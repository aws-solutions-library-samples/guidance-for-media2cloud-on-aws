// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../../../shared/localization.js';
import MediaManager from '../../../shared/media/mediaManager.js';
import AppUtils from '../../../shared/appUtils.js';
import CategorySlideEvents from './categorySlideComponentEvents.js';
import BaseSlideComponent from '../../../shared/baseSlideComponent.js';

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
    this.$mediaManager = MediaManager.getSingleton();
    this.registerMediaManagerEvents();
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

  async show() {
    if (!this.initialized) {
      this.slide.append(this.createSkeleton())
        .append(this.createLoading());
      await this.delayLoadContent();
    } else {
      await this.refreshContent();
    }
    return super.show();
  }

  async delayLoadContent() {
    setTimeout(async () => {
      this.loading(true);
      await this.mediaManager.scanRecordsByCategory(this.mediaType);
      this.loading(false);
      return this.refreshContent();
    }, 10);
  }

  registerMediaManagerEvents() {
    this.mediaManager.eventSource.on(MediaManager.Event.Media.Added, async (event, media) =>
      this.onMediaAdded(media, true));
    this.mediaManager.eventSource.on(MediaManager.Event.Media.Updated, async (event, media) =>
      this.onMediaUpdated(media));
    this.mediaManager.eventSource.on(MediaManager.Event.Media.Error, async (event, media) =>
      this.onMediaError(media));
  }

  async onMediaAdded(media, insertFirst = false) {
    if (media.type !== this.mediaType) {
      return undefined;
    }
    const list = this.slide.find(`#${this.ids.mediaList}`);
    let item = list.find(`div[${DATA_UUID}="${media.uuid}"]`);
    if (item.length === 0) {
      item = await this.createMediaListItem(media);
      const child = (insertFirst)
        ? list.children().first()
        : list.children().last();
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
    const message = Localization.Messages.ProcessingError
      .replace('{{BASENAME}}', media.basename)
      .replace('{{PROCESSINGTAB}}', Localization.Messages.ProcessingTab);
    return this.showAlert(message);
  }

  createSkeleton() {
    const noMedia = this.createNoMediaMessage();
    const mediaList = this.createMediaList();
    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .addClass('collapse')
        .attr(DATA_ROLE, ROLE_MEDIADESC)
        .append(noMedia))
      .append($('<div/>').addClass('col-12 p-0 mx-auto mt-4')
        .append(mediaList));
    return row;
  }

  createNoMediaMessage() {
    const message = Localization.Messages.NoMediaPresent
      .replace('{{MEDIATYPE}}', this.mediaType)
      .replace('{{UPLOADTAB}}', Localization.Messages.UploadTab);
    return $('<p/>').addClass('lead')
      .html(message);
  }

  showNoMediaMessage(show = true) {
    const message = this.slide.find(`div[${DATA_ROLE}="${ROLE_MEDIADESC}"]`);
    return (show)
      ? message.removeClass('collapse')
      : message.addClass('collapse');
  }

  createMediaList() {
    return $('<div/>').addClass('row no-gutters')
      .attr('id', this.ids.mediaList);
  }

  async refreshContent() {
    this.loading(true);
    const list = this.slide.find(`#${this.ids.mediaList}`);
    list.children().remove();
    const medias = this.mediaManager.findMediaByType(this.mediaType).filter(x =>
      x.overallStatus !== SolutionManifest.Statuses.Error);
    if (medias) {
      await Promise.all(medias.map((media) =>
        this.createMediaListItem(media, list)));
      this.showNoMediaMessage(false);
    } else {
      this.showNoMediaMessage(true);
    }
    list.append(this.createLoadMoreMedia());
    this.loading(false);
  }

  async createMediaListItem(media, container) {
    const image = await this.createThumbnail(media);
    const overlay = this.createMediaOverlay(media);
    const item = $('<div/>').addClass('col-3')
      .addClass(`media-${media.overallStatus.toLowerCase()}`)
      .attr(DATA_UUID, media.uuid)
      .attr(DATA_STATUS, media.overallStatus)
      .append(image)
      .append(overlay);
    item.off('click').on('click', async (event) => {
      event.preventDefault();
      return this.slide.trigger(BaseCategorySlideComponent.Events.Media.Selected, [media]);
    });
    if (container) {
      container.append(item);
    }
    return item;
  }

  createLoadMoreMedia() {
    const w = 80;
    const h = 45;
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <g id="${AppUtils.randomHexstring()}"><rect width="${w}" height="${h}" stroke="none" stroke-width="1"></rect></g>
    </svg>`;

    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    const title = Localization.Messages.LoadMore;
    const loadMore = $('<div/>').addClass('col-3')
      .attr(DATA_UUID, ROLE_LOADMORE)
      .append($('<img/>').addClass('w-100 h-max-12rem')
        .attr('src', url)
        .attr('alt', title))
      .append($('<div/>').addClass('card-img-overlay category')
        .css('background-color', '#777777')
        .append($('<div/>').addClass('h-100 d-flex')
          .append($('<h5/>').addClass('text-white lead m-0 align-self-center')
            .attr(DATA_ROLE, ROLE_LOADMORE)
            .append(title))
          .append($('<i/>').addClass('fas fa-ellipsis-h icon-3 ml-auto my-auto'))));

    loadMore.off('click').on('click', async (event) => {
      event.preventDefault();
      await this.scanNextByMediaType();
      if (this.mediaManager.noMoreData(this.mediaType)) {
        this.disableScan(loadMore);
      }
    });
    return loadMore;
  }

  async createThumbnail(media) {
    const proxy = await media.getThumbnail();
    return $('<img/>').addClass('w-100 h-max-12rem')
      .css('object-fit', this.displayOptions.objectFit || 'contain')
      .attr('src', proxy)
      .attr('alt', media.basename);
  }

  createMediaOverlay(media) {
    const title = $('<div/>').addClass('col-6 p-0 m-0')
      .append($('<h5/>').addClass('lead-s m-0 text-white text-contain')
        .append(AppUtils.shorten(media.basename, 54)));
    const status = this.createMediaStatus(media);

    const removeBtn = $('<button/>').addClass('btn btn-sm btn-outline-danger lead-sm media-action')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.RemoveMedia)
      .append($('<i/>').addClass('far fa-trash-alt'))
      .tooltip({
        trigger: 'hover',
      });
    removeBtn.off('click').on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeBtn.tooltip('hide');
      return this.slide.trigger(BaseCategorySlideComponent.Events.Media.Removing, [media]);
    });

    const playIcon = $('<button/>').addClass('btn btn-link media-action')
      .append($('<i/>').addClass('far fa-play-circle icon-4'));

    const content = $('<div/>').addClass('row no-gutters h-100')
      .append(title)
      .append(status)
      .append($('<div/>').addClass('col-12 p-0 align-self-end d-flex')
        .append($('<div/>').addClass('col-6 p-0 m-0 mt-auto')
          .append(removeBtn))
        .append($('<div/>').addClass('col-6 p-0 m-0 ml-auto text-right')
          .append(playIcon)));
    const overlay = $('<div/>').addClass('card-img-overlay category p-2')
      .append(content);
    return overlay;
  }

  createMediaStatus(media) {
    const text = $('<span/>').addClass('lead-xs px-2 text-white text-right bg-dark');
    const status = $('<div/>').addClass('col-6 p-0 m-0')
      .append($('<div/>').addClass('p-0 m-0 d-flex justify-content-end')
        .append(text));
    if (media.overallStatus === SolutionManifest.Statuses.Completed && media.duration) {
      text.append(media.readableDuration);
      return status;
    }
    if (media.overallStatus === SolutionManifest.Statuses.Processing) {
      text.removeClass('bg-dark').addClass('bg-primary')
        .append(Localization.Statuses.Processing);
      return status;
    }
    if (media.overallStatus === SolutionManifest.Statuses.Error) {
      text.removeClass('bg-dark').addClass('bg-danger')
        .append(Localization.Statuses.Error);
      return status;
    }
    return undefined;
  }

  async scanNextByMediaType() {
    this.loading(true);
    const medias = await this.mediaManager.scanRecordsByCategory(this.mediaType);
    if (medias) {
      for (let i = 0; i < medias.length; i++) {
        await this.onMediaAdded(medias[i]);
      }
    }
    this.loading(false);
  }

  disableScan(loadMore) {
    loadMore.find('.category').attr('disabled', 'disabled');
    loadMore.find(`[${DATA_ROLE}="${ROLE_LOADMORE}"]`)
      .html(Localization.Messages.NoMoreData);
  }
}
