// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import BaseAnalysisTab from '../base/baseAnalysisTab.js';

export default class BaseComprehendTab extends BaseAnalysisTab {
  constructor(tabName, previewComponent, defaultTab = false) {
    super(tabName, previewComponent, defaultTab);
  }

  async createTimelineButtons(type) {
    const result = this.media.getComprehendResults();
    if (!(result[type] || {}).metadata) {
      return [];
    }
    const response = await this.download(result[type].metadata);
    if (!response) {
      return [];
    }
    const items = JSON.parse(response.Body);
    /* entity could return 'type' */
    const typedCategory = items[0].type ? {} : undefined;
    const typedlessCategory = [];
    while (items.length) {
      const item = items.shift();
      const btn = this.createButton(item);
      if (typedCategory) {
        typedCategory[item.type] = typedCategory[item.type] || [];
        typedCategory[item.type].push(btn);
      } else {
        typedlessCategory.push(btn);
      }
    }

    if (typedlessCategory.length > 0) {
      return typedlessCategory;
    }
    Object.keys(typedCategory).forEach((cat) => {
      typedlessCategory.push(this.createCategory(cat, typedCategory[cat].length));
      typedlessCategory.splice(typedlessCategory.length, 0, ...typedCategory[cat]);
    });
    return typedlessCategory;
  }

  createButton(item) {
    const displayName = `${item.text} (${Number.parseFloat(item.confidence).toFixed(2)})`;
    const begin = item.begin ? BaseComprehendTab.readableDuration(item.begin) : '--';
    const end = item.end ? BaseComprehendTab.readableDuration(item.end) : '--';
    const tooltip = `${begin} / ${end}`;
    const btn = $('<button/>').addClass('btn btn-sm btn-primary mb-1 ml-1')
      .attr('type', 'button')
      .attr('data-toggle', 'button')
      .attr('aria-pressed', false)
      .attr('autocomplete', 'off')
      .attr('data-mark-in', item.begin)
      .attr('data-mark-out', item.end)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', tooltip)
      .append(displayName)
      .tooltip({
        trigger: 'hover',
      });
    btn.off('click').on('click', async (event) => {
      await this.previewComponent.seek(item.begin / 1000);
    });
    return btn;
  }

  createCategory(cat, length) {
    return $('<span/>').addClass('lead d-block p-0 mt-2 mb-2 ml-1 text-capitalize')
      .append(`${cat} (${length})`);
  }
}
