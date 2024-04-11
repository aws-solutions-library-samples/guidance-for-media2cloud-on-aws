// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  M2CException,
} = require('core-lib');
const {
  TASK: {
    Genre,
    Sentiment,
    Summarize,
    Taxonomy,
    Theme,
    TVRatings,
    Custom,
  },
  LIST_OF_GENRES,
  LIST_OF_RATINGS,
  LIST_OF_SENTIMENTS,
  LIST_OF_THEMES,
  LIST_OF_TAXONOMY,
} = require('./defs');
const BaseModel = require('./baseModel');

const MODEL_ID = process.env.ENV_BEDROCK_MODEL_ID;
const MODEL_VERSION = process.env.ENV_BEDROCK_MODEL_VER;
const SYSTEM = 'You are a media operation engineer responsible for reviewing transcripts and assigning appropriate {{TASK}} to dialogues. Your task is to identify the top 3 relevant {{TASK}} for a given dialogue and provide a confidence score from 0 to 100. The output should be in JSON format. Skip any explanation in the output.';
const SYSTEM_SUMMARY = 'You are a media operation engineer responsible for reviewing transcripts and summarize the dialogues into one or two paragraphs and provide a confidence score from 0 to 100. The output should be in JSON format. Skip any explanation in the output.';
const SYSTEM_CUSTOM = 'You are a media operation engineer responsible for reviewing transcripts and answer the following question and provide a confidence score from 0 to 100. The output should be in JSON format. Skip any explanation in the output.';

const DEFAULT_PARAMS = {
  anthropic_version: MODEL_VERSION,
  max_tokens: 4096 * 4,
  temperature: 0.2,
  top_p: 0.1,
  top_k: 250,
  stop_sequences: ['\n\nHuman:'],
};

class Claude extends BaseModel {
  static canSupport(modelId) {
    return (
      modelId.startsWith('anthropic.claude') &&
      BaseModel.canSupport(modelId)
    );
  }

  get modelId() {
    return MODEL_ID;
  }

  get modelVersion() {
    return MODEL_VERSION;
  }

  async inference(task, inputParams) {
    const modelParams = _createModelInput(task, inputParams);

    const params = {
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(modelParams),
    };

    const response = await this.invokeModel(params)
      .then((res) => ({
        ...res,
        prompt: inputParams.prompt,
      }));

    const {
      content = [],
    } = response;

    if ((content[0] || {}).text) {
      content[0].text = _parseOutputContent(content[0].text);
    }

    return response;
  }
}

module.exports = Claude;

// local scope
function _parseOptions(defaultParams, options = {}) {
  const params = {
    ...defaultParams,
  };

  if (options.temperature) {
    const temperature = Number(options.temperature);
    if (temperature > 0 && temperature < 1.0) {
      params.temperature = temperature;
    }
  }

  if (options.top_k) {
    const topK = Number(options.top_k);
    if (topK > 0 && topK < 500) {
      params.top_k = topK;
    }
  }

  if (options.top_p) {
    const topP = Number(options.top_p);
    if (topP > 0 && topP < 1.0) {
      params.top_p = topP;
    }
  }

  if (options.max_length) {
    const maxLength = Number(options.max_length);
    if (maxLength > 0 && maxLength < 4096) {
      params.max_tokens = maxLength;
    }
  }

  return params;
}

function _textInput(options) {
  if (!options.text_inputs) {
    throw new M2CException('text_inputs not specified');
  }

  return options.text_inputs;
}

function _createModelInput(task, inputParams = {}) {
  if (task === Genre) {
    return _createGenrePrompt(inputParams);
  }

  if (task === Sentiment) {
    return _createSentimentPrompt(inputParams);
  }

  if (task === Summarize) {
    return _createSummarizePrompt(inputParams);
  }

  if (task === Taxonomy) {
    return _createTaxonomyPrompt(inputParams);
  }

  if (task === Theme) {
    return _createThemePrompt(inputParams);
  }

  if (task === TVRatings) {
    return _createTVRatingsPrompt(inputParams);
  }

  if (task === Custom) {
    return _createCustomPrompt(inputParams);
  }

  throw new M2CException('invalid prompt parameter');
}

function _createModelParams(task, categoryList, outputJson, inputParams) {
  const tag = task.replace(/\s/g, '_').toLowerCase();

  const list = [
    `<${tag}>`,
    ...categoryList,
    'None of the above',
    `</${tag}>`,
  ];

  const system = SYSTEM
    .replaceAll('{{TASK}}', task);

  const messages = [];

  const providedList = `Here is a list of the ${task} in <${tag}> tag to consider:\n${list.join('\n')}\n.`;
  messages.push({
    role: 'user',
    content: providedList,
  });

  messages.push({
    role: 'assistant',
    content: `Got the list of the ${task}. Can you provide the transcript?`,
  });

  const transcript = _textInput(inputParams);
  messages.push({
    role: 'user',
    content: `Transcript in <transcript> tag:\n<transcript>${transcript}\n</transcript>`,
  });

  messages.push({
    role: 'assistant',
    content: 'Got the transcript. What output format?',
  });

  const output = `Return JSON format. An example of the output:\n${JSON.stringify(outputJson)}\n. Only answer from the provided list.`;
  messages.push({
    role: 'user',
    content: output,
  });

  // prefill output
  messages.push({
    role: 'assistant',
    content: '{',
  });

  let params = _parseOptions(DEFAULT_PARAMS);
  params = {
    ...params,
    system,
    messages,
  };

  return params;
}

function _createGenrePrompt(options) {
  const example = {
    genres: [
      {
        text: 'Comedy',
        score: 98,
      },
      {
        text: 'Romance',
        score: 80,
      },
    ],
  };

  return _createModelParams(
    'Genres',
    LIST_OF_GENRES,
    example,
    options
  );
}

function _createTaxonomyPrompt(options) {
  const example = {
    taxonomies: [
      {
        text: 'Station Wagon',
        score: 98,
      },
      {
        text: 'Board Games and Puzzles',
        score: 80,
      },
    ],
  };

  const taxonomies = LIST_OF_TAXONOMY
    .map((x) =>
      x.Name);

  return _createModelParams(
    'IAB Taxonomies',
    taxonomies,
    example,
    options
  );
}

function _createThemePrompt(options) {
  const example = {
    themes: [
      {
        text: 'Good versus evil',
        score: 98,
      },
      {
        text: 'War',
        score: 80,
      },
    ],
  };

  return _createModelParams(
    'Themes',
    LIST_OF_THEMES,
    example,
    options
  );
}

// single output
function _createTVRatingsPrompt(options) {
  const example = {
    ratings: {
      text: 'PG-13',
      score: 98,
    },
  };

  const modelParams = _createModelParams(
    'Motion Picture Ratings',
    LIST_OF_RATINGS,
    example,
    options
  );

  modelParams.system = modelParams.system
    .replace('top 3', 'most');

  return modelParams;
}

function _createSentimentPrompt(options) {
  const example = {
    sentiment: {
      text: 'Positive',
      score: 98,
    },
  };

  const modelParams = _createModelParams(
    'Sentiment',
    LIST_OF_SENTIMENTS,
    example,
    options
  );

  modelParams.system = modelParams.system
    .replace('top 3', 'most');

  return modelParams;
}

function _createSummarizePrompt(options) {
  const system = SYSTEM_SUMMARY;
  const messages = [];

  const transcript = _textInput(options);
  messages.push({
    role: 'user',
    content: `Transcript in <transcript> tag:\n<transcript>${transcript}\n</transcript>`,
  });

  messages.push({
    role: 'assistant',
    content: 'I\'ve received the transcript. What output format would you like?',
  });

  const example = {
    summary: {
      text: 'The transcript describes ...',
      score: 98,
    },
  };

  const output = `Return JSON format. An example of the output:\n${JSON.stringify(example)}`;
  messages.push({
    role: 'user',
    content: output,
  });

  messages.push({
    role: 'assistant',
    content: '{',
  });

  let params = _parseOptions(DEFAULT_PARAMS);
  params = {
    ...params,
    anthropic_version: MODEL_VERSION,
    stop_sequences: ['\n\nHuman:'],
    system,
    messages,
  };

  return params;
}

function _createCustomPrompt(options) {
  const system = SYSTEM_CUSTOM;
  const messages = [];

  const transcript = _textInput(options);
  messages.push({
    role: 'user',
    content: `Transcript in <transcript> tag:\n<transcript>${transcript}\n</transcript>\n${options.prompt}`,
  });

  messages.push({
    role: 'assistant',
    content: 'I\'ve received the transcript. What output format would you like?',
  });

  const example = {
    custom: {
      text: 'Answer goes here',
      score: 98,
    },
  };

  const output = `Return JSON format. An example of the output:\n${JSON.stringify(example)}`;
  messages.push({
    role: 'user',
    content: output,
  });

  messages.push({
    role: 'assistant',
    content: '{',
  });

  let params = _parseOptions(DEFAULT_PARAMS);
  params = {
    ...params,
    anthropic_version: MODEL_VERSION,
    stop_sequences: ['\n\nHuman:'],
    system,
    messages,
  };

  return params;
}

function _parseOutputContent(text) {
  if (!text) {
    return text;
  }

  let jsonstring = text;
  if (jsonstring[0] !== '{') {
    jsonstring = `{${jsonstring}`;
  }

  let data;

  try {
    data = JSON.parse(jsonstring);
    return JSON.stringify(data);
  } catch (e) {
    // do nothing
  }

  // find '{' and '}' boundary to parse again.
  let idx = jsonstring.indexOf('{');
  if (idx < 0) {
    return text;
  }
  jsonstring = jsonstring.slice(idx);

  idx = jsonstring.lastIndexOf('}');
  if (idx < 0) {
    return text;
  }
  jsonstring = jsonstring.slice(0, idx + 1);

  try {
    data = JSON.parse(jsonstring);
  } catch (e) {
    // do nothing
  }

  return JSON.stringify(data);
}
