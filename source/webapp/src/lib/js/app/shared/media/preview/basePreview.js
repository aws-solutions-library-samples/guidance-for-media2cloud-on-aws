// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AppUtils from '../../appUtils.js';

export default class BasePreview {
  constructor(media, optionalSearchResults) {
    this.$ids = {
      container: `preview-${AppUtils.randomHexstring()}`,
    };
    this.$container = $('<div/>')
      .addClass('p-0 m-0 w-100')
      .attr('id', this.$ids.container)
      .attr('data-media-type', media.type);
    this.$media = media;
    this.$searchResults = optionalSearchResults;
  }

  get ids() {
    return this.$ids;
  }

  get container() {
    return this.$container;
  }

  get media() {
    return this.$media;
  }

  get searchResults() {
    return this.$searchResults;
  }

  getView() {
    return undefined;
  }

  async load() {
    return this;
  }

  async unload() {
    this.container.children().remove();
    return this;
  }

  async pause() {
    return undefined;
  }

  async unpause() {
    return undefined;
  }

  getCurrentTime() {
    return undefined;
  }

  async beforeViewHide() {
    return this;
  }

  async viewHidden() {
    return this;
  }

  getContainerDimensions() {
    return {
      width: this.container.outerWidth(),
      height: this.container.outerHeight(),
    };
  }
}
