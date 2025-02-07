// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  S3Client,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  RekognitionClient,
  CreateCollectionCommand,
} = require('@aws-sdk/client-rekognition');
const MIME = require('mime');
const {
  aimlGetPresets,
  ApiOps,
  StateData: {
    Statuses,
  },
  FrameCaptureMode,
  AnalysisTypes,
  GraphDefs,
  FaceIndexerDefs,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;
const EXPECTED_BUCKET_OWNER = process.env.ENV_EXPECTED_BUCKET_OWNER;
const JS_SOLUTION_MANIFEST = 'solution-manifest.js';

// validating ResourceProperties.Data input
const REQUIRED_FIELDS = [
  'Region',
  'CustomUserAgent',
  'SolutionId',
  'Version',
  'StackName',
  'LastUpdated',
  'Web',
  'Cognito',
  'S3',
  'StateMachines',
  'ApiEndpoint',
  'IotHost',
  'IotTopic',
  'Ingest',
  'Proxy',
  'AIML',
];
const REQUIRED_SUBFIELDS = [
  {
    name: 'Web',
    fields: ['Bucket'],
  },
  {
    name: 'Cognito',
    fields: ['UserPoolId', 'ClientId', 'IdentityPoolId', 'RedirectUri'],
  },
  {
    name: 'S3',
    fields: ['UseAccelerateEndpoint'],
  },
  {
    name: 'StateMachines',
    fields: ['Ingest', 'Analysis'],
  },
  {
    name: 'Ingest',
    fields: ['Bucket'],
  },
  {
    name: 'Proxy',
    fields: ['Bucket'],
  },
  {
    name: 'AIML',
    fields: ['Detections', 'MinConfidence'],
  },
];

/**
 * @class SolutionManifest
 * @description create solution-manifest.js file and modify demo.html
 */
class SolutionManifest extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);

    // sanity check
    this.sanityCheck(event);

    const {
      ResourceProperties: {
        Data: data,
      },
    } = event;
    this.$data = data;
  }

  sanityCheck(event) {
    const {
      ResourceProperties: {
        Data,
      },
    } = event;

    let missing = REQUIRED_FIELDS
      .filter((x) =>
        Data[x] === undefined);

    if (missing.length) {
      throw new M2CException(`missing ${missing.join(', ')}`);
    }

    for (let i = 0; i < REQUIRED_SUBFIELDS.length; i += 1) {
      const {
        name,
        fields,
      } = REQUIRED_SUBFIELDS[i];

      missing = fields
        .filter((field) =>
          Data[name][field] === undefined);

      if (missing.length > 0) {
        throw new M2CException(`missing ${name}.${missing.join(', ')}`);
      }
    }
  }

  get data() {
    return this.$data;
  }

  get webBucket() {
    return this.data.Web.Bucket;
  }

  get manifest() {
    return this.$manifest;
  }

  /**
   * @function makeManifest
   * @description generate manifest content. These are the parameters that have to be provided
   * for web app to initially connect to the backend.
   */
  async makeManifest() {
    const manifest = {
      ...this.data,
      ApiOps,
      Statuses,
      FrameCaptureMode,
      AnalysisTypes,
      GraphDefs,
      FaceIndexerDefs,
    };

    // update fields
    const {
      FoundationModels = '',
      S3: {
        UseAccelerateEndpoint,
      },
      AIML: {
        Detections = [],
      },
    } = this.data;

    // parse Detections
    const aiml = aimlGetPresets(Detections);
    manifest.AIML = aiml;

    // create face collection if specified
    await _createFaceCollection(aiml.faceCollectionId);

    // parse FoundationModels
    const foundationModels = [];
    try {
      FoundationModels
        .split(';')
        .filter((x) => x)
        .forEach((x) => {
          const [name, value] = x.split('=');
          foundationModels.push({
            name,
            value,
          });
        });
    } catch (e) {
      // do nothing
    }
    manifest.FoundationModels = foundationModels;

    // parse S3 accelerated endpoint
    const useAccelerateEndpoint = (UseAccelerateEndpoint === 'true');
    manifest.S3.UseAccelerateEndpoint = useAccelerateEndpoint;

    // code segment
    const codeSegments = [
      `const manifest = '${JSON.stringify(manifest).replace(/'/g, '\\\'')}';`,
      '',
      'const SolutionManifest = JSON.parse(manifest);',
      '',
      'export default SolutionManifest;',
      '',
    ];

    return Buffer.from(codeSegments.join('\n'));
  }

  /**
   * @function copyManifest
   * @description create and install solution-manifest.js
   */
  async copyManifest() {
    const key = JS_SOLUTION_MANIFEST;
    const manifest = await this.makeManifest();

    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new PutObjectCommand({
      Bucket: this.webBucket,
      Key: key,
      ContentType: MIME.getType(key),
      ServerSideEncryption: 'AES256',
      Body: manifest,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    });

    return s3Client.send(command);
  }

  /**
   * @function create
   * @description subscribe a list of emails to SNS topic
   */
  async create() {
    await this.copyManifest();
    this.storeResponseData('Status', 'SUCCESS');
    return this.responseData;
  }

  /**
   * @function purge
   * @description not implememted (not needed)
   */
  async purge() {
    this.storeResponseData('Status', 'SKIPPED');
    return this.responseData;
  }
}

async function _createFaceCollection(collectionId) {
  let command;

  try {
    if (!collectionId) {
      return;
    }

    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    command = new CreateCollectionCommand({
      CollectionId: collectionId,
    });

    await rekognitionClient.send(command)
      .then((res) => {
        const {
          CollectionArn,
          FaceModelVersion,
          StatusCode,
        } = res;

        console.log(
          `[${StatusCode}] SolutionManifest._createFaceCollection:`,
          CollectionArn,
          FaceModelVersion
        );
        return true;
      })
      .catch((e) => {
        if (e.name === 'ResourceAlreadyExistsException') {
          console.log(
            `[${e.name}] SolutionManifest._createFaceCollection:`,
            collectionId
          );
          return true;
        }
        throw e;
      });
  } catch (e) {
    console.warn(
      'WARN:',
      'SolutionManifest._createFaceCollection:',
      `${command.constructor.name}:`,
      e.$metadata.httpStatusCode,
      e.name,
      e.message,
      JSON.stringify(command.input)
    );
    throw e;
  }
}

module.exports = SolutionManifest;
