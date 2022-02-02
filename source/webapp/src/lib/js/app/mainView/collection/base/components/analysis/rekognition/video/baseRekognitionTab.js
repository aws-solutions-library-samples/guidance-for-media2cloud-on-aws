// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../../shared/localization.js';
import DatasetStore from '../../../../../../../shared/localCache/datasetStore.js';
import ScatterGraph from '../../base/scatterGraph.js';
import BaseRekognitionImageTab from '../image/baseRekognitionImageTab.js';

const COL_TAB = 'col-11';

export default class BaseRekognitionTab extends BaseRekognitionImageTab {
  constructor(category, previewComponent, data, defaultTab = false) {
    super(category, previewComponent, data, defaultTab);
    this.$scatterGraph = undefined;
    this.$datasetStore = DatasetStore.getSingleton();
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

  async createContent() {
    const col = $('<div/>').addClass('col-9 my-4 max-h36r');
    this.delayContentLoad(col);
    return col;
  }

  delayContentLoad(col) {
    setTimeout(async () => {
      this.loading(true);
      const scatterGraph = await this.createScatterGraph(this.category);
      if (!scatterGraph) {
        col.html(Localization.Messages.NoData);
      } else {
        await this.registerVttTracks(this.category);
        const desc = $('<p/>').addClass('lead-sm')
          .append(Localization.Messages.ScatterGraphDesc);
        col.append(desc)
          .append(this.createToggleAll())
          .append(scatterGraph);
      }
      this.loading(false);
    }, 100);
  }

  async registerVttTracks(type) {
    const category = this.data || {};
    const prefix = category.vtt;
    const names = (category.trackBasenames || {}).vtt || [];
    if (!prefix || !names.length) {
      return undefined;
    }
    return names.map(name =>
      this.previewComponent.trackRegister(name, `${prefix}${name}.vtt`));
  }

  async createTrackButtons(type, namePrefix) {
    const category = this.data || {};
    const prefix = category.vtt;
    const names = (category.trackBasenames || {}).vtt || [];
    if (!prefix || !names.length) {
      return undefined;
    }
    return names.map((name) => {
      this.previewComponent.trackRegister(name, `${prefix}${name}.vtt`);
      return this.createButton(name, namePrefix);
    });
  }

  async createScatterGraph(type, namePrefix) {
    const category = this.data || {};
    const prefix = category.timeseries;
    const names = (category.trackBasenames || {}).timeseries || [];
    if (!prefix || !names.length) {
      return undefined;
    }
    const datasets = await this.downloadDatasets(prefix, names);
    if (!datasets || !datasets.length) {
      return undefined;
    }
    this.scatterGraph = new ScatterGraph(datasets);
    this.scatterGraph.on(ScatterGraph.Events.Data.Selected, async (event, datapoint) =>
      this.onDataPointSelected(datapoint));
    this.scatterGraph.on(ScatterGraph.Events.Legend.Changed, async (event, legends) =>
      this.onLegendChanged(legends));
    const col = $('<div/>').addClass('col-9 p-0 m-4 mx-auto');
    return col.append(this.scatterGraph.getGraphContainer());
  }

  async downloadDatasets(prefix, names) {
    let datasets = await this.datasetStore.getItem(prefix)
      .catch(() => undefined);
    if (datasets && datasets[0].duration !== undefined) {
      return datasets;
    }
    const responses = await Promise.all(names.map(name =>
      this.download(`${prefix}${name}.json`)
        .then(data => JSON.parse(data.Body.toString()))
        .catch(() => undefined)));
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
      .catch(() => undefined);
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
    return legends.filter(x => x.basename).map(x =>
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
    const input = $('<input/>').attr('type', 'checkbox');
    input.off('click').on('click', async (event) =>
      this.scatterGraph.toggleAllLegends(input.prop('checked')));

    const toggle = $('<div/>').addClass('form-group px-0 mt-2 mb-2')
      .append($('<div/>').addClass('input-group')
        .append($('<label/>').addClass('xs-switch')
          .append(input)
          .append($('<span/>').addClass('xs-slider round')))
        .append($('<span/>').addClass('lead ml-2')
          .html(Localization.Messages.ToggleAll)));
    return toggle;
  }
}
