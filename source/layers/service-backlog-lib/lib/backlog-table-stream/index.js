// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    console.log('aws-xray-sdk not loaded');
    return require('aws-sdk');
  }
})();
const RekognitionBacklogJob = require('../client/rekognition');
const TranscribeBacklogJob = require('../client/transcribe');
const ComprehendBacklogJob = require('../client/comprehend');
const TextractBacklogJob = require('../client/textract');
const MediaConvertBacklogJob = require('../client/mediaconvert');
const CustomBacklogJob = require('../client/custom');

const EVENT_SOURCE = 'aws:dynamodb';
const EVENT_INSERT = 'INSERT';
const EVENT_REMOVE = 'REMOVE';
const EVENT_MODIFY = 'MODIFY';

class BacklogTableStream {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;
    this.$keys = undefined;
    this.$oldImage = undefined;
    this.$newImage = undefined;
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get eventName() {
    this.sanityCheck();
    return this.event.Records[0].eventName;
  }

  get dynamodb() {
    return this.event.Records[0].dynamodb;
  }

  get keys() {
    return this.$keys;
  }

  set keys(val) {
    this.$keys = val;
  }

  get oldImage() {
    return this.$oldImage;
  }

  set oldImage(val) {
    this.$oldImage = val;
  }

  get newImage() {
    return this.$newImage;
  }

  set newImage(val) {
    this.$newImage = val;
  }

  sanityCheck() {
    const record = ((this.event || {}).Records || [])[0] || {};
    if (!record.dynamodb || record.eventSource !== EVENT_SOURCE) {
      throw new Error('invalid record');
    }
  }

  async process() {
    this.unmarshallData();
    if (this.eventName === EVENT_INSERT) {
      return this.onINSERT();
    }
    if (this.eventName === EVENT_REMOVE) {
      return this.onREMOVE();
    }
    if (this.eventName === EVENT_MODIFY) {
      return this.onMODIFY();
    }
    throw new Error(`invalid event, ${this.eventName}`);
  }

  async onINSERT() {
    return undefined;
  }

  async onMODIFY() {
    return undefined;
  }

  async onREMOVE() {
    const serviceApi = this.oldImage.serviceApi;
    const instance = RekognitionBacklogJob.isService(serviceApi)
      ? new RekognitionBacklogJob()
      : TranscribeBacklogJob.isService(serviceApi)
        ? new TranscribeBacklogJob()
        : ComprehendBacklogJob.isService(serviceApi)
          ? new ComprehendBacklogJob()
          : TextractBacklogJob.isService(serviceApi)
            ? new TextractBacklogJob()
            : MediaConvertBacklogJob.isService(serviceApi)
              ? new MediaConvertBacklogJob()
              : CustomBacklogJob.isService(serviceApi)
                ? new CustomBacklogJob()
                : undefined;
    if (!instance) {
      return undefined;
    }
    const jobs = await instance.fetchAndStartJobs(serviceApi, this.oldImage);
    console.log(`onREMOVE: ${jobs.started.length}/${jobs.notStarted.length}/${jobs.total} [Started/NotStarted/TotalInQueue]\n${JSON.stringify(jobs, null, 2)}`);
    return jobs;
  }

  unmarshallData() {
    this.keys = AWS.DynamoDB.Converter.unmarshall(this.dynamodb.Keys);
    if (this.dynamodb.OldImage) {
      this.oldImage = AWS.DynamoDB.Converter.unmarshall(this.dynamodb.OldImage);
    }
    if (this.dynamodb.NewImage) {
      this.newImage = AWS.DynamoDB.Converter.unmarshall(this.dynamodb.NewImage);
    }
  }
}

module.exports = BacklogTableStream;
