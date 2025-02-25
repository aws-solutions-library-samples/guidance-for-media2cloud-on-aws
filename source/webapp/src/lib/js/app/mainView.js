// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from './shared/localization.js';
import AppUtils from './shared/appUtils.js';
import CollectionTab from './mainView/collectionTab.js';
import UploadTab from './mainView/uploadTab.js';
import ProcessingTab from './mainView/processingTab.js';
import StatsTab from './mainView/statsTab.js';
import FaceCollectionTab from './mainView/faceCollectionTab.js';
import SettingsTab from './mainView/settingsTab.js';
import UserManagementTab from './mainView/userManagementTab.js';
import {
  GetUserSession,
} from './shared/cognito/userSession.js';

const {
  SearchEngineVersion,
} = SolutionManifest;

const {
  Messages: {
    SolutionName: SOLUTION_NAME,
    CollectionTab: MSG_COLLECTION_TAB,
    UploadTab: MSG_UPLOAD_TAB,
    ProcessingTab: MSG_PROCESSING_TAB,
    StatsTab: MSG_STATS_TAB,
    FaceCollectionTab: MSG_FACECOLLECTION_TAB,
    SettingsTab: MSG_SETTINGS_TAB,
    UserManagementTab: MSG_USERMANAGEMENT_TAB,
  },
  Tooltips: {
    Logout: TOOLTIP_LOGOUT,
    VisitSolutionPage: TOOLTIP_SOLUTION_PAGE,
  },
} = Localization;

const [
  COLLECTION_TAB,
  UPLOAD_TAB,
  PROCESSING_TAB,
  STATS_TAB,
  FACECOLLECTION_TAB,
  SETTINGS_TAB,
  USERMANAGEMENT_TAB,
] = [
  MSG_COLLECTION_TAB,
  MSG_UPLOAD_TAB,
  MSG_PROCESSING_TAB,
  MSG_STATS_TAB,
  MSG_FACECOLLECTION_TAB,
  MSG_SETTINGS_TAB,
  MSG_USERMANAGEMENT_TAB,
].map((x) =>
  x.replaceAll(' ', ''));

const ORDERED_CONTROLLERS = [
  COLLECTION_TAB,
  UPLOAD_TAB,
  PROCESSING_TAB,
  STATS_TAB,
  FACECOLLECTION_TAB,
  SETTINGS_TAB,
  USERMANAGEMENT_TAB,
];

const RANDOM_ID = AppUtils.randomHexstring();
const ID_MAIN_CONTAINER = `main-${RANDOM_ID}`;
const ID_MAIN_TOASTLIST = `main-toast-${RANDOM_ID}`;
const ID_MAIN_TABLIST = `main-tabs-${RANDOM_ID}`;
const ID_MAIN_TABCONTENT = `main-content-${RANDOM_ID}`;

const SOLUTION_URL = 'https://aws.amazon.com/solutions/guidance/media2cloud-on-aws/';
const SOLUTION_ICON = '/images/m2c-short-white.png';

const HASSEARCHENGINE = (SearchEngineVersion === undefined || SearchEngineVersion.length > 0);

function parseHashtag(hashtag = '') {
  let tag = hashtag;

  if (tag[0] === '#') {
    tag = tag.slice(1);
  }

  const components = tag.split('/');
  const current = components[0];
  const next = components.slice(1).join('/');

  return {
    current,
    next,
  };
}

export default class MainView {
  constructor() {
    this.$view = $('<div/>')
      .attr('id', ID_MAIN_CONTAINER);
    this.$tabControllers = this.initTabControllersByGroup();
  }

  get view() {
    return this.$view;
  }

  get tabControllers() {
    return this.$tabControllers;
  }

  initTabControllersByGroup() {
    const tabControllers = {};

    const session = GetUserSession();

    /* read only access */
    if (session.canRead()) {
      tabControllers[COLLECTION_TAB] = new CollectionTab();
      tabControllers[PROCESSING_TAB] = new ProcessingTab();
      if (HASSEARCHENGINE) {
        tabControllers[STATS_TAB] = new StatsTab();
      }
    }
    /* read/write access */
    if (session.canWrite()) {
      tabControllers[UPLOAD_TAB] = new UploadTab();
      tabControllers[FACECOLLECTION_TAB] = new FaceCollectionTab();
      tabControllers[SETTINGS_TAB] = new SettingsTab();
    }
    /* read/write/modify access */
    if (session.canModify()) {
      tabControllers[USERMANAGEMENT_TAB] = new UserManagementTab();
    }

    return tabControllers;
  }

  appendTo(parent) {
    return parent.append(this.view);
  }

  async show(hashtag) {
    await this.hide();

    const navbar = $('<nav/>')
      .addClass('navbar navbar-expand-lg navbar-dark bg-dark')
      .append(this.createLogo())
      .append(this.createNavToggle())
      .append(this.createTabItems())
      .append(this.createLogoutIcon());
    this.view.append(navbar);

    this.view.append(this.createTabContents());
    this.view.append(this.createPadding());
    this.view.append(this.createToastLayer());

    return this._show(hashtag);
  }

  async _show(hashtag) {
    const {
      current,
      next,
    } = parseHashtag(hashtag);

    let name = current;
    if (this.tabControllers[name] === undefined) {
      name = COLLECTION_TAB;
    }

    return this.tabControllers[name].show(next);
  }

  async hide() {
    return Promise.all(Object.values(this.tabControllers)
      .map((tab) =>
        tab.hide()));
  }

  createLogo() {
    const solutionLink = $('<a/>').addClass('navbar-brand')
      .attr('href', SOLUTION_URL)
      .attr('target', '_blank')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_SOLUTION_PAGE)
      .css('font-size', '1rem');

    solutionLink.tooltip();
    return solutionLink.append($('<img/>').addClass('d-inline-block align-top')
      .attr('src', SOLUTION_ICON)
      .attr('height', 48)
      .attr('alt', SOLUTION_NAME));
  }

  createNavToggle() {
    const id = ID_MAIN_TABLIST;
    return $('<button/>').addClass('navbar-toggler')
      .attr('type', 'button')
      .attr('data-toggle', 'collapse')
      .attr('data-target', `#${id}`)
      .attr('aria-controls', id)
      .attr('aria-expanded', 'false')
      .attr('aria-label', 'Toggle navigation')
      .append($('<span/>').addClass('navbar-toggler-icon'));
  }

  createTabItems() {
    const id = ID_MAIN_TABLIST;

    const container = $('<div/>')
      .addClass('collapse navbar-collapse')
      .attr('id', id);

    const navbar = $('<div/>')
      .addClass('navbar-nav')
      .attr('role', 'tablist');
    container.append(navbar);

    ORDERED_CONTROLLERS.forEach((name) => {
      const tab = this.tabControllers[name];
      if (tab !== undefined) {
        navbar.append(tab.tabLink);
      }
    });

    return container;
  }

  createLogoutIcon() {
    const session = GetUserSession();

    const logout = $('<button/>')
      .addClass('btn btn-sm btn-link text-white')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', `${(session || {}).username}, ${TOOLTIP_LOGOUT}`)
      .css('font-size', '1rem')
      .tooltip();

    logout.on('click', async () => {
      await session.signOut();
      return window.location.reload();
    });

    const userIcon = $('<i/>')
      .addClass('fas fa-user-circle')
      .css('font-size', '2rem');
    logout.html(userIcon);

    return logout;
  }

  createTabContents() {
    const tabContents = $('<div/>')
      .addClass('tab-content')
      .attr('id', ID_MAIN_TABCONTENT);

    ORDERED_CONTROLLERS.forEach((name) => {
      const tab = this.tabControllers[name];
      if (tab !== undefined) {
        tabContents.append(tab.tabContent);
      }
    });

    return tabContents;
  }

  createPadding() {
    return $('<div/>').addClass('row no-gutters')
      .css('height', 100)
      .append($('<div/>').addClass('col-12 lead-sm d-flex justify-content-center align-self-center')
        .append($('<span/>').addClass('lead-sm mr-2')
          .append(`Version ${SolutionManifest.Version} (${SolutionManifest.LastUpdated})`)));
  }

  createToastLayer(id = ID_MAIN_TOASTLIST) {
    return $('<div/>').addClass('position-absolute w-100 d-flex flex-column')
      .css('z-index', 1000)
      .css('margin-left', '60%')
      .attr('id', id);
  }
}
