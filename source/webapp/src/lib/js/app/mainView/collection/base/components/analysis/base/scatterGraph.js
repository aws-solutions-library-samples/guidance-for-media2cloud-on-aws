// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import mxReadable from '../../../../../../mixins/mxReadable.js';
import AppUtils from '../../../../../../shared/appUtils.js';

const EVENT_DATA_SELECTED = 'scatter:data:selected';
const EVENT_LEGEND_CHANGED = 'scatter:legend:changed';

export default class ScatterGraph extends mxReadable(class {}) {
  constructor(datasets) {
    super();
    this.$datasets = datasets.filter(x => x.data.length > 0);
    this.$labels = this.$datasets.map((x) =>
      x.label);
    this.$graphContainer = $('<div/>').addClass('scatter-graph')
      .attr('id', `scatter-${AppUtils.randomHexstring()}`);
    const options = this.makeGraphOptions(this.$datasets);
    const graph = echarts.init(this.$graphContainer[0]);
    this.registerGraphEvents(this.$datasets, graph);
    graph.setOption(options);
    this.$graph = graph;
  }

  static get Events() {
    return {
      Data: {
        Selected: EVENT_DATA_SELECTED,
      },
      Legend: {
        Changed: EVENT_LEGEND_CHANGED,
      },
    };
  }

  get graphContainer() {
    return this.$graphContainer;
  }

  set graphContainer(val) {
    this.$graphContainer = val;
  }

  get graph() {
    return this.$graph;
  }

  set graph(val) {
    this.$graph = val;
  }

  get datasets() {
    return this.$datasets;
  }

  set datasets(val) {
    this.$datasets = val;
  }

  get labels() {
    return this.$labels;
  }

  get graphId() {
    return this.graphContainer.prop('id');
  }

  getGraphContainer() {
    return this.graphContainer;
  }

  makeGraphOptions(datasets) {
    const legends = datasets
      .sort((a, b) =>
        b.appearance - a.appearance)
      .map((x) => ({
        name: x.label,
      }));

    const legend = {
      type: 'scroll',
      orient: 'horizontal',
      data: legends,
      selected: datasets.reduce((a0, c0) => ({
        ...a0,
        [c0.label]: false,
      }), {}),
      tooltip: {
        show: true,
        trigger: 'item',
        formatter: ((data) => {
          const dataset = datasets.find((x) => x.label === data.name) || {};
          const found = dataset.data || [];
          const startAt = AppUtils.readableDuration((found[0] || {}).x || 0, true);
          const endAt = AppUtils.readableDuration((found[found.length - 1] || {}).x || 0, true);
          let appearance = '';
          if (dataset.duration && dataset.appearance) {
            const percentage = Number((dataset.appearance / dataset.duration) * 100).toFixed(2);
            const duration = AppUtils.readableDuration(dataset.appearance, true);
            const total = AppUtils.readableDuration(dataset.duration, true);
            appearance = `Show rate <strong>${percentage}%</strong> (${duration} of ${total})`;
          }
          return (!found.length)
            ? `<span>${data.name}</span>`
            : `<span>Total <strong>${found.length}</strong> data points</span><br/>Starting at <strong>${startAt}</strong><br/>Ended at <strong>${endAt}</strong><br/>${appearance}`;
        }),
      },
    };
    const grid = {
      containLabel: true,
      show: true,
    };
    const xAxis = {
      type: 'time',
      scale: false,
      minInterval: 1000,
      axisLabel: {
        formatter: (x) => AppUtils.readableDuration(x, true),
        rotate: 45,
      },
      splitLine: {
        show: true,
      },
    };
    const yAxis = {
      type: 'value',
      scale: true,
      axisLabel: {
        formatter: '{value}',
      },
      splitLine: {
        show: true,
      },
      min: 0,
      interval: 1,
    };

    let pencentage = Math.round((Math.min(datasets[0].duration, 60 * 1000) / datasets[0].duration) * 100);
    pencentage = Math.max(pencentage, 10);
    const dataZoom = [
      {
        type: 'slider',
        show: true,
        xAxisIndex: [0],
        start: 0,
        end: pencentage,
        minValueSpan: 2 * 1000,
        labelFormatter: (x) => AppUtils.readableDuration(x, true),
      },
    ];
    const tooltip = {
      show: true,
      trigger: 'item',
      formatter: ((x) =>
        `<span style="color:${x.color}">${x.seriesName}</span> (x${x.data[1]})<br/>at ${AppUtils.readableDuration(x.data[0], true)}`),
    };
    const series = datasets.map(x => ({
      name: x.label,
      type: 'scatter',
      large: true,
      largeThreshold: 5000,
      data: x.data.map(d => ([d.x, d.y])),
    }));
    return {
      legend,
      grid,
      xAxis,
      yAxis,
      dataZoom,
      tooltip,
      series,
    };
  }

  destroy() {
    if (this.graph) {
      this.graph.dispose();
    }
    this.graph = undefined;
    if (this.graphContainer) {
      this.graphContainer.remove();
    }
    this.graphContainer = undefined;
    if (this.datasets) {
      this.datasets.length = 0;
    }
  }

  onDataPointClickEvent(datasets, event) {
    if (event.componentType !== 'series') {
      return undefined;
    }
    const selected = {
      ...datasets[event.seriesIndex].data[event.dataIndex],
      color: event.color,
      label: event.seriesName,
      desc: datasets[event.seriesIndex].desc,
    };
    return this.graphContainer.trigger(ScatterGraph.Events.Data.Selected, [selected]);
  }

  onLegendSelectChangedEvent(datasets, event) {
    const found = datasets.find(x => x.label === event.name);
    const selected = [{
      name: event.name,
      enabled: event.selected[event.name],
      basename: (found || {}).basename,
    }];
    return this.graphContainer.trigger(ScatterGraph.Events.Legend.Changed, [selected]);
  }

  onInverseLegendsEvent(datasets, event) {
    const selected = [];
    datasets.forEach((dataset, idx) => {
      if (event.selected[dataset.label] !== undefined) {
        selected.push({
          name: dataset.label,
          enabled: event.selected[dataset.label],
          basename: dataset.basename,
        });
      }
    });
    return this.graphContainer.trigger(ScatterGraph.Events.Legend.Changed, [selected]);
  }

  onRenderedEvent(graph) {
    if (graph.getWidth() <= 0 || graph.getHeight() <= 0) {
      setTimeout(() => graph.resize(), 200);
    } else {
      graph.off('rendered');
    }
  }

  resize() {
    return this.graph.resize();
  }

  on(event, fn) {
    return this.graphContainer.on(event, fn);
  }

  off(event) {
    return this.graphContainer.off(event);
  }

  async toggleAllLegends(enabled) {
    return this.graph.dispatchAction({
      type: 'legendInverseSelect',
    });
  }

  registerGraphEvents(datasets, graph) {
    const onRendered = this.onRenderedEvent.bind(this, graph);
    graph.off('rendered').on('rendered', async () =>
      onRendered());

    const onDataPoint = this.onDataPointClickEvent.bind(this, datasets);
    graph.off('click').on('click', async (event) =>
      onDataPoint(event));

    const onLegendChanged = this.onLegendSelectChangedEvent.bind(this, datasets);
    graph.off('legendselectchanged').on('legendselectchanged', async (event) =>
      onLegendChanged(event));

    const onInverseLegends = this.onInverseLegendsEvent.bind(this, datasets);
    graph.off('legendinverseselect').on('legendinverseselect', async (event) =>
      onInverseLegends(event));
  }

  updateLegends(legends) {
    const datasets = this.datasets;
    const graphOption = this.graph.getOption();

    /* get a list of labels that are currently selected */
    const selected = [];
    for (let legend of graphOption.legend) {
      const labels = Object.keys(legend.selected);
      while (labels.length) {
        const label = labels.shift();
        if (legend.selected[label] === true) {
          const found = datasets.find((x) =>
            x.label === label);
          if (found) {
            selected.push({
              name: found.label,
              enabled: false,
              basename: found.basename,
            });
          }
          legend.selected[label] = false;
        }
      }
      /* update legends */
      this.graph.setOption({
        legend: {
          data: legends,
          selected: legend.selected,
        },
      });
    }

    /* send events to update other components */
    if (selected.length > 0) {
      this.graphContainer.trigger(ScatterGraph.Events.Legend.Changed, [selected]);
    }
  }
}
