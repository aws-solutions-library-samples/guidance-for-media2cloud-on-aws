// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import DocumentCategorySlideComponent from './document/documentCategorySlideComponent.js';
import DocumentPreviewSlideComponent from './document/documentPreviewSlideComponent.js';
import BaseMediaTab from './base/baseMediaTab.js';

export default class DocumentTab extends BaseMediaTab {
  constructor(defaultTab, plugins) {
    super(defaultTab, Localization.Messages.DocumentTab, plugins);
    this.$categorySlideComponent = new DocumentCategorySlideComponent();
    this.$previewSlideComponent = new DocumentPreviewSlideComponent();
  }
}
