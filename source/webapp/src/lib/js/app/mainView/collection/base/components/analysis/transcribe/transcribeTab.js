// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import mxAlert from '../../../../../../mixins/mxAlert.js';
import Localization from '../../../../../../shared/localization.js';
import VideoPreview from '../../../../../../shared/media/preview/videoPreview.js';
import Spinner from '../../../../../../shared/spinner.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';

const {
  FoundationModels = [],
} = SolutionManifest;

const {
  name: MODEL_NAME = '',
  value: MODEL_ID = '',
} = FoundationModels[0] || {};

const MODEL_PRICING = (MODEL_ID.indexOf('sonnet') > 0)
  ? {
    InputTokens: 0.00300,
    OutputTokens: 0.01500,
  }
  : {
    InputTokens: 0.00025,
    OutputTokens: 0.00125,
  };

const {
  Messages: {
    TranscribeTab: TITLE,
    SubtitleSwitch: MSG_SUBTITLE_SWITCH,
    ShowTranscript: MSG_SHOW_TRANSCRIPT,
    NoData: MSG_NO_DATA,
  },
} = Localization;
const {
  Constants: {
    Subtitle,
  },
  Events: {
    Track: {
      Loaded: TRACK_LOADED_EVENT,
    },
  },
} = VideoPreview;

export default class TranscribeTab extends mxAlert(BaseAnalysisTab) {
  constructor(previewComponent) {
    super(TITLE, previewComponent);
    Spinner.useSpinner();
  }

  async createContent() {
    const container = $('<div/>')
      .addClass('col-11 my-4 max-h36r');

    // subtitle switch
    const subtitleSwitch = this.createSubtitleSwitch();
    container.append(subtitleSwitch);

    // Transcript
    const transcriptView = this.createTranscriptView();
    container.append(transcriptView);

    // Conversation changes
    const conversationView = this.createConversationView();
    container.append(conversationView);

    return container;
  }

  createSubtitleSwitch() {
    const formGroup = $('<div/>')
      .addClass('form-group px-0 mt-2 mb-2');

    const inputGroup = $('<div/>')
      .addClass('input-group');
    formGroup.append(inputGroup);

    const label = $('<label/>')
      .addClass('xs-switch');
    inputGroup.append(label);

    const on = this.previewComponent.trackIsEnabled(Subtitle);
    const input = $('<input/>')
      .attr('type', 'checkbox')
      .attr('data-category', 'transcribe')
      .attr('data-type', 'subtitle')
      .attr('checked', on);
    label.append(input);

    const xslider = $('<span/>')
      .addClass('xs-slider round');
    label.append(xslider);

    const subtitleDesc = $('<span/>')
      .addClass('lead ml-2')
      .html(MSG_SUBTITLE_SWITCH);
    inputGroup.append(subtitleDesc);

    // event handling
    input.on('click', async (event) => {
      const checked = input.prop('checked');
      await this.previewComponent.trackToggle(Subtitle, checked);
    });

    return formGroup;
  }

  createTranscriptView() {
    const details = $('<details/>');

    const summary = $('<summary/>')
      .addClass('my-4');
    details.append(summary);

    let languageCode = this.previewComponent.media.getTranscribeResults();
    languageCode = (languageCode || {}).languageCode;

    let title = MSG_SHOW_TRANSCRIPT
      .replace('{{LANGUAGECODE}}', languageCode);

    title = $('<span/>')
      .addClass('lead ml-2')
      .html(title);
    summary.append(title);

    const view = this.previewComponent.getSubtitleView();
    details.append(view);

    // event handling
    view.on(TRACK_LOADED_EVENT, (event, track) => {
      /*
      if (this.previewComponent.trackIsSub(track)) {
        input.prop('checked', true);
      }
      */
    });

    return details;
  }

  createConversationView() {
    const details = $('<details/>');

    const summary = $('<summary/>')
      .addClass('my-4');
    details.append(summary);

    let languageCode = this.previewComponent.media.getTranscribeResults();
    languageCode = (languageCode || {}).languageCode;

    let title = 'Conversation analysis <code>(powered by Amazon Bedrock)</code>';
    title = $('<span/>')
      .addClass('lead ml-2')
      .html(title);
    summary.append(title);

    details.ready(async () => {
      try {
        Spinner.loading();

        const results = this.previewComponent.media.getTranscribeResults();
        let {
          conversations,
        } = results || {};

        if (!conversations) {
          throw new Error(MSG_NO_DATA);
        }

        conversations = await this.download(conversations);
        if (conversations) {
          conversations = await conversations.Body.transformToString()
            .then((res) =>
              JSON.parse(res));

          const {
            usage: {
              inputTokens,
              outputTokens,
            },
            chapters,
          } = conversations;

          // build the list
          const table = this.buildConversationTable(chapters);
          details.append(table);

          // usage
          const estimatedCost = ((
            (inputTokens * MODEL_PRICING.InputTokens) +
            (outputTokens * MODEL_PRICING.OutputTokens)
          ) / 1000).toFixed(4);

          const p = $('<p/>')
            .append(`(Total of <code>${inputTokens}</code> input tokens and <code>${outputTokens}</code> output tokens using ${MODEL_NAME}. Estimated code is <code>$${estimatedCost}</code>.)`);
          details.append(p);

          // const pre = $('<pre/>')
          //   .append(JSON.stringify(conversations, null, 2));
          // details.append(pre);
        }
      } catch (e) {
        console.error(e);
        const noData = $('<p/>')
          .addClass('lead-s text-muted')
          .append(e.message);

        details.append(noData);
      } finally {
        Spinner.loading(false);
      }
    });

    return details;
  }

  buildConversationTable(conversations) {
    const table = $('<table/>')
      .addClass('table lead-xs');

    const thead = $('<thead/>');
    table.append(thead);

    let tr = $('<tr/>');
    thead.append(tr);

    const headers = ['#', 'Start', 'End', 'Topic']
      .map((text) => {
        const th = $('<th/>')
          .addClass('align-middle text-left b-300')
          .attr('scope', 'col')
          .append(text);
        return th;
      });
    tr.append(headers);

    const tbody = $('<tbody/>');
    table.append(tbody);

    // add row
    for (let i = 0; i < conversations.length; i += 1) {
      const conversation = conversations[i];
      const {
        start,
        end,
        reason,
      } = conversation;

      tr = $('<tr/>');
      tbody.append(tr);

      let td = $('<td/>')
        .append(String(i + 1));
      tr.append(td);

      td = $('<td/>')
        .append(_toHHMMSS(start));
      tr.append(td);

      td = $('<td/>')
        .append(_toHHMMSS(end));
      tr.append(td);

      td = $('<td/>')
        .append(reason);
      tr.append(td);
    }

    return table;
  }
}

function _toHHMMSS(timestamp, hhmmssOnly = false) {
  if (typeof timestamp === 'string') {
    return timestamp;
  }

  return TranscribeTab.readableDuration(timestamp, hhmmssOnly);
}
