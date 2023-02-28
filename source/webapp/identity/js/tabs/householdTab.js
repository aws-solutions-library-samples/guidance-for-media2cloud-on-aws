// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import NodeTypes from '../shared/nodeTypes.js';
import IdentityGraph from '../shared/identityGraph.js';
import BaseTab from './baseTab.js';

const TITLE = 'Household members';
const DESC_TITLE = 'Advertisers want to find out information about user interests to provide an accurate targeting. The data should be based on the activity of the user across all devices.';
const DESC_DETAILS = 'Given a device ID (ie. iPad), traverse that graph from a device to a user (owner) and to a user group (Household or Company). Then, traverse from a household to all users belongs to the same household, to all devices, to all visited websites, and to the corresponding IAB categories.';

export default class HouseholdTab extends BaseTab {
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
      .addClass('custom-select custom-select-sm col-4 mr-1');
    formContainer.append(select);

    select.ready(async () => {
      await this.updateSelectOptions(select);
    });

    select.on('change', async () => {
      try {
        this.loading(true);

        if (!this.identityGraph) {
          return;
        }
        this.identityGraph.resetGraph();

        const val = select.val();
        if (val === 'undefined') {
          return;
        }
        const dataset = await this.getUserId(val);
        this.identityGraph.updateGraph(dataset);
      } catch (e) {
        console.error(e);
      } finally {
        this.loading(false);
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

    /* render all */
    const btnRenderAll = $('<button/>')
      .addClass('btn btn-sm btn-outline-success')
      .append('Render all');
    formContainer.append(btnRenderAll);

    btnRenderAll.on('click', async (event) => {
      event.preventDefault();
      await this.renderAll();
      return false;
    });

    /* top ten IAB categories */
    const btnGroup = $('<div/>')
      .addClass('btn-group ml-auto')
      .attr('role', 'group')
      .attr('aria-label', 'Button group');
    formContainer.append(btnGroup);

    const popoverId = `popover-${this.id}`;
    const btnIAB = $('<button/>')
      .addClass('btn btn-sm btn-outline-dark mr-2')
      .attr('type', 'button')
      .attr('title', 'Stats')
      .attr('data-container', 'body')
      .attr('data-toggle', 'popover')
      .attr('data-placement', 'bottom')
      .attr('data-trigger', 'focus')
      .attr('data-html', true)
      .attr('data-content', `<div id="${popoverId}"></div>`)
      .append('Most popular interests');
    btnGroup.append(btnIAB);

    btnIAB.on('click', (event) =>
      btnIAB.popover('toggle'));

    btnIAB.on('inserted.bs.popover', (event) => {
      this.updatePopoverStats();
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
        .append('Choose a device ID to start...');
      select.append(option);

      let devices = await this.getDeviceIds();
      /* filter out Other devices */
      devices = devices.filter((x) =>
        x.device[0] !== 'Other');

      const options = devices.map((x) => {
        const text = `${x.device[0]} (${x.id})`;
        return $('<option/>')
          .attr('value', x.id)
          .append(text);
      });
      select.append(options);
    } catch (e) {
      console.error(e);
    } finally {
      this.loading(false);
      select.prop('disabled', false);
    }
  }

  updatePopoverStats() {
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

    let row;
    const userNodes = seriesData
      .filter((x) =>
        x.value[0].label === NodeTypes.NODE_PERSISTENT_ID);
    row = this.makeStatsRow('>', 'Total users', userNodes.length);
    tbody.append(row);

    const deviceNodes = seriesData
      .filter((x) =>
        x.value[0].label === NodeTypes.NODE_TRANSIENT_ID);
    row = this.makeStatsRow('>', 'Total devices', deviceNodes.length);
    tbody.append(row);

    let devices = {};
    deviceNodes.forEach((x) => {
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
    row = this.makeStatsRow('>', 'Device types', devices);
    tbody.append(row);

    const websiteGroupNodes = seriesData
      .filter((x) =>
        x.value[0].label === NodeTypes.NODE_WEBSITE_GROUP)
      .sort((a, b) =>
        b.value[1].links_to.length - a.value[1].links_to.length);
    row = this.makeStatsRow('#', 'Total IAB categories', websiteGroupNodes.length);
    tbody.append(row);

    const rows = websiteGroupNodes
      .slice(0, 10)
      .map((x, idx) =>
        this.makeStatsRow(idx + 1, x.value[0].name, x.value[1].links_to.length));
    tbody.append(rows);
  }

  makeStatsRow(scope, key, value) {
    return $('<tr/>')
      .append($('<th/>')
        .attr('scope', 'row')
        .append(scope))
      .append($('<td/>')
        .append(key))
      .append($('<td/>')
        .append(value));
  }

  async renderAll() {
    try {
      this.loading(true);
      if (!this.identityGraph) {
        return;
      }

      let series = this.identityGraph.getGraphSeries() || {};
      let seriesData = series.nodes || series.data;
      if (!seriesData) {
        return;
      }

      let dataset;
      /* find houshold first */
      let householdNode = seriesData.find((x) =>
        x.value[0].label === NodeTypes.NODE_IDENTITY_GROUP);
      if (!householdNode) {
        const userNode = seriesData.find((x) =>
          x.value[0].label === NodeTypes.NODE_PERSISTENT_ID);
        if (!userNode) {
          console.log('[ERR]: renderAll: cannot find any node to continue');
          return;
        }
        dataset = await this.getHousehold(userNode.value[0].id);
        series = this.identityGraph.updateGraph(dataset);
        seriesData = series.nodes || series.data;

        householdNode = seriesData.find((x) =>
          x.value[0].label === NodeTypes.NODE_IDENTITY_GROUP);
        if (!householdNode) {
          console.log('[ERR]: renderAll: still cannot find household node');
          return;
        }
      }

      /* from houshold, find all users */
      dataset = await this.getConnectedUsers(householdNode);
      series = this.identityGraph.updateGraph(dataset);
      seriesData = series.nodes || series.data;

      /* from users, find all devices */
      const userNodes = seriesData.filter((x) =>
        x.value[0].label === NodeTypes.NODE_PERSISTENT_ID);
      dataset = await this.getConnectedDevices(userNodes);
      series = this.identityGraph.updateGraph(dataset);
      seriesData = series.nodes || series.data;

      /* from devices, find all websites */
      const deviceNodes = seriesData.filter((x) =>
        x.value[0].label === NodeTypes.NODE_TRANSIENT_ID);
      dataset = await this.getConnectedWebsites(deviceNodes);
      series = this.identityGraph.updateGraph(dataset);
      seriesData = series.nodes || series.data;

      /* from websites, find all IAB category */
      const websiteNodes = seriesData.filter((x) =>
        x.value[0].label === NodeTypes.NODE_WEBSITE);
      dataset = await this.getConnectedWebsiteGroup(websiteNodes);
      series = this.identityGraph.updateGraph(dataset);
      seriesData = series.nodes || series.data;
    } catch (e) {
      console.error(e);
    } finally {
      this.loading(false);
    }
  }

  async getHousehold(id) {
    return IdentityGraph.graphApi({
      op: 'identity',
      type: 'vertice',
      id,
      start: 0,
      end: 10,
      label: NodeTypes.NODE_IDENTITY_GROUP,
      direction: 'both',
    });
  }

  async getConnectedUsers(householdNode) {
    return IdentityGraph.graphApi({
      op: 'identity',
      type: 'vertice',
      id: householdNode.value[0].id,
      label: NodeTypes.NODE_PERSISTENT_ID,
      start: 0,
      end: 10,
      direction: 'out',
    });
  }

  async getConnectedDevices(userNodes) {
    const ids = userNodes.map((x) =>
      x.value[0].id);

    return IdentityGraph.graphApi({
      op: 'identity',
      type: 'vertice',
      id: ids.join(','),
      label: NodeTypes.NODE_TRANSIENT_ID,
      start: 0,
      end: 200,
      direction: 'both',
    });
  }

  async getConnectedWebsites(deviceNodes) {
    const ids = deviceNodes.map((x) =>
      x.value[0].id);

    return IdentityGraph.graphApi({
      op: 'identity',
      type: 'vertice',
      id: ids.join(','),
      label: NodeTypes.NODE_WEBSITE,
      direction: 'out',
      start: 0,
      end: 1000,
    });
  }

  async getConnectedWebsiteGroup(websiteNodes) {
    const ids = websiteNodes.map((x) =>
      x.value[0].id);

    const dataset = [];
    while (ids.length) {
      const spliced = ids.splice(0, 40);
      const subset = await IdentityGraph.graphApi({
        op: 'identity',
        type: 'vertice',
        id: spliced.join(','),
        label: NodeTypes.NODE_WEBSITE_GROUP,
        direction: 'in',
      });
      dataset.splice(dataset.length, 0, ...subset);
    }
    return dataset;
  }

  async getDeviceIds() {
    return IdentityGraph.graphApi({
      op: 'identity',
      type: 'vertice',
      label: NodeTypes.NODE_TRANSIENT_ID,
      start: 0,
      end: 50,
    });
  }

  async getUserId(id) {
    return IdentityGraph.graphApi({
      op: 'identity',
      type: 'vertice',
      id,
      label: [
        NodeTypes.NODE_PERSISTENT_ID,
        NodeTypes.NODE_IP,
      ].join(','),
      start: 0,
      end: 20,
      direction: 'both',
    });
  }
}
