// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../../../shared/localization.js';
import {
  GetMediaManager,
  RegisterMediaEvent,
  ON_MEDIA_ADDED,
  ON_MEDIA_UPDATED,
  ON_MEDIA_ERROR,
} from '../../../shared/media/mediaManager.js';
import AppUtils from '../../../shared/appUtils.js';
import MediaTypes from '../../../shared/media/mediaTypes.js';
import ObserverHelper from '../../../shared/observerHelper.js';
import CategorySlideEvents from './categorySlideComponentEvents.js';
import BaseSlideComponent from '../../../shared/baseSlideComponent.js';

const {
  Statuses: {
    Processing: STATUS_PROCESSING,
    Completed: STATUS_COMPLETED,
    Error: STATUS_ERROR,
  },
} = SolutionManifest;

const OVERALL_STATUSES = [
  STATUS_COMPLETED,
  STATUS_PROCESSING,
  STATUS_PROCESSING,
];

const {
  Messages: {
    CollectionTab: COLLECTION_TAB,
    VideoTab: VIDEO_TAB,
    PhotoTab: PHOTO_TAB,
    PodcastTab: PODCAST_TAB,
    DocumentTab: DOCUMENT_TAB,
    UploadTab: UPLOAD_TAB,
    ProcessingTab: PROCESSING_TAB,
    NoMediaPresent: MSG_NO_MEDIA_PRESENT,
    LoadMore: MSG_LOAD_MORE,
    NoMoreData: MSG_NO_MORE_DATA,
    ProcessingError: MSG_PROCESSING_ERR,
  },
  Statuses: {
    Error: MSG_STATUS_ERROR,
    Processing: MSG_STATUS_PROCESSING,
  },
  Tooltips: {
    RemoveMedia: TOOLTIP_REMOVE_MEDIA,
  },
} = Localization;

const MEDIATYPE_TO_TAB = {
  [MediaTypes.Video]: VIDEO_TAB,
  [MediaTypes.Photo]: PHOTO_TAB,
  [MediaTypes.Podcast]: PODCAST_TAB,
  [MediaTypes.Document]: DOCUMENT_TAB,
};

const DATA_UUID = 'data-uuid';
const DATA_ROLE = 'data-role';
const DATA_STATUS = 'data-status';
const ROLE_MEDIADESC = 'media-desc';
const ROLE_LOADMORE = 'load-more';

export default class BaseCategorySlideComponent extends BaseSlideComponent {
  constructor(mediaType, displayOptions = {}) {
    super();
    this.$ids = {
      ...super.ids,
      mediaList: `media-${AppUtils.randomHexstring()}`,
    };
    this.$mediaType = mediaType;
    this.$displayOptions = displayOptions;
    this.$mediaManager = GetMediaManager();

    RegisterMediaEvent(
      `basecategoryslidecomponent:${mediaType}`,
      this.onMediaEvent.bind(this)
    );
  }

  static get Events() {
    return CategorySlideEvents;
  }

  get mediaType() {
    return this.$mediaType;
  }

  get displayOptions() {
    return this.$displayOptions;
  }

  get mediaManager() {
    return this.$mediaManager;
  }

  async show(hashtag) {
    if (!this.initialized) {
      const container = this.createSkeleton();
      this.slide.append(container);

      await this.refreshWithHashtag(hashtag);
    } else {
      await this.refreshContent();
    }

    return super.show();
  }

  async refreshWithHashtag(hashtag = '') {
    const uuid = hashtag.split('/').pop();

    if (uuid) {
      const items = await this.refreshContent(uuid);

      const found = items.find((item) =>
        item.attr(DATA_UUID) === uuid);

      if (found) {
        found.click();
      }
    }
  }

  async onMediaEvent(event, media) {
    if (event === ON_MEDIA_ADDED) {
      return this.onMediaAdded(media, true);
    }

    if (event === ON_MEDIA_UPDATED) {
      return this.onMediaUpdated(media);
    }

    if (event === ON_MEDIA_ERROR) {
      return this.onMediaError(media);
    }

    return undefined;
  }

  async onMediaAdded(media, insertFirst = false) {
    if (media.type !== this.mediaType) {
      return undefined;
    }
    const list = this.slide.find(`#${this.ids.mediaList}`);
    let item = list.find(`div[${DATA_UUID}="${media.uuid}"]`);
    if (item.length === 0) {
      item = await this.createMediaListItem(media);

      let child = list.children();
      if (insertFirst) {
        child = child.first();
      } else {
        child = child.last();
      }

      item.insertBefore(child);
    }
    return item;
  }

  async onMediaUpdated(media) {
    if (media.type !== this.mediaType) {
      return undefined;
    }
    const list = this.slide.find(`#${this.ids.mediaList}`);
    const oldItem = list.find(`div[${DATA_UUID}="${media.uuid}"]`);
    let replacedItem;
    if (oldItem.length > 0 && (oldItem.attr(DATA_STATUS) !== media.overallStatus
      || media.status === SolutionManifest.Statuses.IngestStarted
      || media.status === SolutionManifest.Statuses.AnalysisStarted)) {
      replacedItem = await this.createMediaListItem(media);
      oldItem.replaceWith(replacedItem);
    }
    return replacedItem;
  }

  async onMediaRemoved(media) {
    await this.mediaManager.removeMedia(media);
    /* remove it from ui */
    const list = this.slide.find(`#${this.ids.mediaList}`);
    const item = list.find(`div[${DATA_UUID}="${media.uuid}"]`);
    item.remove();
  }

  async onMediaError(media) {
    if (media.type !== this.mediaType) {
      return undefined;
    }
    const list = this.slide.find(`#${this.ids.mediaList}`);
    const oldItem = list.find(`div[${DATA_UUID}="${media.uuid}"]`);
    if (oldItem.length > 0) {
      const replacedItem = await this.createMediaListItem(media);
      oldItem.replaceWith(replacedItem);
    }
    const message = MSG_PROCESSING_ERR
      .replace('{{BASENAME}}', media.basename)
      .replace('{{PROCESSINGTAB}}', PROCESSING_TAB);
    return this.showAlert(message);
  }

  createSkeleton() {
    const container = $('<div/>')
      .addClass('row no-gutters');

    const descContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4')
      .addClass('collapse')
      .attr(DATA_ROLE, ROLE_MEDIADESC);
    container.append(descContainer);

    const desc = this.createNoMediaMessage();
    descContainer.append(desc);

    const listContainer = $('<div/>')
      .addClass('col-12 p-0 mx-auto mt-4');
    container.append(listContainer);

    const mediaList = this.createMediaList();
    listContainer.append(mediaList);

    container.ready(async () => {
      try {
        this.loading();

        await this.mediaManager.scanRecordsByCategory(this.mediaType);
        await this.refreshContent();
      } catch (e) {
        console.error(e);
      } finally {
        this.loading(false);
      }
    });

    listContainer.ready(async () => {
      const hashtag = [
        COLLECTION_TAB,
        MEDIATYPE_TO_TAB[this.mediaType],
      ].join('/');

      ObserverHelper.setHashOnVisible(
        container,
        hashtag
      );
    });

    return container;
  }

  createNoMediaMessage() {
    const container = $('<p/>')
      .addClass('lead');

    const message = MSG_NO_MEDIA_PRESENT
      .replace('{{MEDIATYPE}}', this.mediaType)
      .replace('{{UPLOADTAB}}', UPLOAD_TAB);
    container.append(message);

    return container;
  }

  showNoMediaMessage(show = true) {
    const message = this.slide
      .find(`div[${DATA_ROLE}="${ROLE_MEDIADESC}"]`);

    if (show) {
      return message.removeClass('collapse');
    }

    return message.addClass('collapse');
  }

  createMediaList() {
    return $('<div/>')
      .addClass('row no-gutters')
      .attr('id', this.ids.mediaList);
  }

  async refreshContent(uuid) {
    try {
      this.loading();

      const list = this.slide
        .find(`#${this.ids.mediaList}`);

      list.children().remove();

      let medias = [];

      /* uuid from hashtag */
      if (uuid) {
        const media = await this.mediaManager.lazyGetByUuid(uuid);
        if (media && media.type === this.mediaType) {
          medias.push(media);
        }
      }

      if (medias.length === 0) {
        medias = this.mediaManager
          .findMediaByType(this.mediaType)
          .filter((x) =>
            x.overallStatus !== STATUS_ERROR);
      }

      let mediaListItems = [];

      if (medias.length > 0) {
        mediaListItems = await Promise.all(medias
          .map((media) =>
            this.createMediaListItem(media, list)));
        this.showNoMediaMessage(false);
      } else {
        this.showNoMediaMessage(true);
      }

      const moreBtn = this.createLoadMoreMedia();
      list.append(moreBtn);
      return mediaListItems;
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      this.loading(false);
    }
  }

  async createMediaListItem(media, container) {
    const item = $('<div/>')
      .addClass('col-3')
      .addClass(`media-${media.overallStatus.toLowerCase()}`)
      .attr(DATA_UUID, media.uuid)
      .attr(DATA_STATUS, media.overallStatus);

    item.on('click', async (event) => {
      event.preventDefault();
      return this.slide.trigger(BaseCategorySlideComponent.Events.Media.Selected, [media]);
    });

    if (container) {
      container.append(item);
    }

    item.ready(() => {
      const image = this.createThumbnail(media);
      const overlay = this.createMediaOverlay(media);
      item.append(image)
        .append(overlay);
    });

    return item;
  }

  createLoadMoreMedia() {
    const id = AppUtils.randomHexstring();
    const w = 80;
    const h = 45;
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <g id="${id}"><rect width="${w}" height="${h}" stroke="none" stroke-width="1"></rect></g>
    </svg>`;
    const url = [
      'data:image/svg+xml;charset=UTF-8',
      encodeURIComponent(svg),
    ].join(',');

    const container = $('<div/>')
      .addClass('col-3')
      .attr(DATA_UUID, ROLE_LOADMORE);

    const img = $('<img/>')
      .addClass('w-100')
      .css('aspect-ratio', '16 / 9')
      .css('object-fit', 'cover')
      .attr('src', url)
      .attr('alt', MSG_LOAD_MORE);
    container.append(img);

    const overlayContainer = $('<div/>')
      .addClass('card-img-overlay category')
      .css('background-color', '#777777');
    container.append(overlayContainer);

    const flexContainer = $('<div/>')
      .addClass('h-100 d-flex');
    overlayContainer.append(flexContainer);

    const title = $('<h5/>')
      .addClass('text-white lead m-0 align-self-center')
      .attr(DATA_ROLE, ROLE_LOADMORE)
      .append(MSG_LOAD_MORE);
    flexContainer.append(title);

    const ellipsisIcon = $('<i/>')
      .addClass('fas fa-ellipsis-h icon-3 ml-auto my-auto');
    flexContainer.append(ellipsisIcon);

    container.on('click', async (event) => {
      event.preventDefault();

      await this.scanNextByMediaType();

      if (this.mediaManager.noMoreData(this.mediaType)) {
        this.disableScan(container);
      }
    });

    return container;
  }

  createThumbnail(media) {
    let objectFit = 'cover';
    if ((this.displayOptions || {}).objectFit) {
      objectFit = this.displayOptions.objectFit;
    }

    const img = $('<img/>')
      .addClass('w-100')
      .css('aspect-ratio', '16 / 9')
      .css('object-fit', objectFit)
      .attr('alt', media.basename);

    img.ready(async () => {
      const proxy = await media.getThumbnail();
      img.attr('src', proxy);
    });

    return img;
  }

  createMediaOverlay(media) {
    const container = $('<div/>')
      .addClass('card-img-overlay category p-2');

    const contentContainer = $('<div/>')
      .addClass('row no-gutters h-100');
    container.append(contentContainer);

    const titleContainer = $('<div/>')
      .addClass('col-6 p-0 m-0');
    contentContainer.append(titleContainer);

    const name = AppUtils.shorten(media.basename, 54);
    const title = $('<h5/>')
      .addClass('lead-s m-0 text-white text-contain')
      .append(name);
    titleContainer.append(title);

    const status = this.createMediaStatus(media);
    contentContainer.append(status);

    /* controls when hover the media */
    const hoverControlsContainer = $('<div/>')
      .addClass('col-12 p-0 align-self-end d-flex');
    contentContainer.append(hoverControlsContainer);

    const removeBtnContainer = $('<div/>')
      .addClass('col-6 p-0 m-0 mt-auto');
    hoverControlsContainer.append(removeBtnContainer);

    const removeBtn = $('<button/>')
      .addClass('btn btn-sm btn-outline-danger lead-sm media-action')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_REMOVE_MEDIA)
      .tooltip({
        trigger: 'hover',
      });
    removeBtnContainer.append(removeBtn);

    const removeBtnIcon = $('<i/>')
      .addClass('far fa-trash-alt');
    removeBtn.append(removeBtnIcon);

    const playBtnContainer = $('<div/>')
      .addClass('col-6 p-0 m-0 ml-auto text-right');
    hoverControlsContainer.append(playBtnContainer);

    const playBtn = $('<button/>')
      .addClass('btn btn-link media-action');
    playBtnContainer.append(playBtn);

    const playBtnIcon = $('<i/>')
      .addClass('far fa-play-circle icon-4');
    playBtn.append(playBtnIcon);

    /* events handling */
    removeBtn.on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeBtn.tooltip('hide');
      return this.slide.trigger(BaseCategorySlideComponent.Events.Media.Removing, [media]);
    });

    return container;
  }

  createMediaStatus(media) {
    if (!OVERALL_STATUSES.includes(media.overallStatus)) {
      return undefined;
    }

    const container = $('<div/>')
      .addClass('col-6 p-0 m-0');

    const statusContainer = $('<div/>')
      .addClass('p-0 m-0 d-flex justify-content-end');
    container.append(statusContainer);

    const status = $('<span/>')
      .addClass('lead-xs px-2 text-white text-right');
    statusContainer.append(status);

    if (media.overallStatus === STATUS_COMPLETED && media.duration) {
      status
        .addClass('bg-dark')
        .append(media.readableDuration);
      return container;
    }

    if (media.overallStatus === STATUS_PROCESSING) {
      status
        .addClass('bg-primary')
        .append(MSG_STATUS_PROCESSING);
      return container;
    }

    if (media.overallStatus === STATUS_ERROR) {
      status
        .addClass('bg-danger')
        .append(MSG_STATUS_ERROR);
      return container;
    }

    return undefined;
  }

  async scanNextByMediaType() {
    try {
      this.loading();

      const medias = await this.mediaManager
        .scanRecordsByCategory(this.mediaType);

      if (medias) {
        for (let i = 0; i < medias.length; i++) {
          await this.onMediaAdded(medias[i]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.loading(false);
    }
  }

  disableScan(moreBtn) {
    moreBtn.find('.category')
      .attr('disabled', 'disabled');

    moreBtn.find(`[${DATA_ROLE}="${ROLE_LOADMORE}"]`)
      .html(MSG_NO_MORE_DATA);
  }
}
