// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData: {
    Statuses: {
      Removed,
    },
  },
  GraphDefs,
} = require('core-lib');
const Vertex = require('../vertex');
const BaseWorkflow = require('./base');

const {
  Vertices: {
    Asset,
  },
} = GraphDefs;

class AssetRemovalWorkflow extends BaseWorkflow {
  static isSupported(status) {
    return (status === Removed);
  }

  async process() {
    let response;

    if (this.output.status !== Removed) {
      return undefined;
    }

    const uuid = this.output.uuid;
    if (uuid) {
      const assetV = new Vertex(uuid, Asset);
      response = await assetV.drop(this.graph);
      console.log(
        '== delete vertex:',
        uuid,
        JSON.stringify(response)
      );
    }

    return response;
  }
}

module.exports = AssetRemovalWorkflow;
