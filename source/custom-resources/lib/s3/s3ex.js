/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-extraneous-dependencies */
const AWS = require('aws-sdk');

const CRYPTO = require('crypto');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

/**
 * @class S3Notification
 * @description set S3 notification. Currently supports Lambda Notification only.
 */
class S3Notification extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);
    const {
      ResourceProperties = {},
    } = event || {};

    /* sanity check */
    const REQUIRED_PROPERTIES = [
      'ServiceToken',
      'FunctionName',
      // 'Type', /* Lambda | SNS | SQS */
      'Id',
      'Bucket',
      'Prefix',
      'Suffixes',
      'Events',
      'LambdaFunctionArn',
    ];

    const missing = REQUIRED_PROPERTIES.filter(x => ResourceProperties[x] === undefined);
    if (missing.length) {
      throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
    }

    const {
      Type = 'Lambda',
      Id,
      Bucket,
      Prefix,
      Suffixes,
      Events,
      LambdaFunctionArn,
    } = ResourceProperties;

    if (Type !== 'Lambda') {
      throw new Error(`Type ${Type} not supported`);
    }

    /* event Id */
    this.$eventId = Id;
    /* type */
    this.$type = Type;
    /* targeted bucket */
    this.$bucket = Bucket;
    /* lambda to bind to */
    this.$lambdaArn = LambdaFunctionArn;

    /* events */
    let list;
    list = Events.split(',').filter(x => x).map(x => x.trim());
    this.$eventList = Array.from(new Set(list));
    /* trigger prefix */
    this.$prefix = Prefix;
    /* create suffixes */
    list = Suffixes.split(',').filter(x => x).map(x => x.trim().toLowerCase());
    list = list.concat(list.map(x => x.toUpperCase()));
    this.$suffixList = Array.from(new Set(list));
  }

  get eventId() {
    return this.$eventId;
  }

  get type() {
    return this.$type;
  }

  get bucket() {
    return this.$bucket;
  }

  get prefix() {
    return this.$prefix;
  }

  get suffixList() {
    return this.$suffixList;
  }

  get eventList() {
    return this.$eventList;
  }

  get lambdaArn() {
    return this.$lambdaArn;
  }

  createEventIdBySuffix(suffix) {
    return `${this.eventId}${suffix}`.replace(/\./g, '-');
  }

  createFilterRules(suffix) {
    const rules = [{
      Name: 'suffix',
      Value: suffix,
    }];

    if (this.prefix) {
      rules.push({
        Name: 'prefix',
        Value: this.prefix,
      });
    }

    return rules;
  }

  mergeLambdaConfiguration(configuration) {
    /* requested list */
    const requested = this.suffixList.map((x) => {
      return {
        Id: this.createEventIdBySuffix(x),
        LambdaFunctionArn: this.lambdaArn,
        Events: this.eventList,
        Filter: {
          Key: {
            FilterRules: this.createFilterRules(x),
          },
        },
      };
    });

    /* get a list of filtered configuration */
    const filtered = this.filterConfiguration(configuration);

    const merged = filtered.concat(requested);

    return merged;
  }

  mergeSQSConfiguration(configuration) {
    return configuration;
  }

  mergeSNSConfiguration(configuration) {
    return configuration;
  }

  filterConfiguration(configuration) {
    return configuration.filter(x =>
      x.Id.indexOf(this.eventId) < 0);
  }

  async getConfiguration() {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const response = await s3.getBucketNotificationConfiguration({
      Bucket: this.bucket,
    }).promise();

    console.log(`getConfiguration = ${JSON.stringify(response, null, 2)}`);

    return response;
  }

  async putConfiguration(params) {
    console.log(`putConfiguration = ${JSON.stringify(params, null, 2)}`);
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const response = await s3.putBucketNotificationConfiguration(params).promise();

    return response;
  }

  /**
   * @function create
   * @description create trigger
   */
  async create() {
    const response = await this.getConfiguration();

    let {
      LambdaFunctionConfigurations = [],
      QueueConfigurations = [],
      TopicConfigurations = [],
    } = response || {};

    if (this.type === 'Lambda') {
      LambdaFunctionConfigurations = this.mergeLambdaConfiguration(LambdaFunctionConfigurations);
    } else if (this.type === 'SQS') {
      QueueConfigurations = this.mergeSQSConfiguration(QueueConfigurations);
    } else if (this.type === 'SNS') {
      TopicConfigurations = this.mergeSNSConfiguration(TopicConfigurations);
    } else {
      throw new Error(`'${this.type}' event type not supported`);
    }

    const params = {
      Bucket: this.bucket,
      NotificationConfiguration: {},
    };

    if (LambdaFunctionConfigurations.length) {
      params.NotificationConfiguration.LambdaFunctionConfigurations = LambdaFunctionConfigurations;
    }

    if (QueueConfigurations.length) {
      params.NotificationConfiguration.QueueConfigurations = QueueConfigurations;
    }

    if (TopicConfigurations.length) {
      params.NotificationConfiguration.TopicConfigurations = TopicConfigurations;
    }

    await this.putConfiguration(params);

    this.storeResponseData('Prefix', this.prefix);
    this.storeResponseData('Suffixes', this.suffixList.join(','));
    this.storeResponseData('Events', this.eventList.join(','));
    this.storeResponseData('Status', 'SUCCESS');

    return this.responseData;
  }

  /**
   * @function purge
   * @description update configuration by filtering the events created by us
   */
  async purge() {
    const response = await this.getConfiguration();

    let {
      LambdaFunctionConfigurations = [],
      QueueConfigurations = [],
      TopicConfigurations = [],
    } = response || {};

    if (this.type === 'Lambda') {
      LambdaFunctionConfigurations = this.filterConfiguration(LambdaFunctionConfigurations);
    } else if (this.type === 'SQS') {
      QueueConfigurations = this.filterConfiguration(QueueConfigurations);
    } else if (this.type === 'SNS') {
      TopicConfigurations = this.filterConfiguration(TopicConfigurations);
    } else {
      throw new Error(`'${this.type}' event type not supported`);
    }

    const params = {
      Bucket: this.bucket,
      NotificationConfiguration: {},
    };

    if (LambdaFunctionConfigurations.length) {
      params.NotificationConfiguration.LambdaFunctionConfigurations = LambdaFunctionConfigurations;
    }

    if (QueueConfigurations.length) {
      params.NotificationConfiguration.QueueConfigurations = QueueConfigurations;
    }

    if (TopicConfigurations.length) {
      params.NotificationConfiguration.TopicConfigurations = TopicConfigurations;
    }

    await this.putConfiguration(params);

    this.storeResponseData('Status', 'SUCCESS');

    return this.responseData;
  }
}


/**
 * @class S3Cors
 * @description set CORS configuration to S3 bucket
 */
class S3Cors extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);

    const {
      ResourceProperties = {},
    } = event || {};

    /* sanity check */
    const REQUIRED_PROPERTIES = [
      'ServiceToken',
      'FunctionName',
      'Bucket',
      'AllowedOrigins',
      'AllowedMethods',
      'AllowedHeaders',
      'ExposeHeaders',
      'MaxAgeSeconds',
    ];

    const missing = REQUIRED_PROPERTIES.filter(x => ResourceProperties[x] === undefined);
    if (missing.length) {
      throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
    }

    const {
      Bucket,
      AllowedOrigins,
      AllowedMethods,
      AllowedHeaders,
      ExposeHeaders,
      MaxAgeSeconds,
    } = ResourceProperties;

    this.$bucket = Bucket;
    this.$allowedOrigins = AllowedOrigins.split(',').filter(x => x).map(x => x.trim());
    this.$allowedMethods = AllowedMethods.split(',').filter(x => x).map(x => x.trim());
    this.$allowedHeaders = AllowedHeaders.split(',').filter(x => x).map(x => x.trim());
    this.$exposeHeaders = ExposeHeaders.split(',').filter(x => x).map(x => x.trim());
    this.$maxAgeSeconds = Number.parseInt(MaxAgeSeconds, 10);
  }

  get bucket() {
    return this.$bucket;
  }

  get allowedOrigins() {
    return this.$allowedOrigins;
  }

  get allowedMethods() {
    return this.$allowedMethods;
  }

  get allowedHeaders() {
    return this.$allowedHeaders;
  }

  get exposeHeaders() {
    return this.$exposeHeaders;
  }

  get maxAgeSeconds() {
    return this.$maxAgeSeconds;
  }

  /**
   * @function create
   * @description handle 'Create' and 'Update' events
   */
  async create() {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const params = {
      Bucket: this.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: this.allowedMethods,
            AllowedOrigins: this.allowedOrigins,
            AllowedHeaders: this.allowedHeaders,
            ExposeHeaders: this.exposeHeaders,
            MaxAgeSeconds: this.maxAgeSeconds,
          },
        ],
      },
    };

    const response = await s3.putBucketCors(params).promise();

    console.log(JSON.stringify(response, null, 2));

    this.storeResponseData('Status', 'SUCCESS');

    return this.responseData;
  }

  /**
   * @function purge
   * @description skipping 'Delete' event
   */
  async purge() {
    this.storeResponseData('Status', 'SKIPPED');

    return this.responseData;
  }
}

/**
 * @class S3LifecyclePolicy
 * @description set life cycle policy for a S3 bucket
 */
class S3LifecyclePolicy extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);

    const {
      ResourceProperties = {},
    } = event || {};

    /* sanity check */
    const REQUIRED_PROPERTIES = [
      'ServiceToken',
      'FunctionName',
      'Bucket',
      'TagName',
      'TagValue',
      'TagId',
      'Prefix',
      'TransitionInDays',
      'StorageClass',
    ];

    const missing = REQUIRED_PROPERTIES.filter(x => ResourceProperties[x] === undefined);

    if (missing.length) {
      throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
    }

    const {
      Bucket,
      TagName,
      TagValue,
      TagId,
      Prefix,
      TransitionInDays,
      StorageClass,
    } = ResourceProperties;

    this.$bucket = Bucket;
    this.$tagName = TagName.trim();
    this.$tagValue = TagValue.trim();
    this.$tagId = TagId.trim();
    this.$prefix = Prefix.trim();
    this.$transitionInDays = Number.parseInt(TransitionInDays, 10);
    this.$storageClass = StorageClass;
  }

  get bucket() {
    return this.$bucket;
  }

  get tagName() {
    return this.$tagName;
  }

  get tagValue() {
    return this.$tagValue;
  }

  get tagId() {
    return this.$tagId;
  }

  get prefix() {
    return this.$prefix;
  }

  get transitionInDays() {
    return this.$transitionInDays;
  }

  get storageClass() {
    return this.$storageClass;
  }

  async create() {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const params = {
      Bucket: this.bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: this.tagId,
            Status: 'Enabled',
            Prefix: this.prefix.length ? this.prefix : undefined,
            Filter: {
              Tag: {
                Key: this.tagName,
                Value: this.tagValue,
              },
            },
            NoncurrentVersionTransitions: [{
              NoncurrentDays: 0,
              StorageClass: this.storageClass,
            }],
            Transitions: [{
              Days: this.transitionInDays,
              StorageClass: this.storageClass,
            }],
          },
        ],
      },
    };

    const response = await s3.putBucketLifecycleConfiguration(params).promise();

    console.log(JSON.stringify(response, null, 2));

    this.storeResponseData('Status', 'SUCCESS');

    return this.responseData;
  }

  async purge() {
    this.storeResponseData('Status', 'SKIPPED');

    return this.responseData;
  }
}

const BUCKET_FOUND = 'Found'; /* bucket exists and you are owner of the bucket */
const BUCKET_NOTFOUND = 'NoSuchBucket'; /* bucket doesn't exists */
const BUCKET_DENIED = 'AccessDenied'; /* indicate you are not the bucket's owner */

/**
 * @class S3BucketAvailibility
 * @description check bucket availability
 */
class S3BucketAvailibility extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);

    const {
      ResourceProperties = {},
    } = event || {};

    /* sanity check */
    const REQUIRED_PROPERTIES = [
      'ServiceToken',
      'FunctionName',
      'CreateBucket',
      'Bucket',
    ];

    const missing = REQUIRED_PROPERTIES.filter(x => ResourceProperties[x] === undefined);

    if (missing.length) {
      throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
    }

    const {
      Bucket,
      CreateBucket = '',
    } = ResourceProperties;

    this.$bucket = Bucket;
    this.$createBucket = (CreateBucket.toUpperCase() === 'YES');
  }

  get bucket() {
    return this.$bucket;
  }

  get createBucket() {
    return this.$createBucket;
  }

  /**
   * @function pause - execution for specified duration
   * @param {number} duration - in milliseconds
   */
  async pause(duration = 0) {
    return new Promise(resolve =>
      setTimeout(() => resolve(), duration));
  }

  /**
   * @function getCompatibleBucketName
   * @description try to find a compatible bucket name that is available.
   * Perform sanity check on bucket name,
   * https://docs.aws.amazon.com/AmazonS3/latest/dev/BucketRestrictions.html
   */
  async getCompatibleBucketName() {
    /* convert to lowercase, replace anything that is not a-z, 0-9, '-', and '.' to '-' */
    /* trim repeating '-' characters */
    let basename = this.bucket.toLowerCase()
      .replace(/[^a-z0-9-.]/g, '-')
      .replace(/-+/g, '-');

    /* bucket name must start with a lowercase or number */
    if (basename[0].match(/[^a-z0-9]/)) {
      basename = `0${basename}`;
    }

    /* bucket name must end with a lowercase or number */
    if (basename[basename.length - 1].match(/[^a-z0-9]/)) {
      basename = `${basename}0`;
    }

    let tries = 0;
    const maxTries = 10;
    let response;
    let bucket = basename;

    do {
      /* make sure bucket name < 63 characters */
      bucket = bucket.substr(0, 63);

      response = await this.probe(bucket);

      if (response.status === BUCKET_NOTFOUND) {
        break;
      }

      await this.pause(200);
      /* try randomly generated suffix */
      bucket = `${basename}-${CRYPTO.randomBytes(8).toString('hex')}`;
    } while (tries++ < maxTries);

    if (response.status !== BUCKET_NOTFOUND) {
      throw new Error(`failed to generate an unique bucket name for '${this.bucket}'`);
    }

    return bucket;
  }

  /**
   * @function probe
   * @description check if bucket exists. If it does, also checks its region.
   */
  async probe(bucket) {
    try {
      const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
      });

      const {
        LocationConstraint,
      } = await s3.getBucketLocation({
        Bucket: bucket || this.bucket,
      }).promise();

      return {
        status: BUCKET_FOUND,
        /* LocationConstraint could be 'null' if region is us-east-1 */
        location: LocationConstraint || 'us-east-1',
      };
    } catch (e) {
      return {
        status: e.code,
        error: e,
      };
    }
  }

  /**
   * @function create
   * @description check bucket availability based on 'CreateBucket' flag and 'Bucket' parameter.
   * If CreateBucket is 'NO' and bucket doesn't exist, fails it.
   * If CreateBucket is 'NO' and bucket exists but not an owner, fails it.
   * If CreateBucket is 'NO' and bucket exists but in wrong region, fails it.
   * If CreateBucket is 'YES' but bucket name is taken, recommends a new name.
   * If CreateBucket is 'YES' and bucket name is available, return ok.
   */
  async create() {
    const response = await this.probe();

    console.log(JSON.stringify(response, null, 2));

    this.storeResponseData('RequestedBucketName', this.bucket);

    if (!this.createBucket) {
      if (response.status !== BUCKET_FOUND) {
        throw new Error(`failed to validate '${this.bucket}' bucket, status = ${response.status}`);
      }

      if (response.location !== process.env.AWS_REGION) {
        throw new Error(`'${this.bucket}' bucket is in different region, '${response.location}'`);
      }
      this.storeResponseData('SuggestedBucketName', this.bucket);
    } else {
      const bucket = await this.getCompatibleBucketName();
      this.storeResponseData('SuggestedBucketName', bucket);
    }

    this.storeResponseData('Status', 'SUCCESS');

    return this.responseData;
  }

  async purge() {
    this.storeResponseData('Status', 'SKIPPED');

    return this.responseData;
  }
}


module.exports = {
  S3Notification,
  S3Cors,
  S3LifecyclePolicy,
  S3BucketAvailibility,
};
