// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AppUtils from '../shared/appUtils.js';
import Spinner from '../shared/spinner.js';

export default class BaseTab {
  constructor(title, defaultTab = false) {
    this.$defaultTab = defaultTab;
    this.$title = title;
    this.$identityGraph = undefined;
    this.$id = AppUtils.randomHexstring();
    this.$container = $('<section/>')
      .attr('id', `container-${this.$id}`)
      .addClass('row no-gutter')
      .addClass('mt-4');
  }

  get isDefault() {
    return this.$defaultTab;
  }

  get title() {
    return this.$title;
  }

  get identityGraph() {
    return this.$identityGraph;
  }

  set identityGraph(val) {
    this.$identityGraph = val;
  }

  get id() {
    return this.$id;
  }

  get container() {
    return this.$container;
  }

  createContent() {
    Spinner.createLoading();
    return this.container;
  }

  loading(enabled = true) {
    return Spinner.loading(enabled);
  }
}
