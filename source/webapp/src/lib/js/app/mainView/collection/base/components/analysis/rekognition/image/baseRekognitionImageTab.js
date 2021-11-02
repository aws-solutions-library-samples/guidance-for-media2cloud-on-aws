// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import Localization from '../../../../../../../shared/localization.js';
import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import BaseAnalysisTab from '../../base/baseAnalysisTab.js';

export default class BaseRekognitionImageTab extends BaseAnalysisTab {
  constructor(category, previewComponent, data, defaultTab = false) {
    const tabName = category === AnalysisTypes.Rekognition.Celeb
      ? Localization.Messages.CelebTab
      : category === AnalysisTypes.Rekognition.Label
        ? Localization.Messages.LabelTab
        : category === AnalysisTypes.Rekognition.Face
          ? Localization.Messages.FaceTab
          : category === AnalysisTypes.Rekognition.FaceMatch
            ? Localization.Messages.FaceMatchTab
            : category === AnalysisTypes.Rekognition.Moderation
              ? Localization.Messages.ModerationTab
              : category === AnalysisTypes.Rekognition.Person
                ? Localization.Messages.PersonTab
                : category === AnalysisTypes.Rekognition.Text
                  ? Localization.Messages.TextTab
                  : category === AnalysisTypes.Rekognition.Segment
                    ? Localization.Messages.SegmentTab
                    : category === AnalysisTypes.Rekognition.CustomLabel
                      ? Localization.Messages.CustomLabelTab
                      : 'Unknown';
    super(tabName, previewComponent, defaultTab);
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
