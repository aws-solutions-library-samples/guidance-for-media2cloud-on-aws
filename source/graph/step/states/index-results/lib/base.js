// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  process: {
    EnumValue,
    statics,
    t,
  },
} = require('gremlin');

class Base {
  constructor(id, label, properties = {}) {
    this.$idMap = new Map();
    this.$idMap.set(t.id, id);

    this.$propertyMap = new Map();
    this.$propertyMap.set(t.label, label);

    Object.keys(properties)
      .forEach((x) => {
        this.$propertyMap.set(x, properties[x]);
      });
  }

  get idMap() {
    return this.$idMap;
  }

  get propertyMap() {
    return this.$propertyMap;
  }

  get id() {
    return this.$idMap.get(t.id);
  }

  get label() {
    return this.propertyMap.get(t.label);
  }

  getProperty(name) {
    return this.propertyMap.get(name);
  }

  setProperty(name, value) {
    this.propertyMap.set(name, value);
    return this;
  }

  upsert(g) {
    return g;
  }

  async drop(g) {
    return g
      .drop()
      .iterate();
  }

  async update(g, name, value) {
    return undefined;
  }

  async dump(g) {
    return g
      .path()
      .map(
        statics.unfold()
          .map(
            statics.valueMap(true)
          )
          .fold()
      )
      .toList()
      .then((res) =>
        Base.arrayReduce(res));
  }

  static arrayReduce(arrayData) {
    return arrayData
      .map((x) => {
        if (x instanceof Map) {
          return Base.mapReduce(x);
        }
        if (Array.isArray(x)) {
          return Base.arrayReduce(x);
        }
        return x;
      });
  }

  static mapReduce(mapData) {
    const entries = [
      ...mapData,
    ];

    return entries
      .reduce((a0, c0) => {
        const key = (c0[0] instanceof EnumValue)
          ? c0[0].elementName
          : c0[0];

        let val = c0[1];

        if (val instanceof Map) {
          val = Base.mapReduce(val);
        } else if (Array.isArray(val)) {
          val = Base.arrayReduce(val);
        }

        return {
          ...a0,
          [key]: val,
        };
      }, {});
  }

  static dedup(duplicated) {
    const deduped = [];
    const processed = {};

    while (duplicated.length) {
      const item = duplicated.shift();
      const unique = `${item[2].id},${item[0].id}`;

      if (processed[unique] === undefined) {
        processed[unique] = true;
        deduped.push(item);
      }
    }

    return deduped;
  }
}

module.exports = Base;
