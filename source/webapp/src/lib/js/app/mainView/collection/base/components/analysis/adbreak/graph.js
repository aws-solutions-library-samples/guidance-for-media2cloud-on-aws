// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AppUtils from '../../../../../../shared/appUtils.js';
import PreviewModal from './previewModal.js';

const DOT_SIZE = 20;

function _randomRGB(opacity = 1) {
  const [r, g, b, o] = [
    Math.random(),
    Math.random(),
    Math.random(),
    Math.min(opacity, 1),
  ].map((k) =>
    Math.floor(k * 255)
      .toString(16)
      .toUpperCase()
      .padStart(2, '0'));

  return `#${r}${g}${b}${o}`;
}

export default class Graph {
  constructor(previewComponent, datapoints) {
    this.$id = AppUtils.randomHexstring();
    const container = $('<div/>')
      .attr('id', `graph-${this.$id}`)
      .css('aspect-ratio', '7/2');

    this.$graphContainer = container;
    this.$previewComponent = previewComponent;
    this.$graph = undefined;

    // events
    container.ready(async () => {
      const graph = echarts.init(container[0]);
      this.$graph = graph;

      const options = this.makeGraphOptions(datapoints);
      graph.setOption(options);

      graph.on('click', 'series', (event) => {
        this.onGraphDatapoint(graph, event);
      });
    });
  }

  get id() {
    return this.$id;
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

  get graphId() {
    return this.graphContainer.prop('id');
  }

  get previewComponent() {
    return this.$previewComponent;
  }

  get media() {
    return this.previewComponent.media;
  }

  pauseParentPlayer() {
    const vjs = this.previewComponent.getVideoPlayer();
    vjs.pause();
  }

  makeGraphOptions(datapoints) {
    const singleAxis = {
      type: 'value',
      min: 0,
      max: this.media.duration,
      bottom: '30%',
      scale: true,
      height: '80%',
      axisLabel: {
        rotate: 45,
        formatter: (datapoint) =>
          AppUtils.readableDuration(Math.max(0, datapoint - 0)),
      },
    };

    const percent = 30;
    const dataZoom = [
      {
        type: 'slider',
        show: true,
        singleAxisIndex: 0,
        start: 0,
        end: percent,
        minValueSpan: 1,
        bottom: '5%',
        labelFormatter: (datapoint) =>
          AppUtils.readableDuration(Math.max(0, datapoint - 0)),
      },
    ];

    const tooltip = {
      position: 'right',
      formatter: (datapoint) => {
        const data = datapoint.value[3];
        // show thumbnail
        const container = $('<div/>')
          .addClass('graph-tooltip')
          .css('width', '16rem');

        const img = $('<img/>')
          .attr('crossorigin', 'anonymous')
          .attr('src', data.url);
        container.append(img);

        const table = $('<table/>');
        container.append(table);

        const tbody = $('<tbody/>');
        table.append(tbody);

        let rows = [];

        rows.push({
          name: 'Break type',
          val: data.breakType,
        });
        rows.push({
          name: 'Break at',
          val: data.smpteTimestamp,
        });
        rows.push({
          name: `Scene#${data.scene.sceneNo}`,
          val: AppUtils.readableDuration(data.scene.duration),
        });
        rows.push({
          name: 'Loudness (moment.)',
          val: `${data.momentary.toFixed(2)} LUFS`,
        });
        rows.push({
          name: '&#916; Contextual',
          val: data.contextual.distance.toFixed(2),
        });
        rows.push({
          name: 'Weight',
          val: data.weight.toFixed(2),
        });

        rows = rows.map((row) =>
          $('<tr/>')
            .addClass('lead-xxs')
            .append($('<td/>')
              .append(row.name))
            .append($('<td/>')
              .addClass('px-2')
              .append(row.val)));
        tbody.append(rows);

        return container.prop('outerHTML');
      },
    };

    const _datapoints = datapoints
      .map((datapoint) => ([
        datapoint.timestamp,
        datapoint.weight * DOT_SIZE,
        _randomRGB(0.7),
        datapoint,
      ]));

    const series = [
      {
        type: 'scatter',
        singleAxisIndex: 0,
        coordinateSystem: 'singleAxis',
        data: _datapoints,
        symbolSize: (datapoint) =>
          datapoint[1] * 4,
        itemStyle: {
          color: (datapoint) =>
            datapoint.value[2],
        },
      },
    ];

    return {
      dataZoom,
      singleAxis,
      tooltip,
      series,
    };
  }

  destroy() {
    if (this.graph) {
      this.graph.dispose();
      this.graph = undefined;
    }

    if (this.graphContainer) {
      this.graphContainer.remove();
      this.graphContainer = undefined;
    }
  }

  resize() {
    return this.graph.resize();
  }

  onGraphDatapoint(graph, event) {
    console.log('event', event);
    const datapoint = event.data[3];

    this.showPreview(datapoint);
  }

  showPreview(datapoint) {
    setTimeout(async () => {
      this.pauseParentPlayer();

      const preview = new PreviewModal(
        this.graphContainer,
        this.media,
        datapoint
      );

      preview.on('video:modal:hidden', async (event) => {
        console.log('video:modal:hidden');
        preview.destroy();
      });

      await preview.show();

      this.graphContainer
        .find('div.graph-tooltip')
        .parent()
        .css('visibility', 'hidden')
        .css('opacity', 0);
    });
  }
}
