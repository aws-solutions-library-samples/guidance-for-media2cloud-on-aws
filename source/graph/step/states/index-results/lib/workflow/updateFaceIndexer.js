// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  GraphDefs,
} = require('core-lib');
const Vertex = require('../vertex');
const BaseWorkflow = require('./base');

const {
  Vertices: {
    Celeb,
  },
} = GraphDefs;

async function _dropFaceId(g, faceId) {
  let id = faceId.replaceAll('-', '');
  id = `${id}-${Celeb}`;

  const celebV = new Vertex(id, Celeb);
  return celebV.drop(g)
    .then((res) => {
      console.log(
        '== delete vertex:',
        id,
        faceId,
        JSON.stringify(res)
      );
      return res;
    })
    .catch((e) => {
      console.log(
        '== ERR: deleting vertex:',
        id,
        faceId,
        e
      );
      return undefined;
    });
}

async function _updateFaceName(g, faceId, name) {
  let id = faceId.replaceAll('-', '');
  id = `${id}-${Celeb}`;

  const celebV = new Vertex(id, Celeb);
  return celebV.update(g, 'name', name)
    .then((res) => {
      console.log(
        '== update vertex:',
        id,
        name,
        JSON.stringify(res)
      );
      return res;
    })
    .catch((e) => {
      console.log(
        '== ERR: updating vertex:',
        id,
        name,
        e
      );
      return undefined;
    });
}

class UpdateFaceIndexerWorkflow extends BaseWorkflow {
  async process() {
    const g = this.graph;
    const updated = this.output.input.updated;
    const deleted = this.output.input.deleted;

    if (deleted && deleted.length > 0) {
      await Promise.all(deleted
        .map((item) =>
          _dropFaceId(g, item.faceId)));
    }

    if (updated && updated.length > 0) {
      await Promise.all(updated
        .map((item) =>
          _updateFaceName(g, item.faceId, item.celeb)));
    }

    return undefined;
  }
}

module.exports = UpdateFaceIndexerWorkflow;
