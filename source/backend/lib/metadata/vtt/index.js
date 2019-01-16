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
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-unused-vars */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const PATH = require('path');

const {
  VideoAsset,
  DBConfig,
  IotStatus,
  StateIOData,
} = require('../../common');

const {
  BaseVttTrack,
  MetadataTrackFactory,
} = require('./webvttTrack');

const {
  mxCommonUtils,
} = require('../../shared/mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

/**
 * @class WebVttError
 */
class WebVttError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, WebVttError);
  }
}

/**
 * @function createWebVttTracks
 * @description function to create webvtt tracks from AI result json files
 */
exports.createWebVttTracks = async (event, context) => {
  let bindIotPublish = null;
  const stateData = new StateIOData(event);

  /* eslint-disable no-unused-vars */
  /* eslint-disable no-param-reassign */

  /**
   * @function onStarted
   * @description prepare a list of tracks that will be processed
   * @param {DBConfig} config
   * @param {VideoAsset} asset
   */
  async function onStarted(config, asset) {
    stateData.stateMachine = config.metadataStateMachine;
    stateData.service = 'aws.states';
    stateData.state = 'webvtt';
    stateData.status = 'IN_PROGRESS';
    stateData.progress = 1;
    stateData.dataInTransit = {
      TrackList: [
        'celebs',
        'persons',
        'faces',
        'face_matches',
        'labels',
        'transcript',
        'entities',
        'phrases',
      ],
    };
  }

  /**
   * @function onCompleted
   * @description when there is no more item in TrackList
   * @param {DBConfig} config
   * @param {VideoAsset} asset
   */
  async function onCompleted(config, asset) {
    const { DataInTransit: { AnalyticsBucket, AnalyticsPrefix } } = event;
    /* also copy mediainfo json file to AnalyticsBucket */
    /* eslint-disable prefer-destructuring */
    const mediainfo =
      await asset.fetchMediainfo(config.mediainfoTable, config.mediainfoPartitionKey);

    const params = {
      Bucket: AnalyticsBucket,
      Key: PATH.join(AnalyticsPrefix, 'mediainfo.json'),
      Body: JSON.stringify(mediainfo, null, 2),
      ContentType: 'application/json',
      ContentDisposition: 'attachment',
    };

    await BaseVttTrack.upload(params);
    /* eslint-enable prefer-destructuring */

    /* update database now */
    await asset.updateDB(config.assetTable, config.assetPartitionKey);

    stateData.status = 'COMPLETED';
  }

  /**
   * @function inProgress
   * @description pop from TrackList and process the category one at a time
   * @param {DBConfig} config
   * @param {VideoAsset} asset
   */
  async function inProgress(config, asset) {
    const {
      AnalyticsBucket,
      AnalyticsPrefix,
    } = stateData.dataInTransit;

    const kind = stateData.dataInTransit.TrackList.splice(0, 1).pop();

    /* fetch all the results */
    const Contents = await X.listObjects(AnalyticsBucket, PATH.join(AnalyticsPrefix, kind));

    const Keys = Contents.map(x => x.Key);
    process.env.ENV_QUIET || console.log(`Keys = ${JSON.stringify(Keys, null, 2)}`);

    /* where to save the webvtt files */
    const {
      dir,
    } = PATH.parse(asset.proxy.key);

    const dstBucket = asset.proxy.bucket;
    const dstPrefix = PATH.join(dir, 'analytics');

    const metadata = {
      Bucket: dstBucket,
    };

    const instance = MetadataTrackFactory.createInstanceByKind(
      kind,
      AnalyticsBucket,
      Keys,
      dstBucket,
      dstPrefix
    );

    const response = await instance.run();

    asset.machineMetadata.reset(kind, response);
    stateData.progress += 10;
  }
  /* eslint-enable no-param-reassign */
  /* eslint-disable no-unused-vars */

  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));

    const {
      Data,
      Config,
    } = event;

    if (!Data || !Config) {
      throw new WebVttError('malformed input data, Data or Config not found');
    }

    const {
      DataInTransit: {
        requester,
        AnalyticsBucket,
        AnalyticsPrefix,
      },
    } = event;

    if (!requester || !AnalyticsBucket || !AnalyticsPrefix) {
      throw new WebVttError('malformed input data, DataInTransit.requester, AnalyticsBucket, or AnalyticsPrefix not found');
    }

    const config = new DBConfig(Config);
    stateData.config = config;

    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.data = asset;

    if (stateData.state === 'analytics') {
      await onStarted(config, asset);
    } else if (stateData.dataInTransit.TrackList.length === 0) {
      await onCompleted(config, asset);
    } else {
      await inProgress(config, asset);
    }

    /* send message to IoT */
    const compactData = stateData.compact();
    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(compactData, null, 2)}`);

    await bindIotPublish(compactData);

    const fullData = stateData.toJSON();
    process.env.ENV_QUIET || console.log(`responseData = ${JSON.stringify(fullData, null, 2)}`);

    return fullData;
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
    throw (e instanceof WebVttError) ? e : new WebVttError(e);
  }
};
