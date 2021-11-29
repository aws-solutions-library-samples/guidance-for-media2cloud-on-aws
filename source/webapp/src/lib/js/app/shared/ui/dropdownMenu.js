// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../shared/localization.js';
import AppUtils from '../shared/appUtils.js';

const DROPDOWN_EVENTS = {
  Selected: {
    All: 'dropdown:select:all',
    Item: 'dropdown:select:item',
  },
  Deselected: {
    All: 'dropdown:deselect:all',
    Item: 'dropdown:deselect:item',
  },
};

export default class DropdownMenu {
  constructor(id = `menu-container-${AppUtils.randomHexstring()}`) {
    this.$containerId = id;
    this.$container = $('<div/>').addClass('form-group col-10 px-0 my-2')
      .attr('id', id);
  }

  static get Events() {
    return DROPDOWN_EVENTS;
  }

  get containerId() {
    return this.$containerId;
  }

  get container() {
    return this.$container;
  }

  createContent(datasets) {
    const id = `dropdown-${AppUtils.randomHexstring()}`;
    const dropdown = $('<div/>').addClass('dropdown mb-4')
      .append($('<button/>').addClass('col-4 btn btn-sm btn-outline-dark dropdown-toggle')
        .attr('type', 'button')
        .attr('id', id)
        .attr('data-toggle', 'dropdown')
        .attr('aria-haspopup', true)
        .attr('aria-expanded', false)
        .html(Localization.Messages.SelectLabels));
    const menu = $('<div/>').addClass('dropdown-menu col-4 lead-xs')
      .attr('aria-labelledby', id)
      .append($('<a/>').addClass('dropdown-item')
        .attr('href', '#')
        .attr('data-label', 'all')
        .html(Localization.Messages.SelectAll))
      .append($('<a/>').addClass('dropdown-item')
        .attr('href', '#')
        .attr('data-label', 'none')
        .html(Localization.Messages.SelectNone))
      .append($('<div/>').addClass('dropdown-divider'));

    datasets.map(x => x.label).forEach(x =>
      menu.append($('<a/>').addClass('dropdown-item label-item')
        .attr('href', '#')
        .attr('data-label', x)
        .html(x)));
    dropdown.append(menu);

    menu.find('a.dropdown-item').off('click').on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const item = $(event.currentTarget);
      const selected = item.data('label');
      if (selected === 'none') {
        menu.find('a.label-item').removeClass('active');
        return this.container.trigger(DROPDOWN_EVENTS.Deselected.All);
      }
      if (selected === 'all') {
        menu.find('a.label-item').addClass('active');
        return this.container.trigger(DROPDOWN_EVENTS.Selected.All);
      }
      if (item.hasClass('active')) {
        item.removeClass('active');
        return this.container.trigger(DROPDOWN_EVENTS.Deselected.Item, [selected.toString()]);
      }
      item.addClass('active');
      return this.container.trigger(DROPDOWN_EVENTS.Selected.Item, [selected.toString()]);
    });
    return this.container.append(dropdown);
  }
}
