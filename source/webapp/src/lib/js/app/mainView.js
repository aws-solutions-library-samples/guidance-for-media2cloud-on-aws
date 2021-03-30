import SolutionManifest from '/solution-manifest.js';
import Localization from './shared/localization.js';
import CognitoConnector from './shared/cognitoConnector.js';
import AppUtils from './shared/appUtils.js';
import CollectionTab from './mainView/collectionTab.js';
import UploadTab from './mainView/uploadTab.js';
import ProcessingTab from './mainView/processingTab.js';
import StatsTab from './mainView/statsTab.js';
import SettingsTab from './mainView/settingsTab.js';

const ID_MAIN_CONTAINER = `main-${AppUtils.randomHexstring()}`;
const ID_MAIN_TOASTLIST = `main-${AppUtils.randomHexstring()}`;
const ID_MAIN_TABLIST = `main-${AppUtils.randomHexstring()}`;
const ID_MAIN_TABCONTENT = `main-${AppUtils.randomHexstring()}`;
const SOLUTION_URL = 'https://aws.amazon.com/solutions/media2cloud/';
const SOLUTION_ICON = '/images/m2c-short-white.png';

export default class MainView {
  constructor() {
    this.$view = $('<div/>').attr('id', ID_MAIN_CONTAINER);
    this.$cognito = CognitoConnector.getSingleton();
    this.$tabControllers = [
      new CollectionTab(true),
      new UploadTab(),
      new ProcessingTab(),
      new StatsTab(),
      new SettingsTab(),
    ];
  }

  get view() {
    return this.$view;
  }

  get cognito() {
    return this.$cognito;
  }

  get tabControllers() {
    return this.$tabControllers;
  }

  appendTo(parent) {
    return parent.append(this.view);
  }

  async show() {
    await this.hide();
    const navbar = $('<nav/>').addClass('navbar navbar-expand-lg navbar-dark bg-dark')
      .append(this.createLogo())
      .append(this.createNavToggle())
      .append(this.createTabItems())
      .append(this.createLogoutIcon());
    this.view.append(navbar);
    this.view.append(this.createTabContents());
    this.view.append(this.createPadding());
    this.view.append(this.createToastLayer());
    return this.tabControllers[0].show();
  }

  async hide() {
    return Promise.all(this.tabControllers.map(tab => tab.hide()));
  }

  createLogo() {
    const solutionLink = $('<a/>').addClass('navbar-brand')
      .attr('href', SOLUTION_URL)
      .attr('target', '_blank')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.VisitSolutionPage)
      .css('font-size', '1rem');

    solutionLink.tooltip();
    return solutionLink.append($('<img/>').addClass('d-inline-block align-top')
      .attr('src', SOLUTION_ICON)
      .attr('height', 48)
      .attr('alt', Localization.Messages.SolutionName));
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
    const navbar = $('<div/>').addClass('navbar-nav')
      .attr('role', 'tablist');
    this.tabControllers.forEach(tab => navbar.append(tab.tabLink));
    return $('<div/>').addClass('collapse navbar-collapse')
      .attr('id', id)
      .append(navbar);
  }

  createLogoutIcon() {
    const logout = $('<button/>').addClass('btn btn-sm btn-link')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', `${this.cognito.user.username}, ${Localization.Tooltips.Logout}`)
      .css('font-size', '1rem')
      .html($('<i/>').addClass('fas fa-user-circle')
        .css('font-size', '2rem'));
    logout.tooltip();
    logout.off('click').click(() => {
      this.cognito.signOut();
      return window.location.reload();
    });
    return logout;
  }

  createTabContents() {
    const tabContents = $('<div/>').addClass('tab-content')
      .attr('id', ID_MAIN_TABCONTENT);
    this.tabControllers.forEach(tab =>
      tabContents.append(tab.tabContent));
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
