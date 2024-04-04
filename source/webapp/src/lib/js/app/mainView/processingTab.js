// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../shared/localization.js';
import AppUtils from '../shared/appUtils.js';
import Spinner from '../shared/spinner.js';
import BaseTab from '../shared/baseTab.js';
import {
  GetMediaManager,
  RegisterMediaEvent,
  ON_MEDIA_ADDED,
  ON_MEDIA_UPDATED,
  ON_MEDIA_ERROR,
} from '../shared/media/mediaManager.js';
import DescriptionList from './collection/base/descriptionList.js';
import {
  AWSConsoleStepFunctions,
} from '../shared/awsConsole.js';

const {
  Statuses: {
    Processing: STATUS_PROCESSING,
    Completed: STATUS_COMPLETED,
    Error: STATUS_ERROR,
  },
} = SolutionManifest;

const {
  Messages: {
    ProcessingTab: TITLE,
    ProcessingDesc: MSG_PROCESSSING_DESC,
    NoMoreData: MSG_NO_MORE_DATA,
    LoadMore: MSG_LOAD_MORE,
    ErrorDesc: MSG_ERROR_DESC,
  },
  Tooltips: {
    ViewJobOnAWSConsole: TOOLTIP_VIEW_ON_CONSOLE,
  },
} = Localization;

const HASHTAG = TITLE.replaceAll(' ', '');

const RANDOM_ID = AppUtils.randomHexstring();
const ID_PROCESSINGLIST = `processing-${RANDOM_ID}`;
const ID_PROCESSINGLIST_BTN = `processing-btn-${RANDOM_ID}`;

const ID_ERRORLIST = `error-${RANDOM_ID}`;
const ID_ERRORLIST_BTN = `error-btn-${RANDOM_ID}`;

const DATA_UUID = 'data-uuid';
const INFO_BASIC = 'info-basic';
const CSS_DESCRIPTIONLIST = {
  dl: 'row lead-xs ml-2 my-auto col-9 no-gutters',
  dt: 'col-sm-2 my-0 text-left',
  dd: 'col-sm-10 my-0',
};

export default class ProcessingTab extends BaseTab {
  constructor() {
    super(TITLE, {
      hashtag: HASHTAG,
    });

    this.$mediaManager = GetMediaManager();

    RegisterMediaEvent(
      'processingtab',
      this.onMediaEvent.bind(this)
    );

    Spinner.useSpinner();
  }

  get mediaManager() {
    return this.$mediaManager;
  }

  async onMediaEvent(event, media) {
    if (event === ON_MEDIA_ADDED) {
      return this.onMediaAdded(media);
    }

    if (event === ON_MEDIA_UPDATED) {
      return this.onMediaUpdated(media);
    }

    if (event === ON_MEDIA_ERROR) {
      return this.onMediaError(media);
    }

    return undefined;
  }

  async onMediaAdded(media) {
    const list = this.tabContent
      .find(`#${ID_PROCESSINGLIST}`);

    let item = list
      .find(`li[${DATA_UUID}="${media.uuid}"]`);

    if (item.length === 0) {
      item = await this.createMediaListItem(media);
      list.append(item);
    }

    return item;
  }

  async onMediaUpdated(media) {
    const list = this.tabContent
      .find(`#${ID_PROCESSINGLIST}`);

    const oldItem = list
      .find(`li[${DATA_UUID}="${media.uuid}"]`);

    if (media.overallStatus === STATUS_COMPLETED) {
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
    let list = this.tabContent
      .find(`#${ID_PROCESSINGLIST}`);

    let item = list
      .find(`li[${DATA_UUID}="${media.uuid}"]`);
    item.remove();

    /* add to error list */
    list = this.tabContent
      .find(`#${ID_ERRORLIST}`);

    item = list
      .find(`li[${DATA_UUID}="${media.uuid}"]`);

    if (item.length === 0) {
      item = await this.createMediaListItem(media);
      list.append(item);
    }

    return item;
  }

  async show(hashtag) {
    if (!this.initialized) {
      const content = this.createSkeleton();
      this.tabContent.append(content);
    } else {
      await this.refreshContent();
    }
    return super.show(hashtag);
  }

  createSkeleton() {
    const container = $('<div/>')
      .addClass('row no-gutters');

    const processingSection = this.createProcessingSection();
    container.append(processingSection);

    const errorSection = this.createErrorSection();
    container.append(errorSection);

    return container;
  }

  createProcessingSection() {
    const container = $('<div/>')
      .addClass('col-12 p-0 m-0 pb-4');

    const descContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(descContainer);

    const desc = this.createProcessingDescription();
    descContainer.append(desc);

    const listContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(listContainer);

    const list = this.createProcessingList();
    listContainer.append(list);

    const controlsContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(controlsContainer);

    const [
      controls,
      moreBtn,
    ] = this.createControls(ID_PROCESSINGLIST_BTN);
    controlsContainer.append(controls);

    moreBtn.on('click', async () => {
      const forceRefresh = false;
      await this.scanMoreProcessingJobs(
        list,
        moreBtn,
        forceRefresh
      );
    });

    container.ready(async () => {
      const forceRefresh = true;
      await this.scanMoreProcessingJobs(
        list,
        moreBtn,
        forceRefresh
      );
    });

    return container;
  }

  createProcessingDescription() {
    return $('<p/>')
      .addClass('lead')
      .html(MSG_PROCESSSING_DESC);
  }

  createProcessingList() {
    return $('<ul/>')
      .addClass('list-group')
      .attr('id', ID_PROCESSINGLIST);
  }

  async scanMoreProcessingJobs(
    list,
    moreBtn,
    forceRefresh = false
  ) {
    try {
      Spinner.loading();

      let medias = await this.mediaManager.scanProcessingRecords();

      if (forceRefresh) {
        medias = this.mediaManager.findProcessingMedias();
        list.children().remove();
      }

      if (medias) {
        const items = await Promise.all(medias
          .map((media) =>
            this.createMediaListItem(media)));

        list.append(items
          .filter((x) =>
            x !== undefined));
      }

      if (this.mediaManager.noMoreProccessingJob()) {
        moreBtn.addClass('disabled')
          .attr('disabled', 'disabled')
          .html(MSG_NO_MORE_DATA);
      } else {
        moreBtn.removeClass('disabled')
          .removeAttr('disabled')
          .html(MSG_LOAD_MORE);
      }
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }

  createErrorSection() {
    const container = $('<div/>')
      .addClass('col-12 p-0 m-0 pb-4 bg-light');

    const descContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(descContainer);

    const desc = this.createErrorDescription();
    descContainer.append(desc);

    const listContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(listContainer);

    const list = this.createErrorList();
    listContainer.append(list);

    const controlsContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(controlsContainer);

    const [
      controls,
      moreBtn,
    ] = this.createControls(ID_ERRORLIST_BTN);
    controlsContainer.append(controls);

    moreBtn.on('click', async () => {
      const forceRefresh = false;
      await this.scanMoreErrorJobs(
        list,
        moreBtn,
        forceRefresh
      );
    });

    container.ready(async () => {
      const forceRefresh = true;
      await this.scanMoreErrorJobs(
        list,
        moreBtn,
        forceRefresh
      );
    });

    return container;
  }

  createErrorDescription() {
    return $('<p/>')
      .addClass('lead')
      .html(MSG_ERROR_DESC);
  }

  createErrorList() {
    return $('<ul/>')
      .addClass('list-group')
      .attr('id', ID_ERRORLIST);
  }

  async scanMoreErrorJobs(
    list,
    moreBtn,
    forceRefresh = false
  ) {
    try {
      Spinner.loading();

      let medias = await this.mediaManager.scanErrorRecords();

      if (forceRefresh) {
        medias = this.mediaManager.findErrorMedias();
        list.children().remove();
      }

      if (medias) {
        const items = await Promise.all(medias
          .map((media) =>
            this.createMediaListItem(media)));

        list.append(items
          .filter((x) =>
            x !== undefined));
      }

      if (this.mediaManager.noMoreErrorJob()) {
        moreBtn.addClass('disabled')
          .attr('disabled', 'disabled')
          .html(MSG_NO_MORE_DATA);
      } else {
        moreBtn.removeClass('disabled')
          .removeAttr('disabled')
          .html(MSG_LOAD_MORE);
      }
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }

  createControls(btnId) {
    const formContainer = $('<form/>')
      .addClass('form-inline');

    formContainer.submit((event) =>
      event.preventDefault());

    const btnContainer = $('<div/>')
      .addClass('mx-auto');
    formContainer.append(btnContainer);

    const moreBtn = $('<button/>')
      .addClass('btn btn-outline-dark')
      .attr('id', btnId)
      .html(MSG_LOAD_MORE);
    btnContainer.append(moreBtn);

    return [
      formContainer,
      moreBtn,
    ];
  }

  async refreshContent() {
    let list;
    let moreBtn;

    list = this.tabContent
      .find(`#${ID_PROCESSINGLIST}`);

    moreBtn = this.tabContent
      .find(`button#${ID_PROCESSINGLIST_BTN}`);

    await this.scanMoreProcessingJobs(
      list,
      moreBtn,
      true
    );

    list = this.tabContent
      .find(`#${ID_ERRORLIST}`);

    moreBtn = this.tabContent
      .find(`button#${ID_ERRORLIST_BTN}`);

    await this.scanMoreErrorJobs(
      list,
      moreBtn,
      true
    );
  }

  async createMediaListItem(media) {
    const container = $('<li/>')
      .addClass('list-group-item list-group-item-action no-gutters p-0')
      .css('cursor', 'pointer')
      .attr(DATA_UUID, media.uuid)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_VIEW_ON_CONSOLE)
      .tooltip({
        trigger: 'hover',
      });
    container.on('click', () => {
      const url = AWSConsoleStepFunctions.getExecutionLink(media.executionArn);
      window.open(url, '_blank');
      return false;
    });

    const rowContainer = $('<div/>')
      .addClass('row no-gutters')
      .attr('data-type', INFO_BASIC);
    container.append(rowContainer);

    const imageContainer = $('<div/>')
      .addClass('col-2');
    rowContainer.append(imageContainer);

    const image = await this.createThumbnail(media);
    imageContainer.append(image);

    let bkgdColor = 'bg-success';
    if (media.overallStatus === STATUS_ERROR) {
      bkgdColor = 'bg-danger';
    } else if (media.overallStatus === STATUS_PROCESSING) {
      bkgdColor = 'bg-primary';
    }

    const statusContainer = $('<div/>')
      .addClass('col-1 d-flex')
      .addClass(bkgdColor);
    rowContainer.append(statusContainer);

    const status = $('<span/>')
      .addClass('lead-xxs mx-auto my-auto text-white')
      .html(media.overallStatus);
    statusContainer.append(status);

    const dlContainer = $('<div/>')
      .addClass('col-9 d-flex');
    rowContainer.append(dlContainer);

    const helper = new DescriptionList(CSS_DESCRIPTIONLIST);
    const dl = helper.createTableList();
    [
      'basename',
      'timestamp',
      'status',
    ].forEach((name) =>
      helper.appendTableList(dl, media, name));
    dlContainer.append(dl);

    return container;
  }

  async createThumbnail(media) {
    const image = $('<img/>')
      .addClass('btn-bkgd w-100 h-96px')
      .css('object-fit', 'cover');

    image.ready(async () => {
      const src = await media.getThumbnail();
      image.attr('src', src);
    });

    return image;
  }
}
