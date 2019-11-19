/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/**
 * solution defintion
 */
const Solution = {
  Id: 'SO0050',
  Name: 'media2cloud',
  Version: '2.0.0',
};

/**
 * Environment variables for the workflows
 * Specific to nodejs (backend processes)
 */
const Environment = {
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
    Ingest: `${Solution.Id}-${process.env.ENV_STACKNAME}-ingest`,
    Analysis: `${Solution.Id}-${process.env.ENV_STACKNAME}-analysis`,
    AudioAnalysis: `${Solution.Id}-${process.env.ENV_STACKNAME}-audio-analysis`,
    ImageAnalysis: `${Solution.Id}-${process.env.ENV_STACKNAME}-image-analysis`,
    VideoAnalysis: `${Solution.Id}-${process.env.ENV_STACKNAME}-video-analysis`,
    DocumentAnalysis: `${Solution.Id}-${process.env.ENV_STACKNAME}-document-analysis`,
    GroundTruth: `${Solution.Id}-${process.env.ENV_STACKNAME}-gt-labeling`,
  },
  DynamoDB: {
    Ingest: {
      Table: `${Solution.Id}-${process.env.ENV_STACKNAME}-ingest`,
      PartitionKey: 'uuid',
      GSI: {
        Name: process.env.ENV_GSI_INDEX_NAME,
        Key: 'schemaVersion',
        Value: 1,
        PageSize: 20,
      },
    },
    AIML: {
      Table: `${Solution.Id}-${process.env.ENV_STACKNAME}-aiml`,
      PartitionKey: 'uuid',
      SortKey: 'type',
    },
    IndexedFaces: {
      Table: `${Solution.Id}-${process.env.ENV_STACKNAME}-indexed-faces`,
      PartitionKey: 'name',
      SortKey: 'faceId',
    },
    QueuedFaces: {
      Table: `${Solution.Id}-${process.env.ENV_STACKNAME}-queued-faces`,
      PartitionKey: 'tempId',
    },
    AnalysisQueue: {
      Table: `${Solution.Id}-${process.env.ENV_STACKNAME}-analysis-queue`,
      PartitionKey: 'uuid',
      SortKey: 'keyword',
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
  },
  Ingest: {
    Bucket: process.env.ENV_INGEST_BUCKET,
  },
  Proxy: {
    Bucket: process.env.ENV_PROXY_BUCKET,
  },
  Rekognition: {
    CollectionId: process.env.ENV_DEFAULT_COLLECTION_ID,
    MinConfidence: Number.parseInt(process.env.ENV_DEFAULT_MINCONFIDENCE, 10),
  },
  Transcribe: {
    LanguageCode: process.env.ENV_DEFAULT_LANGUAGE_CODE,
    CustomVocabulary: process.env.ENV_DEFAULT_VOCABULARY,
  },
  Elasticsearch: {
    IndexName: process.env.ENV_ES_INDEX_NAME,
    DomainEndpoint: process.env.ENV_ES_DOMAIN_ENDPOINT,
  },
};

module.exports = {
  Solution,
  Environment,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    Solution,
  });
