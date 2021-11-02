// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import BaseSlideComponent from '../../shared/baseSlideComponent.js';

export default class BaseUploadSlideComponent extends BaseSlideComponent {
  static get Controls() {
    return {
      Back: 'slide:control:back',
      Next: 'slide:control:next',
      Cancel: 'slide:control:cancel',
      Done: 'slide:control:done',
      StartOver: 'slide:control:startover',
      QuickUpload: 'slide:control:quickupload',
      StartNow: 'slide:control:startnow',
    };
  }
}
