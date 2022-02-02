// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import PhotoCategorySlideComponent from './photo/photoCategorySlideComponent.js';
import PhotoPreviewSlideComponent from './photo/photoPreviewSlideComponent.js';
import BaseMediaTab from './base/baseMediaTab.js';

export default class PhotoTab extends BaseMediaTab {
  constructor(defaultTab, plugins) {
    super(defaultTab, Localization.Messages.PhotoTab, plugins);
    this.$categorySlideComponent = new PhotoCategorySlideComponent();
    this.$previewSlideComponent = new PhotoPreviewSlideComponent();
  }
}
