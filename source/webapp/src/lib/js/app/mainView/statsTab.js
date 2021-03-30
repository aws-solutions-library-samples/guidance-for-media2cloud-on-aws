import Localization from '../shared/localization.js';
import ApiHelper from '../shared/apiHelper.js';
import AppUtils from '../shared/appUtils.js';
import MediaFactory from '../shared/media/mediaFactory.js';
import PieGraph from './stats/pieGraph.js';
import mxSpinner from '../mixins/mxSpinner.js';
import BaseTab from '../shared/baseTab.js';

const ID_OVERALLGRAPH = `pie-${AppUtils.randomHexstring()}`;
const ID_MISC = `misc-${AppUtils.randomHexstring()}`;
const MOST_RECENT_ITEMS = 20;

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
    const misc = this.createMiscellaneous();
    const controls = this.createControls();
    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(description))
      .append($('<div/>').addClass('col-9 p-0 mx-auto')
        .append(overall))
      .append($('<div/>').addClass('col-12 p-0 m-0 p-0 bg-light')
        .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
          .append(misc)))
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

  createMiscellaneous() {
    const title = $('<span/>').addClass('d-block p-0 lead')
      .html(Localization.Messages.Miscellaneous);
    const misc = $('<div/>').addClass('col-12 p-0 mx-0 my-4')
      .attr('id', ID_MISC);
    return $('<div/>').addClass('col-12 p-0 m-0 mb-4')
      .append(title)
      .append(misc);
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
    const response = await ApiHelper.getStats({
      size: MOST_RECENT_ITEMS,
    });
    await this.refreshOverallStats(response);
    await this.refreshMiscellaneous(response);
    console.log(JSON.stringify(response, null, 2));
    return undefined;
  }

  async refreshOverallStats(data) {
    const container = this.tabContent.find(`#${ID_OVERALLGRAPH}`);
    if (this.overallCountGraph) {
      this.overallCountGraph.destroy();
    }
    if (this.overallSizeGraph) {
      this.overallSizeGraph.destroy();
    }
    container.children().remove();
    if (!data.overall.length) {
      return container.append($('<p/>').addClass('text-center text-muted')
        .append(Localization.Messages.NoData));
    }
    return container.append(await this.refreshOverallCountStats(data.overall))
      .append(await this.refreshOverallSizeStats(data.overall))
      .append(await this.refreshOverallStatusStats(data.overall))
      .append(await this.refreshMostRecentStats(data.recents));
  }

  async refreshOverallCountStats(data) {
    if (this.overallCountGraph) {
      this.overallCountGraph.destroy();
    }
    const datasets = data.reduce((a0, c0) => a0.concat({
      name: c0.type,
      value: c0.totalCount,
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
    const datasets = data.reduce((a0, c0) => a0.concat({
      name: c0.type,
      value: c0.totalSizeInKB,
    }), []);
    const total = datasets.reduce((a0, c0) => a0 + c0.value, 0);
    const title = `${Localization.Messages.TotalSize} (${AppUtils.readableFileSize(total * 1000)})`;
    const graph = new PieGraph(title, datasets, {
      formatter: (point) =>
        `<strong>${point.data.name}:</strong> ${AppUtils.readableFileSize(point.data.value * 1000)}`,
    });
    this.overallSizeGraph = graph;
    return $('<div/>').addClass('col-6 m-0 p-0')
      .append(graph.getGraphContainer());
  }

  async refreshOverallStatusStats(data) {
    if (this.overallStatusGraph) {
      this.overallStatusGraph.destroy();
    }
    let totalCount = 0;
    let errorCount = 0;
    let completedCount = 0;
    data.forEach((x) => {
      totalCount += x.totalCount;
      errorCount += (x.errorCount || 0);
      completedCount += (x.completedCount || 0);
    });
    const datasets = [
      {
        name: Localization.Statuses.Completed,
        value: completedCount,
      },
      {
        name: Localization.Statuses.Processing,
        value: totalCount - completedCount - errorCount,
      },
      {
        name: Localization.Statuses.Error,
        value: errorCount,
      },
    ];
    const title = `${Localization.Messages.WorkflowStatuses} (${totalCount} processes)`;
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

  async refreshMiscellaneous(data) {
    /* TODO: TO BE CONTINUED */
    /* TODO: TO BE CONTINUED */
    /* TODO: TO BE CONTINUED */
    const container = this.tabContent.find(`#${ID_MISC}`);
    container.children().remove();
    if (!data.largest.length && !data.longest.length) {
      return container.append($('<p/>').addClass('text-center text-muted')
        .append(Localization.Messages.NoData));
    }
    if (data.largest.length) {
      const largest = data.largest[0];
      const media = await MediaFactory.createMedia(largest.uuid);
      if (media) {
        const image = await media.getThumbnail();
      }
      const desc = $('<span/>').addClass('stats-misc')
        .append(Localization.Messages.LargestFile);
      container.append(desc);
    }
    if (data.longest.length) {
      const longest = $('<span/>').addClass('stats-misc')
        .append(Localization.Messages.LongestFile);
      container.append(longest);
    }
    return undefined;
  }
}
