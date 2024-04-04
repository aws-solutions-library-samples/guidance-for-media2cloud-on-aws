// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import PhotoCategorySlideComponent from './photo/photoCategorySlideComponent.js';
import PhotoPreviewSlideComponent from './photo/photoPreviewSlideComponent.js';
import BaseMediaTab from './base/baseMediaTab.js';

const {
  Messages: {
    PhotoTab: TITLE,
  },
} = Localization;

export default class PhotoTab extends BaseMediaTab {
  constructor(options) {
    super(TITLE, options);
    this.$categorySlideComponent = new PhotoCategorySlideComponent();
    this.$previewSlideComponent = new PhotoPreviewSlideComponent();
  }
}
