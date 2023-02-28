// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    console.log('aws-xray-sdk not loaded');
    return require('aws-sdk');
  }
})();
const BacklogJob = require('../backlogJob');
const {
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
} = require('../../shared/defs');

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

  getRekognitionInstance() {
    return new AWS.Rekognition({
      rekognition: '2016-06-27',
      customUserAgent: CustomUserAgent,
    });
  }

  bindToFunc(serviceApi) {
    const rekog = this.getRekognitionInstance();
    switch (serviceApi) {
      case RekognitionBacklogJob.ServiceApis.StartCelebrityRecognition:
        return rekog.startCelebrityRecognition.bind(rekog);
      case RekognitionBacklogJob.ServiceApis.StartContentModeration:
        return rekog.startContentModeration.bind(rekog);
      case RekognitionBacklogJob.ServiceApis.StartFaceDetection:
        return rekog.startFaceDetection.bind(rekog);
      case RekognitionBacklogJob.ServiceApis.StartFaceSearch:
        return rekog.startFaceSearch.bind(rekog);
      case RekognitionBacklogJob.ServiceApis.StartLabelDetection:
        return rekog.startLabelDetection.bind(rekog);
      case RekognitionBacklogJob.ServiceApis.StartPersonTracking:
        return rekog.startPersonTracking.bind(rekog);
      case RekognitionBacklogJob.ServiceApis.StartSegmentDetection:
        return rekog.startSegmentDetection.bind(rekog);
      case RekognitionBacklogJob.ServiceApis.StartTextDetection:
        return rekog.startTextDetection.bind(rekog);
      default:
        return undefined;
    }
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
