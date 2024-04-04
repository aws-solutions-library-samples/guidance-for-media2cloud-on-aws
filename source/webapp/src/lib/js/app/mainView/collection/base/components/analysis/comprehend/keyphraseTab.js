// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../shared/localization.js';
import AnalysisTypes from '../../../../../../shared/analysis/analysisTypes.js';
import BaseComprehendTab from './baseComprehendTab.js';

const {
  Messages: {
    KeyphraseTab: TITLE,
  },
} = Localization;

export default class KeyphraseTab extends BaseComprehendTab {
  constructor(previewComponent) {
    super(TITLE, previewComponent);
  }

  async createContent() {
    const col = $('<div/>').addClass('col-9 my-4 max-h36r');
    const tracks = await this.createTimelineButtons(AnalysisTypes.Comprehend.Keyphrase);
    if (!(tracks || []).length) {
      return super.createContent();
    }
    tracks.forEach(btn => col.append(btn));
    return col;
  }
}
