/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
const PATH = require('path');

const {
  mxCommonUtils,
} = require('../../shared/mxCommonUtils');

class X0 extends mxCommonUtils(class {}) {}

/**
 * @class MetadataParserError
 */
class MetadataParserError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, MetadataParserError);
  }
}

/* eslint-disable class-methods-use-this */
class Base {
  constructor(metaInstance) {
    this.$metaInstance = metaInstance;
    this.$denominator = 100;
    this.$minConfidence = 90;
  }

  get meta() {
    return this.$metaInstance;
  }

  get denominator() {
    return this.$denominator;
  }

  set denominator(val) {
    this.$denominator = val;
  }

  get minConfidence() {
    return this.$minConfidence;
  }

  set minConfidence(val) {
    this.$minConfidence = val;
  }

  async download(Bucket, Key) {
    try {
      const {
        name,
      } = PATH.parse(Key);

      const capName = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const body = await X0.download(Bucket, Key);

      return {
        name: capName,
        data: JSON.parse(body),
      };
    } catch (e) {
      throw new MetadataParserError(e);
    }
  }
}

/**
 * @class Celebrities
 * @description create timeline for celebrities metadata result
 */
class Celebrities extends Base {
  constructor(metaInstance) {
    super(metaInstance);
    this.$timeDrift = 3000;
    this.$minDuration = 10000;
    this.minConfidence = 60;
  }

  get [Symbol.toStringTag]() {
    return 'Celebrities';
  }

  get timeDrift() {
    return this.$timeDrift;
  }

  get minDuration() {
    return this.$minDuration;
  }

  /* eslint-disable no-continue */
  /* eslint-disable no-param-reassign */
  parseTimelines(data) {
    let combined = [];

    /* case 1: combined tracks that are less than time drift threshold */
    let t0 = data[0];
    for (let i = 1; i < data.length; i += 1) {
      const {
        Confidence,
        Count,
        In,
        Out,
      } = data[i];

      if ((In - t0.Out) <= this.timeDrift) {
        t0.Out = Out;
        t0.Confidence = ((t0.Confidence * t0.Count) + (Confidence * Count)) / (t0.Count + Count);
        t0.Count += Count;
        continue;
      }

      combined.push(t0);
      t0 = data[i];
    }
    /* special case: the timestamps never has discontinuity. */
    if (!combined.length && (t0.Out - t0.In) > 0) {
      combined.push(t0);
    }

    /* case 2: toss any timelines that has less confidence */
    combined = combined.filter(x => x.Confidence > this.minConfidence);

    /* case 3: remove timelines that is less than min. duration */
    combined = combined.filter(x => (x.Out - x.In) > this.minDuration);
    if (!combined.length) {
      return undefined;
    }

    /* At last, format it to the followings:
     * { Confidence, Count, Timelines: [{ In, Out }, { In, Out }] }
     */
    /* always insert In/Out = 0 for LB static metadata */
    const Timelines = [{
      In: 0,
      Out: 0,
    }];

    let Confidence = 0;
    let Count = 0;
    combined.forEach((t) => {
      Confidence += t.Confidence * t.Count;
      Count += t.Count;
      Timelines.push({ In: t.In, Out: t.Out });
    });

    return {
      Count,
      Confidence: ((Confidence / Count) / 100),
      Timelines,
    };
  }
  /* eslint-enable no-param-reassign */
  /* eslint-enable no-continue */

  async createTimelines(Bucket, Keys) {
    try {
      const promises = Keys.map(Key => this.download(Bucket, Key));

      const downloaded = await Promise.all(promises);

      const result = {};
      downloaded.forEach((download) => {
        const {
          name,
          data,
        } = download;

        /* combine and format the timelines */
        const combined = this.parseTimelines(data);
        if (combined) {
          result[name] = combined;
        }
      });

      return (Object.keys(result).length) ? result : undefined;
    } catch (e) {
      throw new MetadataParserError(e);
    }
  }

  /**
   * @function parse
   * @description parse celebrites and face_match metadata results
   */
  async parse() {
    const Bucket = this.meta.bucket;
    const promises = [
      this.meta.celebs,
      this.meta.matches,
    ].map((instance) => {
      if (instance && instance.metaKeys.length) {
        return this.createTimelines(Bucket, instance.metaKeys);
      }
      return undefined;
    });

    const results = await Promise.all(promises);

    const celebrities = results.reduce((acc, cur) =>
      Object.assign({}, acc, cur), {});

    return celebrities;
  }
}

/**
 * @class TopItems
 * @description extract top 10, top 5 items
 */
class TopItems extends Base {
  constructor(metaInstance, numOfItems = 5) {
    super(metaInstance);
    this.$minCount = 10;
    this.$numOfItems = numOfItems;
    this.$ignoreItems = [];
  }

  get [Symbol.toStringTag]() {
    return 'TopItems';
  }

  get minCount() {
    return this.$minCount;
  }

  set minCount(val) {
    this.$minCount = val;
  }

  get numOfItems() {
    return this.$numOfItems;
  }

  set numOfItems(val) {
    this.$numOfItems = val;
  }

  get ignoreItems() {
    return this.$ignoreItems;
  }

  set ignoreItems(val) {
    this.$ignoreItems = val;
  }

  async createTopItems(Bucket, Keys) {
    try {
      const promises = Keys.map(Key => this.download(Bucket, Key));

      const downloaded = await Promise.all(promises);

      const candidates = {};
      downloaded.forEach((download) => {
        /* calculate the overall confidence and counts */
        const {
          name,
          data,
        } = download;

        const stats = data.reduce((acc, cur) => {
          acc.totalCount += cur.Count;
          acc.totalConfidence += (cur.Confidence * cur.Count);
          return acc;
        }, { totalCount: 0, totalConfidence: 0 });

        /* filter the results based on Count / Confidence level */
        if (stats.totalCount > this.minCount
          && (stats.totalConfidence / stats.totalCount) > this.minConfidence) {
          candidates[name] = {
            Confidence: (stats.totalConfidence / stats.totalCount) / this.denominator,
            Count: stats.totalCount,
            Timelines: [{ In: 0, Out: 0 }],
          };
        }
      });

      let keys = Object.keys(candidates).sort((a, b) =>
        candidates[b].Confidence - candidates[a].Confidence);

      this.ignoreItems.forEach((x) => {
        const idx = keys.findIndex(xx => xx.toLowerCase() === x.toLowerCase());
        if (idx !== undefined) {
          keys.splice(idx, 1);
        }
      });

      keys = keys.slice(0, this.numOfItems);

      if (!keys.length) {
        return undefined;
      }

      const result = {};

      keys.forEach((key) => {
        result[key] = candidates[key];
      });

      return result;
    } catch (e) {
      throw new MetadataParserError(e);
    }
  }
}

/**
 * @class Emotions
 * @description extract top 10 emotions items
 */
class Emotions extends TopItems {
  get [Symbol.toStringTag]() {
    return 'Emotions';
  }

  async parse() {
    const Bucket = this.meta.bucket;
    const instance = this.meta.faces;

    if (!instance || !instance.metaKeys.length) {
      return undefined;
    }

    const emotions = await this.createTopItems(Bucket, instance.metaKeys);

    return emotions;
  }
}

/**
 * @class Labels
 * @description extract top 10 labels, ignore common labels
 */
class Labels extends TopItems {
  constructor(metaInstance, numOfItems) {
    super(metaInstance, numOfItems);
    this.ignoreItems = ['human', 'person', 'people', 'text'];
    this.minCount = 5;
  }

  get [Symbol.toStringTag]() {
    return 'Labels';
  }

  async parse() {
    const Bucket = this.meta.bucket;
    const instance = this.meta.labels;

    if (!instance || !instance.metaKeys.length) {
      return undefined;
    }

    const labels = await this.createTopItems(Bucket, instance.metaKeys);

    return labels;
  }
}

/**
 * @class KeyPhrases
 * @description extract top 10 keyphrase
 */
class KeyPhrases extends TopItems {
  constructor(metaInstance, numOfItems = 10) {
    super(metaInstance, numOfItems);
    this.minConfidence = 0.8;
    this.denominator = 1;
    this.minCount = 2;
    this.$field = 'KeyPhrases';
  }

  get [Symbol.toStringTag]() {
    return 'KeyPhrases';
  }

  get field() {
    return this.$field;
  }

  set field(val) {
    this.$field = val;
  }

  async createTopItems(Bucket, Keys) {
    try {
      const {
        data,
      } = await this.download(Bucket, Keys[0]);

      const fields = data[this.field];
      if (!fields) {
        return undefined;
      }

      let keys = Object.keys(fields);

      keys = keys.filter(x =>
        (fields[x].Count > this.minCount) && (fields[x].Confidence > this.minConfidence));

      keys = keys.sort((a, b) =>
        fields[b].Confidence - fields[a].Confidence).slice(0, this.numOfItems);

      const candidates = {};

      keys.forEach((x) => {
        candidates[x] = {
          Confidence: fields[x].Confidence,
          Count: fields[x].Count,
          Timelines: [{ In: 0, Out: 0 }],
        };
      });

      if (!keys.length) {
        return undefined;
      }

      return candidates;
    } catch (e) {
      throw new MetadataParserError(e);
    }
  }

  async parse() {
    const Bucket = this.meta.bucket;
    const instance = this.meta.keyphrases;

    if (!instance || !instance.metaKeys.length) {
      return undefined;
    }

    const phrases = await this.createTopItems(Bucket, instance.metaKeys);

    return phrases;
  }
}

/**
 * @class Locations
 * @description extract top 10 locations
 */
class Locations extends KeyPhrases {
  constructor(metaInstance, numOfItems) {
    super(metaInstance, numOfItems);
    this.minConfidence = 0.8;
    this.denominator = 1;
    this.minCount = 0;
    this.field = 'LOCATION';
  }

  get [Symbol.toStringTag]() {
    return 'Locations';
  }

  async parse() {
    const Bucket = this.meta.bucket;
    const instance = this.meta.entities;

    if (!instance || !instance.metaKeys.length) {
      return undefined;
    }

    const locations = await this.createTopItems(Bucket, instance.metaKeys);

    return locations;
  }
}

/**
 * @class Persons
 * @description extract top 10 people
 */
class Persons extends KeyPhrases {
  constructor(metaInstance, numOfItems) {
    super(metaInstance, numOfItems);
    this.minConfidence = 0.8;
    this.denominator = 1;
    this.minCount = 0;
    this.field = 'PERSON';
  }

  get [Symbol.toStringTag]() {
    return 'Persons';
  }

  async parse() {
    const Bucket = this.meta.bucket;
    const instance = this.meta.entities;

    if (!instance || !instance.metaKeys.length) {
      return undefined;
    }

    const locations = await this.createTopItems(Bucket, instance.metaKeys);

    return locations;
  }
}

module.exports = {
  Celebrities,
  Emotions,
  Labels,
  KeyPhrases,
  Locations,
  Persons,
};
