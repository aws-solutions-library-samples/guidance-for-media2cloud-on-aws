// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import Localization from '../../../../../../shared/localization.js';
import AnalysisTypes from '../../../../../../shared/analysis/analysisTypes.js';
import BaseComprehendTab from './baseComprehendTab.js';

export default class EntityTab extends BaseComprehendTab {
  constructor(previewComponent, defaultTab = false) {
    super(Localization.Messages.EntityTab, previewComponent, defaultTab);
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
