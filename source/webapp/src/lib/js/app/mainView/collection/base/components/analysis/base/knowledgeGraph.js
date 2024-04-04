// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import AppUtils from '../../../../../../shared/appUtils.js';
import ApiHelper from '../../../../../../shared/apiHelper.js';
import Spinner from '../../../../../../shared/spinner.js';
import {
  GetMediaManager,
} from '../../../../../../shared/media/mediaManager.js';
import {
  GetFaceManager,
} from '../../../../../../shared/faceManager/index.js';

const {
  GraphDefs: {
    Vertices,
  },
} = SolutionManifest;

const NODESIZE_BY_TYPE = {
  [Vertices.Group]: 50,
  [Vertices.Asset]: 45,
  [Vertices.Celeb]: 30,
  [Vertices.Label]: 30,
  [Vertices.Keyword]: 30,
  [Vertices.Attribute]: 20,
  [Vertices.Checksum]: 20,
};

const GRAPH_MAPPING = Object.values(Vertices)
  .map((x) => ({
    name: x,
  }));

const GRAPH_W = 1200;
const GRAPH_H = 800;
const PAGESIZE = 50;

export default class KnowledgeGraph {
  constructor(container, media, options) {
    this.$id = AppUtils.randomHexstring();
    this.$mediaManager = GetMediaManager();
    this.$faceManager = GetFaceManager();
    this.$media = media;

    this.$graph = undefined;
    this.$graphContainer = $('<div/>')
      .addClass('knowledge-graph')
      .attr('id', `knowledge-${this.$id}`);

    this.$graphContainer.ready(async () => {
      console.log('graphContainer ready');
      await this.renderGraph(this.$graphContainer, options);
    });
    container.append(this.$graphContainer);

    Spinner.useSpinner();
  }

  static canSupport() {
    return (
      SolutionManifest.KnowledgeGraph &&
      SolutionManifest.KnowledgeGraph.Endpoint &&
      SolutionManifest.KnowledgeGraph.ApiKey
    );
  }

  get id() {
    return this.$id;
  }

  get mediaManager() {
    return this.$mediaManager;
  }

  get faceManager() {
    return this.$faceManager;
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

  getGraphContainer() {
    return this.graphContainer;
  }

  getGraphOption() {
    if (!this.graph) {
      return undefined;
    }
    return this.graph.getOption();
  }

  async renderGraph(container, options = {}) {
    try {
      Spinner.loading();

      if (this.graph !== undefined) {
        this.graph.dispose();
      }
      this.graph = this.buildGraph(container, 'dark', options);

      let dataset = options.dataset;
      if (!dataset && this.media) {
        const uuid = this.media.uuid;
        const withOptions = {
          labels: [
            Vertices.Celeb,
            Vertices.Checksum,
          ],
        };

        dataset = await KnowledgeGraph.queryGraph(
          uuid,
          withOptions
        );
      }

      if (dataset) {
        await this.updateGraph(dataset);
      }
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }

  buildGraph(container, color, options = {}) {
    let [w, h] = KnowledgeGraph.computeGraphDimension(container);

    if (Array.isArray(options.dimension)
    && options.dimension.length === 2) {
      [w, h] = options.dimension;
    }

    console.log(
      '== buildGraph:',
      w,
      'x',
      h
    );
    const graph = echarts.init(container[0], color, {
      renderer: 'canvas',
      useDirtyRect: false,
      width: w,
      height: h,
    });

    let graphOptions = {
      nodes: [],
      links: [],
      categories: GRAPH_MAPPING,
    };
    graphOptions = this.makeGraphOptions(graphOptions);
    graph.setOption(graphOptions);

    /* default deselect label, keyword, and checksum */
    let deselectLegends = [
      Vertices.Keyword,
      Vertices.Label,
      Vertices.Checksum,
    ];
    if (options.deselectLegends) {
      deselectLegends = options.deselectLegends;
    }

    deselectLegends.forEach((name) => {
      graph.dispatchAction({
        type: 'legendUnSelect',
        name,
      });
    });

    let dblclickFn = this.onGraphDoubleClickEvent.bind(this);
    if (typeof options.dblclickFn === 'function') {
      dblclickFn = options.dblclickFn;
    }

    graph.on('dblclick', async (event) => {
      await dblclickFn(event);
    });

    return graph;
  }

  async updateGraph(dataset = []) {
    if (!this.graph) {
      return undefined;
    }

    const series = this.graph.getOption().series[0];
    while (dataset.length) {
      const data = dataset.pop();

      if (!Array.isArray(data)) {
        await this.createNodeIfNotExist(data, series);
        continue;
      }

      while (data.length > 2) {
        const src = data.shift();
        const link = data.shift();
        const dest = data[0];

        const srcNode = await this.createNodeIfNotExist(src, series);
        const destNode = await this.createNodeIfNotExist(dest, series);

        if (srcNode !== undefined && destNode !== undefined) {
          this.createRelationship(srcNode, destNode, link, series);
        }
      }
    }

    /* update graph */
    this.graph.setOption({
      series: [series],
    });

    return series;
  }

  resetGraph() {
    if (!this.graph) {
      return;
    }

    const graphOption = this.graph.getOption();
    graphOption.series[0].links = [];
    graphOption.series[0].data = [];
    this.graph.setOption(graphOption, true);
  }

  async createNodeIfNotExist(data, series) {
    if (data === undefined) {
      return undefined;
    }

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

  async createNode(data, idx) {
    const params = {
      id: data.id,
      label: data.label,
      name: data.name,
      traversed: false,
      token: 0,
    };

    if (params.label === Vertices.Asset) {
      const media = await this.mediaManager.lazyGetByUuid(params.id);
      if (media !== undefined) {
        params.image = await media.getThumbnail();
      }
    } else if (params.label === Vertices.Celeb) {
      /* face match specific */
      if (data.faceId && data.collectionId) {
        params.image = await this.faceManager.getFaceImageById(
          data.collectionId,
          data.faceId
        );
      }
    }

    return this.parseNode(params, idx);
  }

  parseNode(nodeData, idx) {
    const label = nodeData.label;
    const stats = {};
    return {
      id: idx,
      name: label,
      symbolSize: NODESIZE_BY_TYPE[label] || 10,
      ...this.computeXYCoord(),
      value: [
        nodeData,
        stats,
      ],
      category: GRAPH_MAPPING
        .findIndex((x) =>
          x.name === label),
    };
  }

  createRelationship(from, to, connection, series) {
    const idx = series.links
      .findIndex((x) =>
        (x.value[0].id === connection.id)
        || (x.source === from.id && x.target === to.id));
    if (idx >= 0) {
      return series.links[idx];
    }

    const link = {
      source: from.id,
      target: to.id,
      value: [
        {
          id: connection.id,
          label: connection.label,
          desc: `  (${connection.label})  `,
        },
      ],
    };
    series.links.push(link);

    /* store relationship to 'from' and 'to' nodes  */
    let stats = from.value[1];
    if (stats[connection.label] === undefined) {
      stats[connection.label] = [];
    }
    stats[connection.label].push(to.id);

    stats = to.value[1];
    if (stats[connection.label] === undefined) {
      stats[connection.label] = [];
    }
    stats[connection.label].push(from.id);

    return link;
  }

  computeXYCoord() {
    let w;
    let h;

    const graph = this.graph;
    if (graph) {
      w = Math.floor((graph.getWidth() || GRAPH_W) / 2);
      h = Math.floor((graph.getHeight() || GRAPH_W) / 2);
    }

    let start = 0 - w;
    let end = w;
    let random = end - start + 10;
    const x = Math.floor(Math.random() * random + start);

    start = 0 - h;
    end = h;
    random = end - start + 10;
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
          const container = $('<div/>')
            .addClass('mx-2 my-2');

          if (parsed.image !== undefined) {
            container.addClass('graph-tooltip');
            const img = $('<img/>')
              .attr('src', parsed.image);
            container.append(img);

            const desc = $('<p/>')
              .addClass('mx-2 my-2 text-truncate')
              .append(parsed.name);
            container.append(desc);
          } else {
            const table = $('<table/>');
            container.append(table);

            const tbody = $('<tbody/>');
            table.append(tbody);

            const rows = Object.keys(parsed)
              .map((key) =>
                $('<tr/>')
                  .append($('<td/>')
                    .addClass('font-weight-bold')
                    .append(key))
                  .append($('<td/>')
                    .addClass('px-2')
                    .append(AppUtils.shorten(parsed[key], 32))));
            tbody.append(rows);
          }

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

  resize() {
    return this.graph.resize();
  }

  on(event, fn) {
    return this.graphContainer.on(event, fn);
  }

  off(event) {
    return this.graphContainer.off(event);
  }

  async onGraphDoubleClickEvent(event) {
    try {
      Spinner.loading(true);

      const parsed = event.data.value[0];
      if (parsed.traversed !== true) {
        const withOptions = {
          token: parsed.token,
        };
        const dataset = await KnowledgeGraph.queryGraph(
          parsed.id,
          withOptions
        );

        if (!dataset || !dataset.length) {
          /* stop querying */
          parsed.traversed = true;
        } else {
          parsed.token += dataset.length;
        }
        await this.updateGraph(dataset);
      }
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }

  static computeGraphDimension(container) {
    const w = Math.floor(container.width() / 2) * 2;
    const h = Math.floor(w / 3) * 2;

    return [w, h];
  }

  static async queryGraph(id, options = {}) {
    const token = options.token || 0;
    const pagesize = options.pagesize || PAGESIZE;
    const params = {
      op: 'query',
      type: 'vertice',
      id,
      token,
      pagesize,
    };

    if (Array.isArray(options.labels)) {
      params.labels = options.labels.join(',');
    } else if (typeof options.labels === 'string'
    && options.labels.length > 0) {
      params.labels = options.labels;
    }

    return ApiHelper.graph(params);
  }

  static async queryVertices(ids) {
    return ApiHelper.graph({
      op: 'query',
      type: 'vertice',
      ids,
    });
  }

  static async queryPaths(from, to) {
    return ApiHelper.graph({
      op: 'path',
      type: 'vertice',
      from,
      to: to.join(','),
    });
  }

  static async pathVertices(ids) {
    return ApiHelper.graph({
      op: 'path',
      type: 'vertice',
      ids: ids.join(','),
    });
  }
}
