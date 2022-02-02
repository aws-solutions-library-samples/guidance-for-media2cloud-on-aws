// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import BasePreviewSlideComponent from '../base/basePreviewSlideComponent.js';
import SnapshotComponent from '../base/components/snapshotComponent.js';

export default class VideoPreviewSlideComponent extends BasePreviewSlideComponent {
  constructor() {
    super();
    this.$snapshotComponent = undefined;
  }

  get snapshotComponent() {
    return this.$snapshotComponent;
  }

  set snapshotComponent(val) {
    this.$snapshotComponent = val;
  }

  async setMedia(media, optionalSearchResults) {
    await super.setMedia(media, optionalSearchResults);
    if (!this.snapshotComponent) {
      this.snapshotComponent = new SnapshotComponent(this.previewComponent);
    }
  }

  async hide() {
    if (this.snapshotComponent) {
      await this.snapshotComponent.hide();
    }
    this.snapshotComponent = undefined;
    return super.hide();
  }

  createPreview() {
    const preview = $('<div/>').addClass('col-12 p-0 m-0')
      .append(this.previewComponent.container);
    const controls = this.snapshotComponent.createComponent();
    return [
      preview,
      controls,
    ];
  }
}
