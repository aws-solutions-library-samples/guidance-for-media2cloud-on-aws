// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

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
