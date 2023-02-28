// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AppUtils from './shared/appUtils.js';
import BrandInteractionTab from './tabs/brandInteractionTab.js';
import HouseholdTab from './tabs/householdTab.js';

const ID_DEMOAPP = 'demo-app';
const TITLE_DEMO = 'Amazon Neptune Identity Graph Demo';
const DEMO_DESC = 'This demo presents how we use Amazon Neptune to create an identity graph and how we can query (walkthrough) the graph for specific use cases.';
const DEMO_DATASET_DESC = '<p>The dataset used for this demo comes from <strong>CIKM Cup 2016 Track 1: Cross Device Entity Linking Challenge</strong>, https://competitions.codalab.org/competitions/11171</p><p>The dataset contains an <strong>anonymized</strong> browse log for a set of anonymized userIDs representing the same user across multiple devices, as well as <strong>obfuscated</strong> site URLs and HTML titles those users visited. There are not much of user attributes, so they had to be generated artificially.</p><p>The graph contains roughly <strong>15M nodes</strong> such as Household (identityGroup), User ID (persistentId), Device ID (transientId), website, and IAB Category (websiteGroup). It also constructs over <strong>80M edges (relationships)</strong> among nodes.</p>';

export default class DemoApp {
  constructor(parentId) {
    this.$parentId = parentId;
    this.$tabControllers = [
      new HouseholdTab(true),
      new BrandInteractionTab(),
    ];
  }

  get parentId() {
    return this.$parentId;
  }

  get tabControllers() {
    return this.$tabControllers;
  }

  async show() {
    const parent = $(`#${this.parentId}`);

    const container = $('<div/>').addClass('row no-gutters');
    parent.append(container);

    const title = this.createTitle();
    container.append(title);

    const tablist = this.createTabList();
    container.append(tablist);

    return parent;
  }

  async hide() {
    this.graphs.forEach((graph) => {
      if (graph) {
        graph.dispose();
      }
    });
    this.graphs.length = 0;
  }

  resize() {
    this.graphs.forEach((graph) => {
      if (graph) {
        graph.resize();
      }
    });
  }

  static randomHexstring() {
    const rnd = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(rnd);
    return rnd[0].toString(16);
  }

  createTitle() {
    const container = $('<section/>')
      .addClass('col-9 m-0 p-0 mx-auto');

    const title = $('<h3/>')
      .addClass('mt-4 text-center')
      .append(TITLE_DEMO);
    container.append(title);

    const desc = $('<p/>')
      .addClass('lead mt-4')
      .html(DEMO_DESC);
    container.append(desc);

    const datasetDesc = $('<p/>')
      .addClass('h4 my-4')
      .append('Dataset');
    container.append(datasetDesc);

    container.append(DEMO_DATASET_DESC);

    return container;
  }

  createTabList() {
    const container = $('<section/>')
      .addClass('col-9 m-0 p-0 mx-auto mt-4');

    const id = AppUtils.randomHexstring();
    const tabItems = this.tabControllers
      .map((tabController, idx) => {
        const num = idx + 1;
        const itemId = `usercase-${id}-${num}`;
        const contentId = `usercase-content-${id}-${num}`;
        const name = `Usecase ${num}: ${tabController.title}`;
        const anchor = $('<a/>')
          .addClass('nav-link')
          .attr('id', itemId)
          .attr('data-toggle', 'tab')
          .attr('href', `#${contentId}`)
          .attr('role', 'tab')
          .attr('aria-controls', contentId)
          .attr('aria-selected', tabController.isDefault.toString())
          .append($('<span/>')
            .addClass('lead-s')
            .append(name));
        const tabLink = $('<li/>').addClass('nav-item')
          .append(anchor);

        const content = tabController.createContent();
        const tabContent = $('<div/>').addClass('tab-pane fade')
          .attr('id', contentId)
          .attr('role', 'tabpanel')
          .attr('aria-labelledby', itemId)
          .append(content);
        if (tabController.isDefault) {
          anchor.addClass('active');
          tabContent.addClass('show active');
        }
        return [
          tabLink,
          tabContent,
        ];
      });

    const tabListId = `tab-${id}`;
    const tabList = $('<ul/>')
      .addClass('nav nav-tabs')
      .attr('id', tabListId)
      .attr('role', 'tablist');
    container.append(tabList);

    const tabContentId = `tabcontent-${id}`;
    const tabContent = $('<div/>')
      .addClass('tab-content')
      .attr('id', tabContentId);
    tabList.append(tabItems.map((x) => x[0]));
    tabContent.append(tabItems.map((x) => x[1]));
    container.append(tabContent);

    return container;
  }
}

$(document).ready(async () => {
  const demoApp = new DemoApp(ID_DEMOAPP);

  $(window).on('unload', async () => {
    console.log('app unloading...');
    await demoApp.hide();
  });
  await demoApp.show();
});
