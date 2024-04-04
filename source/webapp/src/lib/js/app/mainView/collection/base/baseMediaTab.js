// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../../../shared/localization.js';
import {
  GetUserSession,
} from '../../../shared/cognito/userSession.js';
import Spinner from '../../../shared/spinner.js';
import BaseTab from '../../../shared/baseTab.js';
import BaseCategorySlideComponent from './baseCategorySlideComponent.js';
import BasePreviewSlideComponent from './basePreviewSlideComponent.js';

const {
  Messages: {
    ProcessingTab: MSG_PROCESSING_TAB,
    MediaInProcess: MSG_MEDIA_INPROCESS,
    MediaError: MSG_MEDIA_ERROR,
    RemoveMedia: MSG_REMOVE_MEDIA,
  },
  Alerts: {
    DeleteMediaNotAllowed: ERR_DELETE_MEDIA_NOT_ALLOWED,
  },
  Buttons: {
    Close: BTN_CLOSE,
  },
} = Localization;

export default class BaseMediaTab extends BaseTab {
  constructor(title, options = {}) {
    super(title, {
      fontSize: '1.1rem',
      ...options,
    });

    this.$ids = {
      ...super.ids,
      carousel: {
        container: `media-${this.id}`,
      },
    };

    this.$categorySlideComponent = undefined;
    this.$previewSlideComponent = undefined;

    Spinner.useSpinner();
  }

  get categorySlideComponent() {
    return this.$categorySlideComponent;
  }

  get previewSlideComponent() {
    return this.$previewSlideComponent;
  }

  get canWrite() {
    const session = GetUserSession();
    return session.canWrite();
  }

  loading(enabled) {
    return Spinner.loading(enabled);
  }

  async show(hashtag) {
    if (!this.initialized) {
      const container = $('<div/>')
        .addClass('row no-gutters');
      this.tabContent.append(container);

      const carousel = await this.createCarousel();
      container.append(carousel);
    }

    await this.categorySlideComponent.show(hashtag);

    return super.show(hashtag);
  }

  async createCarousel() {
    this.categorySlideComponent.on(BaseCategorySlideComponent.Events.Media.Removing, async (event, media) => {
      if (!this.canWrite) {
        return this.showPermissionErrorDialog(media);
      }
      if (media.overallStatus === SolutionManifest.Statuses.Processing) {
        return this.showProcessingDialog(media);
      }
      const yesno = await this.showRemoveMediaDialog(media);
      if (yesno) {
        this.loading(true);
        await this.categorySlideComponent.onMediaRemoved(media);
        this.loading(false);
      }
      return undefined;
    });
    this.categorySlideComponent.on(BaseCategorySlideComponent.Events.Media.Selected, async (event, media, optionalSearchResults) => {
      if (media.overallStatus === SolutionManifest.Statuses.Processing) {
        return this.showProcessingDialog(media);
      }
      if (media.overallStatus === SolutionManifest.Statuses.Error) {
        return this.showErrorDialog(media);
      }
      this.loading(true);
      await this.previewSlideComponent.setMedia(media, optionalSearchResults);
      this.loading(false);
      return this.slideTo(this.previewSlideComponent.slideId);
    });
    this.previewSlideComponent.on(BasePreviewSlideComponent.Events.Preview.Close, async () => {
      this.slideTo(this.categorySlideComponent.slideId);
    });
    const slides = [
      {
        id: this.categorySlideComponent.slideId,
        el: this.categorySlideComponent.getSlide(),
      },
      {
        id: this.previewSlideComponent.slideId,
        el: this.previewSlideComponent.getSlide(),
      },
    ];
    const inner = $('<div/>').addClass('carousel-inner');
    for (let i = 0; i < slides.length; i++) {
      const classes = (i === 0) ? 'carousel-item active' : 'carousel-item';
      inner.append($('<div/>').addClass(classes)
        .attr('id', slides[i].id)
        .append(slides[i].el));
    }

    const carousel = $('<div/>').addClass('carousel slide w-100')
      .attr('data-ride', false)
      .attr('data-interval', false)
      .attr('id', this.ids.carousel.container)
      .append(inner);

    carousel.on('slide.bs.carousel', async (event) => {
      const id = $(event.relatedTarget).prop('id');
      if (id === this.previewSlideComponent.slideId) {
        return this.previewSlideComponent.show();
      }
      if (id === this.categorySlideComponent.slideId) {
        return this.categorySlideComponent.show();
      }
      return undefined;
    });
    return carousel;
  }

  async showPermissionErrorDialog(media) {
    return this.showDialog(media.basename, ERR_DELETE_MEDIA_NOT_ALLOWED);
  }

  async showProcessingDialog(media) {
    const message = MSG_MEDIA_INPROCESS
      .replace('{{BASENAME}}', media.basename)
      .replace('{{PROCESSINGTAB}}', MSG_PROCESSING_TAB);
    return this.showDialog(media.basename, message);
  }

  async showErrorDialog(media) {
    const message = MSG_MEDIA_ERROR
      .replace('{{BASENAME}}', media.basename)
      .replace('{{PROCESSINGTAB}}', MSG_PROCESSING_TAB);
    return this.showDialog(media.basename, message);
  }

  async showRemoveMediaDialog(media) {
    let confirmed = false;
    const message = MSG_REMOVE_MEDIA
      .replace('{{BASENAME}}', media.basename);
    const yes = $('<button/>').addClass('btn btn-sm btn-outline-danger')
      .append('Yes, remove it');
    yes.off('click').on('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();
      confirmed = true;
      const dialog = $(event.currentTarget).parents('div[role="dialog"]');
      dialog.modal('hide');
    });
    await this.showDialog(media.basename, message, [
      yes,
    ]);
    return confirmed;
  }

  async showDialog(title, message, btns) {
    return new Promise((resolve) => {
      const close = $('<button/>').addClass('btn btn-sm btn-primary')
        .attr('type', 'button')
        .attr('data-dismiss', 'modal')
        .append(BTN_CLOSE);
      const modal = $('<div/>').addClass('modal-dialog')
        .attr('role', 'document')
        .append($('<div/>').addClass('modal-content')
          .append($('<div/>').addClass('modal-header')
            .append($('<h5/>').addClass('modal-title lead')
              .html(title)))
          .append($('<div/>').addClass('modal-body')
            .append(message))
          .append($('<div/>').addClass('modal-footer')
            .append(btns)
            .append(close)));
      const dialog = $('<div/>').addClass('modal fade')
        .attr('tabindex', -1)
        .attr('role', 'dialog')
        .append(modal);
      dialog.off('hidden.bs.modal').on('hidden.bs.modal', () =>
        resolve(dialog.remove()));

      this.tabContent.append(dialog);
      dialog.modal({
        backdrop: 'static',
        keyboard: false,
        show: true,
      });
    });
  }

  slideTo(id) {
    const carousel = this.tabContent.find(`#${this.ids.carousel.container}`).first();
    const idx = carousel.find(`#${id}`).index();
    carousel.carousel(idx);
  }
}
