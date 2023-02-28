// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../shared/localization.js';
import CognitoConnector from '../../../shared/cognitoConnector.js';
import MediaFactory from '../../../shared/media/mediaFactory.js';
import MediaTypes from '../../../shared/media/mediaTypes.js';
import PreviewSlideEvents from './previewSlideComponentEvents.js';
import TechnicalComponentHelper from './components/technicalComponentHelper.js';
import AnalysisComponent from './components/analysisComponent.js';
import SnapshotComponent from './components/snapshotComponent.js';
import BaseSlideComponent from '../../../shared/baseSlideComponent.js';

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
    this.$canWrite = CognitoConnector.getSingleton().canWrite();
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
    return this.$canWrite;
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
      this.slide.append(this.createSkeleton());
      setTimeout(async () => {
        await this.previewComponent.load();
        await this.analysisComponent.show();
        return this.recalculateViewDimensions();
      });
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
    const preview = this.createPreview();
    const techView = this.createTechnicalView();
    const controls = this.createAnalysisView();
    const closeBtn = this.createCloseButton();
    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass(`col-6 p-0 overflow-auto maxh-600 ${BKGD_PREVIEW}`)
        .attr(DATA_VIEW, VIEW_PREVIEW)
        .append(preview))
      .append($('<div/>').addClass(`col-6 p-0 m-0 overflow-auto maxh-600 ${BKGD_TECHVIEW}`)
        .attr(DATA_VIEW, VIEW_TECH)
        .append(techView))
      .append($('<div/>').addClass(`col-12 p-0 m-0 overflow-auto ${BKGD_ANALYSISVIEW}`)
        .attr(DATA_VIEW, VIEW_ANALYSIS)
        .append(controls))
      .append(closeBtn);
    return row;
  }

  createPreview() {
    const preview = $('<div/>').addClass('col-12 p-0 m-0')
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
    const icon = $('<i/>').addClass('far fa-times-circle text-secondary')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Buttons.ClosePreview)
      .css('font-size', '3rem')
      .tooltip({
        trigger: 'hover',
      });

    const btn = $('<div/>').addClass('close-preview')
      .append($('<button/>').addClass('btn btn-sm btn-link')
        .attr('type', 'button')
        .append(icon));
    btn.off('click').on('click', async (event) => {
      event.preventDefault();
      await this.previewComponent.beforeViewHide();
      this.slide.trigger(BasePreviewSlideComponent.Events.Preview.Close, [this.media]);
    });
    return btn;
  }

  recalculateViewDimensions() {
    const {
      width,
      height,
    } = this.previewComponent.getContainerDimensions();
    const tech = this.slide.find(`div[${DATA_VIEW}="${VIEW_TECH}"]`);

    return this;
  }
}
