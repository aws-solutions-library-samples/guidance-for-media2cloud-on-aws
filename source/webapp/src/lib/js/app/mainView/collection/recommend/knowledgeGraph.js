// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import mxReadable from '../../../mixins/mxReadable.js';
import AppUtils from '../../../shared/appUtils.js';
import IABCategories from '../../../shared/iabCategories.js';

const EVENT_DATA_SELECTED = 'knowledge:data:selected';
const EVENT_LEGEND_CHANGED = 'knowledge:legend:changed';

const CAT_IDENTITYGROUP = 'Household';
const CAT_PERSISTENTID = 'User';
const CAT_TRANSIENTID = 'Device';
const CAT_WEBSITEPATH = 'Website';
const CAT_CATEGORYCODE = 'IAB_Category';
const CAT_WEBSITEGROUP = 'WebsiteGroup';

const NODESIZE_IDENTITYGROUP = 60;
const NODESIZE_PERSISTENTID = 40;
const NODESIZE_TRANSIENTID = 30;
const NODESIZE_CATEGORYCODE = 20;
const NODESIZE_WEBSITEPATH = 10;
const NODESIZE_WEBSITEGROUP = 50;

export default class KnowledgeGraph extends mxReadable(class {}) {
  constructor(datasets, container) {
    super();
    this.$datasets = datasets;
    this.$graphContainer = $('<div/>')
      .addClass('knowledge-graph')
      .attr('id', `knowledge-${AppUtils.randomHexstring()}`);
    container.append(this.$graphContainer);

    this.$graph = undefined;
    this.$graphContainer.ready(() => {
      console.log('graphContainer ready');
      this.$graph = this.buildGraph(this.$graphContainer, this.datasets);
    });
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

  buildGraph(container, dataset) {
    const height = Math.max(Math.round(container.height()), 800);
    const width = Math.max(Math.round(container.width()), 800);

    const graph = echarts.init(container[0], null, {
      renderer: 'canvas',
      useDirtyRect: false,
      height,
      width,
    });
    const parsed = this.parseGraphData(dataset);
    const options = this.makeGraphOptions(parsed);
    graph.setOption(options);
    return graph;
  }

  parseGraphData(graphData) {
    const dataset = {
      nodes: [],
      links: [],
      categories: [
        {
          name: CAT_IDENTITYGROUP,
        },
        {
          name: CAT_PERSISTENTID,
        },
        {
          name: CAT_TRANSIENTID,
        },
        {
          name: CAT_WEBSITEPATH,
        },
        {
          name: CAT_CATEGORYCODE,
        },
      ],
    };
    const identityGroup = graphData[0];
    const {
      websiteNodes,
    } = this.parseWebsitePath(identityGroup, dataset);
    this.parseIdentityGroupNode(identityGroup, dataset, websiteNodes);

    return dataset;
  }

  parseWebsitePath(root, dataset) {
    const modified = dataset;
    const randomWebsitePaths = root.persistentIds
      .map((persistentId) =>
        persistentId.transientIds
          .map((transientId) =>
            transientId.randomWebsitePaths))
      .flat(2);

    /* add category nodes */
    const categoryNodes = [];
    [
      ...new Set(randomWebsitePaths
        .map((x) =>
          x.categoryCode)),
    ].forEach((code) => {
      const node = {
        id: String(modified.nodes.length),
        name: code,
        symbolSize: NODESIZE_CATEGORYCODE,
        ...this.randomXYCoord(NODESIZE_CATEGORYCODE),
        value: this.lookupIABCategoryDesc(code),
        category: modified.categories.findIndex((x) =>
          x.name === CAT_CATEGORYCODE),
      };
      modified.nodes.push(node);
      categoryNodes.push(node);
    });

    /* add website nodes and links to category */
    const uniqueUrls = [
      ...new Set(randomWebsitePaths
        .map((x) =>
          x.url)),
    ];
    const websiteNodes = [];
    while (randomWebsitePaths.length) {
      const path = randomWebsitePaths.shift();
      const idx = uniqueUrls.findIndex((x) =>
        x === path.url);
      if (idx < 0) {
        continue;
      }
      const node = {
        id: String(modified.nodes.length),
        name: 'website',
        symbolSize: NODESIZE_WEBSITEPATH,
        ...this.randomXYCoord(NODESIZE_WEBSITEPATH),
        value: path.url,
        category: modified.categories.findIndex((x) =>
          x.name === CAT_WEBSITEPATH),
      };
      modified.nodes.push(node);
      websiteNodes.push(node);
      uniqueUrls.splice(idx, 1);

      /* create link */
      const category = categoryNodes.find((x) =>
        x.name === path.categoryCode);
      if (category) {
        const source = node.id;
        const target = category.id;
        modified.links.push({
          source,
          target,
        });
      } else {
        console.log('ERR: fail to find link', path.url, path.categoryCode);
      }
    }

    return {
      categoryNodes,
      websiteNodes,
    };
  }

  randomXYCoord(symbolSize) {
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

  lookupIABCategoryDesc(code) {
    let desc = 'Uncategorized';
    const cat = code.split('-');
    if (!cat[0]) {
      return desc;
    }
    const rootCategory = IABCategories.find((x) =>
      x.root_category_code === cat[0]);
    if (!rootCategory) {
      return desc;
    }
    desc = rootCategory.root_category_name;
    if (!cat[1]) {
      return desc;
    }
    const leafCategory = rootCategory.leaf_categories.find((x) =>
      x.leaf_category_code === code);
    if (!leafCategory) {
      return desc;
    }
    desc = `${desc}, ${leafCategory.leaf_category_value}`;
    return desc;
  }

  parseIdentityGroupNode(identityGroup, dataset, websiteNodes) {
    const node = {
      id: String(dataset.nodes.length),
      name: identityGroup.label,
      symbolSize: NODESIZE_IDENTITYGROUP,
      ...this.randomXYCoord(NODESIZE_IDENTITYGROUP),
      value: `${identityGroup.identityGroupId} (${identityGroup.persistentIds.length} members)`,
      category: dataset.categories.findIndex((x) =>
        x.name === CAT_IDENTITYGROUP),
    };
    dataset.nodes.push(node);

    identityGroup.persistentIds.forEach((persistentId) => {
      this.parsePersistentIdNode(persistentId, node, dataset, websiteNodes);
    });
    return dataset;
  }

  parsePersistentIdNode(persistentId, srcNode, dataset, websiteNodes) {
    const node = {
      id: String(dataset.nodes.length),
      name: persistentId.label,
      symbolSize: NODESIZE_PERSISTENTID,
      ...this.randomXYCoord(NODESIZE_PERSISTENTID),
      value: `${persistentId.persistentId} (${persistentId.transientIds.length} devices)`,
      category: dataset.categories.findIndex((x) =>
        x.name === CAT_PERSISTENTID),
    };
    dataset.nodes.push(node);

    dataset.links.push({
      source: srcNode.id,
      target: node.id,
    });
    /* parse transientId */
    persistentId.transientIds.forEach((transientId) => {
      this.parseTransientIdNode(transientId, node, dataset, websiteNodes);
    });
    return dataset;
  }

  parseTransientIdNode(transientId, srcNode, dataset, websiteNodes) {
    const ipLocation = transientId.ipLocations[0];
    const value = [
      {
        key: 'Device',
        val: transientId.device,
      },
      {
        key: 'Email',
        val: transientId.email,
      },
      {
        key: 'Address',
        val: `${ipLocation.city}, ${ipLocation.state}`,
      },
      {
        key: 'IP',
        val: ipLocation.ipAddress,
      },
      {
        key: 'OS',
        val: transientId.os,
      },
      {
        key: 'Browser/UserAgent',
        val: `${transientId.browser}/${transientId.userAgent.split(' ')[0]}`,
      },
      {
        key: 'TransientId',
        val: transientId.transientId,
      },
    ];
    const node = {
      id: String(dataset.nodes.length),
      name: transientId.label,
      symbolSize: NODESIZE_TRANSIENTID,
      ...this.randomXYCoord(NODESIZE_TRANSIENTID),
      value: value
        .map((x) =>
          `<strong>${x.key}:</strong> ${x.val}`)
        .join('<br/>'),
      category: dataset.categories.findIndex((x) =>
        x.name === CAT_TRANSIENTID),
    };
    dataset.nodes.push(node);

    dataset.links.push({
      source: srcNode.id,
      target: node.id,
    });

    /* create links to websites */
    transientId.randomWebsitePaths
      .map((x) =>
        x.url)
      .forEach((url) => {
        const found = websiteNodes
          .find((x) =>
            x.value === url);
        if (found) {
          dataset.links.push({
            source: node.id,
            target: found.id,
          });
        }
      });
    return dataset;
  }

  makeGraphOptions(dataset) {
    const title = {};
    const tooltip = {
      show: true,
      trigger: 'item',
      formatter: ((x) => {
        if (x.dataType === 'edge') {
          return `${dataset.nodes[Number(x.data.source)].name} > ${dataset.nodes[Number(x.data.target)].name}`;
        }
        return x.value;
      }),
    };
    const legend = [
      {
        data: dataset.categories.map(function (a) {
          return a.name;
        }),
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
          position: 'right',
          formatter: '{b}',
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

    dataset.nodes.forEach((node) => {
      /* eslint-disable-next-line */
      node.label = {
        show: node.symbolSize >= 20,
      };
    });

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
