// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import Localization from '../../shared/localization.js';
import AppUtils from '../../shared/appUtils.js';
import mxSpinner from '../../mixins/mxSpinner.js';
import BaseTabPlugins from '../../shared/baseTabPlugins.js';
import PreviewSlideComponent from './content/previewSlideComponent.js';
import CategorySlideComponent from './content/categorySlideComponent.js';
import MediaManager from '../../shared/media/mediaManager.js';

export default class ContentTab extends mxSpinner(BaseTabPlugins) {
  constructor(defaultTab = false, plugins) {
    super(Localization.Messages.ContentTab, {
      selected: defaultTab,
      fontSize: '1.1rem',
    }, plugins);

    this.$ids = {
      ...super.ids,
      carousel: {
        container: `content-${AppUtils.randomHexstring()}`,
      },
    };

    this.$previewComponent = new PreviewSlideComponent();
    this.$categoryComponent = new CategorySlideComponent();
    this.$mediaManager = MediaManager.getSingleton();
    // const dropdown = this.createDropdownMenu(plugins);
    // plugins.append(dropdown);
  }

  get ids() {
    return this.$ids;
  }

  get previewComponent() {
    return this.$previewComponent;
  }

  get categoryComponent() {
    return this.$categoryComponent;
  }

  get mediaManager() {
    return this.$mediaManager;
  }

  async show() {
    if (!this.initialized) {
      const carousel = await this.createCarousel();
      const row = $('<div/>').addClass('row no-gutters')
        .append(carousel)
        .append(this.createLoading());
      this.tabContent.append(row);
      await this.categoryComponent.show();
    }
    return super.show();
  }

  async createCarousel() {
    const category = this.categoryComponent.getSlide();
    category.on(CategorySlideComponent.Events.Slide.CardGroup.Card.Selected, async (event, media) => {
      this.loading(true);
      await this.previewComponent.setMedia(media);
      this.loading(false);
      this.slideTo(this.previewComponent.slideId);
    });

    const preview = this.previewComponent.getSlide();
    preview.on(PreviewSlideComponent.Events.Slide.Close, async () => {
      this.slideTo(this.categoryComponent.slideId);
    });

    const slides = [
      {
        id: this.categoryComponent.slideId,
        el: category,
      },
      {
        id: this.previewComponent.slideId,
        el: preview,
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
      if (id === this.previewComponent.slideId) {
        return this.previewComponent.show();
      }
      if (id === this.categoryComponent.slideId) {
        return this.categoryComponent.show();
      }
      return undefined;
    });
    return carousel;
  }

  slideTo(id) {
    const carousel = this.tabContent.find(`#${this.ids.carousel.container}`).first();
    const idx = carousel.find(`#${id}`).index();
    carousel.carousel(idx);
  }

  /**
   * @deprecated
   */
  /*
  createDropdownMenu() {
    const dropdown = $('<div/>').addClass('dropdown')
      .attr('data-tab-id', this.tabId)
      .append($('<a/>').addClass('btn btn-link dropdown-toggle')
        .attr('href', '#')
        .attr('role', 'button')
        .attr('id', ContentTab.Constants.Ids.Dropdown.Menu)
        .attr('data-toggle', 'dropdown')
        .attr('aria-haspopup', true)
        .attr('aria-expanded', false)
        .css('font-size', '1.1rem')
        .append($('<i/>').addClass('fas fa-filter')));
    const menu = $('<div/>').addClass('dropdown-menu');
    Object.keys(ContentTab.Constants.Ids.Dropdown.Items).forEach((item) => {
      if (ContentTab.Constants.Ids.Dropdown.Items[item] === 'divider') {
        menu.append($('<div/>').addClass('dropdown-divider'));
      } else {
        const id = ContentTab.Constants.Ids.Dropdown[item];
        const anchor = $('<a/>').addClass('dropdown-item')
          .attr('href', '#')
          .attr('id', id)
          .html(item);
        anchor.off('click').click(async () => {
          this.tabContent.children().remove();
          this.tabContent.append($('<div/>').addClass('row no-gutters')
            .append($('<p/>').addClass('h4')
              .html(`${item} clicked`)));
        });
        menu.append(anchor);
      }
    });
    return dropdown.append(menu);
  }
  */
}
