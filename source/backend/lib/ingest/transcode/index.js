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
  Transcoder,
  TranscodeError,
} = require('./transcode');

/**
 * @function startTranscodeJob
 * @description function to create a transcoding job
 * @param {object} event - state machine data
 * @param {object} [context]
 */
exports.startTranscode = async (event, context) => {
  const stateData = new StateIOData({
    Service: 'aws.mediaconvert',
    State: 'transcode',
  });
  let bindIotPublish = null;

  try {
    process.env.ENV_QUIET || console.log(`event = ${JSON.stringify(event, null, 2)}`);
    const {
      Config,
      Data,
      DataInTransit: mediainfo,
    } = event;

    const {
      container: {
        duration: DurationInMs,
      },
    } = mediainfo;

    /* convert JSON into instances */
    const config = new DBConfig(Config);
    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.stateMachine = config.ingestStateMachine;
    stateData.config = config;
    stateData.data = asset;

    const transcoder = new Transcoder(config, asset, mediainfo);
    const jobData = transcoder.createJobTemplate();
    const {
      Job: {
        Id: TranscodeJobId,
      },
    } = await transcoder.submit(jobData);

    stateData.status = 'STARTED';
    stateData.dataInTransit = {
      TranscodeJobId,
      DurationInMs,
      BeginTime: (new Date()).getTime(),
    };

    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(stateData.compact(), null, 2)}`);
    await bindIotPublish(stateData.compact());

    process.env.ENV_QUIET || console.log(`responseData = ${JSON.stringify(stateData.toJSON(), null, 2)}`);
    return stateData.toJSON();
  } catch (e) {
    try {
      if (bindIotPublish) {
        stateData.errorMessage = e;
        await bindIotPublish(stateData.compact());
      }
    } catch (e0) {
      /* do nothing */
    }
    /* IMPORTANT: throw error to stop the state machine */
    process.env.ENV_QUIET || console.error(e);
    throw (e instanceof TranscodeError) ? e : new TranscodeError(e);
  }
};

/**
 * @function getTranscodeStatus
 * @param {object} event - state machine data
 * @param {object} [context]
 */
exports.getTranscodeStatus = async (event, context) => {
  let bindIotPublish = null;
  const stateData = new StateIOData(event);

  try {
    process.env.ENV_QUIET || console.log(`event = ${JSON.stringify(event, null, 2)}`);
    const {
      Config,
      Data,
    } = event;

    /* convert JSON into instances */
    const config = new DBConfig(Config);
    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.config = config;
    stateData.data = asset;

    const {
      DataInTransit: {
        TranscodeJobId,
        DurationInMs,
        BeginTime,
      },
    } = event;

    const transcoder = new Transcoder(config, asset);
    const response = await transcoder.getJob(TranscodeJobId);

    /* normalize Status */
    const {
      Job: {
        Status,
      },
    } = response;
    const status = StateIOData.normalizeStatus(Status);

    if (status === 'FAILED') {
      const {
        Job: {
          ErrorCode,
          ErrorMessage,
        },
      } = response;
      throw new TranscodeError(`${ErrorCode} - ${ErrorMessage}`);
    }

    stateData.status = status;

    if (status === 'IN_PROGRESS') {
      const Tdiff = (new Date()).getTime() - Number.parseInt(BeginTime, 10);
      /* assume transcoding takes 1/2 of the time */
      stateData.progress = Math.floor((Tdiff / (DurationInMs / 2)) * 100);
    } else if (status === 'COMPLETED') {
      /* collect the transcoded outputs */
      const {
        dir,
        name,
      } = Transcoder.sanitizedPath(asset.glacier.videoKey);

      const dstPath = PATH.join(dir, name);
      const Key = `${dstPath}.mp4`;
      const LowresKey = `${dstPath}_lowres.mp4`;
      const AudioKey = `${dstPath}.m4a`;
      const ImageKey = `${dstPath}.0000001.jpg`;
      /* make sure all the output exists */
      const {
        LastModified,
        ContentLength,
        ContentType,
      } = await VideoAsset.headObject(config.proxyBucket, Key);

      const promises = [
        ImageKey,
      ].map(k => VideoAsset.headObject(config.proxyBucket, k));

      await Promise.all(promises);

      stateData.dataInTransit = {
        Proxy: {
          LastModified,
          ContentLength,
          ContentType,
          Key,
          AudioKey,
          ImageKey,
          LowresKey,
        },
      };
    }

    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(stateData.compact(), null, 2)}`);
    await bindIotPublish(stateData.compact());

    process.env.ENV_QUIET || console.log(`responseData = ${JSON.stringify(stateData.toJSON(), null, 2)}`);
    return stateData.toJSON();
  } catch (e) {
    try {
      if (bindIotPublish) {
        stateData.errorMessage = e;
        await bindIotPublish(stateData.compact());
      }
    } catch (e0) {
      /* do nothing */
    }
    /* IMPORTANT: throw error to stop the state machine */
    process.env.ENV_QUIET || console.error(e);
    throw (e instanceof TranscodeError) ? e : new TranscodeError(e);
  }
};
