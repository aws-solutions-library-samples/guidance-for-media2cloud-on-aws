// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../../../../../../../shared/localization.js';
import BaseAnalysisTab from '../../base/baseAnalysisTab.js';

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
    ImageCaptionTab: TITLE,
    ImageCaptionDesc: DESCRIPTION,
    NoData: MSG_NO_DATA,
  },
} = Localization;

export default class ImageCaptionTab extends BaseAnalysisTab {
  constructor(previewComponent, data) {
    super(TITLE, previewComponent);
    this.$data = data;
  }

  get data() {
    return this.$data;
  }

  async createContent() {
    const container = $('<div/>')
      .addClass('col-9 my-4 max-h36r');

    const desc = $('<p/>')
      .addClass('lead-sm')
      .append(DESCRIPTION);
    container.append(desc);

    if (this.data === undefined) {
      const message = $('<p/>')
        .addClass('lead')
        .append(MSG_NO_DATA);
      container.append(message);
    } else {
      let {
        output,
      } = this.data;
      output = await (await this.download(output)
        .then((res) =>
          res.Body.transformToString()));
      output = JSON.parse(output);

      const {
        usage: {
          inputTokens,
          outputTokens,
        },
        description,
        altText,
        fileName,
        location,
        tags,
      } = output;

      [
        ['Detail description:', description],
        ['One line ATL-TEXT:', altText],
        ['Recommended file name:', fileName],
        ['Location:', location],
        ['Top 5 relevant tags:', tags],
      ].forEach((field) => {
        const [name, item] = field;
        if (item !== undefined) {
          const section = $('<section/>');
          container.append(section);

          const title = $('<p/>')
            .addClass('b-400 mr-4')
            .append(name);
          section.append(title);

          if (!Array.isArray(item)) {
            let text = `${item.text} (Score: ${item.score}%)`;
            text = $('<p/>')
              .addClass('lead-s b-300')
              .addClass('font-italic')
              .append(text);

            section.append(text);
          } else {
            const ul = $('<ul/>')
              .addClass('lead-s b-300');
            section.append(ul);

            item.forEach((x) => {
              const li = $('<li/>')
                .addClass('font-italic')
                .append(`${x.text} (Score: ${x.score}%)`);
              ul.append(li);
            });
          }
        }
      });

      // usage
      const estimatedCost = ((
        (inputTokens * MODEL_PRICING.InputTokens) +
        (outputTokens * MODEL_PRICING.OutputTokens)
      ) / 1000).toFixed(4);

      const p = $('<p/>')
        .append(`(Total of <code>${inputTokens}</code> input tokens and <code>${outputTokens}</code> output tokens using ${MODEL_NAME}. Estimated code is <code>$${estimatedCost}</code>.)`);
      container.append(p);
    }

    return container;
  }
}
