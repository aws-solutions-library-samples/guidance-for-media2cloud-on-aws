// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../../shared/localization.js';
import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import BaseAnalysisTab from '../../base/baseAnalysisTab.js';

const {
  Messages: {
    CelebTab: CELEB_TAB,
    LabelTab: LABEL_TAB,
    FaceTab: FACE_TAB,
    FaceMatchTab: FACEMATCH_TAB,
    ModerationTab: MODERATION_TAB,
    PersonTab: PERSON_TAB,
    TextTab: TEXT_TAB,
    SegmentTab: SEGMENT_TAB,
    CustomLabelTab: CUSTOMLABEL_TAB,
  },
} = Localization;

const {
  Rekognition: {
    Celeb,
    Label,
    Face,
    FaceMatch,
    Moderation,
    Person,
    Text,
    Segment,
    CustomLabel,
  },
} = AnalysisTypes;

export default class BaseRekognitionImageTab extends BaseAnalysisTab {
  constructor(category, previewComponent, data) {
    let title = 'Unknown';

    if (category === Celeb) {
      title = CELEB_TAB;
    } else if (category === Label) {
      title = LABEL_TAB;
    } else if (category === Face) {
      title = FACE_TAB;
    } else if (category === FaceMatch) {
      title = FACEMATCH_TAB;
    } else if (category === Moderation) {
      title = MODERATION_TAB;
    } else if (category === Person) {
      title = PERSON_TAB;
    } else if (category === Text) {
      title = TEXT_TAB;
    } else if (category === Segment) {
      title = SEGMENT_TAB;
    } else if (category === CustomLabel) {
      title = CUSTOMLABEL_TAB;
    }

    super(title, previewComponent);
    this.$category = category;
    this.$data = data;
  }

  get category() {
    return this.$category;
  }

  get data() {
    return this.$data;
  }

  async createContent() {
    const col = $('<div/>').addClass('col-9 my-4 max-h36r');
    const canvases = this.createCanvasButtons(this.category);
    if (!canvases.length) {
      return super.createContent();
    }
    const enableAll = this.createEnableAll(canvases);
    col.append(enableAll);
    canvases.forEach(btn => col.append(btn));
    return col;
  }

  createCanvasButtons(category) {
    const canvases = this.previewComponent.getCanvasesByType(category);
    const btns = canvases.map((canvas) => {
      const btn = $('<button/>').addClass('btn btn-sm btn-primary text-capitalize mb-1 ml-1')
        .attr('type', 'button')
        .attr('data-toggle', 'button')
        .attr('aria-pressed', false)
        .attr('autocomplete', 'off')
        .attr('data-canvas-id', canvas.id)
        .attr('data-placement', 'bottom')
        .attr('title', `${Localization.Tooltips.Confidence}: ${canvas.confidence}%`)
        .append(canvas.name)
        .tooltip({
          trigger: 'hover',
        });
      btn.off('click').on('click', async (event) => {
        btn.tooltip('hide');
        const enableNow = btn.attr('aria-pressed') === 'false';
        return this.previewComponent.canvasToggle(canvas.id, enableNow);
      });
      return btn;
    });
    return btns;
  }
}
