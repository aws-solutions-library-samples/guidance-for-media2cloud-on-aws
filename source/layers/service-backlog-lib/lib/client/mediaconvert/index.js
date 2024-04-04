// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  MediaConvertClient,
  CreateJobCommand,
} = require('@aws-sdk/client-mediaconvert');
const {
  MediaConvert,
  DataAccess,
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

class MediaConvertBacklogJob extends BacklogJob {
  static get ServiceApis() {
    return {
      CreateJob: 'mediaconvert:createjob',
    };
  }

  async createJob(id, params) {
    return this.startAndRegisterJob(
      id,
      MediaConvertBacklogJob.ServiceApis.CreateJob,
      params
    );
  }

  static isService(serviceApi) {
    return Object.values(MediaConvertBacklogJob.ServiceApis).indexOf(serviceApi) >= 0;
  }

  async startJob(serviceApi, serviceParams) {
    if (!MediaConvert.Endpoint || !DataAccess.RoleArn) {
      throw new M2CException('invalid MediaConvert endpoint or data access role');
    }

    let command;
    if (serviceApi === MediaConvertBacklogJob.ServiceApis.CreateJob) {
      command = new CreateJobCommand(serviceParams);
    } else {
      console.error(
        'ERR:',
        'MediaConvertBacklogJob.startJob:',
        'CreateJobCommand:',
        'not supported',
        serviceApi
      );
      throw new M2CException(`${serviceApi} not supported`);
    }

    const mediaconvertClient = xraysdkHelper(new MediaConvertClient({
      customUserAgent: CustomUserAgent,
      endpoint: MediaConvert.Endpoint,
      retryStrategy: retryStrategyHelper(),
    }));

    return mediaconvertClient.send(command);
  }

  async startAndRegisterJob(id, serviceApi, params) {
    const serviceParams = {
      ...params,
      /* merge user metadata */
      UserMetadata: {
        ...params.UserMetadata,
        backlogId: id,
      },
      ClientRequestToken: id,
      Role: DataAccess.RoleArn,
    };
    return super.startAndRegisterJob(id, serviceApi, serviceParams);
  }

  noMoreQuotasException(name) {
    return (
      (name === 'TooManyRequestsException') ||
      (name === 'LimitExceededException')
    );
  }

  parseJobId(data) {
    return data.Job.Id;
  }
}

module.exports = MediaConvertBacklogJob;
