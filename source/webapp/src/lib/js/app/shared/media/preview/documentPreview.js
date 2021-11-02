// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import Localization from '../../localization.js';
import AppUtils from '../../appUtils.js';
import BasePreview from './basePreview.js';

const CANVAS_LIST = 'canvas-list';
const CAROUSEL_IMAGE = 'carousel-image';
const PAGE_DETAILS = 'page-details';
const PAGE_DETAILS_CONTAINER = 'page-details-container';
const PAGE_BUTTONS_CONTAINER = 'page-buttons-container';
const DATA_PAGEINDEX = 'data-page-idx';
const DATA_COORD = 'data-coord';
const DATA_BOX = 'data-box';
const DATA_CANVAS_ID = 'data-canvas-id';
const DATA_CANVAS_TYPE = 'data-canvas-type';
const TYPE_LINE = 'line';
const TYPE_KEYVAL = 'keyval';
const TYPE_CELL = 'cell';

export default class DocumentPreview extends BasePreview {
  constructor(media, optionSearchResults) {
    super(media, optionSearchResults);
    this.$slide = undefined;
    this.$pageControlContainer = undefined;
    this.$ids = {
      ...this.ids,
      carousel: `doc-${AppUtils.randomHexstring()}`,
    };
  }

  get slide() {
    return this.$slide;
  }

  set slide(val) {
    this.$slide = val;
  }

  get pageControlContainer() {
    return this.$pageControlContainer;
  }

  set pageControlContainer(val) {
    this.$pageControlContainer = val;
  }

  getPageControlContainer() {
    return this.pageControlContainer;
  }

  slideTo(idx) {
    return this.slide.carousel(idx);
  }

  async load() {
    return this.preloaded
      ? this
      : this.preload();
  }

  async unload() {
    if (this.pageControlContainer) {
      this.pageControlContainer.remove();
    }
    if (this.slide) {
      this.slide.remove();
    }
    return super.unload();
  }

  async preload() {
    await this.unload();
    const pages = await this.media.loadPages();
    if (!pages || !pages.length) {
      return this.noData();
    }
    const carouselInner = $('<div/>').addClass('carousel-inner');
    const pageButtonContainer = $('<div/>').addClass('no-gutters d-flex overflow-auto')
      .addClass(PAGE_BUTTONS_CONTAINER);
    const pageDetailsContainer = $('<div/>').addClass('col-12 p-0 m-0')
      .addClass(PAGE_DETAILS_CONTAINER);
    const pageElements = pages.map(x => this.createPage(x));
    pageElements.forEach((pageElement, idx) => {
      if (idx === 0) {
        pageElement.carouselItem.addClass('active');
      }
      carouselInner.append(pageElement.carouselItem);
      pageButtonContainer.append(pageElement.pageButton);
      pageDetailsContainer.append(pageElement.pageDetails);
    });
    this.pageControlContainer = $('<div/>').addClass('col-12 my-4 p-0 m-0')
      .append(pageButtonContainer)
      .append(pageDetailsContainer);
    this.slide = $('<div/>').addClass('carousel slide w-100')
      .attr('data-ride', false)
      .attr('data-interval', false)
      .attr('id', this.ids.carousel)
      .append(carouselInner);
    this.container.append($('<div/>').addClass('col-12 p-0 m-0')
      .append(this.slide));
    this.preloaded = true;
    return this;
  }

  createPage(page) {
    const item = this.creatCarouselItem(page);
    const controls = this.createPageControl(page, item);
    return {
      carouselItem: item,
      ...controls,
    };
  }

  creatCarouselItem(page) {
    const idx = page.data.PageNum;
    const canvases = $('<div/>').addClass(CANVAS_LIST);
    const img = $('<img/>').addClass('h-800max img-contain carousel-image')
      .attr('src', page.url)
      .attr('alt', `Page ${idx + 1}`);
    const overlay = $('<div/>').addClass('overlay-container mx-auto')
      .append(img)
      .append(canvases);
    return $('<div/>').addClass('carousel-item')
      .attr(DATA_PAGEINDEX, idx)
      .append(overlay);
  }

  createPageControl(page, carouselItem) {
    const controlGroup = $('<div/>').addClass('col-11 p-0 ml-4 h-600max overflow-auto')
      .addClass(PAGE_DETAILS)
      .addClass('collapse')
      .attr(DATA_PAGEINDEX, page.data.PageNum);
    const button = $('<img/>').addClass('thumbnail d-inline-flex m-3')
      .attr(DATA_PAGEINDEX, page.data.PageNum)
      .attr('src', page.url);
    button.on('click', async (event) => {
      event.preventDefault();
      return this.onPageButtonSelected(button, controlGroup, page);
    });
    const lineGroup = this.createLineDetails(carouselItem, page.data.Blocks);
    const keyValGroup = this.createKeyValueDetails(carouselItem, page.data.Blocks);
    const tableGroup = this.createTableCellDetails(carouselItem, page.data.Blocks);
    controlGroup.append(keyValGroup)
      .append(tableGroup)
      .append(lineGroup);
    return {
      pageButton: button,
      pageDetails: controlGroup,
    };
  }

  createLineDetails(carouselItem, blocks) {
    const items = [];
    const lines = (blocks || []).filter(x => x.BlockType === 'LINE');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      items.push(this.createCanvasButton(carouselItem, {
        text: line.Text,
        coord: line.Geometry.Polygon,
        box: line.Geometry.BoundingBox,
        confidence: line.Confidence,
        type: TYPE_LINE,
      }));
    }
    if (items.length === 0) {
      return undefined;
    }
    const details = $('<details/>').addClass('ml-1')
      .append($('<summary/>').addClass('my-2')
        .append($('<span/>').addClass('lead-sm text-capitalize')
          .append(`${Localization.Messages.Lines} (${items.length})`)));
    return details.append(items);
  }

  createKeyValueDetails(carouselItem, blocks) {
    const btnGroups = [];
    const keyValSets = (blocks || []).filter(x =>
      x.BlockType === 'KEY_VALUE_SET');
    const keys = [];
    const values = [];
    for (let i = 0; i < keyValSets.length; i++) {
      const keyValSet = keyValSets[i];
      if (keyValSet.EntityTypes[0] === 'KEY') {
        keys.push(keyValSet);
      } else {
        values.push(keyValSet);
      }
    }
    while (keys.length) {
      /* Look for Key */
      const item = keys.shift();
      const btnGroup = $('<div/>').addClass('btn-group')
        .attr('role', 'group')
        .attr('aria-label', 'KeyValue Set');
      let key = 'Blank';
      if (item.Relationships) {
        const ids = item.Relationships.filter(x =>
          x.Type === 'CHILD').reduce((a0, c0) => a0.concat(c0.Ids), []);
        key = ids.reduce((a0, c0) => {
          const blk = (blocks || []).find(x => x.Id === c0);
          return (blk) ? a0.concat(blk.Text) : a0;
        }, []).filter(x => x).join(' ');
      }
      const keyBtn = this.createCanvasButton(carouselItem, {
        text: key,
        coord: item.Geometry.Polygon,
        box: item.Geometry.BoundingBox,
        confidence: item.Confidence,
        type: TYPE_KEYVAL,
      });
      btnGroup.append(keyBtn);
      /* Now, look for Value */
      const ids = item.Relationships.filter(x =>
        x.Type === 'VALUE').reduce((a0, c0) => a0.concat(c0.Ids), []).shift();
      const valItem = this.findAndSplice(values, 'Id', ids);
      let value = 'Blank';
      if (valItem && valItem.Relationships) {
        const wordIds = valItem.Relationships.filter(x =>
          x.Type === 'CHILD').reduce((a0, c0) => a0.concat(c0.Ids), []);
        value = wordIds.reduce((a0, c0) => {
          const blk = (blocks || []).find(x => x.Id === c0);
          return (blk) ? a0.concat(blk.Text || blk.SelectionStatus) : a0;
        }, []).filter(x => x).join(' ');
      }
      const valBtn = this.createCanvasButton(carouselItem, {
        text: value,
        coord: item.Geometry.Polygon,
        box: item.Geometry.BoundingBox,
        confidence: item.Confidence,
        type: TYPE_KEYVAL,
      });
      /* replace button style */
      valBtn.removeClass('btn-primary').addClass('btn-light');
      btnGroup.append(valBtn);
      btnGroups.push(btnGroup);
    }
    if (btnGroups.length === 0) {
      return undefined;
    }
    const details = $('<details/>').addClass('ml-1')
      .append($('<summary/>').addClass('my-2')
        .append($('<span/>').addClass('lead-sm text-capitalize')
          .append(`${Localization.Messages.KeyValueSets} (${btnGroups.length})`)));
    return details.append(btnGroups);
  }

  createTableCellDetails(carouselItem, blocks) {
    const tables = (blocks || []).filter(x => x.BlockType === 'TABLE');
    const cells = (blocks || []).filter(x => x.BlockType === 'CELL');
    let tableIdx = 0;
    const tableItems = [];
    while (tables.length) {
      const table = tables.shift();
      const cellIds = table.Relationships.find(x => x.Type === 'CHILD').Ids;
      while (cellIds.length) {
        const cell = this.findAndSplice(cells, 'Id', cellIds.shift());
        if (cell) {
          let text = 'Blank';
          if (cell.Relationships) {
            const ids = cell.Relationships.find(x => x.Type === 'CHILD').Ids;
            text = ids.reduce((a0, c0) => {
              const blk = blocks.find(x => x.Id === c0);
              return (blk) ? a0.concat(blk.Text) : a0;
            }, []).filter(x => x).join(' ');
          }
          const rowIdx = cell.RowIndex - 1;
          if (!tableItems[tableIdx]) {
            tableItems[tableIdx] = [];
          }
          if (!tableItems[tableIdx][rowIdx]) {
            tableItems[tableIdx][rowIdx] = [];
          }
          const cellBtn = this.createCanvasButton(carouselItem, {
            text,
            coord: cell.Geometry.Polygon,
            box: cell.Geometry.BoundingBox,
            confidence: cell.Confidence,
            type: TYPE_CELL,
          });
          tableItems[tableIdx][rowIdx].push(cellBtn);
        }
      }
      tableIdx++;
    }
    if (tableItems.length === 0) {
      return undefined;
    }
    const tableGroup = $('<details/>').addClass('ml-1')
      .append($('<summary/>').addClass('my-2')
        .append($('<span/>').addClass('lead-sm text-capitalize')
          .append(`${Localization.Messages.Tables} (${tableItems.length})`)));
    tableItems.forEach((table, tid) => {
      const perTableGroup = $('<details/>').addClass('ml-2')
        .append($('<summary/>').addClass('my-1')
          .append($('<span/>').addClass('lead-xs text-captialize')
            .append(`${Localization.Messages.Table} ${tid + 1} (${table.length} ${Localization.Messages.Rows})`)));
      table.forEach((row, rid) => {
        const rowGroup = $('<details/>').addClass('ml-3')
          .append($('<summary/>').addClass('my-1')
            .append($('<span/>').addClass('lead-xxs text-captialize')
              .append(`${Localization.Messages.Row} ${rid + 1}`)));
        row.forEach((btn) => {
          rowGroup.append(btn);
        });
        perTableGroup.append(rowGroup);
      });
      tableGroup.append(perTableGroup);
    });
    return tableGroup;
  }

  createCanvasButton(carouselItem, attrs = {}) {
    const id = `control-${AppUtils.randomHexstring()}`;
    const confidence = Number.parseFloat(Number(attrs.confidence).toFixed(2));
    const box = `${attrs.box.Width},${attrs.box.Height},${attrs.box.Left},${attrs.box.Top}`;
    const coord = attrs.coord.reduce((a0, c0) =>
      a0.concat(c0.X, c0.Y), [])
      .join(',');
    const btn = $('<button/>').addClass('btn btn-sm btn-primary mb-1 ml-1 text-left')
      .attr('type', 'button')
      .attr('data-toggle', 'button')
      .attr('aria-pressed', false)
      .attr('autocomplete', 'off')
      .attr('data-placement', 'bottom')
      .attr(DATA_BOX, box)
      .attr(DATA_COORD, coord)
      .attr(DATA_CANVAS_ID, id)
      .attr(DATA_CANVAS_TYPE, attrs.type)
      .attr('title', `${Localization.Tooltips.Confidence}: ${confidence}%`)
      .append($('<span/>').addClass('lead-xxs')
        .append(attrs.text))
      .tooltip({
        trigger: 'hover',
      });
    btn.on('click', async (event) => {
      const render = btn.attr('aria-pressed') === 'false';
      return (render)
        ? this.showCanvas(btn, carouselItem)
        : this.hideCanvas(btn, carouselItem);
    });
    return btn;
  }

  showCanvas(btn, target) {
    const id = btn.attr(DATA_CANVAS_ID);
    const canvasList = target.find(`div.${CANVAS_LIST}`);
    let canvas = canvasList.find(`canvas[${DATA_CANVAS_ID}="${id}"]`).first();
    if (canvas.length) {
      return canvas.removeClass('collapse');
    }
    const targetImage = target.find(`img.${CAROUSEL_IMAGE}`).first();
    const [
      w, h, l, t,
    ] = btn.attr(DATA_BOX).split(',').map(x => Number.parseFloat(x));
    const canvasW = targetImage.width() * w;
    const canvasH = targetImage.height() * h;
    const canvasL = targetImage.width() * l;
    const canvasT = targetImage.height() * t;
    const type = btn.attr(DATA_CANVAS_TYPE);
    canvas = $('<canvas/>').addClass(`canvas-type-${type}`)
      .attr(DATA_CANVAS_ID, id)
      .attr('width', canvasW)
      .attr('height', canvasH)
      .css('left', canvasL)
      .css('top', canvasT)
      .css('position', 'absolute');
    canvasList.append(canvas);
    return canvas;
  }

  hideCanvas(btn, target) {
    const id = btn.attr(DATA_CANVAS_ID);
    const canvasList = target.find(`div.${CANVAS_LIST}`);
    const canvas = canvasList.find(`canvas[${DATA_CANVAS_ID}="${id}"]`).first();
    return canvas.addClass('collapse');
  }

  onPageButtonSelected(button, controlGroup, page) {
    button.parent().find('img').removeClass('active');
    button.addClass('active');
    controlGroup.parent().find(`div.${PAGE_DETAILS}`).addClass('collapse');
    controlGroup.removeClass('collapse');
    return this.slideTo(page.data.PageNum);
  }

  noData() {
    this.container.append($('<h5/>').addClass('lead')
      .append(Localization.Messages.NoData));
    return this;
  }

  findAndSplice(items, type, val) {
    const idx = items.findIndex(x => x[type] === val);
    return (idx < 0)
      ? undefined
      : items.splice(idx, 1).shift();
  }
}
