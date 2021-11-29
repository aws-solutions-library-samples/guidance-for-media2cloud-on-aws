// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../../shared/localization.js';
import BaseMediaTab from './base/baseMediaTab.js';
import SearchCategorySlideComponent from './search/searchCategorySlideComponent.js';
import SearchPreviewSlideComponent from './search/searchPreviewSlideComponent.js';

export default class SearchTab extends BaseMediaTab {
  constructor(defaultTab, plugins) {
    super(defaultTab, Localization.Messages.Search, plugins);
    this.$categorySlideComponent = new SearchCategorySlideComponent();
    this.$previewSlideComponent = new SearchPreviewSlideComponent();
    this.$tabLink.addClass('ml-auto');
    this.$tabLink.find('a').addClass('search-border');
  }
}
