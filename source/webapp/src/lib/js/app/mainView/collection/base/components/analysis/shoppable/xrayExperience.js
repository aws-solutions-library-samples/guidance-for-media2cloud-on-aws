// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AppUtils from '../../../../../../shared/appUtils.js';
import ApiHelper from '../../../../../../shared/apiHelper.js';

const KEYCODE_SPACEBAR = 32;
// const KEYCODE_ARROW_L = 37;
// const KEYCODE_ARROW_R = 39;

export default class XRayExperience {
  constructor(parent) {
    this.$id = AppUtils.randomHexstring();
    this.$parent = parent;
  }

  get id() {
    return this.$id;
  }

  get parent() {
    return this.$parent;
  }

  get media() {
    return this.parent.media;
  }

  getVideoPlayer() {
    return this.parent.previewComponent.getVideoPlayer();
  }

  async buildShoppableExperience(datapoints) {
    if (datapoints.shoppableBySegment === undefined
    || datapoints.shoppableBySegment.length === 0) {
      return;
    }

    let framePrefix = datapoints.framePrefix;
    if (framePrefix === undefined) {
      const data = this.media.getRekognitionResults();
      const lastIdx = data.framesegmentation.key.lastIndexOf('/');
      framePrefix = data.framesegmentation.key.substring(0, lastIdx);
    }

    let asins = [];
    datapoints.shoppableBySegment.forEach((segment) => {
      segment.apparels.forEach((apparelItem) => {
        apparelItem.asins.forEach((asinItem) => {
          asins.push(asinItem.asin);
        });
      });
    });

    asins = [
      ...new Set(asins),
    ];

    let productDetails = await ApiHelper.getProductDetails({
      asins: asins.join(','),
    });

    if (productDetails.length === 0) {
      return;
    }

    productDetails = productDetails
      .reduce((a0, c0) => ({
        ...a0,
        [c0.asin]: c0,
      }), {});

    // build overlay events
    const xrayItems = [];
    const gemItems = [];

    datapoints.shoppableBySegment
      .forEach((segment, idx) => {
        // build gem icon
        const gemOverlay = this.buildGemIconOverlay(segment);
        gemItems.push(gemOverlay);

        const content = this.buildSlideshow(segment, idx, productDetails);

        const item = {
          // start: 'pause',
          start: `custom-${idx}`,
          end: 'playing',
          align: 'bottom',
          class: 'vjs-custom-overlay overflow-auto',
          attachToControlBar: true,
          content: content.get(0),
        };
        xrayItems.push(item);
      });

    const vjs = this.getVideoPlayer();

    vjs.overlay({
      overlays: gemItems.concat(xrayItems),
    });

    vjs.on('pause', async () => {
      const curTime = Math.round(vjs.currentTime() * 1000);
      for (let i = 0; i < datapoints.shoppableBySegment.length; i += 1) {
        const segment = datapoints.shoppableBySegment[i];
        if (curTime >= segment.timeStart && curTime <= segment.timeEnd) {
          vjs.trigger(`custom-${i}`);
          break;
        }
      }
    });

    vjs.on('keydown', (event) => {
      const isPaused = vjs.paused();
      if (event.keyCode === KEYCODE_SPACEBAR) {
        if (isPaused) {
          vjs.play();
        } else {
          vjs.pause();
        }
      } else if (isPaused) {
        event.preventDefault();
        event.stopPropagation();
        // navigate through the item
        // if (event.keyCode === KEYCODE_ARROW_R) {
        // } else if (event.keyCode === KEYCODE_ARROW_L) {
        // }
      }
    });
  }

  buildGemIconOverlay(segment) {
    const content = $('<i/>')
      .addClass('far fa-gem text-light p-2 lead-lg blinky');

    const overlay = {
      start: segment.timeStart,
      end: segment.timeEnd,
      align: 'top-right',
      showBackground: false,
      content: content.get(0),
    };

    return overlay;
  }

  buildSlideshow(segment, idx, productDetails) {
    // build slideshow
    const id = `xray-${this.id}-${idx}`;
    const idProductList = `${id}-productlist`;
    const idProductDetails = `${id}-productdetails`;
    const idPreviewOrder = `${id}-previeworder`;
    const idConfirmOrder = `${id}-confirmorder`;

    const carousel = $('<div/>')
      .addClass('carousel slide')
      .attr('data-ride', false)
      .attr('data-interval', false)
      .attr('id', id);

    const carouselInner = $('<div/>')
      .addClass('carousel-inner');
    carousel.append(carouselInner);

    const pageProductList = $('<div/>')
      .addClass('carousel-item')
      .data('grandparent', id)
      .attr('id', idProductList)
      .data('next', idProductDetails);
    carouselInner.append(pageProductList);

    const pageProductDetails = $('<div/>')
      .addClass('carousel-item')
      .data('grandparent', id)
      .data('back', idProductList)
      .attr('id', idProductDetails)
      .data('next', idPreviewOrder);
    carouselInner.append(pageProductDetails);

    const pagePreviewOrder = $('<div/>')
      .addClass('carousel-item')
      .data('grandparent', id)
      .data('back', idProductDetails)
      .attr('id', idPreviewOrder)
      .data('next', idConfirmOrder);
    carouselInner.append(pagePreviewOrder);

    const pageConfirmOrder = $('<div/>')
      .addClass('carousel-item')
      .data('grandparent', id)
      .attr('id', idConfirmOrder)
      .data('next', idPreviewOrder);
    carouselInner.append(pageConfirmOrder);

    carouselInner.find('div:first-child')
      .addClass('active');

    // event handling
    carousel.ready(async () => {
      this.onRenderProductListPage(segment, idx, productDetails, pageProductList);
    });

    return carousel;
  }

  onRenderProductListPage(segment, idx, productDetails, pageProductList) {
    console.log('=== onRenderProductListPage ====');
    pageProductList.children().remove();

    const container = $('<div/>')
      .addClass('col-12 m-0 p-0')
      .addClass('overflow-auto');
    pageProductList.append(container);

    const rowContainer = $('<div/>')
      .addClass('no-gutters d-flex checkout-flow');
    container.append(rowContainer);

    const items = [];

    segment.apparels.forEach((apparelItem) => {
      apparelItem.asins.forEach((asinItem) => {
        const item = productDetails[asinItem.asin];
        if (item && item.images) {
          const src = item.images.imageList[0].lowRes.url;

          const itemEl = $('<div/>')
            .addClass('thumbnail vh16 opacity10 d-inline-flex m-3 my-auto')
            .addClass('image-container')
            .addClass('bg-black')
            .addClass('no-cursor')
            .css('aspect-ratio', '3')
            .data('product-item', idx)
            .data('item', item);

          const image = $('<img/>')
            .addClass('col-3 m-0 p-0')
            .addClass('bg-white')
            .css('object-fit', 'contain')
            .css('aspect-ratio', '1/1')
            .attr('src', src);
          itemEl.append(image);

          const itemDesc = $('<div/>')
            .addClass('col-9 m-0 p-0 px-3 my-auto');
          itemEl.append(itemDesc);

          const title = $('<p/>')
            .addClass('text-left p-0 m-0')
            .append(item.title);
          itemDesc.append(title);

          const btnBuy = $('<a/>')
            .attr('role', 'button')
            .attr('href', '#')
            .addClass('btn btn-sm mt-2 float-right');
          itemDesc.append(btnBuy);

          if (item.availability.type === 'OUT_OF_STOCK') {
            btnBuy.addClass('btn-outline-danger disabled')
              .attr('disabled', 'disabled')
              .append('Not available');
          } else {
            btnBuy.addClass('btn-outline-success')
              .append(`$${item.price.value}`);
          }

          // event handlings
          btnBuy.on('click', async (event) => {
            event.preventDefault();
            btnBuy.blur();

            const nextId = pageProductList.data('next');
            const pageProductDetails = pageProductList.siblings(`div#${nextId}`);

            await this.onRenderProductDetailsPage(item, pageProductDetails);

            const pageIdx = pageProductDetails.index();
            pageProductDetails.parent().parent().carousel(pageIdx);
          });

          items.push(itemEl);
        }
      });
    });
    rowContainer.append(items);

    return rowContainer;
  }

  async onRenderProductDetailsPage(item, pageProductDetails) {
    console.log('=== onRenderProductDetailsPage ====');

    pageProductDetails.children().remove();

    const container = $('<div/>')
      .addClass('col-12 m-0 p-0');
    pageProductDetails.append(container);

    const rowContainer = $('<div/>')
      .addClass('row no-gutters')
      .addClass('checkout-flow');
    container.append(rowContainer);

    const src = item.images.imageList[0].lowRes.url;
    const image = $('<img/>')
      .addClass('col-2 m-0 p-0')
      .addClass('bg-white')
      .css('object-fit', 'contain')
      .css('aspect-ratio', '1/1')
      .attr('src', src);
    rowContainer.append(image);

    // description block
    const descContainer = $('<div/>')
      .addClass('col-6 my-auto mx-4');
    rowContainer.append(descContainer);

    const seller = $('<p/>')
      .addClass('text-left p-0 m-0 mt-2');
    descContainer.append(seller);

    const sellerUrl = $('<a/>')
      .addClass('text-left')
      .css('font-size', '0.8rem')
      .attr('href', item.sellerPageURL)
      .attr('target', '_blank')
      .append(`Visit ${item.sellerName}`);
    seller.append(sellerUrl);

    // title
    const title = $('<p/>')
      .addClass('text-left p-0 m-0 my-2')
      .css('font-size', '1.1rem')
      .css('font-weight', '400')
      .append(item.title);
    descContainer.append(title);

    // view details
    const viewDetails = $('<p/>')
      .addClass('text-left p-0 m-0 mt-4')
      .css('font-size', '0.9rem');
    descContainer.append(viewDetails);

    let tooltipText = $('<div/>')
      .addClass('lead-xxxs b-300 text-left');

    item.shortDescriptionBullets.forEach((bullet) => {
      const li = $('<span/>')
        .addClass('d-block mb-1')
        .append(`&#9900; ${bullet}`);
      tooltipText.append(li);
    });
    tooltipText = tooltipText.prop('outerHTML');

    const moreInfo = $('<span/>')
      .addClass('text-primary')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'right')
      .attr('data-html', true)
      .attr('title', tooltipText)
      .text('More information');
    moreInfo.tooltip({
      trigger: 'hover',
    });
    viewDetails.append(moreInfo);

    const shipper = $('<p/>')
      .addClass('text-left p-0 m-0 mt-4')
      .css('font-size', '0.9rem')
      .append(`(Ship from ${item.shipperName})`);
    descContainer.append(shipper);

    // size and color
    const sizeArray = [];
    const colorArray = [];

    item.productVariations.variationDimensions
      .forEach((variation) => {
        let arr;
        if (variation.name === 'Size') {
          arr = sizeArray;
        } else if (variation.name === 'Color') {
          arr = colorArray;
        }
        if (arr) {
          variation.values.forEach((size, idx) => {
            const option = $('<option/>')
              .attr('value', size.value)
              .text(`${variation.name}: ${size.value}`);
            arr.push(option);
          });
        }
      });

    const variationContainer = $('<div/>')
      .addClass('col-3 m-0 my-auto');
    rowContainer.append(variationContainer);

    if (sizeArray.length > 0) {
      const selectSize = $('<select/>')
        .addClass('col-12 mb-1')
        .addClass('custom-select custom-select-sm select-bg-dark');
      variationContainer.append(selectSize);

      selectSize.append(sizeArray);
      selectSize.find('option:first-child')
        .attr('selected', '');
    }

    if (colorArray.length > 0) {
      const selectColor = $('<select/>')
        .addClass('col-12 mb-1')
        .addClass('custom-select custom-select-sm select-bg-dark');
      variationContainer.append(selectColor);

      selectColor.append(colorArray);
      selectColor.find('option:first-child')
        .attr('selected', '');
    }

    // add quantity selection
    const selectQuantity = $('<select/>')
      .addClass('col-12 mb-1')
      .addClass('custom-select custom-select-sm select-bg-dark');
    variationContainer.append(selectQuantity);

    for (let i = item.quantity.minOrderQuantity; i <= item.quantity.maxOrderQuantity; i += 1) {
      const option = $('<option/>')
        .attr('value', i)
        .text(`Qty: ${i}`);
      selectQuantity.append(option);
    }
    selectQuantity.find('option:first-child')
      .attr('selected', '');

    // button group
    const btnGroup = $('<div/>')
      .addClass('col-12 m-0 p-0')
      .addClass('btn-group')
      .attr('role', 'group')
      .attr('aria-label', 'Button group');
    variationContainer.append(btnGroup);

    // back button
    const btnBack = $('<a/>')
      .attr('role', 'button')
      .attr('href', '#')
      .addClass('btn btn-sm btn-outline-light mr-1')
      .append('Back');
    btnGroup.append(btnBack);

    // checkout button
    const btnCheckout = $('<a/>')
      .attr('role', 'button')
      .attr('href', '#')
      .addClass('btn btn-sm btn-success')
      .append('Proceed to checkout');
    btnGroup.append(btnCheckout);

    // event handlings
    btnBack.on('click', async (event) => {
      event.preventDefault();
      btnBack.blur();

      const backId = pageProductDetails.data('back');
      const pageProductList = pageProductDetails.siblings(`div#${backId}`);

      const pageIdx = pageProductList.index();
      pageProductList.parent().parent().carousel(pageIdx);
    });

    btnCheckout.on('click', async (event) => {
      event.preventDefault();
      btnCheckout.blur();

      const items = [];
      items.push({
        quantity: Number(selectQuantity.val()),
        asin: item.asin,
        offerId: item.offerId,
        merchantId: item.merchantId,
      });

      let previewOrders = {
        items,
      };
      previewOrders = await ApiHelper.previewOrders(
        undefined,
        previewOrders
      );

      const nextId = pageProductDetails.data('next');
      const pagePreviewOrders = pageProductDetails.siblings(`div#${nextId}`);

      await this.onRenderPreviewOrderPage(
        item,
        previewOrders,
        pagePreviewOrders
      );

      const pageIdx = pagePreviewOrders.index();
      pagePreviewOrders.parent().parent().carousel(pageIdx);
    });
  }

  async onRenderPreviewOrderPage(item, previewOrdersData, pagePreviewOrders) {
    console.log('=== onRenderPreviewOrderPage ====');

    pagePreviewOrders.children().remove();

    const container = $('<div/>')
      .addClass('col-12 m-0 p-0');
    pagePreviewOrders.append(container);

    const rowContainer = $('<div/>')
      .addClass('row no-gutters')
      .addClass('checkout-flow');
    container.append(rowContainer);

    const viewL = $('<div/>')
      .addClass('col-6 m-0 my-auto');
    rowContainer.append(viewL);

    const shippingBillingTable = this.createShippingBillingTable(previewOrdersData);
    viewL.append(shippingBillingTable);

    const viewR = $('<div/>')
      .addClass('col-6 m-0 my-auto');
    rowContainer.append(viewR);

    const orderSummarySection = this.createOrderSummarySection(previewOrdersData);
    viewR.append(orderSummarySection);

    // control button group
    const btnGroup = $('<div/>')
      .addClass('col-9 m-0 p-0')
      .addClass('btn-group')
      .attr('role', 'group')
      .attr('aria-label', 'Button group');
    viewR.append(btnGroup);

    const btnLater = $('<a/>')
      .attr('role', 'button')
      .attr('href', '#')
      .addClass('btn btn-sm btn-outline-light mr-1')
      .append('Later');
    btnGroup.append(btnLater);

    // confirm button
    const btnConfirm = $('<a/>')
      .attr('role', 'button')
      .attr('href', '#')
      .addClass('btn btn-sm btn-success')
      .append('Place your order');
    btnGroup.append(btnConfirm);

    // event handlings
    btnLater.on('click', async (event) => {
      event.preventDefault();
      btnLater.blur();

      setTimeout(() => {
        console.log('===== getVideoPlayer =====');
        this.getVideoPlayer().play();

        pagePreviewOrders.parent().parent().carousel(0);
      }, 10);
    });

    btnConfirm.on('click', async (event) => {
      event.preventDefault();
      btnConfirm.blur();

      const qs = {
        purchaseId: previewOrdersData.purchaseId,
      };

      const confirmOrders = await ApiHelper.confirmOrders(
        qs,
        previewOrdersData
      );

      const nextId = pagePreviewOrders.data('next');
      const pageConfirmOrders = pagePreviewOrders.siblings(`div#${nextId}`);

      await this.onRenderConfirmOrderPage(
        item,
        confirmOrders,
        pageConfirmOrders
      );

      const pageIdx = pageConfirmOrders.index();
      pagePreviewOrders.parent().parent().carousel(pageIdx);
    });

    return undefined;
  }

  async onRenderConfirmOrderPage(item, confirmOrdersData, pageConfirmOrder) {
    console.log('=== pageConfirmOrder ====');

    pageConfirmOrder.children().remove();

    const container = $('<div/>')
      .addClass('col-12 m-0 p-0');
    pageConfirmOrder.append(container);

    const rowContainer = $('<div/>')
      .addClass('row no-gutters')
      .addClass('checkout-flow');
    container.append(rowContainer);

    const groupContainer = $('<div/>')
      .addClass('col-12 text-center text-white')
      .addClass('my-auto');
    rowContainer.append(groupContainer);

    const orderId = AppUtils.randomHexstring();
    const orderReceived = $('<h5/>')
      .append(`Order received: ${orderId}`);
    groupContainer.append(orderReceived);

    const gift = $('<p/>')
      .css('font-size', '3.5rem')
      .append('&#127873;');
    groupContainer.append(gift);

    let estimatedArrival = confirmOrdersData.orders[0].items[0].estimatedArrivalDate;
    estimatedArrival = new Date(estimatedArrival * 1000)
      .toDateString();

    estimatedArrival = $('<p/>')
      .addClass('lead-s')
      .append(`(Estimated arrival date: ${estimatedArrival})`);
    groupContainer.append(estimatedArrival);

    const btnResume = $('<a/>')
      .addClass('col-3')
      .attr('role', 'button')
      .attr('href', '#')
      .addClass('btn btn-sm btn-outline-success')
      .append('Resume playback in 10s');
    groupContainer.append(btnResume);

    let remaining = 9;
    const resumeTimer = setInterval(() => {
      btnResume.text(`Resume playback in ${remaining}s`);
      remaining -= 1;
      if (remaining === 0) {
        btnResume.click();
      }
    }, 1000);

    btnResume.on('click', async (event) => {
      event.preventDefault();
      btnResume.blur();

      clearInterval(resumeTimer);

      setTimeout(() => {
        console.log('===== getVideoPlayer =====');
        this.getVideoPlayer().play();

        pageConfirmOrder.parent().parent().carousel(0);
      }, 10);
    });
  }

  createShippingBillingTable(previewOrdersData) {
    // shipping / payment method
    const table = $('<table/>')
      .addClass('col-12');

    const tbody = $('<tbody/>')
      .addClass('mb-2');
    table.append(tbody);

    const shippingAddress = $('<div/>');
    const recipient = $('<span/>')
      .addClass('d-block mb-1')
      .append(previewOrdersData.shippingAddress.recipient);
    shippingAddress.append(recipient);

    const street = $('<span/>')
      .addClass('d-block mb-1')
      .append(previewOrdersData.shippingAddress.street);
    shippingAddress.append(street);

    const city = $('<span/>')
      .addClass('d-block mb-1')
      .append(`${previewOrdersData.shippingAddress.city}, ${previewOrdersData.shippingAddress.zipCode}`);
    shippingAddress.append(city);

    const paymentMethod = $('<div/>');
    const ending = $('<span/>')
      .addClass('d-block mb-1')
      .append(`&#128179; ${previewOrdersData.paymentMethods[0].type} ending in ${previewOrdersData.paymentMethods[0].tail}`);
    paymentMethod.append(ending);

    const billing = $('<span/>')
      .addClass('d-block mb-1')
      .append('Billing address same as shipping address');
    paymentMethod.append(billing);

    [
      ['Shipping address', shippingAddress],
      ['Payment method', paymentMethod],
    ].forEach((_item) => {
      const tr = $('<tr/>')
        .addClass('text-left mb-2')
        .addClass('lead-xs b-300');
      tbody.append(tr);

      let [name, value] = _item;
      name = $('<h6/>')
        .append(name);
      name = $('<td/>')
        .addClass('align-top')
        .addClass('col-6')
        .append(name);
      tr.append(name);

      value = $('<td/>')
        .addClass('align-top')
        .addClass('col-6')
        .append(value);
      tr.append(value);
    });

    return table;
  }

  createOrderSummarySection(previewOrdersData) {
    const container = $('<div/>')
      .addClass('m-0 p-0');

    // order summary
    const orderSummary = $('<h6/>')
      .addClass('mb-4')
      .append('Order summary');
    container.append(orderSummary);

    const table = $('<table/>')
      .addClass('col-9 mx-auto mb-4');
    container.append(table);

    const tbody = $('<tbody/>')
      .addClass('mb-2');
    table.append(tbody);

    const itemPrice = $('<span/>')
      .addClass('d-block mb-1')
      .append(`$${previewOrdersData.charges[0].chargeAmount.value}`);
    const handlingFee = $('<span/>')
      .addClass('d-block mb-1')
      .append('Free');

    [
      ['Items:', itemPrice],
      ['Shipping & handling:', handlingFee],
    ].forEach((_item) => {
      const tr = $('<tr/>')
        .addClass('text-left mb-2')
        .addClass('lead-xs b-300');
      tbody.append(tr);

      let [name, value] = _item;
      name = $('<td/>')
        .addClass('align-top')
        .addClass('col-6')
        .append(name);
      tr.append(name);

      value = $('<td/>')
        .addClass('align-top')
        .addClass('col-6')
        .addClass('text-right')
        .append(value);
      tr.append(value);
    });

    // total price
    const tr = $('<tr/>')
      .addClass('text-left text-success my-2')
      .addClass('lead-s b-300');
    tbody.append(tr);

    const totalName = $('<td/>')
      .addClass('align-top')
      .addClass('col-6')
      .addClass('mt-2')
      .css('border-top', '1px solid white')
      .append('Order total:');
    tr.append(totalName);

    const totalValue = $('<td/>')
      .addClass('align-top')
      .addClass('col-6')
      .addClass('text-right mt-2')
      .css('border-top', '1px solid white')
      .append(`$${previewOrdersData.charges[0].chargeAmount.value}`);
    tr.append(totalValue);

    return container;
  }
}
