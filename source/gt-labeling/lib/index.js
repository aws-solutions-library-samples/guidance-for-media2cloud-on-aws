/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-unresolved */
/* eslint-disable prefer-destructuring */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */

const AWS = require('aws-sdk');
const FS = require('fs');
const URL = require('url');
const PATH = require('path');

const {
  Environment,
  StateData,
  DB,
  FaceCollection,
  CommonUtils,
  SNS,
} = require('m2c-core-lib');

const LOG_GROUP_NAME = '/aws/sagemaker/LabelingJobs';

const JobStatusMapping = {
  InProgress: StateData.Statuses.InProgress,
  Stopping: StateData.Statuses.InProgress,
  Stopped: StateData.Statuses.Completed,
  Completed: StateData.Statuses.Completed,
  Failed: StateData.Statuses.Error,
};

/**
 * @class GroundTruth
 */
class GroundTruthError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, GroundTruthError);
  }
}

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_STACKNAME',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_SNS_TOPIC_ARN',
  'ENV_SAGEMAKER_ROLE_ARN',
  'ENV_GROUNDTRUTH_LAMBDA_ARN',
  'ENV_GROUNDTRUTH_WORKTEAM',
  'ENV_GROUNDTRUTH_TEAM_TOPIC_ARN',
];

/**
 * @class GroundTruth
 * @description wrapper of SageMaker Ground Truth
 */
class GroundTruth {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new GroundTruthError('stateData not StateData object');
    }

    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new GroundTruthError(`missing enviroment variables, ${missing.join(', ')}`);
    }

    this.$stateData = stateData;

    this.$instance = new AWS.SageMaker({
      apiVersion: '2017-07-24',
    });

    this.$dbInstance = new DB({
      Table: Environment.DynamoDB.QueuedFaces.Table,
      PartitionKey: Environment.DynamoDB.QueuedFaces.PartitionKey,
    });
  }

  static get Task() {
    return {
      /* statuses from cloudwatch logs */
      NotStarted: 'NOT_STARTED',
      /* task started */
      Started: 'STARTED',
      /* task created and ready to annotate */
      ReadyToAnnotate: 'READY_TO_ANNOTATE',
      /* worker resposned */
      Responsed: 'RESPONSED',
      /* task completed and start tearing down labeling job request */
      Completed: 'COMPLETED',
      /* task was canceled */
      Canceled: 'CANCELED',
      /* undeterimintistic status */
      Unknown: 'UNKNOWN',
    };
  }

  get [Symbol.toStringTag]() {
    return 'GroundTruth';
  }

  get stateData() {
    return this.$stateData;
  }

  get instance() {
    return this.$instance;
  }

  get db() {
    return this.$dbInstance;
  }

  /**
   * @static
   * @function preLabeling
   * @description pre-process for custom labeling
   */
  static async preLabeling(event) {
    console.log(`preLabeling = ${JSON.stringify(event, null, 2)}`);

    /* pre-process */
    if (!event.dataObject) {
      throw new Error('missing event.dataObject');
    }

    return {
      taskInput: {
        sourceRef: event.dataObject['source-ref'],
      },
    };
  }

  /**
   * @static
   * @function postLabeling
   * @description post-process for custom labeling
   */
  static async postLabeling(event) {
    console.log(`postLabeling = ${JSON.stringify(event, null, 2)}`);

    const {
      labelAttributeName,
    } = event;

    const {
      bucket,
      key,
    } = GroundTruth.parseS3Uri(event.payload.s3Uri);

    const buffer = await CommonUtils.download(bucket, key);

    const annotation = JSON.parse(buffer.toString()).reduce((acc, cur) => {
      acc.push({
        datasetObjectId: cur.datasetObjectId,
        consolidatedAnnotation: {
          content: {
            [labelAttributeName]: {
              workerId: cur.annotations[0].workerId,
              workerAnnotation: JSON.parse(cur.annotations[0].annotationData.content),
              machineAnnotationRecord: cur.dataObject,
            },
          },
        },
      });
      return acc;
    }, []);

    console.log(`postLabeling.annotation: ${JSON.stringify(annotation, null, 2)}`);
    return annotation;
  }

  /**
   * @function createDataset
   * @description create dataset based on queued items
   */
  async createDataset() {
    const response = await this.getQueuedItems();

    if (!response.length) {
      this.stateData.setNoData();
      return this.stateData.toJSON();
    }

    const manifest = response.reduce((acc, cur) =>
      acc.concat(this.addSourceRef(cur)), []);

    const {
      bucket,
      prefix,
    } = GroundTruth.parseS3Uri(response[0].imageUrl);

    const basename = CommonUtils.toISODateTime();

    /* store manifest to S3 */
    await CommonUtils.upload({
      Bucket: bucket,
      Key: PATH.join(prefix, `${basename}.manifest`),
      ContentDisposition: `attachment; filename="${basename}.manifest"`,
      Body: manifest.join('\n'),
    });

    /* store UI liquid template to S3 */
    const template = PATH.join(PATH.dirname(__filename), 'templates/liquid.template');

    await CommonUtils.upload({
      Bucket: bucket,
      Key: PATH.join(prefix, `${basename}.liquid`),
      ContentDisposition: `attachment; filename="${basename}.liquid"`,
      Body: FS.readFileSync(template),
    });

    this.stateData.setData('dataset', {
      manifestUri: `s3://${bucket}/${PATH.join(prefix, `${basename}.manifest`)}`,
      templateUri: `s3://${bucket}/${PATH.join(prefix, `${basename}.liquid`)}`,
      items: response.map(x => x.tempId),
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @function createJob
   * @description create labeling job in ground truth
   */
  async createJob() {
    const request = this.makeJobRequest();
    console.log(`createJob.request = ${JSON.stringify(request, null, 2)}`);

    const {
      LabelingJobArn,
    } = await this.instance.createLabelingJob(request).promise();

    /* update dynamodb status */
    await this.updateQueuedItemsStatus();

    this.stateData.setData('labeling', {
      name: request.LabelingJobName,
      arn: LabelingJobArn,
    });

    return this.stateData.toJSON();
  }

  /**
   * @static
   * @function getQueuedItems
   * @description get queued items that have not been processed
   * @param {string} [uuid]
   */
  async getQueuedItems() {
    return this.db.scan({
      status: {
        ComparisonOperator: 'NULL',
      },
    });
  }

  /**
   * @function updateQueuedItemsStatus
   * @description update queued items' status to in_progress
   */
  async updateQueuedItemsStatus() {
    const data = (this.stateData.input || {}).dataset || {};

    return Promise.all((data.items || []).map(x =>
      this.db.update(x, undefined, {
        status: StateData.Statuses.InProgress,
      })));
  }

  /**
   * @function addSourceRef
   * @description add source reference tem
   * @param {object} item
   */
  addSourceRef(item) {
    return JSON.stringify({
      'source-ref': item.imageUrl,
    });
  }

  /**
   * @static
   * @function parseS3Uri
   * @param {string} url
   */
  static parseS3Uri(url) {
    const {
      hostname,
      pathname,
    } = URL.parse(url);

    const {
      dir,
      base,
      name,
      ext,
    } = PATH.parse(decodeURI(pathname.slice(1)));

    return {
      bucket: hostname,
      prefix: dir,
      key: PATH.join(dir, base),
      base,
      name,
      ext,
    };
  }

  /**
   * @function makeJobRequest
   * @description prepare a labeling job request parameters
   */
  makeJobRequest() {
    const data = (this.stateData.input || {}).dataset || {};
    const uuid = this.stateData.uuid;
    const template = data.templateUri;
    const manifest = data.manifestUri;

    if (!uuid || !template || !manifest) {
      throw new GroundTruthError('missing uuid, dataset.templateUri, or dataset.manifestUri');
    }

    const outputPath = manifest.slice(0, manifest.lastIndexOf('/') + 1);

    return {
      HumanTaskConfig: {
        AnnotationConsolidationConfig: {
          AnnotationConsolidationLambdaArn: process.env.ENV_GROUNDTRUTH_LAMBDA_ARN,
        },
        NumberOfHumanWorkersPerDataObject: 1,
        PreHumanTaskLambdaArn: process.env.ENV_GROUNDTRUTH_LAMBDA_ARN,
        TaskDescription: `Tag faces (${uuid})`,
        TaskTimeLimitInSeconds: 600,
        TaskTitle: `Face tagging (${uuid})`,
        TaskAvailabilityLifetimeInSeconds: 3 * 24 * 3600,
        TaskKeywords: [
          'Face tagging',
        ],
        UiConfig: {
          UiTemplateS3Uri: template,
        },
        WorkteamArn: process.env.ENV_GROUNDTRUTH_WORKTEAM,
        MaxConcurrentTaskCount: 1000,
      },
      InputConfig: {
        DataSource: {
          S3DataSource: {
            ManifestS3Uri: manifest,
          },
        },
      },
      OutputConfig: {
        S3OutputPath: outputPath,
      },
      LabelAttributeName: uuid,
      LabelingJobName: `${uuid}-${CommonUtils.toISODateTime()}`,
      RoleArn: process.env.ENV_SAGEMAKER_ROLE_ARN,
      StoppingConditions: {
        MaxPercentageOfInputDatasetLabeled: 100,
      },
      Tags: [{
        Key: 'SolutionId',
        Value: Environment.Solution.Id,
      }],
    };
  }

  /**
   * @function describeJob
   * @param {number} [maxTries] - max. retry for describeLabelingJob calls
   */
  async describeJob(jobName, maxTries = 4) {
    let tries = 0;
    let response;

    do {
      try {
        response = await this.instance.describeLabelingJob({
          LabelingJobName: jobName,
        }).promise();
      } catch (e) {
        console.error(`error: describeLabelingJob(${jobName})[${tries}]: ${e.message}`);
        await CommonUtils.pause(400);
      }
    } while (tries++ < maxTries && !(response || {}).LabelingJobStatus);

    if (!(response || {}).LabelingJobStatus) {
      throw new GroundTruthError(`failed to describeLabelingJob(${jobName}) after ${tries} tries.`);
    }

    return response;
  }

  /**
   * @function parseTaskStatus
   * @description parse task status from logs in sequence
   * @param {Array} events
   */
  parseTaskStatus(events) {
    if (!events) {
      return GroundTruth.Task.NotStarted;
    }

    const messages = events.map(x =>
      JSON.parse(x.message));

    let result = messages.filter(x =>
      x['event-name'] === 'EXPORTED_LABELED_MANIFEST' || x['event-name'] === 'STOPPING_CONDITION_REACHED');

    if (result.length) {
      return GroundTruth.Task.Completed;
    }

    result = messages.filter(x =>
      x['event-name'] === 'BATCH_ANNOTATION_STATUS_EVALUATED');

    let result2 = result.filter(x =>
      x['event-log-message'].indexOf('COMPLETED') > 0);

    if (result2.length) {
      return GroundTruth.Task.Responsed;
    }

    result2 = result.filter(x =>
      x['event-log-message'].indexOf('STOPPED') > 0);

    if (result2.length) {
      return GroundTruth.Task.Canceled;
    }

    result2 = result.filter(x =>
      x['event-log-message'].indexOf('SUBMITTED') > 0);

    if (result2.length) {
      return GroundTruth.Task.ReadyToAnnotate;
    }

    return GroundTruth.Task.Started;
  }

  /**
   * @function getCloudWatchLogs
   * @description fetch and parse cloudwatch logs.
   * Search for 'BATCH_ANNOTATION_STATUS_EVALUATED' and 'SUBMITTED' or 'COMPLETED'
   * @param {string} jobName
   * @param {number} [maxTries]
   */
  async getCloudWatchLogs(jobName, maxTries = 4) {
    let tries = 0;
    let response;

    const logs = new AWS.CloudWatchLogs({
      apiVersion: '2014-03-28',
    });

    do {
      try {
        response = await logs.getLogEvents({
          logGroupName: LOG_GROUP_NAME,
          logStreamName: jobName,
        }).promise();
      } catch (e) {
        console.error(`error: getLogEvents(${jobName})[${tries}]: ${e.message}`);
        await CommonUtils.pause(400);
      }
    } while (tries++ < maxTries && !(response || {}).events);

    return {
      taskStatus: this.parseTaskStatus((response || {}).events),
    };
  }

  /**
   * @function getTeamMembers
   * @description get team members through Coginto user pool/user group
   * @param {string} userPool
   * @param {string} userGroup
   */
  async getTeamMembers(userPool, userGroup) {
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18',
    });

    let response;
    const users = [];
    do {
      response = await cognito.listUsersInGroup({
        GroupName: userGroup,
        UserPoolId: userPool,
        NextToken: (response || {}).NextToken,
      }).promise();

      users.splice(users.length, 0, ...response.Users);
    } while ((response || {}).NextToken);

    /* filter enabled users and return his/her email address */
    const members = users.filter(x => x.Enabled).map(x =>
      (x.Attributes.find(x0 => x0.Name === 'email') || {}).Value).filter(x => x);

    return members;
  }

  /**
   * @function getWorkteamMembers
   */
  async getWorkteamMembers() {
    const teamName = process.env.ENV_GROUNDTRUTH_WORKTEAM.split('/').filter(x => x).pop();

    const response = await this.instance.describeWorkteam({
      WorkteamName: teamName,
    }).promise();

    const {
      CognitoMemberDefinition: {
        UserPool,
        UserGroup,
      },
    } = response.Workteam.MemberDefinitions.shift();

    const members = await this.getTeamMembers(UserPool, UserGroup);

    return {
      uri: `https://${response.Workteam.SubDomain}`,
      members,
    };
  }

  /**
   * @function checkLabelingStatus
   * @description check labeling job status by
   * * checking ground truth labeling job name and
   * * poll and parse cloudwatch logs for task status
   */
  async checkLabelingStatus() {
    const labeling = (this.stateData.input || {}).labeling || {};

    if (!labeling.name) {
      throw new GroundTruthError('missing labeling.name');
    }

    const [
      jobResponse,
      logResponse = {},
    ] = await Promise.all([
      this.describeJob(labeling.name),
      this.getCloudWatchLogs(labeling.name),
    ]);

    switch (JobStatusMapping[jobResponse.LabelingJobStatus]) {
      case StateData.Statuses.InProgress:
        this.stateData.setProgress(this.stateData.progress + 2);
        break;
      case StateData.Statuses.Completed:
        this.stateData.setCompleted();
        break;
      case StateData.Statuses.Error:
        throw new GroundTruthError(`(${labeling.name}) ${jobResponse.FailureReason}`);
      default:
        throw new GroundTruthError(`(${labeling.name}) invalid status, ${jobResponse.LabelingJobStatus}`);
    }

    this.stateData.setData('labeling', {
      outputUri: (jobResponse.LabelingJobOutput || {}).OutputDatasetS3Uri,
      taskStatus: logResponse.taskStatus || GroundTruth.Task.Unknown,
    });

    /* special handling: if task is canceled, throw an error to stop the state machine */
    if (logResponse.taskStatus === GroundTruth.Task.Canceled) {
      throw new GroundTruthError(`(${labeling.name}) task was canceled`);
    }

    return this.stateData.toJSON();
  }

  /**
   * @function downloadOutputDataset
   * @description download and parse output dataset from s3
   */
  async downloadOutputDataset() {
    const labeling = (this.stateData.input || {}).labeling || {};

    if (!labeling.outputUri) {
      throw new GroundTruthError('missing labeling.outputUri');
    }

    const {
      bucket,
      key,
    } = GroundTruth.parseS3Uri(labeling.outputUri);

    const buffer = await CommonUtils.download(bucket, key);

    const dataset = buffer.toString().split('\n')
      .filter(x => x).reduce((acc, cur) =>
        acc.concat(JSON.parse(cur)), []);

    return dataset;
  }

  /**
   * @function processEach
   * @description process each annotation result by
   * * fetch record from queued database
   * * index face to Rekognition collection
   * * purge record on queued database
   * @param {object} data - expect annotation data
   */
  async processEach(data) {
    const {
      name: tempId,
    } = GroundTruth.parseS3Uri(data['source-ref']);

    const guid = this.stateData.uuid;

    const {
      workerId,
      workerAnnotation: {
        firstName,
        lastName,
      },
    } = data[guid];

    const record = await this.db.fetch(tempId);

    record.name = `${firstName} ${lastName}`;
    record.workerId = workerId;

    const collection = new FaceCollection(record.collectionId, record);
    const responses = await collection.indexNow();

    await FaceCollection.purgeQueuedFace(tempId);

    return responses.shift();
  }

  /**
   * @function indexResults
   * @description batch process output dataset by indexing faces to collection
   */
  async indexResults() {
    const dataset = await this.downloadOutputDataset();

    const responses = await Promise.all(dataset.map(x =>
      this.processEach(x)));

    this.stateData.setData('labeling', {
      faceIds: responses.map(x => x.faceId),
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @async
   * @function onCompleted
   * @description on completed, send sns notification
   */
  async onCompleted() {
    return SNS.send(`labeling: ${this.stateData.uuid}`, this.stateData.toJSON()).catch(() => false);
  }
}

module.exports = {
  GroundTruth,
};
