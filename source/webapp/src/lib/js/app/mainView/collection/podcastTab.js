// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../../shared/localization.js';
import PodcastCategorySlideComponent from './podcast/podcastCategorySlideComponent.js';
import PodcastPreviewSlideComponent from './podcast/podcastPreviewSlideComponent.js';
import BaseMediaTab from './base/baseMediaTab.js';

export default class PodcastTab extends BaseMediaTab {
  constructor(defaultTab, plugins) {
    super(defaultTab, Localization.Messages.PodcastTab, plugins);
    this.$categorySlideComponent = new PodcastCategorySlideComponent();
    this.$previewSlideComponent = new PodcastPreviewSlideComponent();
  }
}
