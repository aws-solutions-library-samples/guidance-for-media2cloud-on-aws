// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import BaseMediaTab from './base/baseMediaTab.js';
import SearchCategorySlideComponent from './search/searchCategorySlideComponent.js';
import SearchPreviewSlideComponent from './search/searchPreviewSlideComponent.js';

const {
  Messages: {
    SearchTab: TITLE,
  },
} = Localization;

export default class SearchTab extends BaseMediaTab {
  constructor(options) {
    super(TITLE, options);

    this.$categorySlideComponent = new SearchCategorySlideComponent();
    this.$previewSlideComponent = new SearchPreviewSlideComponent();

    this.$tabLink
      .addClass('ml-auto');
    this.$tabLink.find('a')
      .addClass('search-border');
  }
}
