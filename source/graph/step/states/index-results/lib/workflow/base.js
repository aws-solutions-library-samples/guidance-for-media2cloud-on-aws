// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const GraphManager = require('../graphManager');

class BaseWorkflow {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;
    this.$input = JSON.parse(event.detail.input);
    this.$output = JSON.parse(event.detail.output);
    this.$graphManager = new GraphManager();
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$contenxt;
  }

  get input() {
    return this.$input;
  }

  get output() {
    return this.$output;
  }

  get graphManager() {
    return this.$graphManager;
  }

  get graph() {
    return this.graphManager.graph;
  }

  static isSupported(data) {
    return false;
  }

  async process() {
    return undefined;
  }

  close() {
    if (this.graphManager) {
      this.graphManager.close();
    }
  }
}

module.exports = BaseWorkflow;
