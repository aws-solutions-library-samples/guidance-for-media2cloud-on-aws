// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../localization.js';
import AppUtils from '../../appUtils.js';
import BasePreview from './basePreview.js';
import Spinner from '../../spinner.js';

const MSG_TABLE = Localization.Messages.Table;
const MSG_TABLES = Localization.Messages.Tables;
const MSG_ROW = Localization.Messages.Row;
const MSG_ROWS = Localization.Messages.Rows;
const MSG_LINES = Localization.Messages.Lines;
const MSG_KEY_VALUE_SETS = Localization.Messages.KeyValueSets;
const MSG_NO_DATA = Localization.Messages.NoData;
const TOOLTIP_CONFIDENCE = Localization.Tooltips.Confidence;

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
    Spinner.useSpinner();
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
    return this.slide
      .carousel(idx);
  }

  async load() {
    try {
      Spinner.loading();

      await this.unload();

      const pages = await this.media.loadPages();

      const carouselContainer = $('<div/>')
        .addClass('col-12 p-0 m-0');
      this.container.append(carouselContainer);

      const carousel = $('<div/>')
        .addClass('carousel slide w-100')
        .attr('data-ride', false)
        .attr('data-interval', false)
        .attr('id', this.ids.carousel);
      carouselContainer.append(carousel);
      this.slide = carousel;

      const pageControlContainer = $('<div/>')
        .addClass('col-12 my-4 p-0 m-0');
      this.pageControlContainer = pageControlContainer;

      const pageButtonContainer = $('<div/>')
        .addClass('no-gutters d-flex overflow-auto')
        .addClass(PAGE_BUTTONS_CONTAINER);
      pageControlContainer.append(pageButtonContainer);

      const pageDetailsContainer = $('<div/>')
        .addClass('col-12 p-0 m-0')
        .addClass(PAGE_DETAILS_CONTAINER);
      pageControlContainer.append(pageDetailsContainer);

      const carouselInner = $('<div/>')
        .addClass('carousel-inner');
      carousel.append(carouselInner);

      if (!pages || !pages.length) {
        const noData = this.noData();
        carouselInner.append(noData);
      } else {
        pages.forEach((page) => {
          const pageElement = this.createPage(page);

          carouselInner.append(pageElement.carouselItem);
          pageButtonContainer.append(pageElement.pageButton);
          pageDetailsContainer.append(pageElement.pageDetails);
        });

        /* set first slide active */
        carouselInner.children()
          .first()
          .addClass('active');
      }
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }

    return this;
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

    const container = $('<div/>')
      .addClass('carousel-item')
      .attr(DATA_PAGEINDEX, idx);

    const overlayContainer = $('<div/>')
      .addClass('overlay-container mx-auto');
    container.append(overlayContainer);

    const image = $('<img/>')
      .addClass('h-800max img-contain carousel-image')
      .attr('alt', `Page ${idx + 1}`);
    overlayContainer.append(image);

    const canvases = $('<div/>')
      .addClass(CANVAS_LIST);
    overlayContainer.append(canvases);

    image.ready(async () => {
      const bucket = this.media.getProxyBucket();
      const key = page.data.FileName;

      const src = await this.media.getNamedImageUrl(
        bucket,
        key
      );
      image.attr('src', src.url);
    });

    return container;
  }

  createPageControl(page, carouselItem) {
    const controlGroupContainer = $('<div/>')
      .addClass('col-11 p-0 ml-4 h-600max overflow-auto')
      .addClass(PAGE_DETAILS)
      .addClass('collapse')
      .attr(DATA_PAGEINDEX, page.data.PageNum);

    const lineGroup = this.createLineDetails(
      carouselItem,
      page.data.Blocks
    );
    const keyValGroup = this.createKeyValueDetails(
      carouselItem,
      page.data.Blocks
    );
    const tableGroup = this.createTableCellDetails(
      carouselItem,
      page.data.Blocks
    );

    controlGroupContainer.append(keyValGroup);
    controlGroupContainer.append(tableGroup);
    controlGroupContainer.append(lineGroup);

    const pageThumbnail = $('<img/>')
      .addClass('thumbnail d-inline-flex m-3')
      .attr(DATA_PAGEINDEX, page.data.PageNum);

    pageThumbnail.ready(async () => {
      const bucket = this.media.getProxyBucket();
      const key = page.data.FileName;
      const src = await this.media.getNamedImageUrl(
        bucket,
        key
      );
      pageThumbnail.attr('src', src.url);
    });

    pageThumbnail.on('click', async (event) => {
      event.preventDefault();
      return this.onPageButtonSelected(
        pageThumbnail,
        controlGroupContainer,
        page
      );
    });

    return {
      pageButton: pageThumbnail,
      pageDetails: controlGroupContainer,
    };
  }

  createLineDetails(carouselItem, blocks) {
    if (!Array.isArray(blocks)) {
      return undefined;
    }

    const lines = blocks
      .filter((block) =>
        block.BlockType === 'LINE')
      .map((line) => {
        const button = this.createCanvasButton(carouselItem, {
          type: TYPE_LINE,
          text: line.Text,
          coord: line.Geometry.Polygon,
          box: line.Geometry.BoundingBox,
          confidence: line.Confidence,
        });
        return button;
      });

    if (lines.length === 0) {
      return undefined;
    }

    const details = $('<details/>')
      .addClass('ml-1');

    const summary = $('<summary/>')
      .addClass('my-2');
    details.append(summary);

    const desc = $('<span/>')
      .addClass('lead-sm text-capitalize')
      .append(`${MSG_LINES} (${lines.length})`);
    summary.append(desc);

    details.append(lines);

    return details;
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
          .append(`${MSG_KEY_VALUE_SETS} (${btnGroups.length})`)));
    return details.append(btnGroups);
  }

  createTableCellDetails(carouselItem, blocks) {
    if (!Array.isArray(blocks)) {
      return undefined;
    }

    const tables = [];
    const cells = [];

    blocks.forEach((block) => {
      if (block.BlockType === 'TABLE') {
        tables.push(block);
      } else if (block.BlockType === 'CELL') {
        cells.push(block);
      }
    });

    let tableIdx = 0;
    const tableItems = [];
    while (tables.length) {
      const table = tables.shift();
      const cellIds = table.Relationships
        .find((x) =>
          x.Type === 'CHILD')
        .Ids;

      while (cellIds.length) {
        const cell = this.findAndSplice(cells, 'Id', cellIds.shift());
        if (cell) {
          let text = 'Blank';
          if (cell.Relationships) {
            const ids = cell.Relationships
              .find((x) =>
                x.Type === 'CHILD')
              .Ids;

            text = ids
              .reduce((a0, c0) => {
                const blk = blocks.find((x) =>
                  x.Id === c0);
                if (blk) {
                  return a0.concat(blk.Text);
                }
                return a0;
              }, [])
              .filter((x) =>
                x)
              .join(' ');
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

    const tableGroup = $('<details/>')
      .addClass('ml-1');

    const tableGroupSummary = $('<summary/>')
      .addClass('my-2');
    tableGroup.append(tableGroupSummary);

    const tableGroupDesc = $('<span/>')
      .addClass('lead-sm text-capitalize')
      .append();
    tableGroupSummary.append(tableGroupDesc);

    const tableGroupText = `${MSG_TABLES} (${tableItems.length})`;
    tableGroupDesc.append(tableGroupText);

    tableItems.forEach((table, tid) => {
      const perTableGroup = $('<details/>')
        .addClass('ml-2');

      const perTableSummary = $('<summary/>')
        .addClass('my-1');
      perTableGroup.append(perTableSummary);

      const perTableDesc = $('<span/>')
        .addClass('lead-xs text-captialize');
      perTableSummary.append(perTableDesc);

      const perTableText = `${MSG_TABLE} ${tid + 1} (${table.length} ${MSG_ROWS})`;
      perTableDesc.append(perTableText);

      table.forEach((row, rid) => {
        const rowGroup = $('<details/>')
          .addClass('ml-3');

        const rowSummary = $('<summary/>')
          .addClass('my-1');
        rowGroup.append(rowSummary);

        const rowDesc = $('<span/>')
          .addClass('lead-xxs text-captialize');
        rowSummary.append(rowDesc);

        const rowText = `${MSG_ROW} ${rid + 1}`;
        rowDesc.append(rowText);

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
    const confidence = Number(Number(attrs.confidence).toFixed(2));

    const box = [
      attrs.box.Width,
      attrs.box.Height,
      attrs.box.Left,
      attrs.box.Top,
    ].join(',');

    const coord = attrs.coord
      .reduce((a0, c0) =>
        a0.concat(c0.X, c0.Y), [])
      .join(',');

    const canvasBtn = $('<button/>')
      .addClass('btn btn-sm btn-primary mb-1 ml-1 text-left')
      .attr('type', 'button')
      .attr('data-toggle', 'button')
      .attr('aria-pressed', false)
      .attr('autocomplete', 'off')
      .attr('data-placement', 'bottom')
      .attr(DATA_BOX, box)
      .attr(DATA_COORD, coord)
      .attr(DATA_CANVAS_ID, id)
      .attr(DATA_CANVAS_TYPE, attrs.type)
      .attr('title', `${TOOLTIP_CONFIDENCE}: ${confidence}%`)
      .tooltip({
        trigger: 'hover',
      });

    const btnText = $('<span/>')
      .addClass('lead-xxs')
      .append(attrs.text);
    canvasBtn.append(btnText);

    canvasBtn.on('click', (event) => {
      const shouldRender = (canvasBtn.attr('aria-pressed') === 'false');
      if (shouldRender) {
        return this.showCanvas(
          canvasBtn,
          carouselItem
        );
      }
      return this.hideCanvas(
        canvasBtn,
        carouselItem
      );
    });

    return canvasBtn;
  }

  showCanvas(btn, target) {
    const id = btn.attr(DATA_CANVAS_ID);

    const canvasList = target
      .find(`div.${CANVAS_LIST}`);

    let canvas = canvasList
      .find(`canvas[${DATA_CANVAS_ID}="${id}"]`).first();

    if (canvas.length) {
      return canvas.removeClass('collapse');
    }

    const targetImage = target
      .find(`img.${CAROUSEL_IMAGE}`)
      .first();

    const [
      w, h, l, t,
    ] = btn.attr(DATA_BOX)
      .split(',')
      .map((x) =>
        Number(x));

    const canvasW = targetImage.width() * w;
    const canvasH = targetImage.height() * h;
    const canvasL = targetImage.width() * l;
    const canvasT = targetImage.height() * t;

    const type = btn.attr(DATA_CANVAS_TYPE);

    canvas = $('<canvas/>')
      .addClass(`canvas-type-${type}`)
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

    const canvasList = target
      .find(`div.${CANVAS_LIST}`);
    const canvas = canvasList
      .find(`canvas[${DATA_CANVAS_ID}="${id}"]`)
      .first();

    return canvas
      .addClass('collapse');
  }

  onPageButtonSelected(button, controlGroup, page) {
    button.parent()
      .find('img')
      .removeClass('active');

    button.addClass('active');

    controlGroup.parent()
      .find(`div.${PAGE_DETAILS}`)
      .addClass('collapse');

    controlGroup.removeClass('collapse');

    return this.slideTo(page.data.PageNum);
  }

  noData() {
    const container = $('<div/>')
      .addClass('carousel-item')
      .addClass('active');

    const desc = $('<h5/>')
      .addClass('lead')
      .append(MSG_NO_DATA);
    container.append(desc);

    return container;
  }

  findAndSplice(items, type, val) {
    const idx = items
      .findIndex((x) =>
        x[type] === val);

    if (idx < 0) {
      return undefined;
    }

    return items
      .splice(idx, 1)
      .shift();
  }
}
