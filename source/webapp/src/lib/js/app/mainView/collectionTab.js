import Localization from '../shared/localization.js';
import AppUtils from '../shared/appUtils.js';
import VideoTab from './collection/videoTab.js';
import PhotoTab from './collection/photoTab.js';
import PodcastTab from './collection/podcastTab.js';
import DocumentTab from './collection/documentTab.js';
import SearchTab from './collection/searchTab.js';
import BaseTab from '../shared/baseTab.js';

export default class CollectionTab extends BaseTab {
  constructor(defaultTab = false) {
    super(Localization.Messages.CollectionTab, {
      selected: defaultTab,
    });

    this.$ids = {
      ...super.ids,
      plugins: `plugins-${AppUtils.randomHexstring()}`,
      tablist: `tablist-${AppUtils.randomHexstring()}`,
      tabcontent: `tabcontent-${AppUtils.randomHexstring()}`,
    };

    // reserve an area for sub-tab(s) to add additional menu item.
    const plugins = $('<div/>').attr('id', this.$ids.plugins);

    this.$tabControllers = [
      new VideoTab(true, plugins),
      new PhotoTab(false, plugins),
      new PodcastTab(false, plugins),
      new DocumentTab(false, plugins),
      new SearchTab(false, plugins),
    ].reduce((acc, cur) => ({
      ...acc,
      [cur.tabId]: cur,
    }), {});
    this.$plugins = plugins;
  }

  get ids() {
    return this.$ids;
  }

  get plugins() {
    return this.$plugins;
  }

  get tabControllers() {
    return this.$tabControllers;
  }

  async show() {
    if (!this.initialized) {
      const navbar = $('<nav/>').addClass('navbar navbar-expand-lg navbar-light bg-light')
        .append(this.createTabToggle())
        .append(this.createTabItems())
        .append(this.plugins);
      this.tabContent.append(navbar);
      this.tabContent.append(this.createTabContents());
      /* initialize the first shown tab */
      const id = this.tabContent.find('.tab-pane.active.show').first().attr('aria-labelledby');
      this.tabControllers[id].show();
    }
    return super.show();
  }

  createTabToggle() {
    const id = this.ids.tablist;
    return $('<button/>').addClass('navbar-toggler')
      .attr('type', 'button')
      .attr('data-toggle', 'collapse')
      .attr('data-target', `#${id}`)
      .attr('aria-controls', id)
      .attr('aria-expanded', 'false')
      .attr('aria-label', 'Collection tabs')
      .append($('<span/>').addClass('navbar-toggler-icon'));
  }

  createTabItems() {
    const id = this.ids.tablist;
    const navbar = $('<div/>').addClass('navbar-nav w-100')
      .attr('role', 'tablist');

    Object.values(this.tabControllers).forEach((controller) => {
      navbar.append(controller.tabLink);
    });

    return $('<div/>').addClass('collapse navbar-collapse')
      .attr('id', id)
      .append(navbar);
  }

  createTabContents() {
    const tabContents = $('<div/>').addClass('tab-content')
      .attr('id', this.ids.tabcontent);

    Object.values(this.tabControllers).forEach((controller) => {
      tabContents.append(controller.tabContent);
    });
    return tabContents;
  }
}
