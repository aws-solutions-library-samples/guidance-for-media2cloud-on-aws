// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const Solution = require('./solution');

const ResourcePrefix = process.env.ENV_RESOURCE_PREFIX;

module.exports = {
  Solution: {
    Id: Solution.Id,
    Name: Solution.Name,
    Version: Solution.Version,
    Metrics: {
      Uuid: process.env.ENV_SOLUTION_UUID,
      AnonymousUsage: (process.env.ENV_ANONYMOUS_USAGE || '').toUpperCase() === 'YES',
      CustomUserAgent: process.env.ENV_CUSTOM_USER_AGENT
        || `AWSSOLUTION/${Solution.Id}/${Solution.Version}`,
    },
  },
  StateMachines: {
    Main: `${ResourcePrefix}-main`,
    Ingest: `${ResourcePrefix}-ingest-main`,
    FixityIngest: `${ResourcePrefix}-ingest-fixity`,
    AudioIngest: `${ResourcePrefix}-ingest-audio`,
    VideoIngest: `${ResourcePrefix}-ingest-video`,
    ImageIngest: `${ResourcePrefix}-ingest-image`,
    DocumentIngest: `${ResourcePrefix}-ingest-document`,
    Analysis: `${ResourcePrefix}-analysis-main`,
    AudioAnalysis: `${ResourcePrefix}-analysis-audio`,
    VideoAnalysis: `${ResourcePrefix}-analysis-video`,
    ImageAnalysis: `${ResourcePrefix}-analysis-image`,
    DocumentAnalysis: `${ResourcePrefix}-analysis-document`,
    DynamicFrameSegmentation: `${ResourcePrefix}-dynamic-frame-segmentation`,
    VideoBasedDetection: `${ResourcePrefix}-videobased-detection`,
    FrameBasedDetection: `${ResourcePrefix}-framebased-detection`,
    CustomModelDetection: `${ResourcePrefix}-custom-model-detection`,
    BacklogCustomLabel: `${ResourcePrefix}-backlog-custom-labels`,
    UpdateFaceIndexer: `${ResourcePrefix}-update-face-indexer`,
    AnalysisPostProcess: `${ResourcePrefix}-analysis-post-process`,
    GraphIndexer: `${ResourcePrefix}-graph-indexer`,
    AssetRemoval: `${ResourcePrefix}-asset-removal`,
    Shoppable: `${ResourcePrefix}-shoppable`,
    FaceApiModel: `${ResourcePrefix}-faceapi-model`,
  },
  DynamoDB: {
    Ingest: {
      Table: `${ResourcePrefix}-ingest`,
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
      Table: `${ResourcePrefix}-aiml`,
      PartitionKey: 'uuid',
      SortKey: 'type',
    },
    ServiceToken: {
      Table: `${ResourcePrefix}-service-token`,
      PartitionKey: 'uuid',
      SortKey: 'keyword',
    },
    FaceIndexer: {
      Table: `${ResourcePrefix}-faceindexer`,
      PartitionKey: 'faceId',
      GSI: {
        FaceId: {
          Name: 'gsi-faceid-timestamp',
          Key: 'faceId',
        },
        Celeb: {
          Name: 'gsi-celeb-timestamp',
          Key: 'celeb',
        },
      },
    },
    Shoppable: {
      Table: `${ResourcePrefix}-shoppable`,
      PartitionKey: 'uuid',
    },
  },
  Iot: {
    Host: process.env.ENV_IOT_HOST,
    Topic: process.env.ENV_IOT_TOPIC,
    PolicyName: process.env.ENV_IOT_THING_POLICY_NAME,
  },
  MediaConvert: {
    Host: process.env.ENV_MEDIACONVERT_HOST,
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
    MinConfidence: Number(process.env.ENV_DEFAULT_MINCONFIDENCE || 80),
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
    DomainEndpoint: process.env.ENV_ES_DOMAIN_ENDPOINT,
    UseOpenSearchServerless: (Number(process.env.ENV_USE_OPENSEARCH_SERVERLESS || 0) > 0),
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
  S3: {
    ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
  },
  Cognito: {
    UserPoolId: process.env.ENV_USER_POOL_ID,
  },
};
