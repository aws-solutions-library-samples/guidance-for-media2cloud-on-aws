// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  process: {
    merge,
    direction,
    cardinality,
  },
} = require('gremlin');
const Base = require('./base');

class Edge extends Base {
  upsert(g) {
    return g.mergeE(this.idMap)
      .option(merge.onCreate, this.propertyMap);
  }

  async drop(g) {
    return super.drop(g.E(this.id));
  }

  async update(g, name, value) {
    return g.E(this.id)
      .property(
        cardinality.single,
        name,
        value
      )
      .iterate();
  }

  static fromVertices(label, from, to) {
    const fromId = from.id;
    const toId = to.id;
    const id = `${fromId}_${toId}`;

    const edge = new Edge(id, label);

    // Known issue with direction.from_ and direction.to,
    // use direction.in and direction.out,
    // https://www.answeroverflow.com/m/1096083414928588840
    edge.setProperty(
      direction.in,
      fromId
    );

    edge.setProperty(
      direction.out,
      toId
    );

    return edge;
  }

  async dump(g) {
    return super.dump(g.E(this.id)
      .bothV()
      .dedup());
  }
}

module.exports = Edge;
