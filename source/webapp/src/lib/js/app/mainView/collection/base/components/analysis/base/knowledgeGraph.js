// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import mxReadable from '../../../../../../mixins/mxReadable.js';
import AppUtils from '../../../../../../shared/appUtils.js';
import ImageStore from '../../../../../../shared/localCache/imageStore.js';
import MediaManager from '../../../../../../shared/media/mediaManager.js';

const NODE_VIDEO = 'Video';
const NODE_CELEBRITY = 'celebrity';
const NODE_INDUSTRY = 'industry';
const NODE_PRODUCTS = 'products';
const NODE_SERVICES = 'services';
const NODE_EVENT_TYPE = 'event_type';
const NODESIZE_BY_TYPE = {
  [NODE_VIDEO]: 45,
  [NODE_EVENT_TYPE]: 20,
  [NODE_INDUSTRY]: 20,
  [NODE_CELEBRITY]: 20,
  [NODE_PRODUCTS]: 20,
  [NODE_SERVICES]: 20,
};
const GRAPH_MAPPING = Object.keys(NODESIZE_BY_TYPE)
  .map((x) => ({
    name: x,
  }));
const PAGESIZE = 10;

export default class KnowledgeGraph extends mxReadable(class {}) {
  constructor(container, media, parent) {
    super();
    this.$parent = parent;
    this.$mediaManager = MediaManager.getSingleton();
    this.$imageStore = ImageStore.getSingleton();
    this.$media = media;
    this.$graphContainer = $('<div/>')
      .addClass('knowledge-graph')
      .attr('id', `knowledge-${AppUtils.randomHexstring()}`);
    container.append(this.$graphContainer);

    this.$graph = undefined;
    this.$graphContainer.ready(async () => {
      console.log('graphContainer ready');
      this.$graph = await this.buildGraph(this.$graphContainer);
    });
  }

  get parent() {
    return this.$parent;
  }

  get mediaManager() {
    return this.$mediaManager;
  }

  get imageStore() {
    return this.$imageStore;
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

  get media() {
    return this.$media;
  }

  loading(enabled) {
    return this.parent.loading(enabled);
  }

  getGraphContainer() {
    return this.graphContainer;
  }

  async buildGraph(container) {
    const height = Math.max(Math.round(container.height()), 800);
    const width = Math.max(Math.round(container.width()), 800);

    const graph = echarts.init(container[0], null, {
      renderer: 'canvas',
      useDirtyRect: false,
      height,
      width,
    });

    graph.on('dblclick', async (event) => {
      if (event.event.event.detail === 2) {
        try {
          this.loading(true);
          const type = event.name;
          const data = event.data;
          const parsed = data.value[0];
          console.log('dblclick', event, parsed);
          if (parsed.traversed !== true) {
            const connectedNodes = await this.getConnectedNodes(type, parsed.id, parsed.token);
            if (connectedNodes === undefined) {
              return;
            }
            if (connectedNodes.length === 0) {
              parsed.traversed = true;
            } else {
              parsed.traversed = false;
              parsed.token = (parsed.token || 0) + connectedNodes.length;
            }

            const graphSeries = this.graph.getOption().series[event.seriesIndex];
            while (connectedNodes.length) {
              const connected = connectedNodes.shift();
              let from;
              let to;
              if (connected.IN.id === parsed.id) {
                from = data;
                to = await this.createAdjacentNode(connected.OUT, graphSeries);
              } else if (connected.OUT.id === parsed.id) {
                to = data;
                from = await this.createAdjacentNode(connected.IN, graphSeries);
              }
              if (from !== undefined && to !== undefined) {
                this.createRelationship(from, to, connected, graphSeries);
              }
            }
            /* update graph */
            this.graph.setOption({
              series: [graphSeries],
            });
          }
        } catch (e) {
          console.error(e);
        } finally {
          this.loading(false);
        }
      }
    });

    try {
      this.loading(true);

      const dataset = await this.getConnectedNodes(NODE_VIDEO, this.media.uuid);
      const graphOptions = {
        nodes: [],
        links: [],
        categories: GRAPH_MAPPING,
      };

      let srcNode = dataset.find((x) =>
        x.OUT.id === this.media.uuid);
      srcNode = await this.createNode({
        ...srcNode.OUT,
        token: dataset.length,
        traversed: false,
      }, 0);
      graphOptions.nodes.push(srcNode);

      while (dataset.length) {
        const connected = dataset.shift();
        let from;
        let to;
        if (connected.IN.id === srcNode.value[0].id) {
          from = srcNode;
          to = await this.createAdjacentNode(connected.OUT, graphOptions);
        } else if (connected.OUT.id === srcNode.value[0].id) {
          to = srcNode;
          from = await this.createAdjacentNode(connected.IN, graphOptions);
        }
        if (from !== undefined && to !== undefined) {
          this.createRelationship(from, to, connected, graphOptions);
        }
      }
      const options = this.makeGraphOptions(graphOptions);
      graph.setOption(options);
      return graph;
    } catch (e) {
      console.error(e);
      return graph;
    } finally {
      this.loading(false);
    }
  }

  async getConnectedNodes(label, id, token = 0) {
    return this.graphApi({
      op: 'query',
      type: 'vertice',
      label,
      id,
      token,
      pagesize: PAGESIZE,
    }).then((res) => {
      if (!res) {
        return undefined;
      }
      const edges = [];
      while (res.length) {
        const items = res.shift();
        const idx = items.findIndex((x) =>
          x.IN !== undefined);
        if (idx < 0) {
          continue;
        }
        const found = items.splice(idx, 1).shift();
        let name = (items.find((x) =>
          x.id === found.IN.id) || {}).name;
        found.IN.name = name;

        name = (items.find((x) =>
          x.id === found.OUT.id) || {}).name;
        found.OUT.name = name;
        edges.push(found);
      }
      return edges;
    });
  }

  async graphApi(query) {
    const url = new URL(SolutionManifest.KnowledgeGraph.Endpoint);
    Object.keys(query)
      .forEach((x) => {
        url.searchParams.append(x, query[x]);
      });
    const options = {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SolutionManifest.KnowledgeGraph.ApiKey,
      },
    };
    let tries = 4;
    while (tries--) {
      const response = fetch(url, options)
        .then((res) => {
          if (!res.ok) {
            return new Error();
          }
          return res.json();
        });
      if (!(response instanceof Error)) {
        return response;
      }
    }
    return undefined;
  }

  async createNode(data, idx) {
    let image;
    let name = data.name;
    if (data.label === NODE_VIDEO) {
      const media = await this.mediaManager.lazyGetByUuid(data.id);
      if (media !== undefined) {
        image = await media.getThumbnail();
        name = media.basename;
      }
    } else {
      const prefix = data.label
        .trim()
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-{2,}/g, '-')
        .toLowerCase();
      const basename = data.name
        .split('-')[0]
        .trim()
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-{2,}/g, '-')
        .toLowerCase();
      const extension = (data.label === NODE_CELEBRITY)
        ? '.png'
        : '.svg';
      image = await this.imageStore
        .getBlob(`./images/kg/${prefix}/${basename}${extension}`);
    }
    return this.parseNode({
      ...data,
      name,
      image,
    }, idx);
  }

  parseNode(nodeData, idx) {
    const label = nodeData.label;
    return {
      id: idx,
      name: label,
      symbolSize: NODESIZE_BY_TYPE[label] || 10,
      ...this.computeXYCoord(),
      value: [
        nodeData,
      ],
      category: GRAPH_MAPPING.findIndex((x) =>
        x.name === label),
    };
  }

  async createAdjacentNode(data, series) {
    const nodes = series.nodes || series.data;
    let idx = nodes.findIndex((x) =>
      x.value[0].id === data.id);
    if (idx >= 0) {
      return nodes[idx];
    }

    idx = nodes.length;
    const node = await this.createNode(data, idx);
    nodes.push(node);
    return node;
  }

  createRelationship(from, to, connection, series) {
    const idx = series.links.findIndex((x) =>
      x.value[0].id === connection.id);
    if (idx >= 0) {
      return series.links[idx];
    }

    const link = {
      source: from.id,
      target: to.id,
      value: [
        {
          id: connection.id,
          desc: `${AppUtils.shorten(from.value[0].name, 32)} > ${AppUtils.shorten(to.value[0].name, 32)}`,
        },
      ],
    };
    series.links.push(link);
    return link;
  }

  computeXYCoord() {
    const start = 0 - 1200;
    const end = 1200;
    const random = end - start + 10;

    const x = Math.floor(Math.random() * random + start);
    const y = Math.floor(Math.random() * random + start);
    return {
      x,
      y,
    };
  }

  makeGraphOptions(dataset) {
    const title = {};
    const tooltip = {
      show: true,
      trigger: 'item',
      enterable: true,
      alwaysShowContent: false,
      padding: 0,
      extraCssText: 'border-radius: 0',
      formatter: ((x) => {
        if (x.dataType === 'edge') {
          const container = $('<div/>')
            .addClass('my-2');
          const desc = $('<p/>')
            .addClass('text-truncate')
            .append(x.value[0].desc || x.name);
          container.append(desc);
          return container.prop('outerHTML');
        }
        if (x.dataType === 'node') {
          const parsed = x.value[0];
          const container = $('<div/>');
          if (x.name === NODE_VIDEO) {
            container.addClass('graph-tooltip');
            const img = $('<img/>')
              .attr('src', parsed.image);
            container.append(img);

            const desc = $('<p/>')
              .addClass('mx-2 my-2 text-truncate')
              .append(parsed.name);
            container.append(desc);

            return container.prop('outerHTML');
          }
          container.addClass('row no-gutters');
          let avatar = $('<i/>')
            .addClass('ml-2 my-2')
            .addClass('far fa-question-circle')
            .addClass('graph-avatar');
          if (parsed.image) {
            avatar = $('<img/>')
              .addClass('mx-2 my-auto')
              .addClass('graph-avatar')
              .attr('src', parsed.image);
          }
          container.append(avatar);

          const desc = $('<p/>')
            .addClass('my-auto mr-2 text-truncate')
            .append(parsed.name);
          container.append(desc);
          return container.prop('outerHTML');
        }
        return x.value;
      }),
    };
    const legend = [
      {
        data: dataset.categories
          .map((x) =>
            x.name),
      },
    ];
    const animationDuration = 1500;
    const animationEasingUpdate = 'quinticInOut';
    const series = [
      {
        name: 'Graph database',
        type: 'graph',
        layout: 'none',
        data: dataset.nodes,
        links: dataset.links,
        categories: dataset.categories,
        roam: 'move',
        label: {
          show: true,
          position: 'right',
          formatter: ((x) =>
            AppUtils.shorten(x.value[0].name, 32)),
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 10,
          },
        },
      },
    ];

    return {
      title,
      tooltip,
      legend,
      animationDuration,
      animationEasingUpdate,
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

  resize() {
    return this.graph.resize();
  }

  on(event, fn) {
    return this.graphContainer.on(event, fn);
  }

  off(event) {
    return this.graphContainer.off(event);
  }
}
