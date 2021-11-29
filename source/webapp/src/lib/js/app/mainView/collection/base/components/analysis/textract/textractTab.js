// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../../../../../../shared/localization.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';

export default class TextractTab extends BaseAnalysisTab {
  constructor(previewComponent, defaultTab = false) {
    super(Localization.Messages.TextractTab, previewComponent, defaultTab);
  }

  async createContent() {
    const col = $('<div/>').addClass('col-12 my-4 max-h36r');
    const pageContainer = this.previewComponent.getPageControlContainer();
    if (!pageContainer) {
      return super.createContent();
    }
    return col.append(pageContainer);
  }
}
