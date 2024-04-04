// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  RekognitionClient,
  StartCelebrityRecognitionCommand,
  StartContentModerationCommand,
  StartFaceDetectionCommand,
  StartFaceSearchCommand,
  StartLabelDetectionCommand,
  StartPersonTrackingCommand,
  StartSegmentDetectionCommand,
  StartTextDetectionCommand,
} = require('@aws-sdk/client-rekognition');
const {
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
} = require('../../shared/defs');
const xraysdkHelper = require('../../shared/xraysdkHelper');
const retryStrategyHelper = require('../../shared/retryStrategyHelper');
const {
  M2CException,
} = require('../../shared/error');
const BacklogJob = require('../backlogJob');

class RekognitionBacklogJob extends BacklogJob {
  static get ServiceApis() {
    return {
      StartCelebrityRecognition: 'rekognition:startcelebrityrecognition',
      StartContentModeration: 'rekognition:startcontentmoderation',
      StartFaceDetection: 'rekognition:startfacedetection',
      StartFaceSearch: 'rekognition:startfacesearch',
      StartLabelDetection: 'rekognition:startlabeldetection',
      StartPersonTracking: 'rekognition:startpersontracking',
      StartSegmentDetection: 'rekognition:startsegmentdetection',
      StartTextDetection: 'rekognition:starttextdetection',
    };
  }

  async startCelebrityRecognition(id, params) {
    return this.startAndRegisterJob(
      id,
      RekognitionBacklogJob.ServiceApis.StartCelebrityRecognition,
      params
    );
  }

  async startContentModeration(id, params) {
    return this.startAndRegisterJob(
      id,
      RekognitionBacklogJob.ServiceApis.StartContentModeration,
      params
    );
  }

  async startFaceDetection(id, params) {
    return this.startAndRegisterJob(
      id,
      RekognitionBacklogJob.ServiceApis.StartFaceDetection,
      params
    );
  }

  async startFaceSearch(id, params) {
    return this.startAndRegisterJob(
      id,
      RekognitionBacklogJob.ServiceApis.StartFaceSearch,
      params
    );
  }

  async startLabelDetection(id, params) {
    return this.startAndRegisterJob(
      id,
      RekognitionBacklogJob.ServiceApis.StartLabelDetection,
      params
    );
  }

  async startPersonTracking(id, params) {
    return this.startAndRegisterJob(
      id,
      RekognitionBacklogJob.ServiceApis.StartPersonTracking,
      params
    );
  }

  async startSegmentDetection(id, params) {
    return this.startAndRegisterJob(
      id,
      RekognitionBacklogJob.ServiceApis.StartSegmentDetection,
      params
    );
  }

  async startTextDetection(id, params) {
    return this.startAndRegisterJob(
      id,
      RekognitionBacklogJob.ServiceApis.StartTextDetection,
      params
    );
  }

  static isService(serviceApi) {
    return Object.values(RekognitionBacklogJob.ServiceApis).indexOf(serviceApi) >= 0;
  }

  async startJob(serviceApi, serviceParams) {
    let command;
    if (serviceApi === RekognitionBacklogJob.ServiceApis.StartCelebrityRecognition) {
      command = new StartCelebrityRecognitionCommand(serviceParams);
    } else if (serviceApi === RekognitionBacklogJob.ServiceApis.StartContentModeration) {
      command = new StartContentModerationCommand(serviceParams);
    } else if (serviceApi === RekognitionBacklogJob.ServiceApis.StartFaceDetection) {
      command = new StartFaceDetectionCommand(serviceParams);
    } else if (serviceApi === RekognitionBacklogJob.ServiceApis.StartFaceSearch) {
      command = new StartFaceSearchCommand(serviceParams);
    } else if (serviceApi === RekognitionBacklogJob.ServiceApis.StartLabelDetection) {
      command = new StartLabelDetectionCommand(serviceParams);
    } else if (serviceApi === RekognitionBacklogJob.ServiceApis.StartPersonTracking) {
      command = new StartPersonTrackingCommand(serviceParams);
    } else if (serviceApi === RekognitionBacklogJob.ServiceApis.StartSegmentDetection) {
      command = new StartSegmentDetectionCommand(serviceParams);
    } else if (serviceApi === RekognitionBacklogJob.ServiceApis.StartTextDetection) {
      command = new StartTextDetectionCommand(serviceParams);
    } else {
      console.error(
        'ERR:',
        'RekognitionBacklogJob.startJob:',
        'not supported:',
        serviceApi
      );
      throw new M2CException(`${serviceApi} not supported`);
    }

    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    return rekognitionClient.send(command);
  }

  async startAndRegisterJob(id, serviceApi, params) {
    const serviceParams = {
      ...params,
      ClientRequestToken: id,
      NotificationChannel: this.getServiceTopic(),
    };
    return super.startAndRegisterJob(id, serviceApi, serviceParams);
  }

  // ddb stream
  async fetchAndStartJobs(serviceApi, previousJob) {
    return super.fetchAndStartJobs('rekognition', previousJob);
  }
}

module.exports = RekognitionBacklogJob;
