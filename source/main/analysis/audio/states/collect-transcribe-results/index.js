// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  TranscribeClient,
  GetTranscriptionJobCommand,
  TranscribeServiceException,
} = require('@aws-sdk/client-transcribe');
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require('@aws-sdk/client-bedrock-runtime');
const {
  StateData,
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
  },
  AnalysisTypes: {
    Transcribe,
  },
  CommonUtils,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
  WebVttHelper,
} = require('core-lib');

const JOB_COMPLETED = 'COMPLETED';
const CONVERSATION = 'conversations';
const JSON_CONVERSATION = `${CONVERSATION}.json`;
const MIN_CONVERSATION_DURATION = 40;
const CUES_CHUNK_SIZE_INSEC = 15 * 60;
const MIN_TO_ENABLE_CHUNKING = 20 * 60;

// Claude
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
const SYSTEM = 'You are a media operation assistant that can analyze movie transcripts in WebVTT format and suggest chapter points based on the topic changes in the conversations. It is important to read the entire transcripts.';
const MODEL_PARAMS = {
  anthropic_version: MODEL_VERSION,
  max_tokens: 4096 * 4,
  temperature: 0.2,
  top_p: 0.7,
  top_k: 20,
  stop_sequences: ['\n\nHuman:'],
  system: SYSTEM,
};
const ASSISTANT = {
  OutputFormat: {
    role: 'assistant',
    content: 'OK. I got the transcript. What output format?',
  },
  Prefill: {
    role: 'assistant',
    content: '{',
  },
};

let FilterSettings = {
  analyseConversation: true,
};

class StateTranscribeResults {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
    }
    this.$stateData = stateData;

    const {
      input: {
        aiOptions: {
          filters = {},
        },
      },
    } = stateData;

    _setFilterSettings(filters[Transcribe]);
  }

  get [Symbol.toStringTag]() {
    return 'StateTranscribeResults';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    try {
      const {
        input: {
          destination: {
            bucket: proxyBucket,
          },
          audio: {
            key: audioKey,
          },
        },
        data: {
          [Transcribe]: {
            jobId,
            output: outPrefix,
          },
        },
      } = this.stateData;

      // get job results
      const jobResult = await this.getJob(jobId);
      const {
        TranscriptionJob: {
          TranscriptionJobStatus,
          FailureReason,
          LanguageCodes,
          LanguageCode,
        },
      } = jobResult;

      if (TranscriptionJobStatus !== JOB_COMPLETED) {
        const message = FailureReason || TranscriptionJobStatus;
        throw new TranscribeServiceException(`${jobId}: ${message};`);
      }

      let languageCode = LanguageCode;
      if (Array.isArray(LanguageCodes)) {
        languageCode = LanguageCodes[0].LanguageCode;
      }

      const output = PATH.join(outPrefix, `${jobId}.json`);
      const vtt = PATH.join(outPrefix, `${jobId}.vtt`);

      // use Claude to analyse conversations
      let conversation;
      if (FilterSettings.analyseConversation) {
        conversation = await _analyseConversation(proxyBucket, vtt);
      }

      return this.setCompleted({
        languageCode,
        output,
        vtt,
        [CONVERSATION]: conversation,
      });
    } catch (e) {
      return this.setNoData(e.message);
    }
  }

  async getJob(jobId) {
    const transcribeClient = xraysdkHelper(new TranscribeClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new GetTranscriptionJobCommand({
      TranscriptionJobName: jobId,
    });

    return transcribeClient.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  setNoData(message) {
    this.stateData.setData(Transcribe, {
      errorMessage: message,
      endTime: Date.now(),
    });
    this.stateData.setNoData();
    return this.stateData.toJSON();
  }

  setCompleted(data) {
    this.stateData.setData(Transcribe, {
      ...data,
      endTime: Date.now(),
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

async function _analyseConversation(bucket, key) {
  if (!MODEL_REGION) {
    return undefined;
  }

  const t0 = Date.now();
  const modelId = MODEL_ID;

  const vtt = await CommonUtils.download(bucket, key)
    .catch(() =>
      undefined);

  if (vtt === undefined) {
    return undefined;
  }

  // make sure it has conversation
  const {
    cues = [],
  } = WebVttHelper.parse(vtt) || {};

  if (cues.length === 0) {
    return undefined;
  }

  // also check the length of the transcript
  const duration = Math.round(cues[cues.length - 1].end - cues[0].start);

  if (duration < MIN_CONVERSATION_DURATION) {
    return undefined;
  }

  const result = {
    usage: {
      inputTokens: 0,
      outputTokens: 0,
    },
    chapters: [],
  };

  let iterations = 1;
  let step = cues.length;

  // enable chunking if dialogues is too long.
  if (duration > MIN_TO_ENABLE_CHUNKING) {
    iterations = Math.floor(duration / CUES_CHUNK_SIZE_INSEC);
    step = Math.ceil(cues.length / iterations);
  }

  const duped = cues.slice(0);

  for (let i = 0; i < iterations; i += 1) {
    let sliced = duped.splice(0, step);

    // overlap with 10 cues
    sliced = sliced.concat(duped.slice(0, 10));

    sliced = WebVttHelper.compile({
      valid: true,
      cues: sliced,
    });

    const modelParams = _prepareModelParams(sliced);

    const response = await _invokeEndpoint(modelId, modelParams)
      .then((res) =>
        _parseResponse(res))
      .catch(() =>
        undefined);

    if (response !== undefined) {
      const {
        usage: {
          inputTokens,
          outputTokens,
        },
        chapters,
      } = response;

      result.usage.inputTokens += inputTokens;
      result.usage.outputTokens += outputTokens;
      result.chapters = result.chapters.concat(chapters);
    }
  }

  // guardrail the conversation results
  let chapters;

  chapters = _mergeChapters(result.chapters);
  chapters = _validateTimestamps(chapters, cues);
  result.chapters = chapters;

  result.elapsed = Date.now() - t0;

  const {
    usage: {
      inputTokens,
      outputTokens,
    },
  } = result;

  const estimatedCost = ((
    (inputTokens * MODEL_PRICING.InputTokens) +
    (outputTokens * MODEL_PRICING.OutputTokens)
  ) / 1000).toFixed(4);

  console.log(`inputTokens = ${inputTokens}, outputTokens = ${outputTokens}, estimatedCost = $${estimatedCost}`);
  console.log(JSON.stringify(chapters, null, 2));
  console.log(`Total chapters = ${chapters.length}`);

  const parsed = PATH.parse(key);
  const outKey = PATH.join(
    parsed.dir,
    JSON_CONVERSATION
  );

  await CommonUtils.uploadFile(
    bucket,
    parsed.dir,
    JSON_CONVERSATION,
    result
  );

  return outKey;
}

function _prepareModelParams(vtt) {
  const example = {
    chapters: [
      {
        start: '00:00:10.000',
        end: '00:00:32.000',
        reason: 'It appears the chapter talks about...',
      },
    ],
  };

  const messages = [];

  // user
  messages.push({
    role: 'user',
    content: `Here is the transcripts in <transcript> tag:\n<transcript>${vtt}\n</transcript>\n`,
  });

  // assistent
  messages.push(ASSISTANT.OutputFormat);

  // user
  messages.push({
    role: 'user',
    content: `Return JSON format. An example of the output:\n${JSON.stringify(example)}\n`,
  });

  // assistant
  messages.push(ASSISTANT.Prefill);

  const system = SYSTEM;
  console.log('SYSTEM PROMPT: ', system);

  const modelParams = {
    ...MODEL_PARAMS,
    system,
    messages,
  };

  return modelParams;
}

async function _invokeEndpoint(modelId, modelParams) {
  const runtimeClient = new BedrockRuntimeClient({
    region: MODEL_REGION,
  });

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

function _parseResponse(response) {
  if (response === undefined) {
    return undefined;
  }

  const {
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
    content = [],
  } = response;

  const result = {
    usage: {
      inputTokens,
      outputTokens,
    },
    chapters: [],
  };

  const contentOutput = _parseOutputContent((content[0] || {}).text);

  if (contentOutput === undefined) {
    console.log('WARNING!!! Fail to parse content output?', content[0].text);
    result.rawText = content[0].text;
    return result;
  }

  return {
    ...result,
    ...contentOutput,
  };
}

function _parseOutputContent(text) {
  if (!text) {
    return undefined;
  }

  let jsonstring = text.trim();
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

function _mergeChapters(chapters) {
  // converting timestamp string to msec
  const modified = [];

  chapters.forEach((chapter) => {
    const start = _toMilliseconds(chapter.start);
    const end = _toMilliseconds(chapter.end);
    if (start >= 0 && end >= 0) {
      modified.push({
        start,
        end,
        reason: chapter.reason,
      });
    }
  });

  // sort by ascending start time,
  // then sort by descending end time.
  modified.sort((a, b) => {
    if (a.start < b.start) {
      return -1;
    }
    if (a.start > b.start) {
      return 1;
    }
    return b.end - a.end;
  });

  if (modified.length < 2) {
    return modified;
  }

  const orig = modified.length;

  const stack = [];

  stack.push(modified[0]);

  for (let i = 1; i < modified.length; i += 1) {
    const prev = stack[stack.length - 1];
    const cur = modified[i];

    const {
      start: prevStart,
      end: prevEnd,
      reason: prevReason,
    } = prev;

    const {
      start: curStart,
      end: curEnd,
      reason: curReason,
    } = cur;

    if (curEnd < prevStart) {
      throw new Error('SHOULD NOT HAPPEN');
    }

    if (curStart >= prevEnd) {
      stack.push(cur);
      continue;
    }

    if (curStart > prevStart && curEnd < prevEnd) {
      // completely overlapped, skip it.
      continue;
    }

    // overlapped
    const start = Math.min(curStart, prevStart);
    const end = Math.max(curEnd, prevEnd);

    let reason = prevReason;
    if ((curEnd - curStart) > (prevEnd - prevStart)) {
      reason = curReason;
    }

    stack.pop();
    stack.push({
      start,
      end,
      reason,
    });
  }

  console.log(`[Merge chapters] ${orig} -> ${stack.length} chapters`);

  return stack;
}

function _validateTimestamps(chapters, cues) {
  if (cues.length < 2) {
    return chapters;
  }

  const timestamps = _parseCueTimestamps(cues);

  // now, we can validate the timestamp boundaries
  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i];

    const {
      start: chapterStart,
      end: chapterEnd,
    } = chapter;

    while (timestamps.length) {
      const timestamp = timestamps[0];
      const [
        cueStart,
        cueEnd,
      ] = timestamp;

      if (cueStart >= chapterEnd) {
        break;
      }

      if (cueEnd <= chapterStart) {
        timestamps.shift();
        continue;
      }

      if (Math.abs(chapterEnd - cueStart) < Math.abs(cueEnd - chapterEnd)) {
        break;
      }

      if (chapter.timestamps === undefined) {
        chapter.timestamps = [timestamp];
      } else {
        chapter.timestamps.push(timestamp);
      }

      timestamps.shift();
    }
  }

  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i];

    const {
      start,
      end,
      timestamps: cueTimestamps,
    } = chapter;

    if (cueTimestamps === undefined) {
      continue;
    }

    const cueStart = cueTimestamps[0][0];
    const cueEnd = cueTimestamps[cueTimestamps.length - 1][1];

    if (start !== cueStart) {
      console.log(`CHPT#${String(i).padStart(3, '0')}.start: ${_toHHMMSS(start, true)} -> ${_toHHMMSS(cueStart, true)}`);
      chapter.start = cueStart;
    }

    if (end !== cueEnd) {
      console.log(`CHPT#${String(i).padStart(3, '0')}.end: ${_toHHMMSS(end, true)} -> ${_toHHMMSS(cueEnd, true)}`);
      chapter.start = cueEnd;
    }

    delete chapter.timestamps;
  }

  // debug purpose
  console.log('[Check for collision]: ???');
  for (let i = 0; i < chapters.length - 1; i += 1) {
    const cur = chapters[i];
    const next = chapters[i + 1];

    if (next.start < cur.end) {
      console.log(`[CHAPTER COLLISION]: CHPT#${String(i).padStart(3, '0')}: ${_toHHMMSS(cur.start, true)}/${_toHHMMSS(cur.end, true)} -> ${_toHHMMSS(next.start, true)}/${_toHHMMSS(next.end, true)}`);
    }
  }

  return chapters;
}

function _parseCueTimestamps(cues) {
  const timestamps = cues
    .map((cue) => ([
      Math.round(cue.start * 1000),
      Math.round(cue.end * 1000),
    ]));

  // check to ensure cues are not overlapped
  const stack = [];
  stack.push(timestamps[0]);

  for (let i = 1; i < timestamps.length; i += 1) {
    const prev = stack[stack.length - 1];
    const cur = timestamps[i];

    if (cur[0] < prev[1]) {
      console.log(`[CUE COLLISION]: ${_toHHMMSS(prev[0])}/${_toHHMMSS(prev[1])} -> ${_toHHMMSS(cur[0])}/${_toHHMMSS(cur[1])}`);
      // merge the timestamps
      stack.pop();
      stack.push([
        prev[0],
        cur[1],
      ]);
      continue;
    }

    stack.push(cur);
  }

  return stack;
}

function _toMilliseconds(timestamp) {
  if (typeof timestamp === 'number') {
    return timestamp;
  }

  // 00:00:21.520
  const regex = /^([0-9]+):([0-9]+):([0-9]+)\.([0-9]+)$/;
  const matched = timestamp.match(regex);

  if (!matched) {
    return -1;
  }
  const hh = Number(matched[1]);
  const mm = Number(matched[2]);
  const ss = Number(matched[3]);
  const ms = Number(matched[4]);

  return (
    (hh * 3600000) +
    (mm * 60000) +
    (ss * 1000) +
    ms
  );
}

function _toHHMMSS(msec, withMsec) {
  return CommonUtils.toHHMMSS(msec, withMsec);
}

function _setFilterSettings(userFilterSettings = {}) {
  try {
    const {
      analyseConversation = FilterSettings.analyseConversation,
    } = userFilterSettings;

    FilterSettings = {
      analyseConversation: !!(analyseConversation),
    };
  } catch (e) {
    // do nothing
  }
}

module.exports = StateTranscribeResults;
