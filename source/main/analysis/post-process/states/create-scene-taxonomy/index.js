// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const FS = require('node:fs');
const PATH = require('node:path');
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require('@aws-sdk/client-bedrock-runtime');
const {
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
  },
  AnalysisTypes: {
    Scene,
  },
  StateData: {
    Statuses: {
      Completed,
      Processing,
    },
  },
  CommonUtils,
  IABTaxonomy,
  xraysdkHelper,
  retryStrategyHelper,
  WebVttHelper,
  JimpHelper: {
    MIME_JPEG,
    imageFromBuffer,
    imageFromScratch,
  },
} = require('core-lib');
const BaseState = require('../shared/base');

const MODEL_REGION = process.env.ENV_BEDROCK_REGION;
const MODEL_ID = process.env.ENV_BEDROCK_MODEL_ID;
const MODEL_VERSION = process.env.ENV_BEDROCK_MODEL_VER;
const TASK_ALL = 'You are asked to provide the following information: a detail description to describe the scene, identify the most relevant IAB taxonomy, GARM, sentiment, and brands and logos that may appear in the scene, and five most relevant tags from the scene.';
const TASK_IAB = 'You are asked to identify the most relevant IAB taxonomy.';
const SYSTEM = 'You are a media operation engineer. Your job is to review a portion of a video content presented by a sequence of consecutive images. Each image also contains a sequence of frames presented in a 4x7 grid reading from left to right and then from top to bottom. You may also optionally be given the dialogues of the scene that helps you to understand the context. {{TASK}} It is important to return the results in JSON format and also includes a confidence score from 0 to 100. Skip any explanation.';
const ASSISTANT = {
  ProvideDialogues: {
    role: 'assistant',
    content: 'Got the images. Do you have the dialogues of the scene?',
  },
  OtherInfo: {
    role: 'assistant',
    content: 'OK. Do you have other information to provdie?',
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
  temperature: 0.1,
  // top_p: 0.8,
  // top_k: 250,
  stop_sequences: ['\n\nHuman:'],
  // system: SYSTEM,
};

const ENABLE_IMAGE_TILE = false;
// can support upto 140 frames per scene
const MAX_IMAGES = 5;
const MAX_GRID = [4, 7];
// Claude max WxH without resizing
const MAX_IMAGE_WXH = [1568, 1568];
const TILE_WXH = [392, 220];
const BORDER_SIZE = 2;

const STATUS_WAIT_RETRY = 'WAIT_RETRY';
const LAMBDA_TIMEOUT_EXCEPTION = 'LambdaTimeoutException';
const MODEL_ERROR_EXCEPTION = 'ModelErrorException';
const REKOGNITION = 'rekognition';
const JSON_FRAME_HASH = 'frameHash.json';
const IGNORED_CUES = [
  'ColorBars',
  'BlackFrames',
  'StudioLogo',
  'Slate',
  // 'EndCredits',
  // 'OpeningCredits',
  // 'Content',
  // 'undefined',
];

const GARM = [
  'Adult & Explicit Sexual Content',
  'Arms & Ammunition',
  'Crime & Harmful acts to individuals and Society, Human Right Violations',
  'Death, Injury or Military Conflict',
  'Online piracy',
  'Hate speech & acts of aggression',
  'Obscenity and Profanity, including language, gestures, and explicitly gory, graphic or repulsive content intended to shock and disgust',
  'Illegal Drugs, Tobacco, ecigarettes, Vaping, or Alcohol',
  'Spam or Harmful Content',
  'Terrorism',
  'Debated Sensitive Social Issue',
  'None',
];

const TaxonomyTier4 = IABTaxonomy
  .filter((x) =>
    x.Tier4.length > 0);

const TaxonomyTier3 = IABTaxonomy
  .filter((x) =>
    x.Tier3.length > 0 && x.Tier4.length === 0);

const TaxonomyTier2 = IABTaxonomy
  .filter((x) =>
    x.Tier2.length > 0 && x.Tier3.length === 0);

const TaxonomyTier1 = IABTaxonomy
  .filter((x) =>
    x.Tier2.length === 0);

const FilterSettings = {
  enhanceWithLLM: true,
};

class StateCreateSceneTaxonomy extends BaseState {
  constructor(event, context) {
    super(event, context);

    const {
      input: {
        aiOptions: {
          filters = {},
        },
      },
    } = this.stateData;
    _setFilterSettings(filters[Scene]);
  }

  static opSupported(op) {
    return op === 'StateCreateSceneTaxonomy';
  }

  async process() {
    if (!MODEL_REGION) {
      return this.setCompleted();
    }

    if (FilterSettings.enhanceWithLLM === false) {
      return this.setCompleted();
    }

    const outputs = await this.downloadOutputs();

    if (outputs === undefined) {
      return this.setCompleted();
    }

    const {
      [Scene]: {
        framePrefix,
        scene: _scenes = [],
        stats = {},
      },
      framehashes,
      vttCues,
    } = outputs;

    const {
      input: {
        destination: {
          bucket: proxyBucket,
        },
      },
      data: {
        video: {
          rekognition: {
            scene: {
              metadata: sceneMetadataKey,
              nextIdx: _nextIdx,
            },
          },
        },
      },
    } = this.stateData;

    let nextIdx = _nextIdx;
    if (nextIdx === undefined) {
      // reset the stats in case this is triggered by re-analysis flow
      Object.keys(stats).forEach((key) => {
        delete stats[key];
      });
      nextIdx = 0;
    }

    const scenes = _scenes.slice(nextIdx);

    if (scenes.length === 0) {
      return this.setCompleted();
    }

    // add taxonomy
    const {
      processed,
      reason,
    } = await this.batchCreateTaxonomy(
      proxyBucket,
      framePrefix,
      scenes,
      framehashes,
      vttCues,
      stats
    );

    nextIdx += processed;
    outputs[Scene].stats = stats;

    const parsed = PATH.parse(sceneMetadataKey);
    await CommonUtils.uploadFile(
      proxyBucket,
      parsed.dir,
      parsed.base,
      outputs[Scene]
    );

    if (nextIdx >= _scenes.length) {
      return this.setCompleted();
    }

    return this.setProcessing(nextIdx, reason);
  }

  async downloadOutputs() {
    try {
      const {
        input: {
          destination: {
            bucket: proxyBucket,
          },
          aiOptions: {
            scene,
          },
        },
        data: {
          video: {
            [REKOGNITION]: {
              [Scene]: {
                metadata: sceneMetadata,
              },
              framesegmentation: {
                key: framesegmentation,
              },
            },
          },
          audio: {
            transcribe: {
              vtt,
            },
          },
        },
      } = this.stateData;

      if (!scene) {
        throw new Error('scene detection not enabled');
      }

      let promises = [];

      // download scenes
      promises.push(CommonUtils.download(proxyBucket, sceneMetadata)
        .then((res) => ({
          [Scene]: JSON.parse(res.toString()),
        })));

      // download framehashes
      const framehashes = PATH.join(
        PATH.parse(framesegmentation).dir,
        JSON_FRAME_HASH
      );
      promises.push(CommonUtils.download(proxyBucket, framehashes)
        .then((res) => ({
          framehashes: JSON.parse(res.toString()),
        })));

      // download transcript
      promises.push(_downloadTranscript(proxyBucket, vtt));

      promises = await Promise.all(promises);
      promises = promises.reduce((a0, c0) => ({
        ...a0,
        ...c0,
      }));

      return promises;
    } catch (e) {
      console.log(
        'WARN:',
        'downloadOutputs',
        e.message
      );

      return undefined;
    }
  }

  async batchCreateTaxonomy(
    bucket,
    framePrefix,
    scenes,
    framehashes,
    vttCues,
    stats
  ) {
    let processed = 0;
    let reason;

    if (Object.keys(stats).length === 0) {
      stats.apiCount = 0;
      stats.inputTokens = 0;
      stats.outputTokens = 0;
      stats.inferenceTime = 0;
      stats.elapsed = 0;
    }

    // mesh frames to scene
    scenes.forEach((item) => {
      const {
        timeStart,
        timeEnd,
      } = item;

      item.frames = [];

      for (let i = 0; i < framehashes.length; i += 1) {
        const frame = framehashes[i];
        const {
          timestamp,
        } = frame;

        if (timestamp > timeEnd) {
          break;
        }

        if (timestamp < timeStart) {
          continue;
        }

        item.frames.push(frame);
      }
    });

    const t0 = Date.now();

    try {
      for (let i = 0; i < scenes.length; i += 1) {
        const scene = scenes[i];
        const {
          technicalCueType,
          sceneNo,
          frames,
          timeStart,
          timeEnd,
        } = scene;

        console.log(`\n=== PROCESSING Scene#${sceneNo}`);

        if (IGNORED_CUES.includes(technicalCueType)) {
          console.log(`[TechnicalCue]: ${technicalCueType}. Skipping...`);
          processed += 1;
          continue;
        }

        if (frames.length < 4) {
          console.log(`[Not enough frames]: ${frames.length} frames only. Skipping...`);
          processed += 1;
          continue;
        }

        // find transcript
        const dialogues = _findSceneDialogues(vttCues, [timeStart, timeEnd]);

        let name = String(sceneNo).padStart(3, '0');
        name = `scene-${name}.jpg`;

        console.log(`scene#${sceneNo} has ${frames.length} frames.`);

        const response = await _createSceneTaxonomy(
          bucket,
          framePrefix,
          frames,
          dialogues,
          name
        );

        const {
          usage: {
            inputTokens,
            outputTokens,
          },
          elapsed,
        } = response;
        stats.apiCount += 1;
        stats.inputTokens += inputTokens;
        stats.outputTokens += outputTokens;
        stats.inferenceTime += elapsed;

        console.log(JSON.stringify(response, null, 2));

        scene.details = [response];
        processed += 1;

        if (this.lambdaTimeout() === true) {
          const timeoutException = new Error('lambda is about to timeout');
          timeoutException.name = LAMBDA_TIMEOUT_EXCEPTION;
          throw timeoutException;
        }
      }
    } catch (e) {
      reason = e;
    } finally {
      const t1 = Date.now();
      stats.elapsed = t1 - t0;
      scenes.forEach((scene) => {
        delete scene.frames;
      });
    }

    return {
      processed,
      reason,
    };
  }

  setCompleted(stopReason) {
    this.stateData.status = Completed;

    const {
      data: {
        video: {
          rekognition: {
            scene,
          },
        },
      },
    } = this.stateData;

    if (scene === undefined) {
      return this.stateData;
    }

    delete scene.nextIdx;
    delete scene.waitInSeconds;
    delete scene.stopReason;

    if (stopReason && stopReason.name && stopReason.message) {
      scene.stopReason = `${stopReason.name} - ${stopReason.message}`;
    }

    return this.stateData;
  }

  setProcessing(nextIdx, reason) {
    this.stateData.status = Processing;

    const {
      data: {
        video: {
          rekognition: {
            scene,
          },
        },
      },
    } = this.stateData;

    scene.nextIdx = nextIdx;

    if (reason && reason.name !== LAMBDA_TIMEOUT_EXCEPTION) {
      return this.setWaitAndRetry(reason);
    }

    return this.stateData;
  }

  setWaitAndRetry(reason) {
    this.stateData.status = STATUS_WAIT_RETRY;

    if (reason.name !== MODEL_ERROR_EXCEPTION) {
      return this.setCompleted(reason);
    }

    const {
      data: {
        video: {
          rekognition: {
            scene,
          },
        },
      },
    } = this.stateData;

    if (scene.waitInSeconds === undefined) {
      scene.waitInSeconds = 40; // wait for 40s
    } else {
      scene.waitInSeconds = Math.round(scene.waitInSeconds * 1.5);
    }

    // should not wait any longer
    if (scene.waitInSeconds > 400) {
      return this.setCompleted(reason);
    }

    return this.stateData;
  }
}

async function _createSceneTaxonomy(
  bucket,
  framePrefix,
  frames,
  dialogues,
  name
) {
  const images = await _tileImages(bucket, framePrefix, frames);

  if (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined && ENABLE_IMAGE_TILE) {
    const parsed = PATH.parse(name);

    for (let i = 0; i < images.length; i += 1) {
      const jpeg = await images[i].getBufferAsync(MIME_JPEG);
      const file = PATH.join(parsed.dir, `${parsed.name}-${i}${parsed.ext}`);
      FS.writeFileSync(file, jpeg);
    }
  }

  return _inference(images, dialogues);
}

async function _tileImages(bucket, prefix, frames) {
  let selected = frames;

  const maxFramesPerImage = MAX_GRID[0] * MAX_GRID[1];
  const maxFrames = MAX_IMAGES * maxFramesPerImage;

  if (frames.length > maxFrames) {
    selected = _getEquallyDistributedSubset(frames, maxFrames);
  }

  let images = [];

  while (selected.length > 0) {
    const sliced = selected.splice(0, maxFramesPerImage);
    if (sliced.length < 4) {
      continue;
    }

    images.push(_tileImage(bucket, prefix, sliced));
  }

  images = await Promise.all(images);

  return images;
}

async function _tileImage(bucket, prefix, frames) {
  const [maxCol, maxRow] = MAX_GRID;
  const nCol = maxCol;
  const nRow = Math.ceil(frames.length / nCol);

  const [tileW, tileH] = TILE_WXH;
  const imgW = tileW * nCol;
  const imgH = tileH * nRow;

  const combined = await imageFromScratch(imgW, imgH);

  for (let row = 0; row < nRow && frames.length > 0; row += 1) {
    for (let col = 0; col < nCol && frames.length > 0; col += 1) {
      const frame = frames.shift();
      const key = PATH.join(prefix, frame.name);

      let buf = await (await CommonUtils.download(bucket, key, false)
        .then((res) =>
          res.Body.transformToByteArray()));
      buf = Buffer.from(buf);

      let tile = await imageFromBuffer(buf);

      const factor = tileW / tile.bitmap.width;
      tile = tile.scale(factor);

      const w = tile.bitmap.width - (BORDER_SIZE * 2);
      const h = tile.bitmap.height - (BORDER_SIZE * 2);
      tile = tile.crop(BORDER_SIZE, BORDER_SIZE, w, h);

      const l = col * tileW + BORDER_SIZE;
      const t = row * tileH + BORDER_SIZE;
      combined.blit(tile, l, t);
    }
  }

  return combined;
}

async function _inference(
  images,
  dialogues = [],
  options = {}
) {
  const t0 = Date.now();

  const modelId = MODEL_ID;
  const version = MODEL_VERSION;

  const messages = [];

  const imageContents = [];
  if (images.length < 2) {
    imageContents.push({
      type: 'text',
      text: 'Here is an image contains frame sequence that describes a scene.',
    });
  } else {
    imageContents.push({
      type: 'text',
      text: `Here are the ${images.length} images containing frame sequence that describes a scene.`,
    });
  }

  console.log(`Number of tiled images = ${images.length}`);

  for (let i = 0; i < images.length; i += 1) {
    const image = await images[i].getBase64Async(MIME_JPEG);
    imageContents.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: image.split(',')[1],
      },
    });
  }
  messages.push({
    role: 'user',
    content: imageContents,
  });

  // assistent
  messages.push(ASSISTANT.ProvideDialogues);

  // dialogues
  let dialogueContent = 'No dialogue';
  if (dialogues.length > 0) {
    dialogueContent = `Here is the dialogues of the scene in <transcript> tag:\n<transcript>\n${dialogues.join('\n')}\n</transcript>\n`;
  }
  messages.push({
    role: 'user',
    content: dialogueContent,
  });

  // assistent
  messages.push(ASSISTANT.OtherInfo);

  const additional = [];
  // iab taxonomy list
  const taxonomies = TaxonomyTier1
    .map((x) =>
      x.Name);
  taxonomies.push('None');
  additional.push({
    type: 'text',
    text: `Here is a list of IAB Taxonomies in <iab> tag:\n<iab>\n${taxonomies.join('\n')}\n</iab>\nOnly answer the IAB taxonomy from this list.`,
  });

  // garm taxonomy list
  const garms = GARM;
  additional.push({
    type: 'text',
    text: `Here is a list of GARM Taxonomies in <garm> tag:\n<garm>\n${garms.join('\n')}\n</garm>\nOnly answer the GARM taxonomy from this list.`,
  });

  // sentiment
  const sentiments = ['Positive', 'Neutral', 'Negative', 'None'];
  additional.push({
    type: 'text',
    text: `Here is a list of Sentiments in <sentiment> tag:\n<sentiment>\n${sentiments.join('\n')}\n</sentiment>\nOnly answer the Sentiment from this list.`,
  });

  // tags
  additional.push({
    type: 'text',
    text: 'Also provide five most relevant tags of the scene.',
  });

  messages.push({
    role: 'user',
    content: additional,
  });

  // assistant
  messages.push(ASSISTANT.OutputFormat);

  const example = {
    description: {
      text: 'The scene describes...',
      score: 98,
    },
    sentiment: {
      text: 'Positive',
      score: 90,
    },
    garmTaxonomy: {
      text: 'Online piracy',
      score: 90,
    },
    iabTaxonomy: {
      text: 'Station Wagon',
      score: 80,
    },
    brandAndLogos: [
      {
        text: 'Amazon',
        score: 98,
      },
      {
        text: 'Nike',
        score: 90,
      },
    ],
    tags: [
      {
        text: 'BMW',
        score: 90,
      },
    ],
  };

  const output = `Return JSON format. An example of the output:\n${JSON.stringify(example)}\n`;
  messages.push({
    role: 'user',
    content: output,
  });

  // assistant
  messages.push(ASSISTANT.Prefill);

  const system = SYSTEM.replace('{{TASK}}', TASK_ALL);
  const modelParams = {
    ...MODEL_PARAMS,
    ...options,
    messages,
    system,
  };

  const response = await _invokeEndpoint(modelId, modelParams);

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

  if (!(content[0] || {}).text) {
    result.elapsed = Date.now() - t0;
    return result;
  }

  const contentOutput = _parseOutputContent(content[0].text);

  if (contentOutput === undefined) {
    console.log('WARNING!!! Fail to parse content output?', content[0].text);
  }

  result = {
    ...result,
    ...contentOutput,
  };

  const response2 = await _inferenceRefineIAB(
    imageContents,
    dialogueContent,
    result.iabTaxonomy
  );

  result.usage.inputTokens += response2.usage.inputTokens;
  result.usage.outputTokens += response2.usage.outputTokens;
  result.iabTaxonomy.id = response2.id;
  result.iabTaxonomy.text = response2.text;
  result.iabTaxonomy.score = response2.score;

  const t1 = Date.now();
  result.elapsed = t1 - t0;

  return result;
}

async function _invokeEndpoint(modelId, modelParams) {
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

function _findAllChildrenTaxonomies(tier1) {
  let taxonomies = [];

  const tier2 = _findChildrenTaxonomy(tier1, TaxonomyTier2);
  if (tier2.length > 0) {
    taxonomies = taxonomies.concat(tier2);

    const tier3 = _findChildrenTaxonomy(
      tier2,
      TaxonomyTier3
    );

    if (tier3.length > 0) {
      taxonomies = taxonomies.concat(tier3);

      const tier4 = _findChildrenTaxonomy(
        tier3,
        TaxonomyTier4
      );

      if (tier4.length > 0) {
        taxonomies = taxonomies.concat(tier4);
      }
    }
  }

  return taxonomies;
}

function _findChildrenTaxonomy(parents, children) {
  const uniqueIds = parents
    .map((x) =>
      x.UniqueID);

  return children
    .filter((x) =>
      uniqueIds.includes(x.Parent));
}

async function _downloadTranscript(bucket, key, field = 'vttCues') {
  return WebVttHelper.download(bucket, key)
    .then((res) => {
      const cues = res.cues
        .map((cue) => ({
          start: Math.round(cue.start * 1000),
          end: Math.round(cue.end * 1000),
          text: cue.text,
        }))
        .sort((a, b) => {
          if (a.start < b.start) {
            return -1;
          }
          if (a.start > b.start) {
            return 1;
          }
          return b.end - a.end;
        });

      // check for speech collision
      const stack = [];
      stack.push(cues[0]);

      for (let i = 1; i < cues.length; i += 1) {
        const prev = stack[stack.length - 1];
        const cur = cues[i];

        if (cur.start <= prev.end) {
          const item = {
            start: Math.min(cur.start, prev.start),
            end: Math.max(cur.end, prev.end),
            text: [prev.text, cur.text].join('\n'),
          };
          stack.pop();
          stack.push(item);
          continue;
        }

        // merge short pauses
        if ((cur.start - prev.end) < 400) {
          const item = {
            start: Math.min(cur.start, prev.start),
            end: Math.max(cur.end, prev.end),
            text: [prev.text, cur.text].join('\n'),
          };
          stack.pop();
          stack.push(item);
          continue;
        }

        stack.push(cur);
      }

      return {
        [field]: stack,
      };
    });
}

function _findSceneDialogues(cues, timestamps) {
  const [timeA, timeB] = timestamps;

  if (timeA < 0 || timeB < 0) {
    return '';
  }

  const dialogues = [];

  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    const {
      start,
      end,
      text,
    } = cue;

    if (end < timeA) {
      continue;
    }

    if (start > timeB) {
      break;
    }

    dialogues.push(text);
  }

  return dialogues;
}

function _getEquallyDistributedSubset(arrayA, maxArraySize) {
  if (
    (!Array.isArray(arrayA) || arrayA.length === 0) ||
    (!Number.isInteger(maxArraySize) || maxArraySize <= 0)
  ) {
    return [];
  }

  const result = [];
  const step = Math.ceil(arrayA.length / maxArraySize);

  for (let i = 0; i < arrayA.length; i += step) {
    result.push(arrayA[i]);
    if (result.length === maxArraySize) {
      break;
    }
  }

  return result;
}

async function _inferenceRefineIAB(
  imageContents,
  dialogueContent,
  curTaxonomy
) {
  const lowerTierTaxonomy = {
    id: 0,
    text: 'None',
    score: 0,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
    },
  };

  if (curTaxonomy === undefined) {
    return lowerTierTaxonomy;
  }

  const tier1 = TaxonomyTier1
    .filter((x) =>
      x.Name === curTaxonomy.text)[0];

  if (tier1 === undefined) {
    return lowerTierTaxonomy;
  }

  lowerTierTaxonomy.id = tier1.UniqueID;
  lowerTierTaxonomy.text = curTaxonomy.text;
  lowerTierTaxonomy.score = curTaxonomy.score;

  const childTaxonomies = _findAllChildrenTaxonomies([tier1]);

  if (childTaxonomies.length === 0) {
    return lowerTierTaxonomy;
  }

  const taxonomies = childTaxonomies
    .map((x) =>
      x.Name);
  taxonomies.push('None');

  const example = {
    text: 'Station Wagon',
    score: 80,
  };
  const responseFormat = `Return JSON format. An example of the output:\n${JSON.stringify(example)}\n. Skip any explanation.`;

  // construct the message sequence
  const messages = [];
  // images
  messages.push({
    role: 'user',
    content: imageContents,
  });
  // has dialogues?
  messages.push(ASSISTANT.ProvideDialogues);
  // dialogues
  messages.push({
    role: 'user',
    content: dialogueContent,
  });
  // other info?
  messages.push(ASSISTANT.OtherInfo);
  // lowerTierTaxonomy list of iab taxonomies
  messages.push({
    role: 'user',
    content: `Here is a list of IAB Taxonomies in <iab> tag:\n<iab>\n${taxonomies.join('\n')}\n</iab>\nOnly answer the IAB taxonomy from this list.`,
  });
  // output format?
  messages.push(ASSISTANT.OutputFormat);
  // return format
  messages.push({
    role: 'user',
    content: responseFormat,
  });
  // guardrail to only return JSON
  messages.push(ASSISTANT.Prefill);

  const system = SYSTEM.replace('{{TASK}}', TASK_IAB);
  const modelId = MODEL_ID;
  const modelParams = {
    ...MODEL_PARAMS,
    system,
    messages,
  };

  const response = await _invokeEndpoint(modelId, modelParams);

  if (response === undefined) {
    return lowerTierTaxonomy;
  }

  const {
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
    content = [],
  } = response;

  lowerTierTaxonomy.usage = {
    inputTokens,
    outputTokens,
  };

  if (!(content[0] || {}).text) {
    return lowerTierTaxonomy;
  }

  const contentOutput = _parseOutputContent(content[0].text);

  if (!(contentOutput || {}).text) {
    return lowerTierTaxonomy;
  }

  const tier = childTaxonomies
    .filter((x) =>
      x.Name === contentOutput.text)[0];

  if (tier === undefined) {
    return lowerTierTaxonomy;
  }

  lowerTierTaxonomy.id = tier.UniqueID;
  lowerTierTaxonomy.text = contentOutput.text;
  lowerTierTaxonomy.score = contentOutput.score;

  console.log(`[inferenceIAB]: ${tier1.UniqueID} - ${curTaxonomy.text} (${curTaxonomy.score}) -> ${lowerTierTaxonomy.id} - ${lowerTierTaxonomy.text} (${lowerTierTaxonomy.score})`);

  return lowerTierTaxonomy;
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

function _setFilterSettings(userFilterSettings = {}) {
  if (userFilterSettings.enhanceWithLLM !== undefined) {
    FilterSettings.enhanceWithLLM = !!(userFilterSettings.enhanceWithLLM);
  }
}

module.exports = StateCreateSceneTaxonomy;
