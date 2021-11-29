// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../../shared/localization.js';
import VideoCategorySlideComponent from './video/videoCategorySlideComponent.js';
import VideoPreviewSlideComponent from './video/videoPreviewSlideComponent.js';
import BaseMediaTab from './base/baseMediaTab.js';

export default class VideoTab extends BaseMediaTab {
  constructor(defaultTab, plugins) {
    super(defaultTab, Localization.Messages.VideoTab, plugins);
    this.$categorySlideComponent = new VideoCategorySlideComponent();
    this.$previewSlideComponent = new VideoPreviewSlideComponent();
  }
}
