// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import NodeTypes from './nodeTypes.js';
import AppUtils from './appUtils.js';
import Spinner from './spinner.js';

const GRAPH_W = 1200;
const GRAPH_H = 800;

const GRAPH_MAPPING = Object.keys(NodeTypes.NODE_SIZE_BY_TYPE)
  .map((x) => ({
    name: x,
  }));

export default class IdentityGraph {
  constructor(container, parent) {
    this.$parent = parent;

    this.$id = AppUtils.randomHexstring();
    const graphId = `graph-${this.$id}`;
    this.$graphContainer = $('<div/>')
      .addClass('knowledge-graph')
      .attr('id', graphId);
    container.append(this.$graphContainer);

    this.$graph = undefined;
    this.$graphContainer.ready(async () => {
      this.$graph = await this.buildGraph(this.$graphContainer);
    });
  }

  get id() {
    return this.$id;
  }

  get parent() {
    return this.$parent;
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

  loading(enabled) {
    return Spinner.loading(enabled);
  }

  getGraphContainer() {
    return this.graphContainer;
  }

  static async graphApi(query) {
    const url = new URL(SolutionManifest.KnowledgeGraph.Endpoint);
    Object.keys(query)
      .forEach((x) => {
        if (query[x] !== undefined) {
          url.searchParams.append(x, query[x]);
        }
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

  async buildGraph(container) {
    const height = Math.max(Math.round(container.height()), GRAPH_H);
    const width = Math.max(Math.round(container.width()), GRAPH_W);

    const graph = echarts.init(container[0], null, {
      renderer: 'canvas',
      useDirtyRect: false,
      height,
      width,
    });

    /* dblclick always receives a single click event */
    /* delay processing single click event by 300ms */
    let timer;
    graph.on('click', ((event) => {
      if (event.event.event.detail === 1) {
        timer = setTimeout(async () => {
          try {
            this.loading(true);
            const parsed = event.data.value[0];

            let options = {
              start: 0,
              end: 20,
            };

            /* beginning of the route */
            if (event.data.name === NodeTypes.NODE_IDENTITY_GROUP) {
              return;
            }
            switch (parsed.label) {
              case NodeTypes.NODE_WEBSITE_GROUP:
                options = {
                  ...options,
                  label: NodeTypes.NODE_WEBSITE,
                  end: 200,
                  direction: 'out',
                };
                break;
              case NodeTypes.NODE_WEBSITE:
                options = {
                  ...options,
                  label: NodeTypes.NODE_TRANSIENT_ID,
                  direction: 'in',
                };
                break;
              case NodeTypes.NODE_TRANSIENT_ID:
                options = {
                  ...options,
                  label: [
                    NodeTypes.NODE_PERSISTENT_ID,
                    NodeTypes.NODE_IP,
                  ].join(','),
                  direction: 'both',
                };
                break;
              case NodeTypes.NODE_PERSISTENT_ID:
                options = {
                  ...options,
                  label: NodeTypes.NODE_IDENTITY_GROUP,
                  direction: 'both',
                };
                break;
              default: //do nothing
            }
            const dataset = await this.getConnectedNodes(parsed, options);
            this.updateGraph(dataset);
          } catch (e) {
            console.error(e);
          } finally {
            this.loading(false);
          }
        }, 300);
      }
    }));

    graph.on('dblclick', async (event) => {
      if (event.event.event.detail === 2) {
        clearTimeout(timer);
        try {
          this.loading(true);
          const parsed = event.data.value[0];
          let options = {
            start: 0,
            end: 20,
          };
          switch (parsed.label) {
            /* end of the route */
            case NodeTypes.NODE_WEBSITE_GROUP:
              return;
            case NodeTypes.NODE_TRANSIENT_ID:
              options = {
                ...options,
                label: NodeTypes.NODE_WEBSITE,
                end: 200,
              };
              break;
            case NodeTypes.NODE_WEBSITE:
              options = {
                ...options,
                label: NodeTypes.NODE_WEBSITE_GROUP,
                direction: 'in',
              };
              break;
            default: //do nothing
          }
          const dataset = await this.getConnectedNodes(parsed, options);
          this.updateGraph(dataset);
        } catch (e) {
          console.error(e);
        } finally {
          this.loading(false);
        }
      }
    });

    try {
      this.loading(true);

      const graphOptions = {
        nodes: [],
        links: [],
        categories: GRAPH_MAPPING,
      };

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

  getGraphSeries() {
    if (!this.graph) {
      return undefined;
    }
    return this.graph.getOption().series[0];
  }

  resetGraph() {
    if (this.graph) {
      const series = this.graph.getOption().series[0];
      series.data = [];
      series.links = [];
      /* update graph */
      this.graph.setOption({
        series: [series],
      });
    }
  }

  updateGraph(dataset) {
    if (!this.graph) {
      return undefined;
    }

    const series = this.graph.getOption().series[0];
    while (dataset.length) {
      const data = dataset.shift();
      if (Array.isArray(data)) {
        const src = data[0];
        const link = data[1];
        const dest = data[2];
        const srcNode = this.createNodeIfNotExist(src, series);
        const destNode = this.createNodeIfNotExist(dest, series);
        if (srcNode !== undefined && destNode !== undefined) {
          this.createRelationship(srcNode, destNode, link, series);
        }
      } else {
        this.createNodeIfNotExist(data, series);
      }
    }

    /* update graph */
    this.graph.setOption({
      series: [series],
    });
    return series;
  }

  createNodeIfNotExist(data, series) {
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
    const node = this.createNode(data, idx);
    nodes.push(node);
    return node;
  }

  createNode(data, idx) {
    const id = data.id;
    const label = data.label;
    const name = NodeTypes.NODE_NAME_BY_TYPE[label];
    return this.parseNode({
      id,
      label,
      name,
      ...this.parseIdentityGroupData(data),
      ...this.parsePersistIdData(data),
      ...this.parseTransientData(data),
      ...this.parseIPData(data),
      ...this.parseWebsiteData(data),
      ...this.parseWebsiteGroupData(data),
    }, idx);
  }

  parseNode(nodeData, idx) {
    const label = nodeData.label;
    const stats = {};
    return {
      id: idx,
      name: label,
      symbolSize: NodeTypes.NODE_SIZE_BY_TYPE[label] || 10,
      ...this.computeXYCoord(),
      value: [
        nodeData,
        stats,
      ],
      category: GRAPH_MAPPING.findIndex((x) =>
        x.name === label),
    };
  }

  parseTransientData(data) {
    let parsed;
    if (data.label === NodeTypes.NODE_TRANSIENT_ID) {
      const type = (data.type !== undefined)
        ? data.type[0]
        : undefined;
      const userAgent = (data.user_agent !== undefined)
        ? data.user_agent[0]
        : undefined;
      const device = (data.device !== undefined)
        ? data.device[0]
        : undefined;
      const os = (data.os !== undefined)
        ? data.os[0]
        : undefined;
      const browser = (data.browser !== undefined)
        ? data.browser[0]
        : undefined;
      const email = (data.email !== undefined)
        ? data.email[0]
        : undefined;
      parsed = {
        type,
        userAgent,
        device,
        os,
        browser,
        email,
        name: device,
      };
    }
    return parsed;
  }

  parseIPData(data) {
    let parsed;
    if (data.label === NodeTypes.NODE_IP) {
      const state = (data.state !== undefined)
        ? data.state[0]
        : undefined;
      const city = (data.city !== undefined)
        ? data.city[0]
        : undefined;
      const ipAddress = (data.ip_address !== undefined)
        ? data.ip_address[0]
        : undefined;
      parsed = {
        state,
        city,
        ipAddress,
        name: `${city}, ${state}`,
      };
    }
    return parsed;
  }

  parseWebsiteData(data) {
    let parsed;
    if (data.label === NodeTypes.NODE_WEBSITE) {
      const url = (data.url !== undefined)
        ? data.url[0]
        : undefined;
      parsed = {
        url,
        // name: url,
      };
    }
    return parsed;
  }

  parseWebsiteGroupData(data) {
    let parsed;
    if (data.label === NodeTypes.NODE_WEBSITE_GROUP) {
      const url = (data.url !== undefined)
        ? data.url[0]
        : undefined;
      const category = (data.category !== undefined)
        ? data.category[0]
        : undefined;
      const categoryCode = (data.categoryCode !== undefined)
        ? data.categoryCode[0]
        : undefined;
      parsed = {
        url,
        category,
        categoryCode,
        name: `${category} (${categoryCode})`,
      };
    }
    return parsed;
  }

  parsePersistIdData(data) {
    let parsed;
    if (data.label === NodeTypes.NODE_PERSISTENT_ID) {
      const pid = (data.pid !== undefined)
        ? data.pid[0]
        : undefined;
      parsed = {
        pid,
        name: `User (${AppUtils.shorten(pid, 8)})`,
      };
    }
    return parsed;
  }

  parseIdentityGroupData(data) {
    let parsed;
    if (data.label === NodeTypes.NODE_IDENTITY_GROUP) {
      const igid = (data.igid !== undefined)
        ? data.igid[0]
        : undefined;
      const type = (data.type !== undefined)
        ? data.type[0]
        : undefined;
      parsed = {
        igid,
        type,
        name: `${AppUtils.capitalize(type)} (${AppUtils.shorten(igid, 8)})`,
      };
    }
    return parsed;
  }

  createRelationship(from, to, connection, series) {
    const idx = series.links.findIndex((x) =>
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
          desc: `${AppUtils.shorten(from.value[0].name, 20)} ${connection.label} ${AppUtils.shorten(to.value[0].name, 20)}`,
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

  async getConnectedNodes(data, options = {}) {
    let params = {
      op: 'identity',
      type: 'vertice',
      id: data.id,
      ...options,
    };
    if (!params.direction) {
      params.direction = 'both';
    }
    const dataset = await IdentityGraph.graphApi(params);

    /* if dest is website, make another query to get IAB nodes */
    const first = ((dataset || [])[0] || [])[2];
    if (!first || first.label !== NodeTypes.NODE_WEBSITE) {
      return dataset;
    }

    const ids = dataset.map((x) =>
      x[2].id);
    params = {
      ...params,
      id: ids.join(','),
      start: undefined,
      end: undefined,
      label: NodeTypes.NODE_WEBSITE_GROUP,
      direction: 'in',
    };
    const iabs = await IdentityGraph.graphApi(params);
    return [
      ...dataset,
      ...iabs,
    ];
  }

  async createAdjacentNode(data, series) {
    const nodes = series.nodes || series.data;
    let idx = nodes.findIndex((x) =>
      x.value[0].id === data.id);
    if (idx >= 0) {
      return nodes[idx];
    }

    idx = nodes.length;
    const node = this.createNode(data, idx);
    nodes.push(node);
    return node;
  }

  computeXYCoord() {
    let start = 0 - GRAPH_W;
    let end = GRAPH_W;
    let random = end - start + 10;
    const x = Math.floor(Math.random() * random + start);

    start = 0 - GRAPH_H;
    end = GRAPH_H;
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
          const container = $('<div/>')
            .addClass('mx-2 my-2');

          const table = $('<table/>');
          container.append(table);

          const tbody = $('<tbody/>');
          table.append(tbody);

          const rows = Object.keys(x.value[0]).map((key) =>
            $('<tr/>')
              .append($('<td/>')
                .addClass('font-weight-bold')
                .append(key))
              .append($('<td/>')
                .addClass('px-2')
                .append(AppUtils.shorten(x.value[0][key], 32))));
          tbody.append(rows);

          return container.prop('outerHTML');
        }
        return x.value;
      }),
    };
    const legend = {
      data: dataset.categories
        .map((x) =>
          x.name),
      formatter: ((x) =>
        NodeTypes.NODE_NAME_BY_TYPE[x]),
    };
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
            x.value[0].name),
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
