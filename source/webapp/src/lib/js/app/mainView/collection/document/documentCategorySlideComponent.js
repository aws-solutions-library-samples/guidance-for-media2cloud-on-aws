// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import MediaTypes from '../../../shared/media/mediaTypes.js';
import BaseCategorySlideComponent from '../base/baseCategorySlideComponent.js';

export default class DocumentCategorySlideComponent extends BaseCategorySlideComponent {
  constructor() {
    super(MediaTypes.Document, {
      objectFit: 'cover',
    });
  }
}
