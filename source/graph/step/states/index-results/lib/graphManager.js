// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  driver: {
    DriverRemoteConnection,
  },
  structure: {
    Graph,
  },
} = require('gremlin');
const Base = require('./base');

const NEPTUNE_ENDPOINT = process.env.ENV_NEPTUNE_ENDPOINT;

let _remoteConnection;

class GraphManager {
  constructor(endpoint = NEPTUNE_ENDPOINT) {
    this.$graph = undefined;

    try {
      const wss = `wss://${endpoint}/gremlin`;
      _remoteConnection = new DriverRemoteConnection(wss, {});

      const graph = new Graph();
      this.$graph = graph
        .traversal()
        .withRemote(_remoteConnection);
    } catch (e) {
      if (_remoteConnection) {
        _remoteConnection.close();
        _remoteConnection = undefined;
      }
      throw new Error('failed to create graph');
    }
  }

  get graph() {
    return this.$graph;
  }

  close() {
    console.log('finally... closing driver...');
    if (_remoteConnection !== undefined) {
      _remoteConnection.close();
      _remoteConnection = undefined;
    }
  }

  async dumpVertices() {
    return Base.dump(this.graph.V()
      .bothE()
      .dedup()
      .otherV());
  }

  async dumpEdges() {
    return Base.dump(this.graph.E()
      .bothV()
      .dedup());
  }
}

module.exports = GraphManager;
