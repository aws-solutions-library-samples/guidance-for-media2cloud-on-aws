// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../shared/localization.js';
import VideoTab from './collection/videoTab.js';
import PhotoTab from './collection/photoTab.js';
import PodcastTab from './collection/podcastTab.js';
import DocumentTab from './collection/documentTab.js';
import SearchTab from './collection/searchTab.js';
import BaseTab from '../shared/baseTab.js';

const {
  SearchEngineVersion,
} = SolutionManifest;

const {
  Messages: {
    CollectionTab: TITLE,
    VideoTab: MSG_VIDEO_TAB,
    PhotoTab: MSG_PHOTO_TAB,
    PodcastTab: MSG_PODCAST_TAB,
    DocumentTab: MSG_DOCUMENT_TAB,
    SearchTab: MSG_SEARCH_TAB,
  },
} = Localization;

/* remove all spaces */
const [
  VIDEO_TAB,
  PHOTO_TAB,
  PODCAST_TAB,
  DOCUMENT_TAB,
  SEARCH_TAB,
  RECOMMEND_TAB,
] = [
  MSG_VIDEO_TAB,
  MSG_PHOTO_TAB,
  MSG_PODCAST_TAB,
  MSG_DOCUMENT_TAB,
  MSG_SEARCH_TAB,
].map((x) =>
  x.replaceAll(' ', ''));

const ORDERED_CONTROLLERS = [
  VIDEO_TAB,
  PHOTO_TAB,
  PODCAST_TAB,
  DOCUMENT_TAB,
  SEARCH_TAB,
  RECOMMEND_TAB,
];
const HASSEARCHENGINE = (SearchEngineVersion === undefined || SearchEngineVersion.length > 0);

export default class CollectionTab extends BaseTab {
  constructor() {
    super(TITLE);

    this.$ids = {
      ...super.ids,
      tablist: `tablist-${this.id}`,
      tabcontent: `tabcontent-${this.id}`,
    };

    this.$tabControllers = {
      [VIDEO_TAB]: new VideoTab(),
      [PHOTO_TAB]: new PhotoTab(),
      [PODCAST_TAB]: new PodcastTab(),
      [DOCUMENT_TAB]: new DocumentTab(),
    };
    if (HASSEARCHENGINE) {
      this.$tabControllers[SEARCH_TAB] = new SearchTab();
    }
  }

  get ids() {
    return this.$ids;
  }

  get tabControllers() {
    return this.$tabControllers;
  }

  async show(hashtag) {
    const {
      current,
      next,
    } = this.parseHashtag(hashtag);

    if (!this.initialized) {
      const navbar = $('<nav/>')
        .addClass('navbar navbar-expand-lg navbar-light bg-light')
        .append(this.createTabToggle())
        .append(this.createTabItems());
      this.tabContent.append(navbar);
      this.tabContent.append(this.createTabContents());
    }

    let activeController = this.tabControllers[current];
    if (!activeController) {
      const tabId = this.tabContent
        .find('.tab-pane.active.show')
        .attr('aria-labelledby');

      if (tabId) {
        activeController = Object.values(this.tabControllers)
          .find((tabController) =>
            tabController.tabId === tabId);
      }
    }

    if (activeController) {
      await activeController.show(next);
    } else {
      await this.tabControllers[VIDEO_TAB].show('');
    }

    return super.show(hashtag);
  }

  createTabToggle() {
    const id = this.ids.tablist;
    return $('<button/>').addClass('navbar-toggler')
      .attr('type', 'button')
      .attr('data-toggle', 'collapse')
      .attr('data-target', `#${id}`)
      .attr('aria-controls', id)
      .attr('aria-expanded', 'false')
      .attr('aria-label', 'Collection tabs')
      .append($('<span/>').addClass('navbar-toggler-icon'));
  }

  createTabItems() {
    const id = this.ids.tablist;
    const container = $('<div/>')
      .addClass('collapse navbar-collapse')
      .attr('id', id);

    const navbar = $('<div/>')
      .addClass('navbar-nav w-100')
      .attr('role', 'tablist');
    container.append(navbar);

    ORDERED_CONTROLLERS.forEach((name) => {
      const tabController = this.tabControllers[name];
      if (tabController !== undefined) {
        navbar.append(tabController.tabLink);
      }
    });

    return container;
  }

  createTabContents() {
    const tabContents = $('<div/>')
      .addClass('tab-content')
      .attr('id', this.ids.tabcontent);

    ORDERED_CONTROLLERS.forEach((name) => {
      const tabController = this.tabControllers[name];
      if (tabController !== undefined) {
        tabContents.append(tabController.tabContent);
      }
    });

    return tabContents;
  }
}
