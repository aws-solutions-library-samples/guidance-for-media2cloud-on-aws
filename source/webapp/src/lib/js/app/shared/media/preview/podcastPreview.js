// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
