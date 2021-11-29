// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../../shared/localization.js';
import BaseTabPlugins from '../../shared/baseTabPlugins.js';

export default class FaceCollectionTab extends BaseTabPlugins {
  constructor(defaultTab, plugins) {
    super(Localization.Messages.FaceCollectionTab, {
      selected: defaultTab,
      fontSize: '1.1rem',
    }, plugins);
  }

  async show() {
    if (!this.initialized) {
      const row = $('<div/>').addClass('row no-gutters')
        .append(this.createDummy());
      this.tabContent.append(row);
    }
    return super.show();
  }

  createDummy() {
    return $('<p/>').addClass('h4')
      .html('Face Collection Tab');
  }
}
