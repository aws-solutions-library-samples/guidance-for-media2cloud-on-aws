// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AppUtils from './appUtils.js';
import ObserverHelper from './observerHelper.js';

export default class BaseTab {
  constructor(title, options = {}) {
    this.$id = AppUtils.randomHexstring();
    this.$ids = {
      tabId: `tab-${this.$id}`,
      contentId: `tabcontent-${this.$id}`,
    };
    this.$title = title;
    this.$hashtag = options.hashtag;

    const anchor = $('<a/>')
      .addClass('nav-link')
      .attr('id', this.tabId)
      .attr('href', `#${this.contentId}`)
      .attr('role', 'tab')
      .attr('data-toggle', 'tab')
      .attr('aria-controls', this.contentId)
      .attr('aria-selected', false)
      .css('font-size', options.fontSize || '1.2rem')
      .html(this.title);

    this.$tabLink = $('<li/>')
      .addClass('nav-item')
      .append(anchor);

    this.$tabContent = $('<div/>')
      .addClass('tab-pane fade')
      .attr('id', this.contentId)
      .attr('role', 'tabpanel')
      .attr('aria-labelledby', this.tabId);

    this.tabContent.ready(() => {
      ObserverHelper.setHashOnVisible(
        this.tabContent,
        this.hashtag
      );
    });

    anchor.on('shown.bs.tab', async (event) => {
      const target = $(event.target);
      target.parent().siblings()
        .children('.nav-link')
        .removeClass('show active');
      if (target.prop('id') === this.tabId) {
        await this.show();
      }
      return true;
    });

    this.$initialized = false;
  }

  get id() {
    return this.$id;
  }

  get ids() {
    return this.$ids;
  }

  get tabId() {
    return `tab-${this.id}`;
  }

  get contentId() {
    return `tabcontent-${this.id}`;
  }

  get title() {
    return this.$title;
  }

  set title(val) {
    this.$title = val;

    this.tabLink
      .children('a.nav-link')
      .html(this.$title);
  }

  get tabLink() {
    return this.$tabLink;
  }

  get tabContent() {
    return this.$tabContent;
  }

  get initialized() {
    return this.$initialized;
  }

  set initialized(val) {
    this.$initialized = val;
  }

  get hashtag() {
    return this.$hashtag;
  }

  parseHashtag(hashtag = '') {
    let tag = hashtag;

    if (tag[0] === '#') {
      tag = tag.slice(1);
    }

    const components = tag.split('/');
    return {
      current: components[0],
      next: components.slice(1).join('/'),
    };
  }

  async show(hashtag) {
    this.initialized = true;

    this.tabLink
      .children('a')
      .addClass('show active');

    this.tabContent.tab('show');

    return this.tabContent;
  }

  async hide() {
    this.tabContent
      .children()
      .remove();

    this.initialized = false;
  }
}
