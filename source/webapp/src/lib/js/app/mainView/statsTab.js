// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AnalysisTypes from '../shared/analysis/analysisTypes.js';
import Localization from '../shared/localization.js';
import ApiHelper from '../shared/apiHelper.js';
import AppUtils from '../shared/appUtils.js';
import Spinner from '../shared/spinner.js';
import PieGraph from './stats/pieGraph.js';
import BaseTab from '../shared/baseTab.js';

const RANDOM_ID = AppUtils.randomHexstring();
const ID_OVERALLGRAPH = `pie-${RANDOM_ID}`;
const ID_AGGREGATIONGRAPH = `aggs-${RANDOM_ID}`;

const AGGS_TYPE_KNOWNFACES = 'knownFaces';
const AGGS_TYPE_LABELS = 'labels';
const AGGS_TYPE_MODERATIONS = 'moderations';
const AGGS_TYPE_KEYPHRASES = 'keyphrases';
const AGGS_TYPE_ENTITIES = 'entities';
const AGGREGATION_SIZE = 20;

const {
  Rekognition: {
    Celeb,
    FaceMatch,
    Label,
    CustomLabel,
    Moderation,
  },
  Comprehend: {
    Keyphrase,
    Entity,
    CustomEntity,
  },
} = AnalysisTypes;

const AGGS_ANALYSIS = [
  // knownFaces
  Celeb,
  FaceMatch,
  // labels
  Label,
  CustomLabel,
  // moderations
  Moderation,
  // keyphrases
  Keyphrase,
  // entities
  Entity,
  CustomEntity,
];

const {
  Messages: {
    StatsTab: TITLE,
    StatsDesc: MSG_STATS_DESC,
    OverallStats: MSG_OVERALL_STATS,
    Aggregations: MSG_AGGREGATIONS,
    NoData: MSG_NO_DATA,
    TotalCount: MSG_TOTAL_COUNT,
    TotalSize: MSG_TOTAL_SIZE,
    WorkflowStatuses: MSG_WORKFLOW_STATUSES,
    MostRecentStats: MSG_MOST_RECENT_STATS,
    TopKnownFaces: MSG_TOP_KNOWN_FACES,
    TopLabels: MSG_TOP_LABELS,
    TopModerations: MSG_TOP_MODERATIONS,
    TopKeyphrases: MSG_TOP_KEYPHRASES,
    TopEntities: MSG_TOP_ENTITIES,
  },
  Tooltips: {
    RefreshStats: TOOLTIP_REFRESH_STATS,
  },
  Buttons: {
    Refresh: BTN_REFRESH,
  },
} = Localization;

const HASHTAG = TITLE.replaceAll(' ', '');

export default class StatsTab extends BaseTab {
  constructor() {
    super(TITLE, {
      hashtag: HASHTAG,
    });

    this.$pieGraphs = {
      overall: {
        totalCount: undefined,
        totalSize: undefined,
        status: undefined,
        recents: undefined,
      },
      aggs: {
        [AGGS_TYPE_KNOWNFACES]: undefined,
        [AGGS_TYPE_LABELS]: undefined,
        [AGGS_TYPE_MODERATIONS]: undefined,
        [AGGS_TYPE_KEYPHRASES]: undefined,
        [AGGS_TYPE_ENTITIES]: undefined,
      },
    };

    Spinner.useSpinner();
  }

  get overallCountGraph() {
    return this.$pieGraphs.overall.totalCount;
  }

  set overallCountGraph(val) {
    this.$pieGraphs.overall.totalCount = val;
  }

  get overallSizeGraph() {
    return this.$pieGraphs.overall.totalSize;
  }

  set overallSizeGraph(val) {
    this.$pieGraphs.overall.totalSize = val;
  }

  get overallStatusGraph() {
    return this.$pieGraphs.overall.status;
  }

  set overallStatusGraph(val) {
    this.$pieGraphs.overall.status = val;
  }

  get mostRecentGraph() {
    return this.$pieGraphs.overall.recents;
  }

  set mostRecentGraph(val) {
    this.$pieGraphs.overall.recents = val;
  }

  get aggsGraphs() {
    return this.$pieGraphs.aggs;
  }

  get knownFacesGraph() {
    return this.$pieGraphs.aggs.knownFaces;
  }

  set knownFacesGraph(val) {
    this.$pieGraphs.aggs.knownFaces = val;
  }

  get labelsGraph() {
    return this.$pieGraphs.aggs.labels;
  }

  set labelsGraph(val) {
    this.$pieGraphs.aggs.labels = val;
  }

  get moderationsGraph() {
    return this.$pieGraphs.aggs.moderations;
  }

  set moderationsGraph(val) {
    this.$pieGraphs.aggs.moderations = val;
  }

  get keyphrasesGraph() {
    return this.$pieGraphs.aggs.keyphrases;
  }

  set keyphrasesGraph(val) {
    this.$pieGraphs.aggs.keyphrases = val;
  }

  get entitiesGraph() {
    return this.$pieGraphs.aggs.entities;
  }

  set entitiesGraph(val) {
    this.$pieGraphs.aggs.entities = val;
  }

  async show(hashtag) {
    if (!this.initialized) {
      const content = this.createSkeleton();
      this.tabContent.append(content);
    } else {
      await this.refreshContent();
    }
    return super.show(hashtag);
  }

  createSkeleton() {
    const container = $('<div/>')
      .addClass('row no-gutters');

    const descContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(descContainer);

    const desc = this.createDescription();
    descContainer.append(desc);

    const overallContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto');
    container.append(overallContainer);

    const overall = this.createOverallStatus();
    overallContainer.append(overall);

    const aggsContainer = $('<div/>')
      .addClass('col-12 p-0 m-0 p-0 bg-light');
    container.append(aggsContainer);

    const aggs = this.createAggregations();
    aggsContainer.append(aggs);

    const controlsContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(controlsContainer);

    const controls = this.createControls();
    controlsContainer.append(controls);

    container.ready(async () => {
      await this.refreshContent();
    });

    return container;
  }

  createDescription() {
    return $('<p/>')
      .addClass('lead')
      .html(MSG_STATS_DESC);
  }

  createOverallStatus() {
    const container = $('<div/>')
      .addClass('col-12 p-0 m-0');

    const title = $('<span/>')
      .addClass('d-block p-0 lead')
      .html(MSG_OVERALL_STATS);
    container.append(title);

    const pieGraphContainer = $('<div/>')
      .addClass('row no-gutters')
      .attr('id', ID_OVERALLGRAPH);
    container.append(pieGraphContainer);

    return container;
  }

  createAggregations() {
    const container = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');

    const title = $('<span/>')
      .addClass('d-block p-0 lead')
      .html(MSG_AGGREGATIONS);
    container.append(title);

    const aggsGraphContainer = $('<div/>')
      .addClass('row no-gutters')
      .attr('id', ID_AGGREGATIONGRAPH);
    container.append(aggsGraphContainer);

    return container;
  }

  createControls() {
    const container = $('<form/>')
      .addClass('form-inline');

    const btnContainer = $('<div/>')
      .addClass('mx-auto');
    container.append(btnContainer);

    container.submit((event) =>
      event.preventDefault());

    const btnRefresh = $('<button/>')
      .addClass('btn btn-success')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_REFRESH_STATS)
      .html(BTN_REFRESH)
      .tooltip({
        trigger: 'hover',
      });
    btnContainer.append(btnRefresh);

    btnRefresh.on('click', () =>
      this.refreshContent());

    return container;
  }

  async refreshContent() {
    try {
      Spinner.loading();

      const promises = [];

      /* get overall stats */
      promises.push(await ApiHelper.getStats({
        size: AGGREGATION_SIZE,
      }).then((res) =>
        this.refreshOverallStats(res)));

      /* get analysis aggs */
      promises.push(await ApiHelper.getStats({
        size: AGGREGATION_SIZE,
        aggregate: AGGS_ANALYSIS.join(','),
      }).then((res) =>
        this.refreshAggregations(res.aggregations)));

      await Promise.all(promises);
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }

  async refreshOverallStats(data) {
    console.log('refreshOverallStats', data);

    const container = this.tabContent
      .find(`#${ID_OVERALLGRAPH}`);

    container.children()
      .remove();

    if (!data.stats.types) {
      const noData = $('<p/>')
        .addClass('text-center text-muted')
        .append(MSG_NO_DATA);

      return container.append(noData);
    }

    const stats = await Promise.all([
      this.refreshOverallCountStats(data.stats.types),
      this.refreshOverallSizeStats(data.stats.types),
      this.refreshOverallStatusStats(data.stats.overallStatuses),
      this.refreshMostRecentStats(data.recents),
    ]);

    return container.append(stats);
  }

  async refreshOverallCountStats(data) {
    const container = $('<div/>')
      .addClass('col-6 m-0 p-0');

    if (this.overallCountGraph) {
      this.overallCountGraph.destroy();
    }

    const datasets = data.reduce((a0, c0) =>
      a0.concat({
        name: c0.type,
        value: c0.count,
      }), []);

    const total = datasets.reduce((a0, c0) =>
      a0 + c0.value, 0);

    const title = `${MSG_TOTAL_COUNT} (${total} files)`;
    const graph = new PieGraph(title, datasets, {
      formatter: '<strong>{b}</strong>: {c} files ({d}%)',
    });

    this.overallCountGraph = graph;

    const graphContainer = graph.getGraphContainer();
    container.append(graphContainer);

    return container;
  }

  async refreshOverallSizeStats(data) {
    const container = $('<div/>')
      .addClass('col-6 m-0 p-0');

    if (this.overallSizeGraph) {
      this.overallSizeGraph.destroy();
    }

    const datasets = data.reduce((a0, c0) =>
      a0.concat({
        name: c0.type,
        value: c0.fileSize.total,
      }), []);

    const total = datasets.reduce((a0, c0) =>
      a0 + c0.value, 0);

    const title = `${MSG_TOTAL_SIZE} (${AppUtils.readableFileSize(total)})`;
    const graph = new PieGraph(title, datasets, {
      formatter: (point) =>
        `<strong>${point.data.name}:</strong> ${AppUtils.readableFileSize(point.data.value)}`,
    });

    this.overallSizeGraph = graph;

    const graphContainer = graph.getGraphContainer();
    container.append(graphContainer);

    return container;
  }

  async refreshOverallStatusStats(data) {
    const container = $('<div/>')
      .addClass('col-6 m-0 p-0');

    if (this.overallStatusGraph) {
      this.overallStatusGraph.destroy();
    }

    const datasets = data.reduce((a0, c0) =>
      a0.concat({
        name: c0.overallStatus,
        value: c0.count,
      }), []);

    const total = datasets.reduce((a0, c0) =>
      a0 + c0.value, 0);

    const title = `${MSG_WORKFLOW_STATUSES} (${total} processes)`;

    const graph = new PieGraph(title, datasets, {
      formatter: '<strong>{b}</strong>: {c} counts ({d}%)',
    });

    this.overallStatusGraph = graph;

    const graphContainer = graph.getGraphContainer();
    container.append(graphContainer);

    return container;
  }

  async refreshMostRecentStats(data) {
    const container = $('<div/>')
      .addClass('col-6 m-0 p-0');

    if (this.mostRecentGraph) {
      this.mostRecentGraph.destroy();
    }

    if (!data || !data.length) {
      return undefined;
    }

    const datasets = data.map((x) => ({
      ...x,
      name: x.basename,
      value: x.fileSize,
    }));

    const title = `${MSG_MOST_RECENT_STATS} (${data.length})`;
    const graph = new PieGraph(title, datasets, {
      formatter: (point) => [
        `<strong>name:</strong> ${point.data.basename}`,
        `<strong>uuid:</strong>: ${point.data.uuid}`,
        `<strong>duration:</strong>: ${AppUtils.readableDuration(point.data.duration)}`,
        `<strong>filesize:</strong>: ${AppUtils.readableFileSize(point.data.fileSize)}`,
        `<strong>lastmodified:</strong>: ${AppUtils.isoDateTime(point.data.lastModified)}`,
        `<strong>type:</strong>: ${point.data.type}`,
      ].join('<br/>'),
    });

    this.mostRecentGraph = graph;

    const graphContainer = graph.getGraphContainer();
    container.append(graphContainer);

    return container;
  }

  async refreshAggregations(data) {
    console.log('refreshAggregations', data);

    const container = this.tabContent
      .find(`#${ID_AGGREGATIONGRAPH}`);

    container.children()
      .remove();

    if (data === undefined || Object.keys(data).length === 0) {
      const noData = $('<p/>')
        .addClass('text-center text-muted')
        .append(MSG_NO_DATA);

      return container.append(noData);
    }

    const aggsByTypes = [
      {
        type: AGGS_TYPE_KNOWNFACES,
        title: MSG_TOP_KNOWN_FACES,
        dataset: this.mergeAggs(data[Celeb], data[FaceMatch]),
      },
      {
        type: AGGS_TYPE_LABELS,
        title: MSG_TOP_LABELS,
        dataset: this.mergeAggs(data[Label], data[CustomLabel]),
      },
      {
        type: AGGS_TYPE_MODERATIONS,
        title: MSG_TOP_MODERATIONS,
        dataset: data[Moderation] || [],
      },
      {
        type: AGGS_TYPE_KEYPHRASES,
        title: MSG_TOP_KEYPHRASES,
        dataset: data[Keyphrase] || [],
      },
      {
        type: AGGS_TYPE_ENTITIES,
        title: MSG_TOP_ENTITIES,
        dataset: this.mergeAggs(data[Entity], data[CustomEntity]),
      },
    ];

    const aggs = await Promise.all(aggsByTypes
      .map((agg) =>
        this.refreshAggregateByType(
          agg.type,
          agg.title,
          agg.dataset
        )));

    return container.append(aggs);
  }

  mergeAggs(arrayA = [], arrayB = []) {
    const remained = [];

    arrayB.forEach((b) => {
      const found = arrayA.find((a) =>
        a.name === b.name);
      if (found) {
        found.count = Math.max(found.count, b.count);
      } else {
        remained.push(b);
      }
    });

    return arrayA.concat(remained);
  }

  async refreshAggregateByType(type, title, data) {
    if (this.aggsGraphs[type]) {
      this.aggsGraphs[type].destroy();
    }

    const container = $('<div/>')
      .addClass('col-6 m-0 p-0');

    const datasets = data.reduce((a0, c0) =>
      a0.concat({
        name: c0.name,
        value: c0.count,
      }), []);

    const graph = new PieGraph(title, datasets, {
      formatter: '<strong>{b}</strong>: {c} documents',
    });

    this.aggsGraphs[type] = graph;

    const graphContainer = graph.getGraphContainer();
    container.append(graphContainer);

    return container;
  }
}
