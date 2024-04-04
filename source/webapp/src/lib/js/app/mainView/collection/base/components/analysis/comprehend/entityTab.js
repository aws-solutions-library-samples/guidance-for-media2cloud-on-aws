// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../shared/localization.js';
import AnalysisTypes from '../../../../../../shared/analysis/analysisTypes.js';
import BaseComprehendTab from './baseComprehendTab.js';

const {
  Messages: {
    EntityTab: TITLE,
  },
} = Localization;

export default class EntityTab extends BaseComprehendTab {
  constructor(previewComponent) {
    super(TITLE, previewComponent);
  }

  async createTimelineButtons(type) {
    const entities = await super.createTimelineButtons(type);
    const customEntities = await super.createTimelineButtons(AnalysisTypes.Comprehend.CustomEntity);
    return entities.concat(customEntities);
  }

  async createContent() {
    const col = $('<div/>').addClass('col-9 my-4 max-h36r');
    const tracks = await this.createTimelineButtons(AnalysisTypes.Comprehend.Entity);
    if (!(tracks || []).length) {
      return super.createContent();
    }
    tracks.forEach(btn => col.append(btn));
    return col;
  }
}
