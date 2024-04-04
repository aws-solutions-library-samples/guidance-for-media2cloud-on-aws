// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  StateData: {
    Statuses: {
      IngestCompleted,
    },
  },
  CommonUtils,
  GraphDefs,
} = require('core-lib');
const Vertex = require('../vertex');
const Edge = require('../edge');
const BaseWorkflow = require('./base');

const {
  Vertices: {
    Asset,
    Group,
    Attribute,
    Checksum,
  },
  Edges: {
    BelongTo,
    HasAttribute,
    HasChecksum,
  },
} = GraphDefs; // require('../constants');

class IngestWorkflow extends BaseWorkflow {
  static isSupported(status) {
    return (status === IngestCompleted);
  }

  async process() {
    const graph = this.graph;
    const data = this.output;

    if (this.output.status !== IngestCompleted) {
      return undefined;
    }

    const bucket = data.input.bucket;
    const key = data.input.key;

    const metadata = await CommonUtils.headObject(
      bucket,
      key
    );

    let props = {
      type: data.input.type,
      status: data.status,
      key,
      name: PATH.parse(key).name,
      mime: data.input.mime || metadata.ContentType,
      fileSize: Number(metadata.ContentLength),
      lastModified: new Date(metadata.LastModified).getTime(),
    };

    /* V: asset */
    const assetV = new Vertex(data.uuid, Asset, props);

    ['duration', 'framerate']
      .forEach((x) => {
        if (data.input[x] !== undefined) {
          assetV.setProperty(x, data.input[x]);
        }
      });

    if (data.data.docinfo !== undefined) {
      assetV.setProperty('numPages', data.data.docinfo.numPages);
    }

    let chained = graph;
    chained = assetV.upsert(chained);

    /* V: group */
    if (data.input.group) {
      const groupName = data.input.group;
      const groupId = [
        Buffer.from(groupName).toString('hex'),
        Group,
      ].join('-');

      props = {
        name: groupName,
      };

      const groupV = new Vertex(groupId, Group, props);
      chained = groupV.upsert(chained);

      /* E: asset -> group */
      const groupE = Edge.fromVertices(BelongTo, assetV, groupV);
      chained = groupE.upsert(chained);
    }

    /* V: checksum (for dedup use case?) */
    const checksumId = data.data.checksum.computed;
    props = {
      name: checksumId,
      algorithm: data.data.checksum.algorithm,
    };
    const checksumV = new Vertex(checksumId, Checksum, props);
    chained = checksumV.upsert(chained);

    /* E: asset -> checksum */
    const checksumE = Edge.fromVertices(HasChecksum, assetV, checksumV);
    chained = checksumE.upsert(chained);

    /* attributes */
    const attrs = data.input.attributes || {};
    const attrNames = Object.keys(attrs)
      .filter((x) =>
        x !== 'group');
    attrNames.forEach((name) => {
      /* V: attribute */
      const attrId = [
        Buffer.from(attrs[name]).toString('hex').substring(0, 248),
        Attribute,
      ].join('-');
      props = {
        name: attrs[name],
      };
      const attrV = new Vertex(attrId, Attribute, props);
      chained = attrV.upsert(chained);

      /* E: asset -> attribute */
      const attrE = Edge.fromVertices(HasAttribute, assetV, attrV);
      chained = attrE.upsert(chained);
    });

    const response = await chained.iterate();
    console.log('== chained', JSON.stringify(response));

    /* debug: dump graph structure */
    const dbg = await assetV.dump(this.graph);
    console.log('== ingest - dump graph', assetV.id);
    dbg.forEach((x) => {
      console.log(`${x[0].name[0]} (${x[0].label}) -> ${x[1].label} -> ${x[2].name[0]} (${x[2].label})`);
    });
    console.log('Total connections', dbg.length);

    return response;
  }
}

module.exports = IngestWorkflow;
