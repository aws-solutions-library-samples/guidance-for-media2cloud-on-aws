// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../../../../../../shared/localization.js';
import ApiHelper from '../../../../../../shared/apiHelper.js';
import Spinner from '../../../../../../shared/spinner.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';
import mxAlert from '../../../../../../mixins/mxAlert.js';

class AlertHelper extends mxAlert(class {}) {}
const _alertAgent = new AlertHelper();

const {
  FoundationModels = [],
  ApiOps: {
    Genre,
    Sentiment,
    Summarize,
    Taxonomy,
    Theme,
    TVRatings,
    Custom,
  },
} = SolutionManifest;
const {
  Messages: {
    GenAITab: TITLE,
    Bedrock: MSG_BEDROCK_TITLE,
    BedrockDesc: MSG_BEDROCK_DESC,
    AdjustParameters: MSG_MODEL_PARAMETER_DESC,
    ModelName: MSG_MODEL_NAME,
    SelectModel: MSG_SELECT_MODEL,
    Template: MSG_TEMPLATED_PROMPT,
    Prompt: MSG_PROMPT,
    Temperature: MSG_MODEL_TEMPERATURE,
    TopK: MSG_MODEL_TOP_K,
    TopP: MSG_MODEL_TOP_P,
    MaxLength: MSG_MODEL_MAX_LENGTH,
    OriginalTranscriptPlaceholder: MSG_TRANSCRIPT_PLACEHOLDER,
  },
  Buttons: {
    SendRequest: BTN_SEND_REQUEST,
  },
  Tooltips: {
    SendRequest: TP_SEND_REQUEST,
    Prompt: TP_MODEL_PROMPT,
    Temperature: TP_MODEL_TEMPERATURE,
    TopK: TP_MODEL_TOP_K,
    TopP: TP_MODEL_TOP_P,
    MaxLength: TP_MODEL_MAX_LENGTH,
  },
  Alerts: {
    Oops: OOPS,
    BedrockServiceUnavailable: ERR_SERVICE_UNAVAILABLE,
    BedrockModelUnavailable: ERR_MODEL_UNAVAILABLE,
    BedrockAccessRequired: ERR_ACCESS_REQUIRED,
  },
} = Localization;

const TASK_SUMMARIZE = Summarize.split('/')[1];
const TASK_GENRE = Genre.split('/')[1];
const TASK_SENTIMENT = Sentiment.split('/')[1];
const TASK_RATING = TVRatings.split('/')[1];
const TASK_THEME = Theme.split('/')[1];
const TASK_TAXONOMY = Taxonomy.split('/')[1];
const TASK_CUSTOM = Custom.split('/')[1];

// disble text input by default
const ENABLE_TEXT_INPUT = false;

const DEFAULT_PROMPTS = [
  {
    name: 'Choose a prompt...',
    value: 'undefined',
  },
  {
    name: 'Summarize transcript',
    value: TASK_SUMMARIZE,
  },
  {
    name: 'Genre (Comedy, Action, Drama)',
    value: TASK_GENRE,
  },
  {
    name: 'Sentiment (Positive, Neural, Negative)',
    value: TASK_SENTIMENT,
  },
  {
    name: 'MPAA Rating (G, PG, PG-13)',
    value: TASK_RATING,
  },
  {
    name: 'Theme (Love, Justice, Man vs nature)',
    value: TASK_THEME,
  },
  {
    name: 'IAB Taxomony (Automotive, Business & Finance)',
    value: TASK_TAXONOMY,
  },
  {
    name: 'Passthrough your prompt',
    value: TASK_CUSTOM,
  },
];

async function _typeSentence(container, sentence, delay = 40) {
  let sentences;
  if (Array.isArray(sentence)) {
    sentences = sentence;
  } else {
    sentences = [sentence];
  }

  for (let i = 0; i < sentences.length; i += 1) {
    const text = sentences[i];
    for (let j = 0; j < text.length; j += 1) {
      await _pause(delay);
      container.append(text[j]);
    }
    container.append('<br/>');
  }
}

async function _pause(delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
}

function _promptResponse(res) {
  if (!res) {
    return '';
  }

  let output = ((res.content || [])[0] || {}).text || '';

  // check to see if it is in JSON format
  let idx = output.indexOf('{');
  if (idx >= 0) {
    output = output.slice(idx);
    idx = output.lastIndexOf('}');
    if (idx >= 0) {
      const texts = [];

      output = output.slice(0, idx + 1);
      output = JSON.parse(output);
      Object.values(output)
        .forEach((val) => {
          if (Array.isArray(val)) {
            val.forEach((x) => {
              texts.push(`${x.text} (Score: ${x.score}%)`);
            });
          } else {
            texts.push(`${val.text} (Score: ${val.score}%)`);
          }
        });
      output = texts;
    }
  }

  return output;
}

export default class GenAITab extends BaseAnalysisTab {
  constructor(previewComponent) {
    super(TITLE, previewComponent);

    this.$modelParameters = {
      top_k: 50,
      top_p: 80, // convert to 0.0 - 1.0 before sending request
      temperature: 60, // convert to 0.0 - 1.0 before sending request
      prompt: '',
      max_length: 4096,
    };
    Spinner.useSpinner();
  }

  static canSupport() {
    return FoundationModels.length > 0;
  }

  get modelParameters() {
    return this.$modelParameters;
  }

  get modelName() {
    return this.modelParameters.modelName;
  }

  set modelName(val) {
    this.modelParameters.modelName = val;
  }

  get prompt() {
    return this.modelParameters.prompt;
  }

  set prompt(val) {
    this.modelParameters.prompt = val;
  }

  get promptTemplate() {
    return this.modelParameters.promptTemplate;
  }

  set promptTemplate(val) {
    this.modelParameters.promptTemplate = val;
  }

  get transcriptInput() {
    return this.modelParameters.text_inputs;
  }

  set transcriptInput(val) {
    this.modelParameters.text_inputs = val;
  }

  get temperature() {
    return this.modelParameters.temperature;
  }

  set temperature(val) {
    this.modelParameters.temperature = Number(val);
  }

  get topK() {
    return this.modelParameters.top_k;
  }

  set topK(val) {
    this.modelParameters.top_k = Number(val);
  }

  get topP() {
    return this.modelParameters.top_p;
  }

  set topP(val) {
    this.modelParameters.top_p = Number(val);
  }

  get maxLength() {
    return this.modelParameters.max_length;
  }

  set maxLength(val) {
    this.modelParameters.max_length = Number(val);
  }

  async createContent() {
    const container = $('<div/>')
      .addClass('col-11 my-4 vh-50');

    // Synopsis
    const synopsisView = this.createSynposisView();
    container.append(synopsisView);

    return container;
  }

  createSynposisView() {
    const details = $('<details/>')
      .attr('open', '');

    const summary = $('<summary/>')
      .addClass('my-4');
    details.append(summary);

    const title = $('<span/>')
      .addClass('lead ml-2')
      .html(MSG_BEDROCK_TITLE);
    summary.append(title);

    // | textarea | controls |
    const innerContainer = $('<div/>')
      .addClass('row no-gutters');
    details.append(innerContainer);

    const desc = $('<p/>')
      .addClass('lead-s')
      .append(MSG_BEDROCK_DESC);
    innerContainer.append(desc);

    // (L) Textarea components
    const textareaContainer = $('<div/>')
      .addClass('col-7 m-0 p-0');
    innerContainer.append(textareaContainer);

    // transcript input
    const transcriptInput = this.createTranscriptInput();
    textareaContainer.append(transcriptInput);

    // output area
    const outputArea = this.createOutputArea();
    textareaContainer.append(outputArea);

    // (R) control form to re-run the model
    const formController = $('<div/>')
      .addClass('col-5 m-0 p-0 bg-secondary text-white');
    innerContainer.append(formController);

    const form = $('<form/>')
      .addClass('form-inline ml-4 mt-2')
      .addClass('synopsis-form');
    formController.append(form);

    const modelSelection = this.createModelSelection();
    form.append(modelSelection);

    // fine tune parameters
    const parameterDesc = $('<p/>')
      .addClass('lead-s my-2 col-12 px-0')
      .append(MSG_MODEL_PARAMETER_DESC);
    form.append(parameterDesc);

    // template prompts
    const templateGroup = this.createPromptTemplate();
    form.append(templateGroup);

    // prompt
    const promptGroup = this.createPromptGroup();
    form.append(promptGroup);

    // MaxLength
    const maxLengthGroup = this.createMaxLengthGroup();
    form.append(maxLengthGroup);

    // temperature
    const temperatureGroup = this.createTemperatureGroup();
    form.append(temperatureGroup);

    // Top-K
    const topKGroup = this.createTopKGroup();
    form.append(topKGroup);

    // Top-P
    const topPGroup = this.createTopPGroup();
    form.append(topPGroup);

    // Generate
    const submitBtn = this.createSubmitButton();
    form.append(submitBtn);

    // event handling
    form.submit(async (event) => {
      const btn = submitBtn.find('button');

      try {
        event.preventDefault();

        btn.attr('disabled', 'disabled');
        btn.tooltip('hide');

        const sentenceEl = outputArea.find('.sentence');
        sentenceEl.html('');

        await this.onSubmitPrompt(sentenceEl);
      } catch (e) {
        console.error(e);

        event.stopPropagation();
        this.shake(form);

        if (e.name === 'ServiceUnavailableException') {
          await this.showAlert(ERR_SERVICE_UNAVAILABLE);
        } else if (e.name === 'ResourceNotFoundException') {
          await this.showAlert(ERR_MODEL_UNAVAILABLE);
        } else if (e.name === 'AccessDeniedException') {
          await this.showAlert(ERR_ACCESS_REQUIRED);
        }
      } finally {
        Spinner.loading(false);
        btn.removeAttr('disabled');
      }
    });

    return details;
  }

  createTranscriptInput() {
    const textareaContainer = $('<div/>')
      .addClass('col-12 m-0 p-0');

    // text area to show synposis
    const textarea = $('<textarea/>')
      .addClass('form-control')
      .addClass('lead-xs b-300')
      .attr('rows', 11)
      .attr('cols', 80)
      .attr('placeholder', MSG_TRANSCRIPT_PLACEHOLDER);
    if (ENABLE_TEXT_INPUT === false) {
      textarea.prop('disabled', true);
    }
    textareaContainer.append(textarea);

    textarea.ready(async () => {
      const media = this.previewComponent.media;
      let output = (media.getTranscribeResults() || {}).output;
      if (output === undefined) {
        return;
      }

      output = await this.download(output)
        .then((res) => {
          if ((res || {}).Body === undefined) {
            return undefined;
          }
          return res.Body.transformToString();
        });

      if (output === undefined) {
        return;
      }

      output = JSON.parse(await output);
      output = output.results.transcripts[0].transcript;

      if (output.length === 0) {
        return;
      }

      // render the text
      this.transcriptInput = output;
      textarea.text([
        MSG_TRANSCRIPT_PLACEHOLDER,
        output,
      ].join('\n\n'));
    });

    // update transcript input when textarea being updated
    textarea.on('blur', () => {
      let val = textarea.val();

      // remove leading placeholder message
      val = val
        .split('\n')
        .filter((x) => {
          if (x === MSG_TRANSCRIPT_PLACEHOLDER) {
            return false;
          }
          if (x.length === 0) {
            return false;
          }
          return true;
        })
        .join('\n');

      this.transcriptInput = val;
    });

    return textareaContainer;
  }

  createOutputArea() {
    // output
    const outputContainer = $('<div/>')
      .addClass('col-12 m-0 p-0')
      .addClass('bg-dark text-light');

    const textarea = $('<div/>')
      .addClass('typing-container')
      .addClass('overflow-auto')
      .addClass('w-100');
    outputContainer.append(textarea);

    const id = `sentence-${this.id}`;
    const sentence = $('<span/>')
      .attr('id', id)
      .addClass('sentence')
      .addClass('input-cursor')
      .addClass('m-2');
    textarea.append(sentence);

    return outputContainer;
  }

  createModelSelection() {
    const label = $('<span/>')
      .addClass('lead-s my-4')
      .html(MSG_MODEL_NAME);

    const select = $('<select/>')
      .addClass('custom-select custom-select-sm')
      .addClass('col-9 mx-2 p-1');

    let option = $('<option/>')
      .attr('value', 'undefined')
      .append(MSG_SELECT_MODEL);
    select.append(option);

    const options = FoundationModels.map((model) => {
      option = $('<option/>')
        .attr('value', model.value)
        .append(model.name);
      return option;
    });
    select.append(options);

    // update model name on change event
    select.on('change', () => {
      const val = select.val();
      if (val === 'undefined') {
        this.modelName = undefined;
      }
      this.modelName = val;
    });

    return [
      label,
      select,
    ];
  }

  createPromptTemplate() {
    const promptGroup = $('<div/>')
      .addClass('form-group')
      .addClass('col-12 px-0 mt-2 mb-2');

    const id = `template-${this.id}`;
    const label = $('<label/>')
      .addClass('lead-s col-2 px-0 justify-content-start')
      .attr('for', id)
      .html(MSG_TEMPLATED_PROMPT);
    promptGroup.append(label);

    const select = $('<select/>')
      .addClass('custom-select custom-select-sm')
      .addClass('col-9 m-0 p-1 ml-4');
    promptGroup.append(select);

    let options;
    if (ENABLE_TEXT_INPUT === false) {
      options = DEFAULT_PROMPTS
        .filter((x) =>
          x.value !== TASK_CUSTOM);
    } else {
      options = DEFAULT_PROMPTS;
    }

    options = options
      .map((prompt) => {
        const option = $('<option/>')
          .attr('value', prompt.value)
          .append(prompt.name);
        return option;
      });

    options[0].attr('selected', 'selected');
    select.append(options);

    const inputId = `prompt-${this.id}`;

    // update model name on change event
    select.on('change', () => {
      let text;
      const template = select.val();

      if (template === 'undefined') {
        this.promptTemplate = undefined;
        text = '';
      } else {
        this.promptTemplate = template;
        if (template === TASK_CUSTOM) {
          text = '';
        } else {
          text = select.children('option:selected').text();
        }
      }

      const promptInput = this.tabContent.find(`input#${inputId}`);
      promptInput.val(text);
      promptInput.blur();
    });

    return promptGroup;
  }

  createPromptGroup() {
    const promptGroup = $('<div/>')
      .addClass('form-group')
      .addClass('col-12 px-0 mt-2 mb-2');

    const id = `prompt-${this.id}`;
    const promptLabel = $('<label/>')
      .addClass('lead-s col-2 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TP_MODEL_PROMPT)
      .html(MSG_PROMPT);
    promptLabel.tooltip({
      trigger: 'hover',
    });
    promptGroup.append(promptLabel);

    const promptInput = $('<input/>')
      .addClass('form-control form-control-sm')
      .addClass('col-9 m-0 p-1 ml-4 lead-xs b-300')
      .attr('id', id)
      .attr('type', 'text')
      .attr('placeholder', '(Summarize text)');
    if (ENABLE_TEXT_INPUT === false) {
      promptInput.prop('disabled', true);
    }
    promptGroup.append(promptInput);

    promptInput.on('blur', () => {
      this.prompt = promptInput.val();
    });

    return promptGroup;
  }

  createTemperatureGroup() {
    const temperatureGroup = $('<div/>')
      .addClass('form-group')
      .addClass('col-12 px-0 mt-2 mb-2');

    const id = `temperature-${this.id}`;
    const temperatureLabel = $('<label/>')
      .addClass('lead-s col-2 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TP_MODEL_TEMPERATURE)
      .html(MSG_MODEL_TEMPERATURE);
    temperatureLabel.tooltip({
      trigger: 'hover',
    });
    temperatureGroup.append(temperatureLabel);

    let temperatureValue = this.temperature;
    const temperatureRange = $('<input/>')
      .addClass('custom-range')
      .addClass('col-7 m-0 pr-2 ml-4')
      .attr('type', 'range')
      .attr('min', 0)
      .attr('max', 100)
      .attr('value', temperatureValue)
      .attr('step', 1)
      .attr('id', id);
    temperatureGroup.append(temperatureRange);

    const temperatureText = $('<input/>')
      .addClass('col-2 text-center text-muted p-0 lead-xs b-500')
      .attr('type', 'text')
      .attr('value', temperatureValue / 100)
      .attr('disabled', 'disabled')
      .attr('id', `${id}-text`);
    temperatureGroup.append(temperatureText);

    temperatureRange.on('input', () => {
      temperatureValue = Number(temperatureRange.val());
      temperatureText.val(temperatureValue / 100);
      this.temperature = temperatureValue;
    });

    return temperatureGroup;
  }

  createTopKGroup() {
    const topKGroup = $('<div/>')
      .addClass('form-group')
      .addClass('col-12 px-0 mt-2 mb-2');

    const id = `topk-${this.id}`;
    const topKLabel = $('<label/>')
      .addClass('lead-s col-2 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TP_MODEL_TOP_K)
      .html(MSG_MODEL_TOP_K);
    topKLabel.tooltip({
      trigger: 'hover',
    });
    topKGroup.append(topKLabel);

    let topKValue = this.topK;
    const topKRange = $('<input/>')
      .addClass('custom-range')
      .addClass('col-7 m-0 pr-2 ml-4')
      .attr('type', 'range')
      .attr('min', 0)
      .attr('max', 100)
      .attr('value', topKValue)
      .attr('step', 1)
      .attr('id', id);
    topKGroup.append(topKRange);

    const topKText = $('<input/>')
      .addClass('col-2 text-center text-muted p-0 lead-xs b-500')
      .attr('type', 'text')
      .attr('value', topKValue)
      .attr('disabled', 'disabled')
      .attr('id', `${id}-text`);
    topKGroup.append(topKText);

    topKRange.on('input', () => {
      topKValue = Number(topKRange.val());
      topKText.val(topKValue);
      this.topK = topKValue;
    });

    return topKGroup;
  }

  createTopPGroup() {
    const topPGroup = $('<div/>')
      .addClass('form-group')
      .addClass('col-12 px-0 mt-2 mb-2');

    const id = `topp-${this.id}`;
    const topPLabel = $('<label/>')
      .addClass('lead-s col-2 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TP_MODEL_TOP_P)
      .html(MSG_MODEL_TOP_P);
    topPLabel.tooltip({
      trigger: 'hover',
    });
    topPGroup.append(topPLabel);

    let topPValue = this.topP;
    const topPRange = $('<input/>')
      .addClass('custom-range')
      .addClass('col-7 m-0 pr-2 ml-4')
      .attr('type', 'range')
      .attr('min', 0)
      .attr('max', 100)
      .attr('value', topPValue)
      .attr('step', 1)
      .attr('id', id);
    topPGroup.append(topPRange);

    const topPText = $('<input/>')
      .addClass('col-2 text-center text-muted p-0 lead-xs b-500')
      .attr('type', 'text')
      .attr('value', topPValue / 100)
      .attr('disabled', 'disabled')
      .attr('id', `${id}-text`);
    topPGroup.append(topPText);

    topPRange.on('input', () => {
      topPValue = Number(topPRange.val());
      topPText.val(topPValue / 100);
      this.topP = topPValue;
    });

    return topPGroup;
  }

  createMaxLengthGroup() {
    const maxLenGroup = $('<div/>')
      .addClass('form-group')
      .addClass('col-12 px-0 mt-2 mb-2');

    const id = `maxlen-${this.id}`;
    const maxLenLabel = $('<label/>')
      .addClass('lead-s col-2 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TP_MODEL_MAX_LENGTH)
      .html(MSG_MODEL_MAX_LENGTH);
    maxLenLabel.tooltip({
      trigger: 'hover',
    });
    maxLenGroup.append(maxLenLabel);

    let maxLenValue = this.maxLength;
    const maxLenRange = $('<input/>')
      .addClass('custom-range')
      .addClass('col-7 m-0 pr-2 ml-4')
      .attr('type', 'range')
      .attr('min', 10)
      .attr('max', 4096)
      .attr('value', maxLenValue)
      .attr('step', 1)
      .attr('id', id);
    maxLenGroup.append(maxLenRange);

    const maxLenText = $('<input/>')
      .addClass('col-2 text-center text-muted p-0 lead-xs b-500')
      .attr('type', 'text')
      .attr('value', maxLenValue)
      .attr('disabled', 'disabled')
      .attr('id', `${id}-text`);
    maxLenGroup.append(maxLenText);

    maxLenRange.on('input', () => {
      maxLenValue = Number(maxLenRange.val());
      maxLenText.val(maxLenValue);
      this.maxLength = maxLenValue;
    });

    return maxLenGroup;
  }

  createSubmitButton() {
    const btnGroup = $('<div/>')
      .addClass('form-group')
      .addClass('col-12 px-0 mt-2 mb-2');

    const submitBtn = $('<button/>')
      .addClass('btn btn-success mx-auto mt-4')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TP_SEND_REQUEST)
      .html(BTN_SEND_REQUEST)
      .tooltip({
        trigger: 'hover',
      });
    btnGroup.append(submitBtn);

    return btnGroup;
  }

  // on submit event
  async onSubmitPrompt(sentenceEl) {
    const params = {};

    const task = this.promptTemplate;
    const prompt = this.prompt;

    if (!task) {
      throw new Error('no prompt is selected');
    }

    if (task === Custom && !prompt) {
      throw new Error('no prompt is selected');
    }
    params.prompt = prompt;

    if (this.modelName === undefined) {
      throw new Error('modelName not specified');
    }
    params.model = this.modelName;

    if (this.temperature > 0) {
      params.temperature = Number(this.temperature) / 100;
    }

    if (this.topK > 0) {
      params.top_k = Number(this.topK);
    }

    if (this.topP > 0) {
      params.top_p = Number(this.topP) / 100;
    }

    if (this.maxLength > 0) {
      params.max_length = Number(this.maxLength);
    }

    if (this.transcriptInput.length === 0) {
      throw new Error('no text is specified');
    }
    params.text_inputs = this.transcriptInput;

    Spinner.loading(true);

    // check prompt type
    let promise;

    if (task === TASK_SUMMARIZE) {
      promise = ApiHelper.promptSummarize(params);
    } else if (task === TASK_GENRE) {
      promise = ApiHelper.promptGenre(params);
    } else if (task === TASK_SENTIMENT) {
      promise = ApiHelper.promptSentiment(params);
    } else if (task === TASK_RATING) {
      promise = ApiHelper.promptTVRatings(params);
    } else if (task === TASK_THEME) {
      promise = ApiHelper.promptTheme(params);
    } else if (task === TASK_TAXONOMY) {
      promise = ApiHelper.promptTaxonomy(params);
    } else if (task === TASK_CUSTOM) {
      promise = ApiHelper.promptCustom(params);
    }

    promise = await promise;
    Spinner.loading(false);

    const {
      usage,
    } = promise || {};

    promise = _promptResponse(promise);
    await _typeSentence(sentenceEl, promise);

    return this.onPromptEnd(sentenceEl, usage, params.prompt);
  }

  async onPromptEnd(sentenceEl, usage, prompt) {
    const {
      input_tokens: inputTokens = -1,
      output_tokens: outputTokens = -1,
    } = usage || {};

    if (inputTokens > 0 && outputTokens > 0) {
      sentenceEl.append('<br>----<br>');

      // Claude pricing (Haiku vs Sonnet)
      let pricing = {
        inputTokens: 0.00025,
        outputTokens: 0.00125,
      };

      if (this.modelName.indexOf('sonnet') > 0) {
        pricing = {
          inputTokens: 0.00300,
          outputTokens: 0.01500,
        };
      }

      const estimatedCost = ((
        (inputTokens * pricing.inputTokens) +
        (outputTokens * pricing.outputTokens)
      ) / 1000).toFixed(4);
      const text = `Total ${inputTokens} input tokens and ${outputTokens} output tokens. Estimated cost is $${estimatedCost}`;
      await _typeSentence(sentenceEl, text, 20);
    }

    sentenceEl.append('<br>----<br>');
    const _prompt = `(Original prompt: ${prompt})`;
    await _typeSentence(sentenceEl, _prompt, 20);
  }

  shake(element, delay = 200) {
    _alertAgent.shake(element, delay);
  }

  async showAlert(message, duration = 4000) {
    return _alertAgent.showMessage(
      this.tabContent,
      'danger',
      OOPS,
      message,
      duration
    );
  }
}
