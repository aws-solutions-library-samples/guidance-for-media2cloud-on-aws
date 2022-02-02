// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../shared/localization.js';
import AppUtils from '../shared/appUtils.js';
import mxSpinner from '../mixins/mxSpinner.js';
import BaseTab from '../shared/baseTab.js';
import MediaManager from '../shared/media/mediaManager.js';
import DescriptionList from './collection/base/descriptionList.js';
import {
  AWSConsoleStepFunctions,
} from '../shared/awsConsole.js';

const ID_PROCESSINGLIST = `processing-${AppUtils.randomHexstring()}`;
const ID_ERRORLIST = `error-${AppUtils.randomHexstring()}`;
const DATA_UUID = 'data-uuid';
const INFO_BASIC = 'info-basic';
const CSS_DESCRIPTIONLIST = {
  dl: 'row lead-xs ml-2 my-auto col-9 no-gutters',
  dt: 'col-sm-2 my-0 text-left',
  dd: 'col-sm-10 my-0',
};

export default class ProcessingTab extends mxSpinner(BaseTab) {
  constructor(defaultTab, plugins) {
    super(Localization.Messages.ProcessingTab, {
      selected: defaultTab,
      fontSize: '1.1rem',
    }, plugins);
    this.$mediaManager = MediaManager.getSingleton();
    this.registerMediaManagerEvents();
  }

  get mediaManager() {
    return this.$mediaManager;
  }

  registerMediaManagerEvents() {
    this.mediaManager.eventSource.on(MediaManager.Event.Media.Added, async (event, media) =>
      this.onMediaAdded(media));
    this.mediaManager.eventSource.on(MediaManager.Event.Media.Updated, async (event, media) =>
      this.onMediaUpdated(media));
    this.mediaManager.eventSource.on(MediaManager.Event.Media.Error, async (event, media) =>
      this.onMediaError(media));
  }

  async onMediaAdded(media) {
    const list = this.tabContent.find(`#${ID_PROCESSINGLIST}`);
    let item = list.find(`li[${DATA_UUID}="${media.uuid}"]`);
    if (item.length === 0) {
      item = await this.createMediaListItem(media);
      list.append(item);
    }
    return item;
  }

  async onMediaUpdated(media) {
    const list = this.tabContent.find(`#${ID_PROCESSINGLIST}`);
    const oldItem = list.find(`li[${DATA_UUID}="${media.uuid}"]`);
    if (media.overallStatus === SolutionManifest.Statuses.Completed) {
      return oldItem.remove();
    }
    let newItem;
    if (oldItem.length > 0) {
      newItem = await this.createMediaListItem(media);
      oldItem.replaceWith(newItem);
    }
    return newItem;
  }

  async onMediaError(media) {
    /* remove from processing list */
    let list = this.tabContent.find(`#${ID_PROCESSINGLIST}`);
    let item = list.find(`li[${DATA_UUID}="${media.uuid}"]`);
    item.remove();
    /* add to error list */
    list = this.tabContent.find(`#${ID_ERRORLIST}`);
    item = list.find(`li[${DATA_UUID}="${media.uuid}"]`);
    if (item.length === 0) {
      item = await this.createMediaListItem(media);
      list.append(item);
    }
    return item;
  }

  async show() {
    if (!this.initialized) {
      this.tabContent.append(this.createSkeleton());
      setTimeout(async () => {
        this.loading(true);
        await Promise.all([
          this.mediaManager.scanProcessingRecords(),
          this.mediaManager.scanErrorRecords(),
        ]);
        this.loading(false);
        return this.refreshContent();
      }, 10);
    } else {
      await this.refreshContent();
    }
    return super.show();
  }

  createSkeleton() {
    const processingSection = this.createProcessingSection();
    const errorSection = this.createErrorSection();
    const row = $('<div/>').addClass('row no-gutters')
      .append(processingSection)
      .append(errorSection)
      .append(this.createLoading());
    return row;
  }

  createProcessingSection() {
    const processingDesc = this.createProcessingDescription();
    const processingList = this.createProcessingList();
    const processingControls = this.createProcessingControls();
    return $('<div/>').addClass('col-12 p-0 m-0 pb-4')
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(processingDesc))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(processingList))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(processingControls));
  }

  createProcessingDescription() {
    return $('<p/>').addClass('lead')
      .html(Localization.Messages.ProcessingDesc);
  }

  createProcessingList() {
    return $('<ul/>').addClass('list-group')
      .attr('id', ID_PROCESSINGLIST);
  }

  createProcessingControls() {
    const [
      controls,
      btn,
    ] = this.createControls();
    btn.off('click').on('click', () =>
      this.scanMoreProcessingJobs(btn));
    return controls;
  }

  async scanMoreProcessingJobs(btn) {
    this.loading(true);
    const medias = await this.mediaManager.scanProcessingRecords();
    if (medias) {
      const list = this.tabContent.find(`#${ID_PROCESSINGLIST}`);
      const items = (await Promise.all(medias.map(media =>
        this.createMediaListItem(media)))).filter(x => x);
      list.append(items);
    }
    if (this.mediaManager.noMoreProccessingJob()) {
      btn.addClass('disabled')
        .attr('disabled', 'disabled')
        .html(Localization.Messages.NoMoreData);
    } else {
      btn.removeClass('disabled')
        .removeAttr('disabled')
        .html(Localization.Messages.LoadMore);
    }
    this.loading(false);
  }

  createErrorSection() {
    const errorDesc = this.createErrorDescription();
    const errorList = this.createErrorList();
    const errorControls = this.createErrorControls();
    return $('<div/>').addClass('col-12 p-0 m-0 pb-4 bg-light')
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(errorDesc))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(errorList))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(errorControls));
  }

  createErrorDescription() {
    return $('<p/>').addClass('lead')
      .html(Localization.Messages.ErrorDesc);
  }

  createErrorList() {
    return $('<ul/>').addClass('list-group')
      .attr('id', ID_ERRORLIST);
  }

  createErrorControls() {
    const [
      controls,
      btn,
    ] = this.createControls();
    btn.off('click').on('click', () =>
      this.scanMoreErrorJobs(btn));
    return controls;
  }

  async scanMoreErrorJobs(btn) {
    this.loading(true);
    const medias = await this.mediaManager.scanErrorRecords();
    if (medias) {
      const list = this.tabContent.find(`#${ID_ERRORLIST}`);
      const items = (await Promise.all(medias.map(media =>
        this.createMediaListItem(media)))).filter(x => x);
      list.append(items);
    }
    if (this.mediaManager.noMoreErrorJob()) {
      btn.addClass('disabled')
        .attr('disabled', 'disabled')
        .html(Localization.Messages.NoMoreData);
    } else {
      btn.removeClass('disabled')
        .removeAttr('disabled')
        .html(Localization.Messages.LoadMore);
    }
    this.loading(false);
  }

  createControls() {
    const loadMore = $('<button/>').addClass('btn btn-outline-dark')
      .html(Localization.Messages.LoadMore);

    const controls = $('<form/>').addClass('form-inline')
      .append($('<div/>').addClass('mx-auto')
        .append(loadMore));

    controls.submit(event =>
      event.preventDefault());

    return [
      controls,
      loadMore,
    ];
  }

  async refreshContent() {
    this.loading(true);
    let list;
    let medias = this.mediaManager.findProcessingMedias();
    if (medias) {
      list = this.tabContent.find(`#${ID_PROCESSINGLIST}`);
      list.children().remove();
      const items = (await Promise.all(medias.map(media =>
        this.createMediaListItem(media)))).filter(x => x);
      list.append(items);
    }

    medias = this.mediaManager.findErrorMedias();
    if (medias) {
      list = this.tabContent.find(`#${ID_ERRORLIST}`);
      list.children().remove();
      const items = (await Promise.all(medias.map(media =>
        this.createMediaListItem(media)))).filter(x => x);
      list.append(items);
    }
    this.loading(false);
  }

  async createMediaListItem(media) {
    const image = await this.createThumbnail(media);
    const helper = new DescriptionList(CSS_DESCRIPTIONLIST);
    const dl = helper.createTableList();
    [
      'basename',
      'timestamp',
      'status',
    ].forEach(name => helper.appendTableList(dl, media, name));
    const bkgdColor = media.overallStatus === SolutionManifest.Statuses.Error
      ? 'bg-danger'
      : media.overallStatus === SolutionManifest.Statuses.Processing
        ? 'bg-primary'
        : 'bg-success';
    const status = $('<span/>').addClass('lead-xxs mx-auto my-auto text-white')
      .html(media.overallStatus);

    const basic = $('<div/>').addClass('row no-gutters')
      .attr('data-type', INFO_BASIC)
      .append($('<div/>').addClass('col-2')
        .append(image))
      .append($('<div/>').addClass('col-1 d-flex')
        .addClass(bkgdColor)
        .append(status))
      .append($('<div/>').addClass('col-9 d-flex')
        .append(dl));

    const li = $('<li/>').addClass('list-group-item list-group-item-action no-gutters p-0')
      .css('cursor', 'pointer')
      .attr(DATA_UUID, media.uuid)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.ViewJobOnAWSConsole)
      .append(basic)
      .tooltip({
        trigger: 'hover',
      });

    li.off('click').on('click', () => {
      const url = AWSConsoleStepFunctions.getExecutionLink(media.executionArn);
      window.open(url, '_blank');
      return false;
    });
    return li;
  }

  async createThumbnail(media) {
    const proxy = await media.getThumbnail();
    return $('<img/>').addClass('btn-bkgd w-100 h-96px')
      .attr('src', proxy)
      .css('object-fit', 'cover');
  }
}
