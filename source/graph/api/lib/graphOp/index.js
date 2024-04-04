// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  driver: {
    DriverRemoteConnection,
  },
  structure: {
    Graph,
  },
  process: {
    statics,
    column,
    direction,
    pick,
    pop,
    order,
    scope,
    P,
    TextP,
    t,
    EnumValue,
  },
} = require('gremlin');
const {
  GraphDefs,
} = require('core-lib');
const BaseOp = require('../shared/baseOp');
const {
  InternalServerErrorException,
} = require('../shared/exceptions');

const {
  Vertices,
  Edges,
} = GraphDefs;

const NEPTUNE_ENDPOINT = process.env.ENV_NEPTUNE_ENDPOINT_RO
  || process.env.ENV_NEPTUNE_ENDPOINT;

const OP_QUERY = 'query';
const OP_INFO = 'info';
const OP_PATH = 'path';
const TYPE_VERTICE = 'vertice';
const TYPE_EDGE = 'edge';
const QUERY_TIMEOUT_MS = 28 * 1000;
const DEFAULT_PAGESIZE = 20;
const RETURNED_PROPS = [
  'id',
  'label',
  'name',
  'faceId',
  'collectionId',
];

class GraphOp extends BaseOp {
  static opSupported(op) {
    return [
      OP_QUERY,
      OP_INFO,
      OP_PATH,
    ].includes(op);
  }

  async onGET(data) {
    let dc;
    let responseData;
    try {
      if (!NEPTUNE_ENDPOINT) {
        throw new Error('NEPTUNE_ENDPOINT not defined');
      }

      dc = new DriverRemoteConnection(`wss://${NEPTUNE_ENDPOINT}/gremlin`, {});
      const graph = new Graph();
      const g = graph.traversal().withRemote(dc);

      const qs = this.queryString;
      if (qs.op === OP_INFO) {
        responseData = await this.getGraphInfo(g, qs);
      } else if (qs.op === OP_PATH) {
        responseData = await this.pathVertices(g, qs);
      } else if (qs.type === TYPE_VERTICE) {
        responseData = await this.queryVertices(g, qs);
      } else if (qs.type === TYPE_EDGE) {
        responseData = await this.queryEdges(g, qs);
      } else {
        throw new Error('type not supported');
      }

      return this.onSucceed(responseData);
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    } finally {
      console.log('finally... closing driver...');
      if (dc) {
        dc.close();
      }
    }
  }

  async getGraphInfo(g, qs) {
    let query = g.V();

    if (qs.type === TYPE_EDGE) {
      query = g.E();
    }
    query = query
      .groupCount()
      .by(t.label);

    return query
      .toList()
      .then((res) => {
        const response = this.arrayReduce(res);
        console.log(
          '== getGraphInfo:',
          qs.type,
          '==',
          JSON.stringify(response, null, 2)
        );
        return response;
      });
  }

  async pathVertices(g, qs) {
    const permutations = [];

    if (qs.from && qs.to) {
      const from = qs.from;
      const ids = decodeURIComponent(qs.to)
        .split(',')
        .filter((x) =>
          x.length);

      ids.forEach((to) => {
        permutations.push({
          from,
          to,
        });
      });
    } else if (qs.ids) {
      const ids = decodeURIComponent(qs.ids || '')
        .split(',')
        .filter((x) =>
          x.length);

      while (ids.length > 1) {
        const from = ids.pop();
        ids.forEach((to) => {
          permutations.push({
            from,
            to,
          });
        });
      }
    }

    const response = await Promise.all(permutations
      .map((permutation) =>
        this.queryPathFromAToB(g, permutation)));

    return response
      .flat(1);
  }

  async queryVerticeByIds(g, qs) {
    const ids = decodeURIComponent(qs.ids || '')
      .split(',')
      .filter((x) =>
        x.length);
    const query = g.V(...ids)
      .elementMap('id', 'label', 'name');

    return query.toList()
      .then((res) =>
        this.arrayReduce(res));
  }

  async queryVerticeById(g, qs) {
    const start = Number(qs.token || 0);
    const end = start + Number(qs.pagesize || DEFAULT_PAGESIZE);
    const labels = decodeURIComponent(qs.labels || '')
      .split(',')
      .filter((x) =>
        x.length);

    let query = g.V(qs.id)
      .bothE()
      .dedup()
      .otherV();

    /* filter with label */
    if (labels.length > 0) {
      query = query.hasLabel(...labels);
    }

    query = query
      .range(start, end)
      .path()
      .map(
        statics
          .unfold()
          .map(
            statics.elementMap(...RETURNED_PROPS)
          )
          .fold()
      );

    return query
      .toList()
      .then((res) => {
        console.log(
          '== queryVerticeById:',
          qs.id,
          '==',
          JSON.stringify(res, null, 2)
        );

        const response = this.dedup(this.arrayReduce(res));
        console.log(
          '== queryVerticeById:',
          qs.id,
          '==',
          JSON.stringify(response, null, 2)
        );
        return response;
      });
  }

  async queryVerticeByLabel(g, qs) {
    const start = Number(qs.token || 0);
    const end = start + Number(qs.pagesize || DEFAULT_PAGESIZE);

    let query = g.V()
      .hasLabel(qs.label);

    if (qs.name !== undefined) {
      query = query
        .has('name', TextP.containing(qs.name));
    }

    query = query
      .range(start, end)
      .valueMap(true);

    return query
      .toList()
      .then((res) => {
        const response = this.arrayReduce(res);
        console.log(
          '== queryVerticeByLabel:',
          qs.label,
          qs.name,
          '==',
          JSON.stringify(response, null, 2)
        );
        return response;
      });
  }

  async queryVertices(g, qs) {
    if (qs.ids !== undefined) {
      return this.queryVerticeByIds(g, qs);
    }
    if (qs.id !== undefined) {
      return this.queryVerticeById(g, qs);
    }
    if (qs.label !== undefined) {
      return this.queryVerticeByLabel(g, qs);
    }
    throw new Error('invalid query options');
  }

  async queryGraph(g, options) {
    if (options.id) {
      return this.queryById(g, options);
    }
    if (options.type === TYPE_VERTICE) {
      return this.queryVertices(g, options);
    }
    if (options.type === TYPE_EDGE) {
      return this.queryEdges(g, options);
    }
    throw new Error('Incorrect parameter');
  }

  async queryEdges(g, options) {
    if (!options.label) {
      throw new Error('Missing parameter');
    }

    const start = Number(options.token || 0);
    const end = start + Number(options.pagesize || 20);

    let query = g.E()
      .hasLabel(options.label);

    if (options.name) {
      query = query
        .has('name', TextP.containing(options.name));
    }

    query = query
      .range(start, end)
      .valueMap(true);

    return query.toList()
      .then((res) =>
        this.arrayReduce(res));
  }

  async queryById(g, options) {
    if (options.type !== TYPE_VERTICE) {
      throw new Error('Incorrect parameter');
    }
    const start = Number(options.token || 0);
    const end = start + Number(options.pagesize || 20);
    let query;
    /* if level is specified, query two levels of nodes */
    if (options.level !== undefined) {
      query = g.V(options.id)
        .outE()
        .otherV()
        .inE()
        .otherV()
        .hasId(P.neq(options.id))
        .range(start, end)
        .path()
        .map(
          statics.unfold()
            .map(statics.elementMap('name'))
            .fold()
        );
    } else {
      query = g.V(options.id)
        .bothE()
        .range(start, end)
        .otherV()
        .path()
        .map(
          statics.unfold()
            .map(
              statics.elementMap('name')
            )
            .fold()
        );
    }

    return query.toList()
      .then((res) =>
        this.arrayReduce(res));
  }

  async queryPath(g, options) {
    if (options.to && options.from) {
      return this.queryPathFromAToB(g, options);
    }

    if (!options.id) {
      throw new Error('id is null.');
    }

    const ids = decodeURIComponent(options.id)
      .split(',')
      .filter((x) =>
        x.length);

    let query = g.V(...ids);
    if (options.direction === 'both') {
      query = query
        .bothE()
        .dedup()
        .otherV();
    } else if (options.direction === 'in') {
      query = query
        .inE()
        .dedup()
        .otherV();
    } else if (options.direction === 'out') {
      query = query
        .outE()
        .dedup()
        .otherV();
    } else {
      throw new Error('invalid direction');
    }

    if (options.label !== undefined) {
      const labels = options.label
        .split(',')
        .filter((x) =>
          x.length);
      query = query
        .hasLabel(...labels);
      // .has('status', 'released');
    }

    const year = Number(options.year || 2013);
    query = query.has('year', P.gte(year));

    const start = Number(options.start || 0);
    const end = Number(options.end || 10) + start;
    query = query.range(start, end);

    query = query.path()
      .map(
        statics.unfold()
          .map(
            statics.elementMap()
          )
          .fold()
      );
    return query.toList()
      .then((res) =>
        this.dedup(this.arrayReduce(res)));
  }

  async queryPathFromAToB(g, options) {
    const from = options.from;
    const to = options.to;
    const limit = Number(options.limit || 1);

    console.log(
      '=== queryPathFromAToB:',
      from,
      to
    );

    const query = g.V(from)
      .repeat(
        statics.timeLimit(QUERY_TIMEOUT_MS)
          /* both doesn't return edges */
          // .both()
          /* edge and otherV takes longer time */
          .bothE()
          .otherV()
          .simplePath()
      )
      .until(
        statics.hasId(to)
      )
      .path()
      .limit(limit)
      .map(
        statics.unfold()
          .map(
            statics.elementMap(...RETURNED_PROPS)
          )
          .fold()
      );

    return query
      .toList()
      .then((res) => {
        console.log(
          '=== [RET] queryPathFromAToB:',
          from,
          to,
          res
        );
        return this.arrayReduce(res);
      });
  }

  arrayReduce(arrayData) {
    return arrayData.map((x) => {
      if (x instanceof Map) {
        return this.mapReduce(x);
      }
      if (Array.isArray(x)) {
        return this.arrayReduce(x);
      }
      return x;
    });
  }

  mapReduce(mapData) {
    const entries = [
      ...mapData,
    ];
    return entries.reduce((a0, c0) => {
      const key = (c0[0] instanceof EnumValue)
        ? c0[0].elementName
        : c0[0];
      let val = c0[1];
      if (val instanceof Map) {
        val = this.mapReduce(val);
      } else if (Array.isArray(val)) {
        val = this.arrayReduce(val);
      }
      return {
        ...a0,
        [key]: val,
      };
    }, {});
  }

  dedup(dataset) {
    const deduped = [];
    const processed = {};
    while (dataset.length) {
      const item = dataset.shift();
      const unique = `${item[2].id},${item[0].id}`;
      if (processed[unique] === undefined) {
        processed[unique] = true;
        deduped.push(item);
      }
    }
    return deduped;
  }

  async debugQuery(g, options) {
    throw new Error('not allow');
  }
}

module.exports = GraphOp;
