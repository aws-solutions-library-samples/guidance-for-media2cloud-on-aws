// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
