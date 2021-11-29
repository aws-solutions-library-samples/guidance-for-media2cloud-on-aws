// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import AnalysisTypes from '../shared/analysis/analysisTypes.js';
import Localization from '../shared/localization.js';
import ApiHelper from '../shared/apiHelper.js';
import AppUtils from '../shared/appUtils.js';
import MediaFactory from '../shared/media/mediaFactory.js';
import PieGraph from './stats/pieGraph.js';
import mxSpinner from '../mixins/mxSpinner.js';
import BaseTab from '../shared/baseTab.js';

const ID_OVERALLGRAPH = `pie-${AppUtils.randomHexstring()}`;
const ID_AGGREGATIONGRAPH = `aggs-${AppUtils.randomHexstring()}`;
const MOST_RECENT_ITEMS = 20;
const AGGREGATED_KNOWN_FACE_SIZE = 20;
const AGGREGATED_LABEL_SIZE = 20;
const AGGREGATED_MODERATION_SIZE = 20;
const AGGREGATED_KEYPHRASE_SIZE = 20;
const AGGREGATED_ENTITY_SIZE = 20;
const AGGS_TYPE_KNOWNFACES = 'knownFaces';
const AGGS_TYPE_LABELS = 'labels';
const AGGS_TYPE_MODERATIONS = 'moderations';
const AGGS_TYPE_KEYPHRASES = 'keyphrases';
const AGGS_TYPE_ENTITIES = 'entities';

export default class StatsTab extends mxSpinner(BaseTab) {
  constructor(defaultTab = false) {
    super(Localization.Messages.StatsTab, {
      selected: defaultTab,
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

  async show() {
    if (!this.initialized) {
      this.tabContent.append(this.createSkeleton());
      this.delayContentLoad();
    } else {
      await this.refreshContent();
    }
    return super.show();
  }

  createSkeleton() {
    const description = this.createDescription();
    const overall = this.createOverallStatus();
    const aggs = this.createAggregations();
    const controls = this.createControls();
    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(description))
      .append($('<div/>').addClass('col-9 p-0 mx-auto')
        .append(overall))
      .append($('<div/>').addClass('col-12 p-0 m-0 p-0 bg-light')
        .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
          .append(aggs)))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(controls))
      .append(this.createLoading());
    return row;
  }

  createDescription() {
    return $('<p/>').addClass('lead')
      .html(Localization.Messages.StatsDesc);
  }

  createOverallStatus() {
    const title = $('<span/>').addClass('d-block p-0 lead')
      .html(Localization.Messages.OverallStats);
    const pieGraphContainer = $('<div/>').addClass('row no-gutters')
      .attr('id', ID_OVERALLGRAPH);
    return $('<div/>').addClass('col-12 p-0 m-0')
      .append(title)
      .append(pieGraphContainer);
  }

  createAggregations() {
    const title = $('<span/>').addClass('d-block p-0 lead')
      .html(Localization.Messages.Aggregations);
    const aggsGraphContainer = $('<div/>').addClass('row no-gutters')
      .attr('id', ID_AGGREGATIONGRAPH);
    return $('<div/>').addClass('col-12 p-0 m-0 mb-4')
      .append(title)
      .append(aggsGraphContainer);
  }

  createControls() {
    const refresh = $('<button/>').addClass('btn btn-success')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.RefreshStats)
      .html(Localization.Buttons.Refresh)
      .tooltip({
        trigger: 'hover',
      });
    refresh.off('click').on('click', () =>
      this.refreshContent());

    const controls = $('<form/>').addClass('form-inline')
      .append($('<div/>').addClass('mx-auto')
        .append(refresh));
    controls.submit(event =>
      event.preventDefault());

    return controls;
  }

  delayContentLoad() {
    return setTimeout(async () => {
      this.loading(true);
      await this.refreshContent();
      this.loading(false);
    });
  }

  async refreshContent() {
    const stats = await ApiHelper.getStats({
      size: MOST_RECENT_ITEMS,
    });
    const [
      knownFaces,
      labels,
      moderations,
      keyphrases,
      entities,
    ] = await Promise.all([
      this.aggregateKnownFaces(),
      this.aggregateLabels(),
      this.aggregateModerations(),
      this.aggregateKeyphrases(),
      this.aggregateEntities(),
    ]);

    await this.refreshOverallStats(stats);
    await this.refreshAggregations({
      [AGGS_TYPE_KNOWNFACES]: knownFaces.aggregations,
      [AGGS_TYPE_LABELS]: labels.aggregations,
      [AGGS_TYPE_MODERATIONS]: moderations.aggregations,
      [AGGS_TYPE_KEYPHRASES]: keyphrases.aggregations,
      [AGGS_TYPE_ENTITIES]: entities.aggregations,
    });
    return undefined;
  }

  async aggregateKnownFaces() {
    return ApiHelper.getStats({
      size: AGGREGATED_KNOWN_FACE_SIZE,
      aggregate: [
        AnalysisTypes.Rekognition.Celeb,
        AnalysisTypes.Rekognition.FaceMatch,
      ].join(','),
    });
  }

  async aggregateLabels() {
    return ApiHelper.getStats({
      size: AGGREGATED_LABEL_SIZE,
      aggregate: [
        AnalysisTypes.Rekognition.Label,
        AnalysisTypes.Rekognition.CustomLabel,
      ].join(','),
    });
  }

  async aggregateModerations() {
    return ApiHelper.getStats({
      size: AGGREGATED_MODERATION_SIZE,
      aggregate: [
        AnalysisTypes.Rekognition.Moderation,
      ].join(','),
    });
  }

  async aggregateKeyphrases() {
    return ApiHelper.getStats({
      size: AGGREGATED_KEYPHRASE_SIZE,
      aggregate: [
        AnalysisTypes.Comprehend.Keyphrase,
      ].join(','),
    });
  }

  async aggregateEntities() {
    return ApiHelper.getStats({
      size: AGGREGATED_ENTITY_SIZE,
      aggregate: [
        AnalysisTypes.Comprehend.Entity,
        AnalysisTypes.Comprehend.CustomEntity,
      ].join(','),
    });
  }

  async refreshOverallStats(data) {
    const container = this.tabContent.find(`#${ID_OVERALLGRAPH}`);
    container.children().remove();
    if (!data.stats.types) {
      return container.append($('<p/>').addClass('text-center text-muted')
        .append(Localization.Messages.NoData));
    }
    return container.append(await this.refreshOverallCountStats(data.stats.types))
      .append(await this.refreshOverallSizeStats(data.stats.types))
      .append(await this.refreshOverallStatusStats(data.stats.overallStatuses))
      .append(await this.refreshMostRecentStats(data.recents));
  }

  async refreshOverallCountStats(data) {
    if (this.overallCountGraph) {
      this.overallCountGraph.destroy();
    }
    const datasets = data.reduce((a0, c0) => a0.concat({
      name: c0.type,
      value: c0.count,
    }), []);
    const total = datasets.reduce((a0, c0) => a0 + c0.value, 0);
    const title = `${Localization.Messages.TotalCount} (${total} files)`;
    const graph = new PieGraph(title, datasets, {
      formatter: '<strong>{b}</strong>: {c} files ({d}%)',
    });
    this.overallCountGraph = graph;
    return $('<div/>').addClass('col-6 m-0 p-0')
      .append(graph.getGraphContainer());
  }

  async refreshOverallSizeStats(data) {
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
    const title = `${Localization.Messages.TotalSize} (${AppUtils.readableFileSize(total)})`;
    const graph = new PieGraph(title, datasets, {
      formatter: (point) =>
        `<strong>${point.data.name}:</strong> ${AppUtils.readableFileSize(point.data.value)}`,
    });
    this.overallSizeGraph = graph;
    return $('<div/>').addClass('col-6 m-0 p-0')
      .append(graph.getGraphContainer());
  }

  async refreshOverallStatusStats(data) {
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
    const title = `${Localization.Messages.WorkflowStatuses} (${total} processes)`;
    const graph = new PieGraph(title, datasets, {
      formatter: '<strong>{b}</strong>: {c} counts ({d}%)',
    });
    this.overallStatusGraph = graph;
    return $('<div/>').addClass('col-6 m-0 p-0')
      .append(graph.getGraphContainer());
  }

  async refreshMostRecentStats(data) {
    if (this.mostRecentGraph) {
      this.mostRecentGraph.destroy();
    }
    if (!data || !data.length) {
      return undefined;
    }
    const datasets = data.map(x => ({
      ...x,
      name: x.basename,
      value: x.fileSize,
    }));
    const title = `${Localization.Messages.MostRecentStats} (${data.length})`;
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
    return $('<div/>').addClass('col-6 m-0 p-0')
      .append(graph.getGraphContainer());
  }

  async refreshAggregations(data) {
    const container = this.tabContent.find(`#${ID_AGGREGATIONGRAPH}`);
    container.children().remove();
    if (!data) {
      return container.append($('<p/>').addClass('text-center text-muted')
        .append(Localization.Messages.NoData));
    }
    const aggs = await Promise.all(Object.keys(data).map((type) =>
      this.refreshAggregateByType(data[type], type)));
    return container.append(aggs);
  }

  async refreshAggregateByType(data, type) {
    if (this.aggsGraphs[type]) {
      this.aggsGraphs[type].destroy();
    }
    const datasets = data.reduce((a0, c0) =>
      a0.concat({
        name: c0.name,
        value: c0.count,
      }), []);
    const title = (type === AGGS_TYPE_KNOWNFACES)
      ? Localization.Messages.TopKnownFaces
      : (type === AGGS_TYPE_LABELS)
        ? Localization.Messages.TopLabels
        : (type === AGGS_TYPE_MODERATIONS)
          ? Localization.Messages.TopModerations
          : (type === AGGS_TYPE_KEYPHRASES)
            ? Localization.Messages.TopKeyphrases
            : (type === AGGS_TYPE_ENTITIES)
              ? Localization.Messages.TopEntities
              : undefined;
    const graph = new PieGraph(title, datasets, {
      formatter: '<strong>{b}</strong>: {c} documents',
    });
    this.aggsGraphs[type] = graph;
    return $('<div/>').addClass('col-6 m-0 p-0')
      .append(graph.getGraphContainer());
  }
}
