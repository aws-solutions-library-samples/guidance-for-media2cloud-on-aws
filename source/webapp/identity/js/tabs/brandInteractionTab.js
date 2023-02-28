// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import NodeTypes from '../shared/nodeTypes.js';
import IdentityGraph from '../shared/identityGraph.js';
import AppUtils from '../shared/appUtils.js';
import BaseTab from './baseTab.js';

const TITLE = 'Brand interactions';
const DESC_TITLE = 'Advertisers want to generate audiences for demand-side platform (DSP) platform targeting. Specific audience could be the users who are interested in specific topics';
const DESC_DETAILS = 'Given a domain (ie. UKTV Play), traverse nodes to all device IDs, and traverse to all sub-pages from each device that has visited. This can be used to understand a specific journey such as a subscription flow that the audience went through; i.e, who has started the subscription process but never completed.';

export default class BrandInteractionTab extends BaseTab {
  constructor(defaultTab) {
    super(TITLE, defaultTab);
  }

  createContent() {
    this.container.children().remove();

    const desc = this.createDescription();
    this.container.append(desc);

    const select = this.createSelectForm();
    this.container.append(select);

    const identityGraph = this.createIdentityGraph();
    this.container.append(identityGraph);

    return super.createContent();
  }

  createDescription() {
    const container = $('<section/>')
      .addClass('col-12 mt-4');

    let desc = $('<p>')
      .addClass('font-weight-bold')
      .append(DESC_TITLE);
    container.append(desc);

    desc = $('<p/>')
      .addClass('font-weight-bold')
      .append('');
    container.append(desc);
    desc = $('<p/>')
      .addClass('text-muted')
      .html(DESC_DETAILS);
    container.append(desc);

    return container;
  }

  createSelectForm() {
    const container = $('<section/>')
      .addClass('col-12');

    const formContainer = $('<form/>')
      .addClass('px-0 form-inline needs-validation')
      .attr('novalidate', 'novalidate')
      .attr('role', 'form');
    container.append(formContainer);

    const select = $('<select/>')
      .addClass('custom-select custom-select-sm col-3 mr-1');
    formContainer.append(select);

    select.ready(async () => {
      await this.updateSelectOptions(select);
    });

    select.on('change', async () => {
      try {
        if (!this.identityGraph) {
          return;
        }
        this.identityGraph.resetGraph();

        const val = select.val();
        if (val === 'undefined') {
          return;
        }
        const dataset = await this.getWebsites(val);
        await this.identityGraph.updateGraph(dataset);
      } catch (e) {
        console.error(e);
      }
    });

    /* refresh */
    const btnRefresh = $('<button/>')
      .addClass('btn btn-sm btn-outline-dark mr-1')
      .append($('<i/>')
        .addClass('fas fa-sync-alt'));
    formContainer.append(btnRefresh);

    btnRefresh.on('click', async (event) => {
      event.preventDefault();
      await this.updateSelectOptions(select);
      return false;
    });

    /* all devices */
    const btnAllDevices = $('<button/>')
      .addClass('btn btn-sm btn-outline-success')
      .append('All devices');
    formContainer.append(btnAllDevices);

    /* stats group */
    const btnGroup = $('<div/>')
      .addClass('btn-group col-7 ml-auto')
      .attr('role', 'group')
      .attr('aria-label', 'Button group');
    formContainer.append(btnGroup);

    /* select 'from' */
    const selectFrom = $('<select/>')
      .addClass('custom-select custom-select-sm col-4 mr-1')
      .data('default', 'Choose a website to compare...');
    btnGroup.append(selectFrom);

    selectFrom.ready(async () => {
      await this.updateWebsiteSelectOptions(selectFrom);
    });

    /* select 'to' */
    const selectTo = $('<select/>')
      .addClass('custom-select custom-select-sm col-4 mr-1')
      .data('default', 'Choose a different website...');
    btnGroup.append(selectTo);

    selectTo.ready(async () => {
      await this.updateWebsiteSelectOptions(selectTo);
    });

    btnAllDevices.on('click', async (event) => {
      event.preventDefault();
      await this.renderAllDevices();
      await this.updateWebsiteSelectOptions(selectFrom);
      await this.updateWebsiteSelectOptions(selectTo);
      return false;
    });

    const popoverId = `popover-${this.id}`;
    const btnStats = $('<button/>')
      .addClass('btn btn-sm btn-outline-dark mr-2')
      .attr('type', 'button')
      .attr('title', 'Stats')
      .attr('data-container', 'body')
      .attr('data-toggle', 'popover')
      .attr('data-placement', 'bottom')
      .attr('data-trigger', 'focus')
      .attr('data-html', true)
      .attr('data-content', `<div id="${popoverId}"></div>`)
      .append('Show stats');
    btnGroup.append(btnStats);

    btnStats.on('click', (event) =>
      btnStats.popover('toggle'));

    btnStats.on('inserted.bs.popover', (event) => {
      const to = selectTo.val();
      const from = selectFrom.val();
      this.updatePopoverStats(from, to);
    });

    $('.popover-dismiss').popover({
      trigger: 'focus',
    });
    return container;
  }

  createIdentityGraph() {
    const container = $('<section/>')
      .addClass('mx-auto mt-4');

    if (this.identityGraph) {
      this.identityGraph.destroy();
    }

    this.identityGraph = new IdentityGraph(container, this);
    return container;
  }

  async updateSelectOptions(select) {
    try {
      this.loading(true);
      select.prop('disabled', 'disabled');
      select.children().remove();
      const option = $('<option/>')
        .attr('value', 'undefined')
        .append('Choose a website domain to start...');
      select.append(option);

      const websiteGroups = await this.getWebsiteGroups()
        .then((res) =>
          res.sort((a, b) =>
            a.category[0].localeCompare(b.category[0])));

      const options = websiteGroups.map((x) => {
        const text = `(${x.category[0]}) ${x.url[0]} [${x.connected}]`;
        return $('<option/>')
          .attr('value', x.url[0])
          .append(text);
      });
      select.append(options);
    } catch (e) {
      console.error(e);
    } finally {
      select.prop('disabled', false);
      this.loading(false);
    }
  }

  async updateWebsiteSelectOptions(select) {
    try {
      this.loading(true);
      select.prop('disabled', 'disabled');
      select.children().remove();

      const text = select.data('default');
      const option = $('<option/>')
        .attr('value', 'undefined')
        .append(text);
      select.append(option);

      if (!this.identityGraph) {
        return;
      }
      const series = this.identityGraph.getGraphSeries();
      if (!series) {
        return;
      }

      const ids = (series.nodes || series.data || [])
        .filter((x) =>
          x.value[0].label === NodeTypes.NODE_WEBSITE)
        .sort((a, b) =>
          a.value[0].id.localeCompare(b.value[0].id));
      const options = ids.map((x) =>
        $('<option/>')
          .attr('value', x.id)
          .append(`${x.value[0].id} (${(x.value[1].visited || []).length})`));
      select.append(options);
    } catch (e) {
      console.error(e);
    } finally {
      select.prop('disabled', false);
      this.loading(false);
    }
  }

  async renderAllDevices() {
    try {
      this.loading(true);
      if (!this.identityGraph) {
        return;
      }
      const series = this.identityGraph.getGraphSeries() || {};
      const seriesData = series.nodes || series.data;
      if (!seriesData) {
        return;
      }
      const ids = seriesData
        .filter((x) =>
          x.value[0].label === NodeTypes.NODE_WEBSITE)
        .map((x) =>
          x.value[0].id);
      const dataset = await IdentityGraph.graphApi({
        op: 'identity',
        type: 'vertice',
        id: ids.join(','),
        start: undefined,
        end: undefined,
        label: NodeTypes.NODE_TRANSIENT_ID,
        direction: 'in',
      });
      await this.identityGraph.updateGraph(dataset);
    } catch (e) {
      console.error(e);
    } finally {
      this.loading(false);
    }
  }

  updatePopoverStats(from, to) {
    if (!this.identityGraph) {
      return;
    }
    const series = this.identityGraph.getGraphSeries() || {};
    const seriesData = series.nodes || series.data;
    if (!seriesData) {
      return;
    }

    const popoverId = `popover-${this.id}`;
    const popoverContainer = $(`#${popoverId}`);
    popoverContainer.children().remove();

    const table = $('<table/>')
      .addClass('table table-striped');
    popoverContainer.append(table);

    const tbody = $('<tbody/>');
    table.append(tbody);

    /* total users */
    const totalNodes = seriesData.filter((x) =>
      x.value[0].label === NodeTypes.NODE_TRANSIENT_ID);
    let row = this.makeStatsRow('Total users visited the domain', totalNodes.length, totalNodes);
    tbody.append(row);

    let fromNode;
    let fromConnected;
    let toNode;
    let toConnected;
    if (from !== 'undefined') {
      fromNode = seriesData[Number(from)];
      fromConnected = (fromNode.value[1].visited || [])
        .map((x) =>
          seriesData[x]);
      row = this.makeStatsRow('Site A', fromNode.value[0].id, fromConnected);
      tbody.append(row);
    }
    if (to !== 'undefined') {
      toNode = seriesData[Number(to)];
      toConnected = (toNode.value[1].visited || [])
        .map((x) =>
          seriesData[x]);
      row = this.makeStatsRow('Site B', toNode.value[0].id, toConnected);
      tbody.append(row);
    }

    /* users visited both */
    if (fromConnected && toConnected) {
      const fromIds = fromConnected.map((x) =>
        x.value[0].id);
      const toIds = toConnected.map((x) =>
        x.value[0].id);

      const visitedBoth = fromConnected.filter((x) =>
        toIds.includes(x.value[0].id));
      row = this.makeStatsRowBase('Users visited A and B', visitedBoth.length, visitedBoth);
      tbody.append(row);

      const visitedFrom = fromConnected.filter((x) =>
        !toIds.includes(x.value[0].id));
      row = this.makeStatsRowBase('Users visited A only', visitedFrom.length, visitedFrom);
      tbody.append(row);

      const visitedTo = toConnected.filter((x) =>
        !fromIds.includes(x.value[0].id));
      row = this.makeStatsRowBase('Users visited B only', visitedTo.length, visitedTo);
      tbody.append(row);
    }
  }

  makeStatsRow(scope, id, item) {
    const text = `${AppUtils.shorten(id, 24)} (${item.length})`;

    return this.makeStatsRowBase(scope, text, item);
  }

  makeStatsRowBase(scope, text, item) {
    let devices = {};
    item.forEach((x) => {
      if (devices[x.value[0].device] === undefined) {
        devices[x.value[0].device] = 0;
      }
      devices[x.value[0].device] += 1;
    });
    devices = Object.keys(devices)
      .sort((a, b) =>
        a.localeCompare(b))
      .map((x) =>
        `${x} (${devices[x]})`)
      .join(', ');

    let users = item
      .sort((a, b) =>
        b.value[1].visited.length - a.value[1].visited.length)
      .map((x) => ({
        email: x.value[0].email,
        visited: x.value[1].visited.length,
      }));
    users = users.slice(0, 5)
      .map((x) =>
        `${x.email} (${x.visited})`)
      .join(', ');

    return $('<tr/>')
      .append($('<th/>')
        .attr('scope', 'row')
        .append(scope))
      .append($('<td/>')
        .append(text))
      .append($('<td/>')
        .append(`${devices} ...`))
      .append($('<td/>')
        .append(`${users} ...`));
  }

  async getWebsiteGroups() {
    return IdentityGraph.graphApi({
      op: 'identity',
      type: 'vertice',
      label: NodeTypes.NODE_WEBSITE_GROUP,
      start: 0,
      end: 400,
      aggregate: true,
      maxResults: 30,
    });
  }

  async getWebsites(url) {
    return IdentityGraph.graphApi({
      op: 'identity',
      type: 'vertice',
      label: NodeTypes.NODE_WEBSITE,
      textP: JSON.stringify({
        url,
      }),
      start: 0,
      end: 50,
    });
  }
}
