// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import DocumentCategorySlideComponent from './document/documentCategorySlideComponent.js';
import DocumentPreviewSlideComponent from './document/documentPreviewSlideComponent.js';
import BaseMediaTab from './base/baseMediaTab.js';

const {
  Messages: {
    DocumentTab: TITLE,
  },
} = Localization;

export default class DocumentTab extends BaseMediaTab {
  constructor(options) {
    super(TITLE, options);
    this.$categorySlideComponent = new DocumentCategorySlideComponent();
    this.$previewSlideComponent = new DocumentPreviewSlideComponent();
  }
}
