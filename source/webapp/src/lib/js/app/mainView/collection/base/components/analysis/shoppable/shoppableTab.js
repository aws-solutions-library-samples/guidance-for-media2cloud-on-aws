// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AnalysisTypes from '../../../../../../shared/analysis/analysisTypes.js';
import ApiHelper from '../../../../../../shared/apiHelper.js';
import Localization from '../../../../../../shared/localization.js';
import Spinner from '../../../../../../shared/spinner.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';
import XRayExperience from './xrayExperience.js';

const {
  Shoppable,
} = AnalysisTypes;

const {
  Messages: {
    ShoppableTab: TITLE,
    ShoppableTabDesc: MSG_DESC,
    ShoppableListTitle: MSG_LIST_TITLE,
    ShoppableItemsDesc: MSG_ITEMS_DESC,
    ShoppableAmazonTitle: MSG_SHOP_AMAZON_TITLE,
    ShoppableMetadataTitle: MSG_METADATA_TITLE,
  },
  Alerts: {
    NoShoppableProduct: ERR_NO_SHOPPABLE_PRODUCT,
  },
} = Localization;

export default class ShoppableTab extends BaseAnalysisTab {
  constructor(previewComponent, data) {
    super(TITLE, previewComponent);
    this.$data = data;
    this.$xrayExperience = new XRayExperience(this);
    // this.$xrayExperience = undefined;
    Spinner.useSpinner();
  }

  get data() {
    return this.$data;
  }

  get xrayExperience() {
    return this.$xrayExperience;
  }

  async createContent() {
    const container = $('<div/>')
      .addClass('col-11 my-4 vh-50');

    const desc = this.createDescription();
    container.append(desc);

    container.ready(async () => {
      try {
        Spinner.loading();

        let datapoints = await this.download(this.data.key);
        if (datapoints) {
          datapoints = await datapoints.Body.transformToString()
            .then((res) =>
              JSON.parse(res));
        }

        const listView = this.createListView(datapoints);
        container.append(listView);

        if (this.xrayExperience) {
          await this.xrayExperience.buildShoppableExperience(datapoints);
        }
      } catch (e) {
        console.error(e);
      } finally {
        Spinner.loading(false);
      }
    });

    return container;
  }

  createDescription() {
    const section = $('<section/>')
      .addClass('col-10 mx-auto');

    const desc = $('<p/>')
      .addClass('lead-s')
      .append(MSG_DESC);
    section.append(desc);

    return section;
  }

  createListView(datapoints) {
    const section = $('<section/>')
      .addClass('col-10 mx-auto');

    const details = $('<details/>')
      .attr('open', '');
    section.append(details);

    const summary = $('<summary/>')
      .addClass('my-4');
    details.append(summary);

    const title = $('<span/>')
      .addClass('lead ml-2')
      .html(MSG_LIST_TITLE);
    summary.append(title);

    section.ready(async () => {
      try {
        Spinner.loading();

        let framePrefix = datapoints.framePrefix;
        if (framePrefix === undefined) {
          const data = this.media.getRekognitionResults();
          const lastIdx = data.framesegmentation.key.lastIndexOf('/');
          framePrefix = data.framesegmentation.key.substring(0, lastIdx);
        }

        const carousel = await this.buildFrameList(
          datapoints,
          framePrefix
        );
        details.append(carousel);
      } catch (e) {
        console.error(e);
      } finally {
        Spinner.loading(false);
      }
    });

    return section;
  }

  async buildFrameList(
    datapoints,
    framePrefix
  ) {
    const container = $('<div/>')
      .addClass('col-12 p-0 m-0')
      .css('aspect-ratio', '7/2');

    let items = datapoints[Shoppable] || [];
    if (items.length === 0) {
      const noData = $('<p/>')
        .addClass('lead-s text-muted')
        .append(ERR_NO_SHOPPABLE_PRODUCT);

      container.append(noData);

      return container;
    }

    const proxyBucket = this.media.getProxyBucket();

    items = items.map((item) => {
      const name = item.file;
      return {
        ...item,
        key: `${framePrefix}/${name}`,
      };
    });

    items = items
      .filter((item) =>
        item.apparels.length > 0);

    items.sort((a, b) =>
      a.frameNo - b.frameNo);

    // frame list
    const frameListContainer = $('<div/>')
      .addClass('no-gutters d-flex overflow-auto');
    container.append(frameListContainer);

    // frame detail view
    const frameDetailContainer = $('<div/>')
      .addClass('col-12 m-0 p-0 mt-4')
      .addClass('collapse');
    container.append(frameDetailContainer);

    const images = items.map((item) => {
      const image = $('<img/>')
        .addClass('thumbnail opacity07 d-inline-flex m-3')
        .css('aspect-ratio', '16/9')
        .data('item', item);

      // event handlings
      image.ready(async () => {
        const src = await this.media.getNamedImageUrl(
          proxyBucket,
          item.key
        );
        image.attr('src', src.url);
      });

      image.on('click', async (event) => {
        event.preventDefault();
        return this.onFrameSelected(frameDetailContainer, image);
      });

      return image;
    });
    frameListContainer.append(images);

    return container;
  }

  async onFrameSelected(frameDetailView, frame) {
    frame.parent()
      .find('img.thumbnail')
      .removeClass('active');
    frame.addClass('active');

    frameDetailView.children()
      .remove();

    const item = frame.data('item');
    const src = frame.attr('src');

    const container = $('<div/>')
      .addClass('row no-gutters');
    frameDetailView.append(container);

    // R-view - display frame
    const imageContainer = $('<div/>')
      .addClass('col-7 m-0 p-0')
      .addClass('image-container');
    container.append(imageContainer);

    const image = $('<img/>')
      .addClass('w-100')
      .css('aspect-ratio', '16/9')
      .css('object-fit', 'contain')
      .attr('src', src);
    imageContainer.append(image);

    // L-view - show description
    const dataContainer = $('<div/>')
      .addClass('col-5 m-0 p-0');
    container.append(dataContainer);

    const innerContainer = $('<div/>')
      .addClass('col-11 mx-auto m-0 p-0');
    dataContainer.append(innerContainer);

    let desc = item.apparels
      .map((apparel) =>
        apparel.label);
    desc = [
      ...new Set(desc),
    ].join(', ');
    desc = MSG_ITEMS_DESC
      .replace('{{ITEMS}}', desc);
    desc = $('<p/>')
      .addClass('lead-s')
      .append(desc);
    innerContainer.append(desc);

    // Bottom-view - show similar products
    const shopAmazonDetails = $('<details/>')
      .addClass('col-12 m-0 p-0');
    container.append(shopAmazonDetails);

    const shopAmazonSummary = $('<summary/>')
      .addClass('my-4');
    shopAmazonDetails.append(shopAmazonSummary);

    const shopAmazonTitle = $('<span/>')
      .addClass('lead-s ml-2')
      .html(MSG_SHOP_AMAZON_TITLE);
    shopAmazonSummary.append(shopAmazonTitle);

    const shopAmazonItemList = $('<div/>')
      .addClass('row no-gutters');
    shopAmazonDetails.append(shopAmazonItemList);

    // Debug-view - show metadata JSON file
    const metadataDetails = $('<details/>')
      .addClass('col-12 m-0 p-0');
    container.append(metadataDetails);

    const metadataSummary = $('<summary/>')
      .addClass('my-4');
    metadataDetails.append(metadataSummary);

    const metadataTitle = $('<span/>')
      .addClass('lead-s ml-2')
      .html(MSG_METADATA_TITLE);
    metadataSummary.append(metadataTitle);

    const jsonData = $('<pre/>')
      .addClass('lead-xs')
      .append(JSON.stringify(item, null, 2));
    metadataDetails.append(jsonData);

    frameDetailView.removeClass('collapse');

    // event handlings
    // overlay bounding boxes
    image.on('load', () => {
      const actualW = image[0].naturalWidth;
      const actualH = image[0].naturalHeight;
      const imgW = image.width();
      const imgH = image.height();

      const scale = Math.min((imgW / actualW), (imgH / actualH));
      console.log(`${imgW}x${imgH} (${actualW}x${actualH}), [${scale}]`);

      const scaleW = actualW * scale;
      const scaleH = actualH * scale;
      const offsetW = (imgW - scaleW) / 2;
      const offsetH = (imgH - scaleH) / 2;

      const boxes = item.apparels.map((apparel, idx) => {
        const cx = Math.round(((apparel.box.w / 2) + apparel.box.l) * scaleW + offsetW);
        const cy = Math.round(((apparel.box.h / 2) + apparel.box.t) * scaleH + offsetH);
        const box = $('<div/>')
          .addClass('apparel-item')
          .css('left', cx)
          .css('top', cy)
          .data('idx', idx);

        box.on('click', async (event) => {
          event.preventDefault();
          console.log('box clicked', item.apparels[idx]);
          await this.onApparelSelected(item.apparels[idx], shopAmazonItemList);
        });

        return box;
      });
      imageContainer.append(boxes);
    });

    return item;
  }

  async onApparelSelected(similarItems, container) {
    try {
      Spinner.loading();

      container.children().remove();

      const asins = similarItems.items.map((item) => {
        const asin = item.asin.split('.').pop();
        return asin;
      });

      const responses = await ApiHelper.getProductDetails({
        asins: asins.join(','),
      });

      const items = [];
      responses.forEach((item) => {
        if (item.images === undefined) {
          console.log(item);
          return;
        }

        const src = item.images.imageList[0].lowRes.url;
        const link = `https://www.amazon.com/dp/${item.asin}`;

        const itemEl = $('<div/>')
          .addClass('col-3');

        const image = $('<img/>')
          .addClass('w-100')
          .css('object-fit', 'contain')
          .css('aspect-ratio', '1/1')
          .css('cursor', 'pointer')
          .attr('src', src);
        itemEl.append(image);

        const price = $('<span/>')
          .addClass('lead-xs b-400');
        if (item.availability.type === 'OUT_OF_STOCK') {
          price.addClass('text-danger')
            .append(item.availability.type);
        } else {
          price.addClass('text-success')
            .append(`$${item.price.value}`);
        }

        const title = $('<p/>')
          .addClass('text-center')
          .addClass('lead-xxs b-300')
          .append(item.title)
          .append('<br/>')
          .append(price);
        itemEl.append(title);

        image.on('click', (event) => {
          event.preventDefault();
          window.open(link, '_blank');
        });

        items.push(itemEl);
      });

      container.append(items);

      container.parent()
        .attr('open', '');
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }
}
