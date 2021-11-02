// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import VideoPreview from './videoPreview.js';

export default class PodcastPreview extends VideoPreview {
  constructor(media, optionalSearchResults) {
    super(media, optionalSearchResults);
    this.$mediaType = 'audio/mp4';
  }

  async getProxyMedia() {
    return this.media.getProxyAudio();
  }
}
