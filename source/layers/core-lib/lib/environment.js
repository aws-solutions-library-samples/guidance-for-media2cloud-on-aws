/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const Solution = require('./solution');

module.exports = {
  Solution: {
    Id: Solution.Id,
    Name: Solution.Name,
    Version: Solution.Version,
    StackName: process.env.ENV_STACKNAME,
    Metrics: {
      Uuid: process.env.ENV_SOLUTION_UUID,
      AnonymousUsage: (process.env.ENV_ANONYMOUS_USAGE || '').toUpperCase() === 'YES',
    },
  },
  StateMachines: {
    Main: `${Solution.Id}-${process.env.ENV_STACKNAME}-main`,
    Ingest: `${Solution.Id}-${process.env.ENV_STACKNAME}-ingest-main`,
    FixityIngest: `${Solution.Id}-${process.env.ENV_STACKNAME}-ingest-fixity`,
    AudioIngest: `${Solution.Id}-${process.env.ENV_STACKNAME}-ingest-audio`,
    VideoIngest: `${Solution.Id}-${process.env.ENV_STACKNAME}-ingest-video`,
    ImageIngest: `${Solution.Id}-${process.env.ENV_STACKNAME}-ingest-image`,
    DocumentIngest: `${Solution.Id}-${process.env.ENV_STACKNAME}-ingest-document`,
    Analysis: `${Solution.Id}-${process.env.ENV_STACKNAME}-analysis-main`,
    AudioAnalysis: `${Solution.Id}-${process.env.ENV_STACKNAME}-analysis-audio`,
    VideoAnalysis: `${Solution.Id}-${process.env.ENV_STACKNAME}-analysis-video`,
    ImageAnalysis: `${Solution.Id}-${process.env.ENV_STACKNAME}-analysis-image`,
    DocumentAnalysis: `${Solution.Id}-${process.env.ENV_STACKNAME}-analysis-document`,
  },
  DynamoDB: {
    Ingest: {
      Table: `${Solution.Id}-${process.env.ENV_STACKNAME}-ingest`,
      PartitionKey: 'uuid',
      GSI: {
        SchemaVersion: {
          Name: 'gsi-schemaversion-timestamp',
          Key: 'schemaVersion',
          Value: 1,
        },
        Type: {
          Name: 'gsi-type-timestamp',
          Key: 'type',
        },
        Group: {
          Name: 'gsi-group-timestamp',
          Key: 'group',
        },
        Status: {
          Name: 'gsi-overallstatus-timestamp',
          Key: 'overallStatus',
        },
        PageSize: 20,
      },
    },
    AIML: {
      Table: `${Solution.Id}-${process.env.ENV_STACKNAME}-aiml`,
      PartitionKey: 'uuid',
      SortKey: 'type',
    },
    ServiceToken: {
      Table: `${Solution.Id}-${process.env.ENV_STACKNAME}-service-token`,
      PartitionKey: 'uuid',
      SortKey: 'keyword',
    },
    Stats: {
      Table: `${Solution.Id}-${process.env.ENV_STACKNAME}-stats`,
      PartitionKey: 'type',
    },
  },
  Iot: {
    Host: process.env.ENV_IOT_HOST,
    Topic: process.env.ENV_IOT_TOPIC,
    PolicyName: process.env.ENV_IOT_THING_POLICY_NAME,
  },
  MediaConvert: {
    Host: process.env.ENV_MEDIACONVERT_HOST,
    Role: process.env.ENV_MEDIACONVERT_ROLE,
  },
  SNS: {
    Topic: process.env.ENV_SNS_TOPIC_ARN,
    Service: {
      TopicArn: process.env.ENV_SERVICE_TOPIC_ARN,
    },
  },
  Ingest: {
    Bucket: process.env.ENV_INGEST_BUCKET,
  },
  Proxy: {
    Bucket: process.env.ENV_PROXY_BUCKET,
  },
  Rekognition: {
    MinConfidence: Number.parseInt(process.env.ENV_DEFAULT_MINCONFIDENCE, 10),
    Notification: {
      RoleArn: process.env.ENV_SERVICE_TOPIC_ROLE_ARN,
    },
  },
  Textract: {
    Notification: {
      RoleArn: process.env.ENV_SERVICE_TOPIC_ROLE_ARN,
    },
  },
  Elasticsearch: {
    IndexName: process.env.ENV_ES_INDEX_NAME,
    DomainEndpoint: process.env.ENV_ES_DOMAIN_ENDPOINT,
  },
  ElasticTranscoder: {
    Pipeline: {
      Id: process.env.ENV_ETS_PIPELINE_ID,
    },
    Audio: {
      Preset: process.env.ENV_ETS_AUDIO_PRESET,
    },
  },
  DataAccess: {
    RoleArn: process.env.ENV_DATA_ACCESS_ROLE,
  },
};
