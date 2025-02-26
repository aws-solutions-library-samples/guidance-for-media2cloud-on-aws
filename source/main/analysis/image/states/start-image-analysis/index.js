// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('node:path');
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require('@aws-sdk/client-bedrock-runtime');
const {
  RekognitionClient,
  RecognizeCelebritiesCommand,
  DetectFacesCommand,
  DescribeCollectionCommand,
  SearchFacesByImageCommand,
  DetectLabelsCommand,
  DetectModerationLabelsCommand,
  DetectTextCommand,
  DescribeProjectVersionsCommand,
  DetectCustomLabelsCommand,
} = require('@aws-sdk/client-rekognition');
const {
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
  },
  AnalysisTypes: {
    Rekognition: {
      Celeb,
      Face,
      FaceMatch,
      Label,
      Moderation,
      Text,
      CustomLabel,
    },
  },
  StateData,
  CommonUtils,
  FaceIndexer,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
  JimpHelper: {
    MIME_JPEG,
    imageFromS3,
  },
} = require('core-lib');

const MODEL_REGION = process.env.ENV_BEDROCK_REGION;
const MODEL_ID = process.env.ENV_BEDROCK_MODEL_ID;
const MODEL_VERSION = process.env.ENV_BEDROCK_MODEL_VER;
const MODEL_PRICING = (MODEL_ID.indexOf('sonnet') > 0)
  ? {
    InputTokens: 0.00300,
    OutputTokens: 0.01500,
  }
  : {
    InputTokens: 0.00025,
    OutputTokens: 0.00125,
  };
const MODEL_ERROR_EXCEPTION = 'ModelErrorException';
const SYSTEM = 'You are a journalist responsible for reviewing photos and provide detail information of the photos. You may optionally be provided with additional information such as known people, texts, and GPS longitude and latitude. Your task is to write a detail description of the photo, provide a one line ATL-TEXT for SEO purpose, suggest a descriptive file name for the photo, and top 5 tags or keywords of the photo for search purpose. Use the additional information where possilbe. Also provide a confidence score from 0 to 100. The output should be in JSON format. Skip any explanation in the output.';
const ASSISTANT = {
  GotPhotoOtherInfo: {
    role: 'assistant',
    content: 'Got the photo. Other information you would like to provide?',
  },
  OutputFormat: {
    role: 'assistant',
    content: 'OK. What output format?',
  },
  Prefill: {
    role: 'assistant',
    content: '{',
  },
};
const MODEL_PARAMS = {
  anthropic_version: MODEL_VERSION,
  max_tokens: 4096 * 4,
  temperature: 0.2,
  top_p: 0.1,
  top_k: 250,
  stop_sequences: ['\n\nHuman:'],
};

const MAX_W = 960;
const MAX_H = MAX_W;

const {
  Statuses: {
    Completed,
  },
} = StateData;

const ANALYSIS_TYPE = 'image';
const CATEGORY = 'rekog-image';
const MIN_CONFIDENCE = 80;
const OUTPUT_JSON = 'output.json';
const CAPTION = 'caption';

class StateStartImageAnalysis {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
    }
    this.$stateData = stateData;
    this.$faceIndexer = new FaceIndexer();
  }

  get [Symbol.toStringTag]() {
    return 'StateStartImageAnalysis';
  }

  get stateData() {
    return this.$stateData;
  }

  get faceIndexer() {
    return this.$faceIndexer;
  }

  async process() {
    const {
      input: {
        aiOptions,
      },
    } = this.stateData;

    let results = [];

    results.push(this.startCeleb(aiOptions));
    results.push(this.startFace(aiOptions));
    results.push(this.startFaceMatch(aiOptions));
    results.push(this.startLabel(aiOptions));
    results.push(this.startModeration(aiOptions));
    results.push(this.startText(aiOptions));
    results.push(this.startCustomLabels(aiOptions));

    results = await Promise.all(results);

    results = results
      .filter((x) =>
        x)
      .reduce((acc, cur) => ({
        ...acc,
        ...cur,
      }), {});

    const caption = await this.generateCaption(results);

    results = {
      ...results,
      ...caption,
    };

    // clean up the results
    Object.keys(results)
      .forEach((key) => {
        delete results[key].response;
      });

    this.stateData.setData(ANALYSIS_TYPE, {
      status: Completed,
      [CATEGORY]: results,
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async startCeleb(aiOptions) {
    if (!aiOptions.celeb) {
      return undefined;
    }

    const params = this.makeParams();
    const command = new RecognizeCelebritiesCommand(params);

    return this.startFn(Celeb, command);
  }

  async startFace(aiOptions) {
    if (!aiOptions.face) {
      return undefined;
    }
    const params = {
      ...this.makeParams(),
      Attributes: [
        'ALL',
      ],
    };
    const command = new DetectFacesCommand(params);

    return this.startFn(Face, command);
  }

  async startFaceMatch(aiOptions) {
    if (!aiOptions[FaceMatch] || !aiOptions.faceCollectionId) {
      return undefined;
    }

    let command;

    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    /* ensure face collection exists and has faces */
    command = new DescribeCollectionCommand({
      CollectionId: aiOptions.faceCollectionId,
    });

    const valid = await rekognitionClient.send(command)
      .then((res) =>
        res.FaceCount > 0)
      .catch(() =>
        false);

    if (!valid) {
      return undefined;
    }

    const params = {
      ...this.makeParams(),
      CollectionId: aiOptions.faceCollectionId,
      FaceMatchThreshold: aiOptions.minConfidence || MIN_CONFIDENCE,
    };
    command = new SearchFacesByImageCommand(params);

    return this.startFn(FaceMatch, command);
  }

  async startLabel(aiOptions) {
    if (!aiOptions.label) {
      return undefined;
    }

    const params = {
      ...this.makeParams(),
      MinConfidence: aiOptions.minConfidence || MIN_CONFIDENCE,
    };
    const command = new DetectLabelsCommand(params);

    return this.startFn(Label, command);
  }

  async startModeration(aiOptions) {
    if (!aiOptions.moderation) {
      return undefined;
    }

    const params = {
      ...this.makeParams(),
      MinConfidence: aiOptions.minConfidence || MIN_CONFIDENCE,
    };
    const command = new DetectModerationLabelsCommand(params);

    return this.startFn(Moderation, command);
  }

  async startText(aiOptions) {
    if (!aiOptions.text) {
      return undefined;
    }

    const params = this.makeParams();
    const command = new DetectTextCommand(params);

    return this.startFn(Text, command);
  }

  makeParams() {
    const bucket = this.stateData.input.destination.bucket;
    const key = this.stateData.input.image.key;
    if (!bucket || !key) {
      throw new M2CException('bucket or key is missing');
    }
    return {
      Image: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
    };
  }

  async startFn(subCategory, command, model) {
    const t0 = new Date().getTime();

    let response;
    try {
      const rekognitionClient = xraysdkHelper(new RekognitionClient({
        customUserAgent: CustomUserAgent,
        retryStrategy: retryStrategyHelper(),
      }));

      response = await rekognitionClient.send(command)
        .then((res) => ({
          ...res,
          $metadata: undefined,
        }));
    } catch (e) {
      console.error(
        'WARN:',
        'StateStartImageAnalysis.startFn:',
        `${command.constructor.name}:`,
        e.$metadata.httpStatusCode,
        e.name,
        e.message
      );

      return {
        [subCategory]: {
          errorMessage: [
            `${command.constructor.name}:`,
            e.$metadata.httpStatusCode,
            e.name,
            e.message,
          ].join(' '),
        },
      };
    }

    const bucket = this.stateData.input.destination.bucket;
    const prefix = this.makeOutputPrefix(subCategory, model);
    const output = PATH.join(prefix, OUTPUT_JSON);

    if (subCategory === FaceMatch) {
      response = await this.amendSearchFacesByImageResponse(response);
    }

    await CommonUtils.uploadFile(
      bucket,
      prefix,
      OUTPUT_JSON,
      response
    );

    return {
      [subCategory]: {
        output,
        startTime: t0,
        endTime: new Date().getTime(),
        model,
        response,
      },
    };
  }

  makeOutputPrefix(subCategory, optionalPath = '') {
    const timestamp = CommonUtils.toISODateTime((this.stateData.input.request || {}).timestamp);
    return PATH.join(
      this.stateData.input.destination.prefix,
      'raw',
      timestamp,
      CATEGORY,
      subCategory,
      optionalPath,
      '/'
    );
  }

  async startCustomLabels(aiOptions) {
    if (!aiOptions.customlabel
    || !(aiOptions.customLabelModels || []).length) {
      return undefined;
    }
    let responses = await Promise.all(aiOptions.customLabelModels
      .map((model) =>
        this.startCustomLabel(model)));
    responses = responses
      .filter((x) =>
        x);
    if (responses.length === 0) {
      return undefined;
    }
    return {
      [CustomLabel]: responses,
    };
  }

  async startCustomLabel(model) {
    const projectVersionArn = await this.checkProjectVersionStatus(model);
    if (!projectVersionArn) {
      return undefined;
    }

    const params = {
      ...this.makeParams(),
      ProjectVersionArn: projectVersionArn,
    };
    const command = new DetectCustomLabelsCommand(params);

    return this.startFn(
      CustomLabel,
      command,
      model
    ).then((res) =>
      res[CustomLabel]);
  }

  async checkProjectVersionStatus(model) {
    let projectArn = model;
    if (projectArn.indexOf('arn:aws:rekognition:') !== 0) {
      projectArn = `arn:aws:rekognition:${process.env.AWS_REGION}:${this.stateData.accountId}:project/${model}`;
    }

    let response;
    do {
      const rekognitionClient = xraysdkHelper(new RekognitionClient({
        customUserAgent: CustomUserAgent,
        retryStrategy: retryStrategyHelper(),
      }));

      const command = new DescribeProjectVersionsCommand({
        ProjectArn: projectArn,
        NextToken: (response || {}).NextToken,
      });

      try {
        response = await rekognitionClient.send(command);
      } catch (e) {
        console.error(
          'ERR:',
          'StateStartImageAnalysis.checkProjectVersionStatus:',
          'DescribeProjectVersionsCommand:',
          model,
          e.$metadata.httpStatusCode,
          e.name,
          e.message
        );
        return undefined;
      }

      const runningModel = response.ProjectVersionDescriptions
        .find((x) =>
          x.Status === 'RUNNING');

      if (runningModel !== undefined) {
        return runningModel.ProjectVersionArn;
      }
    } while ((response || {}).NextToken);

    /* cannot find any running model */
    return undefined;
  }

  async amendSearchFacesByImageResponse(response) {
    // lookup faceId <-> celeb
    const facesToGet = [];

    response.FaceMatches
      .forEach((faceMatch) => {
        const face = faceMatch.Face;
        const found = this.faceIndexer.lookup(face.FaceId);

        if (face === undefined) {
          return;
        }
        if (found === undefined) {
          facesToGet.push(face);
        } else if (found && found.celeb) {
          face.Name = found.celeb;
        }
      });

    if (facesToGet.length > 0) {
      const faceIds = facesToGet
        .map((x) =>
          x.FaceId);

      await this.faceIndexer.batchGet(faceIds)
        .then((res) => {
          // try look up again!
          if (res.length > 0) {
            facesToGet.forEach((face) => {
              const found = this.faceIndexer.lookup(face.FaceId);
              if (found && found.celeb) {
                face.Name = found.celeb;
              } else {
                // do not return external image id if it can't resolve the name!
                face.Name = FaceIndexer.resolveExternalImageId(
                  face.ExternalImageId,
                  false
                );
              }
            });
          }
          return res;
        });
    }

    return response;
  }

  async generateCaption(data) {
    if (!MODEL_REGION) {
      return undefined;
    }

    const t0 = Date.now();

    // download imageinfo to check if we have GPS info
    const {
      input: {
        destination: {
          bucket: proxyBucket,
          prefix: proxyPrefix,
        },
        image: {
          key: imageKey,
        },
      },
    } = this.stateData;

    let imageinfo = PATH.join(proxyPrefix, 'imageinfo', 'imageinfo.json');
    imageinfo = await CommonUtils.download(proxyBucket, imageinfo)
      .then((res) =>
        JSON.parse(res));

    const {
      GPSLatitude: latitude,
      GPSLongitude: longitude,
    } = imageinfo || {};

    // only interestd in celeb, facematch, text
    let knownFaces = [];
    const {
      CelebrityFaces: celebrityFaces = [],
    } = (data[Celeb] || {}).response || {};
    celebrityFaces.forEach((face) => {
      if (face.MatchConfidence > 90) {
        knownFaces.push(face.Name);
      }
    });

    const {
      FaceMatches: faceMatches = [],
    } = (data[FaceMatch] || {}).response || {};
    faceMatches.forEach((face) => {
      if (face.Similarity > 90 && face.Face.Name) {
        knownFaces.push(face.Face.Name);
      }
    });

    knownFaces = [
      ...new Set(knownFaces),
    ];

    const texts = [];

    const {
      TextDetections: textDetections = [],
    } = (data[Text] || {}).response || {};

    textDetections.forEach((text) => {
      if (text.Confidence > 80) {
        texts.push(text.DetectedText);
      }
    });

    // load image
    let image = await imageFromS3(proxyBucket, imageKey);

    const scaleW = MAX_W / image.bitmap.width;
    const scaleH = MAX_H / image.bitmap.height;
    const factor = Math.min(scaleW, scaleH);
    if (factor < 1.0) {
      image = image.scale(factor);
    }
    image = image.quality(80);
    image = await image.getBase64Async(MIME_JPEG);
    image = image.split(',')[1];

    // prepare model parameter
    const params = _prepareModelParams(
      image,
      knownFaces,
      texts,
      [latitude, longitude]
    );

    const response = await _invokeEndpoint(params)
      .catch(() => undefined);

    if (response === undefined) {
      return response;
    }

    const {
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
      content = [],
    } = response;

    let result = {
      usage: {
        inputTokens,
        outputTokens,
      },
    };

    if ((content[0] || {}).text) {
      const parsed = _parseOutputContent(content[0].text);

      result = {
        ...result,
        ...parsed,
      };
    }

    const estimatedCost = ((
      (inputTokens * MODEL_PRICING.InputTokens) +
      (outputTokens * MODEL_PRICING.OutputTokens)
    ) / 1000).toFixed(4);
    console.log(`inputTokens = ${inputTokens}, outputTokens = ${outputTokens}, estimatedCost = $${estimatedCost}`);
    console.log(JSON.stringify(result, null, 2));

    const prefix = this.makeOutputPrefix(CAPTION);
    const output = PATH.join(prefix, OUTPUT_JSON);

    await CommonUtils.uploadFile(
      proxyBucket,
      prefix,
      OUTPUT_JSON,
      result
    );

    return {
      [CAPTION]: {
        output,
        startTime: t0,
        endTime: Date.now(),
      },
    };
  }
}

function _prepareModelParams(
  image,
  knownFaces,
  texts,
  gps
) {
  const system = SYSTEM;

  const messages = [];

  // image content
  const imageContent = [];
  imageContent.push({
    type: 'text',
    text: 'Here is a photo to analyze.',
  });
  imageContent.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/jpeg',
      data: image,
    },
  });
  messages.push({
    role: 'user',
    content: imageContent,
  });

  messages.push(ASSISTANT.GotPhotoOtherInfo);

  const additionalContent = [];
  if (knownFaces.length) {
    const persons = [
      '<people>',
      ...knownFaces,
      '</people>',
    ];

    additionalContent.push({
      type: 'text',
      text: `Here is a list of known people appeared in the photo. Use their names in <people> tag where possible. People:\n${persons.join('\n')}\n`,
    });
  }

  if (texts.length) {
    const words = [
      '<text>',
      ...texts,
      '</text>',
    ];

    additionalContent.push({
      type: 'text',
      text: `Here is a list of texts appeared on the photo. Use the texts in <text> tag where possible. Texts:\n${words.join('\n')}\n`,
    });
  }

  const [latitude, longitude] = gps;
  if (latitude && longitude) {
    const location = [
      '<longitude>',
      longitude,
      '</longitude>',
      '<latitude>',
      latitude,
      '</latitude>',
    ];
    additionalContent.push({
      type: 'text',
      text: `Here is the GPS location where the photo is taken in <longitude> and <latitude> tags:\n${location.join('\n')}\n. Identify the location in the photo. Skip any explanation.`,
    });
  }

  if (additionalContent.length > 0) {
    messages.push({
      role: 'user',
      content: additionalContent,
    });
  } else {
    messages.push({
      role: 'user',
      content: 'No, I don\'t have additional information to provide.',
    });
  }

  messages.push(ASSISTANT.OutputFormat);

  const example = {
    description: {
      text: 'The photo describes...',
      score: 98,
    },
    altText: {
      text: 'One line ALT-TEXT',
      score: 90,
    },
    fileName: {
      text: 'photo-of-someone-doing-something',
      score: 90,
    },
    location: {
      text: 'Madrid, Spain',
      score: 80,
    },
    tags: [
      {
        text: 'Night club',
        score: 90,
      },
    ],
  };

  const output = `Return JSON format. An example of the output:\n${JSON.stringify(example)}\n.`;
  messages.push({
    role: 'user',
    content: output,
  });

  messages.push(ASSISTANT.Prefill);

  const params = {
    ...MODEL_PARAMS,
    system,
    messages,
  };

  return params;
}

async function _invokeEndpoint(modelParams, modelId = MODEL_ID) {
  const runtimeClient = xraysdkHelper(new BedrockRuntimeClient({
    region: MODEL_REGION,
    customUserAgent: CustomUserAgent,
    retryStrategy: retryStrategyHelper(4),
  }));

  const params = {
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(modelParams),
  };

  const command = new InvokeModelCommand(params);

  let response = await runtimeClient.send(command)
    .catch((e) => {
      let exception;
      if (e.code === 'ENOTFOUND') {
        exception = new Error(`Bedrock not supported in the region (${e.code})`);
        exception.name = 'ServiceUnavailableException';
      } else if (e.name === MODEL_ERROR_EXCEPTION) {
        exception = new Error(`Model inference quota reached. Retry again. (${e.name})`);
        exception.name = MODEL_ERROR_EXCEPTION;
      } else if (e.name === 'ResourceNotFoundException') {
        exception = new Error(`Make sure to request access to the model in the region (${e.name})`);
        exception.name = 'ResourceNotFoundException';
      } else if (e.name === 'AccessDeniedException') {
        exception = new Error(`Not allow to access to the model in the region (${e.name})`);
        exception.name = 'AccessDeniedException';
      } else {
        exception = new Error(e.message);
        exception.name = e.name || e.code || 'UnknownException';
      }

      console.log(`[ERR]: InvokeModelCommand: ${exception.name} - ${exception.message}`);
      throw exception;
    });

  response = new TextDecoder().decode(response.body);
  response = JSON.parse(response);

  return response;
}

function _parseOutputContent(text) {
  if (!text) {
    return undefined;
  }

  let jsonstring = text;
  if (jsonstring[0] !== '{') {
    jsonstring = `{${jsonstring}`;
  }

  let data;

  try {
    data = JSON.parse(jsonstring);
    return data;
  } catch (e) {
    // do nothing
  }

  // find '{' and '}' boundary to parse again.
  let idx = jsonstring.indexOf('{');
  if (idx < 0) {
    return undefined;
  }
  jsonstring = jsonstring.slice(idx);

  idx = jsonstring.lastIndexOf('}');
  if (idx < 0) {
    return undefined;
  }
  jsonstring = jsonstring.slice(0, idx + 1);

  try {
    data = JSON.parse(jsonstring);
  } catch (e) {
    // do nothing
  }

  return data;
}

module.exports = StateStartImageAnalysis;
