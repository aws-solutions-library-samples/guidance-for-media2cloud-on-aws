// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  process: {
    merge,
    cardinality,
  },
} = require('gremlin');
const Base = require('./base');

class Vertex extends Base {
  upsert(g) {
    return g.mergeV(this.idMap)
      .option(merge.onCreate, this.propertyMap);
  }

  async drop(g) {
    return super.drop(g.V(this.id));
  }

  async update(g, name, value) {
    return g.V(this.id)
      .property(
        cardinality.single,
        name,
        value
      )
      .iterate();
  }

  async dump(g) {
    return super.dump(g.V(this.id)
      .bothE()
      .dedup()
      .otherV());
  }
}

module.exports = Vertex;
