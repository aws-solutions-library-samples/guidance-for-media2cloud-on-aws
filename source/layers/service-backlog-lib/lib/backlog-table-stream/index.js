// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  unmarshall,
} = require('@aws-sdk/util-dynamodb');

const RekognitionBacklogJob = require('../client/rekognition');
const TranscribeBacklogJob = require('../client/transcribe');
const ComprehendBacklogJob = require('../client/comprehend');
const TextractBacklogJob = require('../client/textract');
const MediaConvertBacklogJob = require('../client/mediaconvert');
const CustomBacklogJob = require('../client/custom');
const {
  M2CException,
} = require('../shared/error');

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
      throw new M2CException('invalid record');
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
    throw new M2CException(`invalid event, ${this.eventName}`);
  }

  async onINSERT() {
    return undefined;
  }

  async onMODIFY() {
    return undefined;
  }

  async onREMOVE() {
    const serviceApi = this.oldImage.serviceApi;
    let instance;
    if (RekognitionBacklogJob.isService(serviceApi)) {
      instance = new RekognitionBacklogJob();
    } else if (TranscribeBacklogJob.isService(serviceApi)) {
      instance = new TranscribeBacklogJob();
    } else if (ComprehendBacklogJob.isService(serviceApi)) {
      instance = new ComprehendBacklogJob();
    } else if (TextractBacklogJob.isService(serviceApi)) {
      instance = new TextractBacklogJob();
    } else if (MediaConvertBacklogJob.isService(serviceApi)) {
      instance = new MediaConvertBacklogJob();
    } else if (CustomBacklogJob.isService(serviceApi)) {
      instance = new CustomBacklogJob();
    }

    if (!instance) {
      return undefined;
    }

    const jobs = await instance.fetchAndStartJobs(serviceApi, this.oldImage);
    console.log(`onREMOVE: ${jobs.started.length}/${jobs.notStarted.length}/${jobs.total} [Started/NotStarted/TotalInQueue]\n${JSON.stringify(jobs, null, 2)}`);
    return jobs;
  }

  unmarshallData() {
    this.keys = unmarshall(this.dynamodb.Keys);
    if (this.dynamodb.OldImage) {
      this.oldImage = unmarshall(this.dynamodb.OldImage);
    }
    if (this.dynamodb.NewImage) {
      this.newImage = unmarshall(this.dynamodb.NewImage);
    }
  }
}

module.exports = BacklogTableStream;
