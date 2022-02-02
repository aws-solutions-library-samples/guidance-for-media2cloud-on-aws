// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../shared/localization.js';
import VideoPreview from '../../../../../../shared/media/preview/videoPreview.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';

export default class TranscribeTab extends BaseAnalysisTab {
  constructor(previewComponent, defaultTab = false) {
    super(Localization.Messages.TranscribeTab, previewComponent, defaultTab);
  }

  async createContent() {
    const col = $('<div/>').addClass('col-9 my-4 max-h36r');
    const on = this.previewComponent.trackIsEnabled(VideoPreview.Constants.Subtitle);
    const input = $('<input/>')
      .attr('type', 'checkbox')
      .attr('data-category', 'transcribe')
      .attr('data-type', 'subtitle')
      .attr('checked', on);
    input.off('click').on('click', async (event) => {
      const checked = input.prop('checked');
      await this.previewComponent.trackToggle(VideoPreview.Constants.Subtitle, checked);
    });

    const toggle = $('<div/>').addClass('form-group px-0 mt-2 mb-42')
      .append($('<div/>').addClass('input-group')
        .append($('<label/>').addClass('xs-switch')
          .append(input)
          .append($('<span/>').addClass('xs-slider round')))
        .append($('<span/>').addClass('lead ml-2')
          .html(Localization.Messages.SubtitleSwitch)));

    const view = this.previewComponent.getSubtitleView();
    view.on(VideoPreview.Events.Track.Loaded, (event, track) => {
      /*
      if (this.previewComponent.trackIsSub(track)) {
        input.prop('checked', true);
      }
      */
    });
    return col.append(toggle).append(view);
  }
}
