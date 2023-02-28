// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../../shared/localization.js';
import BaseAnalysisTab from '../../base/baseAnalysisTab.js';

const TITLE = Localization.Messages.ImageCaptionTab;
const DESC = Localization.Messages.ImageCaptionDesc;
const NO_DATA = Localization.Messages.NoData;

export default class ImageCaptionTab extends BaseAnalysisTab {
  constructor(previewComponent, defaultTab = false) {
    super(TITLE, previewComponent, defaultTab);
  }

  async createContent() {
    const container = $('<div/>')
      .addClass('col-9 my-4 max-h36r');

    const caption = this.previewComponent.media.getImageAutoCaptioning()
      || NO_DATA;

    const desc = $('<p/>')
      .addClass('lead-sm font-italic')
      .append(DESC);
    container.append(desc);

    const message = $('<p/>')
      .addClass('lead')
      .append(caption);
    container.append(message);

    return container;
  }
}
