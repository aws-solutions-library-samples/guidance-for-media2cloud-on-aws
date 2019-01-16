/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-unused-vars */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const URL = require('url');
const PATH = require('path');
const HTTPS = require('https');

const {
  DBConfig,
  VideoAsset,
  IotStatus,
  StateIOData,
} = require('../../common');

const {
  sigV4Client,
} = require('../../shared/signer');


/**
 * @class IngestError
 */
class IngestError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, IngestError);
  }
}

/**
 * @function authHttpCmd
 * @description authHttpCmd request to API Gateway to start state machine
 * @param {URL} url
 * @param {object} content
 */
async function authHttpCmd(url, content) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(content);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };

    const signParams = {
      accessKey: process.env.AWS_ACCESS_KEY_ID,
      secretKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
      region: process.env.AWS_REGION,
      serviceName: 'execute-api',
      endpoint: url.format(),
    };

    const signer = sigV4Client.newClient(signParams);
    const method = 'POST';
    const signed = signer.signRequest({
      method,
      path: '',
      headers,
      queryParams: undefined,
      body,
    });

    const {
      protocol,
      hostname,
      pathname: path,
    } = url;

    const options = {
      method: 'POST',
      protocol,
      hostname,
      path,
      headers: signed.headers,
    };
    process.env.ENV_QUIET || console.log(`options: ${JSON.stringify(options, null, 2)}`);

    const buffers = [];
    const request = HTTPS.request(options, (response) => {
      response.on('data', (chunk) => {
        buffers.push(chunk);
      });
      response.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
    request.on('error', (e) => {
      const err = new IngestError(e);
      reject(err);
    });
    request.write(body);
    request.end();
  });
}

/**
 * @function onMediaFileArrival
 * @description check metadata field. If x-amz-metadata-web-upload is missing,
 * create and upload a JSON archive definition file.
 * @param {object} event - s3:OBJECTCREATED event
 * @param {object} [context]
 */
exports.onMediaFileArrival = async (event, context) => {
  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));

    const {
      Records: [{
        s3: {
          bucket: {
            name: Bucket,
          },
          object: {
            key,
          },
        },
      }],
    } = event;

    /* skip if is folder */
    if (key.substr(-1) === '/') {
      return;
    }

    /* if x-amz-web-upload is present, it is uploaded by web ui. */
    /* skip the creation of JSON definition file */
    const Key = VideoAsset.unescapeS3Character(key);
    const {
      ETag,
      Metadata,
    } = await VideoAsset.headObject(Bucket, Key);

    if (Metadata['web-upload']) {
      process.env.ENV_QUIET || console.log(`${Key} uploaded from web UI. nothing to do`);
      return;
    }

    /* create archive definition file */
    /* check if ETag is equal to MD5 of the entire file or not */
    if (ETag.indexOf('-') < 0) {
      Metadata.md5 = Metadata.md5 || Buffer.from(ETag.match(/([0-9a-fA-F]{32})/)[1], 'hex').toString('base64');
    }
    const document = await VideoAsset.createDIVADocument({
      Bucket,
      Key,
      Metadata,
    });

    /* upload the JSON file back to bucket */
    /* this triggers the ingest workflow */
    const {
      dir,
      name,
    } = PATH.parse(Key);

    const params = {
      Bucket,
      Key: PATH.join(dir, `${name}.json`),
      Body: JSON.stringify(document, null, 2),
      ContentType: 'application/json',
      ContentDisposition: 'attachment',
    };
    const response = await VideoAsset.upload(params);
    process.env.ENV_QUIET || console.log(`response = ${JSON.stringify(response, null, 2)}`);
  } catch (e) {
    process.env.ENV_QUIET || console.error(e);
  }
};

/**
 * @function onGlacierObjectCreated
 * @description call API Gateway to start the state machine. Expect JSON archive definition file.
 * @param {object} event - s3:OBJECTCREATED event
 * @param {object} [context]
 */
exports.onGlacierObjectCreated = async (event, context) => {
  const stateData = new StateIOData({
    State: 's3',
    Status: 'OBJECTCREATED',
    Progress: 100,
  });
  let bindIotPublish = null;

  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));
    const {
      Records: [{
        s3: {
          bucket: {
            name: Bucket,
          },
          object: {
            key,
          },
        },
      }],
    } = event;

    /* skip if is folder */
    if (key.substr(-1) === '/') {
      return;
    }

    /* load configuratin from dynamodb */
    const Table = process.env.ENV_CONFIGURATION_TALBE;
    const PartitionKey = process.env.ENV_CONFIGURATION_PARTITION_KEY;
    const ItemName = process.env.ENV_CONFIGURATION_ITEM_NAME;

    const config = await DBConfig.loadFromDB(Table, PartitionKey, ItemName);
    stateData.stateMachine = config.ingestStateMachine;

    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);
    stateData.config = config;

    const Key = VideoAsset.unescapeS3Character(key);
    const asset = await VideoAsset.createFromDIVA(Bucket, Key);

    stateData.data = asset;
    await asset.updateDB(config.assetTable, config.assetPartitionKey);

    const fullData = stateData.toJSON();
    process.env.ENV_QUIET || console.log(`send = ${JSON.stringify(fullData, null, 2)}`);

    /* call API Gateway to start state machine */
    const endpoint = URL.parse(`${config.apiGatewayEndpoint}/${config.ingestStateMachine}`);
    const promiseApi = authHttpCmd(endpoint, fullData);

    /* send message to IoT */
    const compactData = stateData.compact();

    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(compactData, null, 2)}`);
    const promiseIot = bindIotPublish(compactData);

    await Promise.all([promiseApi, promiseIot]);
  } catch (e) {
    try {
      if (bindIotPublish) {
        stateData.errorMessage = e;
        await bindIotPublish(stateData.compact());
      }
    } catch (e0) {
      /* do nothing */
    }
    process.env.ENV_QUIET || console.error(e);
  }
};
