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
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
const AWS = require('aws-sdk');

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

  /* eslint-disable class-methods-use-this */
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
  /* eslint-enable class-methods-use-this */

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
    } = ResourceProperties;

    this.$bucket = Bucket;
    this.$tagName = TagName.trim();
    this.$tagValue = TagValue.trim();
    this.$tagId = TagId.trim();
    this.$prefix = Prefix.trim();
    this.$transitionInDays = Number.parseInt(TransitionInDays, 10);
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
              StorageClass: 'GLACIER',
            }],
            Transitions: [{
              Days: this.transitionInDays,
              StorageClass: 'GLACIER',
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


module.exports = {
  S3Notification,
  S3Cors,
  S3LifecyclePolicy,
};
