// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../shared/localization.js';
import {
  GetUserSession,
} from '../../../shared/cognito/userSession.js';
import MediaFactory from '../../../shared/media/mediaFactory.js';
import MediaTypes from '../../../shared/media/mediaTypes.js';
import ObserverHelper from '../../../shared/observerHelper.js';
import PreviewSlideEvents from './previewSlideComponentEvents.js';
import TechnicalComponentHelper from './components/technicalComponentHelper.js';
import AnalysisComponent from './components/analysisComponent.js';
import SnapshotComponent from './components/snapshotComponent.js';
import BaseSlideComponent from '../../../shared/baseSlideComponent.js';

const {
  Messages: {
    CollectionTab: COLLECTION_TAB,
    VideoTab: VIDEO_TAB,
    PhotoTab: PHOTO_TAB,
    PodcastTab: PODCAST_TAB,
    DocumentTab: DOCUMENT_TAB,
  },
} = Localization;

const MEDIATYPE_TO_TAB = {
  [MediaTypes.Video]: VIDEO_TAB,
  [MediaTypes.Photo]: PHOTO_TAB,
  [MediaTypes.Podcast]: PODCAST_TAB,
  [MediaTypes.Document]: DOCUMENT_TAB,
};

const BKGD_PREVIEW = 'bg-white';
const BKGD_TECHVIEW = 'bg-f0';
const BKGD_ANALYSISVIEW = 'bg-light';
const DATA_VIEW = 'data-view';
const VIEW_PREVIEW = 'preview';
const VIEW_TECH = 'technical';
const VIEW_ANALYSIS = 'analysis';

export default class BasePreviewSlideComponent extends BaseSlideComponent {
  constructor() {
    super();
    this.$previewComponent = undefined;
    this.$analysisComponent = undefined;
    this.$snapshotComponent = undefined;
  }

  static get Events() {
    return PreviewSlideEvents;
  }

  get previewComponent() {
    return this.$previewComponent;
  }

  set previewComponent(val) {
    this.$previewComponent = val;
  }

  get analysisComponent() {
    return this.$analysisComponent;
  }

  set analysisComponent(val) {
    this.$analysisComponent = val;
  }

  get snapshotComponent() {
    return this.$snapshotComponent;
  }

  set snapshotComponent(val) {
    this.$snapshotComponent = val;
  }

  get media() {
    return (this.$previewComponent || {}).media;
  }

  get canWrite() {
    const session = GetUserSession();
    return session.canWrite();
  }

  async setMedia(media, optionalSearchResults) {
    if (optionalSearchResults !== undefined
      || this.media !== media) {
      await this.hide();
      this.previewComponent = await MediaFactory.createPreviewComponent(media, optionalSearchResults);
      this.analysisComponent = new AnalysisComponent(this.previewComponent);
    }
    if (media.type === MediaTypes.Video
      || media.type === MediaTypes.Photo) {
      if (this.canWrite && !this.snapshotComponent) {
        this.snapshotComponent = new SnapshotComponent(this.previewComponent);
      }
    }
  }

  async show() {
    if (!this.initialized) {
      const container = this.createSkeleton();

      container.ready(async () => {
        this.createObserver(container);
        await this.previewComponent.load();
        await this.analysisComponent.show();
      });

      this.slide.append(container);
    }

    this.slide[0].scrollIntoView({
      behavior: 'smooth',
    });

    return super.show();
  }

  async hide() {
    if (this.snapshotComponent) {
      await this.snapshotComponent.hide();
    }
    this.snapshotComponent = undefined;
    if (this.previewComponent) {
      await this.previewComponent.unload();
    }
    this.previewComponent = undefined;
    if (this.analysisComponent) {
      await this.analysisComponent.hide();
    }
    this.analysisComponent = undefined;
    return super.hide();
  }

  createSkeleton() {
    const container = $('<div/>')
      .addClass('row no-gutters');

    const previewContainer = $('<div/>')
      .addClass('col-6 p-0 overflow-auto vh-70x')
      .addClass(BKGD_PREVIEW)
      .attr(DATA_VIEW, VIEW_PREVIEW);
    container.append(previewContainer);

    const preview = this.createPreview();
    previewContainer.append(preview);

    const techviewContainer = $('<div/>')
      .addClass('col-6 p-0 m-0 overflow-auto vh-70x')
      .addClass(BKGD_TECHVIEW)
      .attr(DATA_VIEW, VIEW_TECH);
    container.append(techviewContainer);

    const techview = this.createTechnicalView();
    techviewContainer.append(techview);

    const analysisContainer = $('<div/>')
      .addClass('col-12 p-0 m-0 overflow-auto')
      .addClass(BKGD_ANALYSISVIEW)
      .attr(DATA_VIEW, VIEW_ANALYSIS);
    container.append(analysisContainer);

    const controls = this.createAnalysisView();
    analysisContainer.append(controls);

    const closeBtn = this.createCloseButton();
    container.append(closeBtn);

    return container;
  }

  createPreview() {
    const preview = $('<div/>')
      .addClass('col-12 p-0 m-0')
      .append(this.previewComponent.container);

    let controls;
    if (this.snapshotComponent) {
      controls = this.snapshotComponent.createComponent();
    }
    return [
      preview,
      controls,
    ];
  }

  createTechnicalView() {
    return TechnicalComponentHelper.createContents(this.media);
  }

  createAnalysisView() {
    return this.analysisComponent.createContents();
  }

  createCloseButton() {
    const icon = $('<i/>')
      .addClass('far fa-times-circle text-secondary')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Buttons.ClosePreview)
      .css('font-size', '3rem')
      .tooltip({
        trigger: 'hover',
      });

    const btn = $('<div/>')
      .addClass('close-preview')
      .append($('<button/>')
        .addClass('btn btn-sm btn-link')
        .attr('type', 'button')
        .append(icon));

    btn.on('click', async (event) => {
      event.preventDefault();
      this.slide.trigger(BasePreviewSlideComponent.Events.Preview.Close, [this.media]);
    });

    return btn;
  }

  createObserver(container) {
    const media = this.media;
    if (!media) {
      return;
    }

    const mediaTab = MEDIATYPE_TO_TAB[media.type];
    const uuid = media.uuid;

    const hashtag = [
      COLLECTION_TAB,
      mediaTab,
      uuid,
    ].join('/');

    ObserverHelper.setHashOnVisible(
      container,
      hashtag
    );
  }
}
