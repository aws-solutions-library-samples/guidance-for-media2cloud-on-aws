// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const ResourcePrefix = process.env.ENV_RESOURCE_PREFIX;
const CustomUserAgent = process.env.ENV_CUSTOM_USER_AGENT;
const ExpectedBucketOwner = process.env.ENV_EXPECTED_BUCKET_OWNER;

module.exports = {
  EventBridge: {
    Bus: process.env.ENV_BACKLOG_EB_BUS,
    Name: 'StatusChange',
    Source: 'custom.servicebacklog',
    DetailType: 'Service Backlog Status Change',
  },
  DynamoDB: {
    Name: process.env.ENV_BACKLOG_TABLE,
    PartitionKey: 'id',
    SortKey: 'serviceApi',
    GSI: {
      Status: {
        Index: 'gsi-status-timestamp',
        PartitionKey: 'status',
        SortKey: 'timestamp',
      },
      JobId: {
        Index: 'gsi-jobId',
        PartitionKey: 'jobId',
      },
    },
    AtomicLock: {
      Name: process.env.ENV_ATOMICLOCK_TABLE,
      PartitionKey: 'lockId',
    },
  },
  DataAccess: {
    RoleArn: process.env.ENV_DATA_ACCESS_ROLE,
  },
  MediaConvert: {
    Endpoint: process.env.ENV_MEDIACONVERT_HOST,
  },
  Topic: {
    Arn: process.env.ENV_BACKLOG_TOPIC_ARN,
    RoleArn: process.env.ENV_BACKLOG_TOPIC_ROLE_ARN,
  },
  StateMachines: {
    BacklogCustomLabels: `${ResourcePrefix}-backlog-custom-labels`,
    States: {
      CheckProjectVersionStatus: 'check-project-version-status',
      StartProjectVersion: 'start-project-version',
      DetectCustomLabels: 'detect-custom-labels',
    },
  },
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
  S3: {
    ExpectedBucketOwner,
  },
};
