// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import VideoCategorySlideComponent from './video/videoCategorySlideComponent.js';
import VideoPreviewSlideComponent from './video/videoPreviewSlideComponent.js';
import BaseMediaTab from './base/baseMediaTab.js';

const {
  Messages: {
    VideoTab: TITLE,
  },
} = Localization;

export default class VideoTab extends BaseMediaTab {
  constructor(options) {
    super(TITLE, options);
    this.$categorySlideComponent = new VideoCategorySlideComponent();
    this.$previewSlideComponent = new VideoPreviewSlideComponent();
  }
}
