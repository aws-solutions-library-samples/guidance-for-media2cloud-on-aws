// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import GroupCategorySlideComponent from './group/groupCategorySlideComponent.js';
import GroupPreviewSlideComponent from './group/groupPreviewSlideComponent.js';
import BaseMediaTab from './base/baseMediaTab.js';

export default class GroupTab extends BaseMediaTab {
  constructor(defaultTab, plugins) {
    super(defaultTab, Localization.Messages.GroupTab, plugins);
    this.$categorySlideComponent = new GroupCategorySlideComponent();
    this.$previewSlideComponent = new GroupPreviewSlideComponent();
  }
}
