// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../../shared/localization.js';
import {
  GetDatasetStore,
} from '../../../../../../../shared/localCache/index.js';
import MapData from '../../../../../../../shared/analysis/mapData.js';
import ScatterGraph from '../../base/scatterGraph.js';
import BaseRekognitionImageTab from '../image/baseRekognitionImageTab.js';
import AppUtils from '../../../../../../../shared/appUtils.js';
import {
  GetS3Utils,
} from '../../../../../../../shared/s3utils.js';

const {
  Events: {
    Data: {
      Selected: EVENT_DATA_SELECTED,
    },
    Legend: {
      Changed: EVENT_LEGEND_CHANGED,
    },
  },
} = ScatterGraph;

const {
  Messages: {
    SearchSpecificLabel: MSG_SEARCH_SPECIFIC_LABEL,
    ToggleAll: MSG_TOGGLE_ALL,
    ToggleTextOverlay: MSG_TEXT_OVERLAY,
    NoData: MSG_NO_DATA,
    ScatterGraphDesc: MSG_SCATTERGRAPH_DESC,
  },
  Tooltips: {
    ToggleAll: TOOLTIP_ALL_LABELS,
    ToggleTextOverlay: TOOLTIP_TEXT_OVERLAY,
  },
} = Localization;

export default class BaseRekognitionTab extends BaseRekognitionImageTab {
  constructor(category, previewComponent, data) {
    super(category, previewComponent, data);
    this.$scatterGraph = undefined;
    this.$datasetStore = GetDatasetStore();
    this.$mapData = undefined;
    this.onRender(this.tabContent);
  }

  get shouldCache() {
    return true;
  }

  get scatterGraph() {
    return this.$scatterGraph;
  }

  set scatterGraph(val) {
    if (this.$scatterGraph) {
      this.$scatterGraph.destroy();
    }
    this.$scatterGraph = val;
  }

  get datasetStore() {
    return this.$datasetStore;
  }

  get mapData() {
    return this.$mapData;
  }

  set mapData(val) {
    this.$mapData = val;
  }

  get trackBasenames() {
    return (this.mapData || {}).basenames || [];
  }

  get canPreloadContent() {
    return true;
  }

  get canRenderVtt() {
    return true;
  }

  async createContent() {
    let container = this.tabContent.find('.rekog-tab');
    if (container.length > 0) {
      return container;
    }
    container = this.loadContent();
    return container;
  }

  async delayContentLoad(col) {
    this.loading(true);

    const scatterGraph = await this.createScatterGraph(this.category);
    if (!scatterGraph) {
      col.html(MSG_NO_DATA);
    } else {
      const desc = $('<p/>')
        .addClass('lead-sm')
        .append(MSG_SCATTERGRAPH_DESC);
      col.append(desc);

      const toggleAll = this.createToggleAll();
      col.append(toggleAll);

      col.append(scatterGraph);
    }
    this.loading(false);
  }

  async registerVttTracks(type) {
    const category = this.data || {};
    if (!category.vtt) {
      return undefined;
    }

    /* using single json file for all vtts */
    if (/json$/.test(category.vtt)) {
      const bucket = this.media.getProxyBucket();
      return this.registerVttTracksFromJson(
        type,
        bucket,
        category.vtt
      );
    }

    if (!this.trackBasenames.length) {
      return undefined;
    }

    return this.trackBasenames
      .map(name =>
        this.previewComponent.trackRegister(name, `${category.vtt}${name}.vtt`));
  }

  unregisterVttTracks() {
    const labels = this.scatterGraph.datasets
      .map((x) =>
        x.basename);

    labels.forEach((label) => {
      this.previewComponent.trackToggle(label, false);
      this.previewComponent.trackUnregister(label);
    });
  }

  async createTrackButtons(type, namePrefix) {
    const category = this.data || {};
    if (!category.vtt) {
      return undefined;
    }

    /* using single json file for all vtts */
    if (/json$/.test(category.vtt)) {
      const bucket = this.media.getProxyBucket();
      return this.createTrackButtonsFromJson(
        type,
        namePrefix,
        bucket,
        category.vtt
      );
    }

    if (!this.trackBasenames.length) {
      return undefined;
    }

    return this.trackBasenames
      .map((name) => {
        this.previewComponent.trackRegister(name, `${category.vtt}${name}.vtt`);
        return this.createButton(name, namePrefix);
      });
  }

  async createScatterGraph(type, namePrefix) {
    const category = this.data || {};
    if (!category.timeseries) {
      return undefined;
    }

    let datasets;
    if (this.mapData && this.mapData.version > 0) {
      datasets = await this.downloadAllMergedDataset(
        category.timeseries
      );
    } else {
      if (!this.trackBasenames.length) {
        return undefined;
      }
      datasets = await this.downloadDatasets(
        category.timeseries,
        this.trackBasenames
      );
    }

    if (!datasets || !datasets.length) {
      return undefined;
    }

    const container = $('<div/>')
      .addClass('col-12')
      .addClass('p-0 m-4 mx-auto');

    this.scatterGraph = new ScatterGraph(datasets);

    this.scatterGraph.on(EVENT_DATA_SELECTED, async (event, datapoint) =>
      this.onDataPointSelected(datapoint));

    this.scatterGraph.on(EVENT_LEGEND_CHANGED, async (event, legends) =>
      this.onLegendChanged(legends));

    const graphContainer = this.scatterGraph.getGraphContainer();
    container.append(graphContainer);

    return container;
  }

  async downloadAllMergedDataset(key) {
    let datasets = await this.datasetStore
      .getItem(key)
      .catch(() =>
        undefined);

    if (!datasets || !datasets[0] || datasets[0].duration === undefined) {
      datasets = await this.download(key)
        .catch((e) => {
          console.log(
            'ERR:',
            'fail to download rekognition dataset',
            key,
            e.message
          );
          return undefined;
        });

      if (datasets) {
        datasets = await datasets.Body.transformToString()
          .then((res) =>
            JSON.parse(res));

        // for facematch, don't cache
        if (this.shouldCache) {
          await this.datasetStore
            .putItem(key, datasets)
            .catch(() =>
              undefined);
        }
      }
    }

    datasets = await this.transformDataset(datasets);

    return datasets;
  }

  async transformDataset(data) {
    return Object.values(data)
      .map((x) => ({
        ...x,
        basename: x.label.toLowerCase()
          .replace(/\s/g, '_')
          .replace(/\//g, '-'),
      }));
  }

  async downloadDatasets(prefix, names) {
    let datasets = await this.datasetStore.getItem(prefix)
      .catch(() =>
        undefined);
    if (datasets && datasets[0].duration !== undefined) {
      return datasets;
    }

    let responses = await Promise.all(names
      .map((name) => {
        const key = `${prefix}${name}.json`;
        return this.download(key)
          .catch((e) => {
            console.log(
              'ERR:',
              'fail to download rekognition dataset',
              key,
              e.message
            );

            return undefined;
          });
      }));

    responses = responses
      .filter((x) =>
        x !== undefined);

    responses = await Promise.all(responses
      .map((x) =>
        x.Body.transformToString()
          .then((res) =>
            JSON.parse(res))));

    datasets = [];
    for (let i = 0; i < responses.length; i++) {
      if (responses[i] !== undefined) {
        datasets.push({
          ...responses[i],
          basename: names[i],
        });
      }
    }

    await this.datasetStore.putItem(prefix, datasets)
      .catch(() =>
        undefined);

    return datasets;
  }

  async selectAll() {
    await Promise.all(this.scatterGraph.datasets.map(x =>
      this.previewComponent.trackToggle(x.basename, true)));
    return this.scatterGraph.selectAllDataset();
  }

  async deselectAll() {
    await Promise.all(this.scatterGraph.datasets.map(x =>
      this.previewComponent.trackToggle(x.basename, false)));
    return this.scatterGraph.deselectAllDataset();
  }

  async select(label) {
    const basename = (this.scatterGraph.findDataset(label) || {}).basename;
    if (basename) {
      await this.previewComponent.trackToggle(basename, true);
    }
    return this.scatterGraph.selectDataset(label);
  }

  async deselect(label) {
    const basename = (this.scatterGraph.findDataset(label) || {}).basename;
    if (basename) {
      await this.previewComponent.trackToggle(basename, false);
    }
    return this.scatterGraph.deselectDataset(label);
  }

  async onDataPointSelected(datapoint) {
    this.previewComponent.pause();
    this.previewComponent.seek(datapoint.x / 1000);
    const dimension = this.previewComponent.getContainerDimensions();
    const canvasView = this.previewComponent.getCanvasView();
    canvasView.children().remove();
    const overlay = $('<div/>').addClass('lead-sm')
      .css('position', 'absolute')
      .css('top', '1rem')
      .css('left', '1rem');
    for (let i = 0; i < datapoint.details.length; i++) {
      const badges = this.createBadges(datapoint, i);
      let [
        w, h, l, t,
      ] = this.computeCoordinate(datapoint.details[i], dimension.width, dimension.height);

      if (w !== undefined) {
        let canvas = this.createCanvas(w, h, l, t, datapoint.color);
        canvasView.append(canvas);
        if (datapoint.details[i].xy) {
          [
            w, h, l, t,
          ] = this.computeCoordinate(datapoint.details[i].xy, dimension.width, dimension.height);
          canvas = this.createCanvas(w, h, l, t, datapoint.color);
          canvasView.append(canvas);
        }
        const outerHtml = badges.map(x => x.prop('outerHTML'));
        canvas.hover(() =>
          overlay.html(outerHtml).removeClass('collapse'), () =>
          overlay.html(outerHtml).addClass('collapse'));
      } else {
        overlay.append(badges);
      }
    }
    canvasView.append(overlay);
  }

  async onLegendChanged(legends) {
    const canvasView = this.previewComponent.getCanvasView();
    canvasView.children().remove();

    return legends
      .filter((x) =>
        x.basename)
      .map((x) =>
        this.previewComponent.trackToggle(x.basename, x.enabled));
  }

  computeCoordinate(box, imageW, imageH) {
    return (box.w === undefined)
      ? []
      : [
        Math.min(Math.round(box.w * imageW), imageW),
        Math.min(Math.round(box.h * imageH), imageH),
        Math.max(Math.round(box.l * imageW), 0),
        Math.max(Math.round(box.t * imageH), 0),
      ];
  }

  createCanvas(w, h, l, t, color) {
    const opacity = '4C'; /* 30% */
    return $('<canvas/>')
      .addClass('canvas-item')
      .attr('width', w)
      .attr('height', h)
      .css('left', l)
      .css('top', t)
      .css('background-color', `${color}${opacity}`)
      .css('border-color', color);
  }

  createBadges(datapoint, idx, namedPrefix) {
    const badges = [];
    const score = datapoint.details[idx].c || (datapoint.details[idx].xy || {}).c || '--';
    let label = `${datapoint.label} (${score}%)`;
    if (namedPrefix) {
      label = `${namedPrefix} ${label}`;
    }
    badges.push(this.createBadge(label));
    if (datapoint.desc) {
      datapoint.desc.split(';').forEach(x =>
        badges.push(this.createBadge(x)));
    }
    if (datapoint.details[idx].desc) {
      datapoint.details[idx].desc.split(';').forEach(x =>
        badges.push(this.createBadge(x, 'badge-dark')));
    }
    return badges;
  }

  createBadge(text, badgeClass = 'badge-success') {
    return $('<span/>').addClass('badge badge-pill lead-xs mb-1')
      .addClass(badgeClass)
      .css('display', 'block')
      .html(text);
  }

  async hide() {
    if (this.scatterGraph) {
      this.scatterGraph.destroy();
    }
    this.scatterGraph = undefined;
    return super.hide();
  }

  createToggleAll() {
    const formGroup = $('<div/>')
      .addClass('form-group px-0 mt-2 mb-2');

    const inputGroup = $('<div/>')
      .addClass('input-group');
    formGroup.append(inputGroup);

    /* toggle button */
    const toggleAllLabels = this.createAllLabelToggle();
    inputGroup.append(toggleAllLabels);
    const checkboxAll = toggleAllLabels[0].find('input').first();

    /* show text overlay */
    const toggleTextOverlay = this.createTextOverlayToggle();
    inputGroup.append(toggleTextOverlay);

    /* search */
    const dropdown = $('<div/>')
      .addClass('dropdown col-3 p-0 ml-auto');
    inputGroup.append(dropdown);

    const id = `dropdown-${AppUtils.randomHexstring()}`;
    const searchField = $('<input/>')
      .addClass('form-control form-control-sm')
      .attr('type', 'text')
      .attr('id', id)
      .attr('autocomplete', 'off')
      .attr('data-toggle', 'dropdown')
      .attr('aria-haspopup', true)
      .attr('aria-expanded', false)
      .attr('placeholder', MSG_SEARCH_SPECIFIC_LABEL);
    dropdown.append(searchField);

    const menu = $('<div/>')
      .addClass('dropdown-menu col-12 lead-xs')
      .attr('aria-labelledby', id);
    dropdown.append(menu);

    /* clear search result */
    const clear = $('<button/>')
      .addClass('btn btn-sm btn-secondary')
      .append($('<i/>').addClass('far fa-times-circle'));
    inputGroup.append(clear);

    // event handling
    ['focus', 'keyup'].forEach((event) => {
      searchField.on(event, () => {
        console.log(`searchField.on.${event}`);

        let matched = this.scatterGraph.labels;

        const val = searchField.val();
        if (val.length > 0) {
          const regex = new RegExp(val, 'gi');
          matched = this.scatterGraph.labels
            .filter((x) =>
              x.match(regex));
        }

        matched = matched
          .map((x) =>
            this.createDropdownItem(x, dropdown, searchField, checkboxAll));

        menu.children().remove();
        menu.append(matched);

        dropdown.dropdown('show');
      });
    });

    clear.on('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const val = searchField.val();
      if (val.length > 0) {
        searchField.val('');
        /* reset legends */
        let legends = this.scatterGraph.datasets
          .map((x) =>
            x.label);
        this.scatterGraph.updateLegends(legends);
        /* reset search results */
        legends = legends.map((x) =>
          this.createDropdownItem(x, dropdown, searchField, checkboxAll));
        menu.children().remove();
        menu.append(legends);
        dropdown.dropdown('hide');
        /* uncheck toggle */
        checkboxAll.prop('checked', false);
      }
    });

    return formGroup;
  }

  createAllLabelToggle() {
    const xswitch = $('<label/>')
      .addClass('xs-switch');

    const toggle = $('<input/>')
      .attr('type', 'checkbox');
    xswitch.append(toggle);

    const slider = $('<span/>')
      .addClass('xs-slider round');
    xswitch.append(slider);

    const desc = $('<span/>')
      .addClass('lead ml-2')
      .append(MSG_TOGGLE_ALL)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_ALL_LABELS)
      .tooltip({
        trigger: 'hover',
      });

    toggle.on('click', async (event) =>
      this.scatterGraph.toggleAllLegends(toggle.prop('checked')));

    return [
      xswitch,
      desc,
    ];
  }

  createTextOverlayToggle() {
    if (!this.canRenderVtt) {
      return undefined;
    }

    const xswitch = $('<label/>')
      .addClass('xs-switch ml-4');

    const toggle = $('<input/>')
      .attr('type', 'checkbox');
    xswitch.append(toggle);

    const slider = $('<span/>')
      .addClass('xs-slider round');
    xswitch.append(slider);

    const desc = $('<span/>')
      .addClass('lead ml-2')
      .append(MSG_TEXT_OVERLAY)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_TEXT_OVERLAY)
      .tooltip({
        trigger: 'hover',
      });

    toggle.on('click', async (event) => {
      const checked = toggle.prop('checked');
      if (checked) {
        await this.registerVttTracks(this.category);
        const legends = this.scatterGraph.getLegendsState();
        legends.forEach((legend) => {
          if (legend.enabled) {
            this.previewComponent.trackToggle(legend.basename, true);
          }
        });
      } else {
        this.unregisterVttTracks();
      }
    });

    return [
      xswitch,
      desc,
    ];
  }

  createDropdownItem(item, dropdown, searchField, toggle) {
    const anchor = $('<a/>')
      .addClass('dropdown-item')
      .attr('href', '#')
      .attr('data-value', item)
      .append(item);
    anchor.on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const selected = anchor.data('value');
      searchField.val(selected);
      dropdown.dropdown('hide');
      const legends = this.scatterGraph.datasets
        .filter((x) =>
          x.label === selected)
        .map((x) =>
          x.label);
      this.scatterGraph.updateLegends(legends);
      toggle.prop('checked', false);
    });
    return anchor;
  }

  onRender(tabContent) {
    tabContent.ready(async () => {
      console.log('BaseRekognitionTab.onReady');

      const bucket = this.media.getProxyBucket();
      const mapFile = this.data.output;
      if (/json$/.test(mapFile)) {
        this.mapData = await MapData.loadFromKey(
          bucket,
          mapFile
        );
      }

      if (this.canPreloadContent) {
        this.loadContent(tabContent);
      }
    });
  }

  loadContent(tabContent) {
    const container = $('<div/>')
      .addClass('col-9 my-4 max-h36r')
      .addClass('rekog-tab');

    container.ready(async () => {
      this.createObserver(container);
    });

    if (tabContent) {
      tabContent.append(container);
    }

    return container;
  }

  createObserver(container) {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: [0.1],
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.intersectionRatio > options.threshold[0]) {
          console.log(
            'BaseRekognitionTab.createObserver',
            'entry.intersectionRatio',
            entry.intersectionRatio
          );

          await this.delayContentLoad(container);
          observer.unobserve(container[0]);
        }
      });
    }, options);

    observer.observe(container[0]);

    return observer;
  }

  async registerVttTracksFromJson(
    type,
    bucket,
    jsonKey
  ) {
    let vtts = await this.datasetStore
      .getItem(jsonKey)
      .catch(() =>
        undefined);

    if (vtts === undefined) {
      const s3utils = GetS3Utils();
      vtts = await s3utils.getObject(
        bucket,
        jsonKey
      ).catch((e) => {
        console.error(
          'ERR:',
          'fail to download',
          jsonKey
        );
        return undefined;
      });

      if (vtts) {
        vtts = await vtts.Body.transformToString()
          .then((res) =>
            JSON.parse(res));
      }
    }

    if (vtts && this.shouldCache) {
      await this.datasetStore
        .putItem(jsonKey, vtts)
        .catch(() =>
          undefined);
    }

    return Object.keys(vtts || {})
      .map((x) => {
        const blob = new Blob([vtts[x]], {
          type: 'text/vtt',
        });
        const id = x.toLowerCase()
          .replace(/\s/g, '_')
          .replace(/\//g, '-');
        return this.previewComponent.trackRegister(
          id,
          URL.createObjectURL(blob)
        );
      });
  }

  async createTrackButtonsFromJson(
    type,
    namePrefix,
    bucket,
    jsonKey
  ) {
    const s3utils = GetS3Utils();
    let vtts = await s3utils.getObject(
      bucket,
      jsonKey
    ).catch((e) => {
      console.error(
        'ERR:',
        'fail to download',
        jsonKey
      );
      return undefined;
    });

    if (vtts) {
      vtts = await vtts.Body.transformToString()
        .then((res) =>
          JSON.parse(res));
    }

    return Object.keys(vtts || {})
      .map((x) => {
        const blob = new Blob([vtts[x]], {
          type: 'text/vtt',
        });
        this.previewComponent.trackRegister(
          x,
          URL.createObjectURL(blob)
        );
        return this.createButton(x, namePrefix);
      });
  }
}
