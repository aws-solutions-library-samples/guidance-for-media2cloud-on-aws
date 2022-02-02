// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import mxReadable from '../../mixins/mxReadable.js';
import AppUtils from '../../shared/appUtils.js';

export default class PieGraph extends mxReadable(class {}) {
  constructor(title, datasets, customization) {
    super();
    this.$graphContainer = $('<div/>').addClass('pie-graph mx-auto')
      .attr('id', `pie-${AppUtils.randomHexstring()}`);
    this.$dataset = datasets.sort((a, b) =>
      a.value - b.value);
    const options = this.makeGraphOptions(title, this.$dataset, customization);
    const graph = echarts.init(this.$graphContainer[0]);
    const onRendered = this.onRenderedEvent.bind(this, graph);
    graph.on('rendered', async () => onRendered());
    graph.setOption(options);
    this.$graph = graph;
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

  get graphId() {
    return this.graphContainer.prop('id');
  }

  getGraphContainer() {
    return this.graphContainer;
  }

  makeGraphOptions(topic, datasets, customization = {}) {
    const title = {
      text: topic,
      left: 'center',
      top: 20,
      textStyle: {
        fontSize: 16,
        fontWeight: 200,
      },
    };
    const tooltip = {
      trigger: 'item',
      formatter: customization.formatter || '{b} : {c} files ({d}%)',
    };
    const series = [
      {
        type: 'pie',
        radius: '60%',
        center: [
          '50%',
          '50%',
        ],
        data: datasets,
        roseType: 'radius',
        label: {
          fontSize: 12,
        },
        labelLine: {
          smooth: 0.2,
          length: 15,
          length2: 15,
        },
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(91, 12, 10, 0.5)',
        },
        animationType: 'scale',
        animationEasing: 'elasticOut',
        animationDelay: () => {
          const rand = new Uint32Array(1);
          (window.crypto || window.msCrypto).getRandomValues(rand);
          return (rand[0] % 200) + 1;
        },
      },
    ];
    return {
      title,
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
}
