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
/* eslint-disable class-methods-use-this */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const AWS = require('aws-sdk');
const PATH = require('path');

/**
 * @class WebVttTrackError
 */
class WebVttTrackError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, WebVttTrackError);
  }
}

/**
 * @class BaseVttTrack
 * @description base class for creating WebVTT file
 */
class BaseVttTrack {
  /**
   * @function constructor
   * @param {string} Bucket - bucket
   * @param {array} Keys - a list of Keys in sequence
   * @param {object} Spec - contains FilePrefix, ListTag, ObjectTag,
   * IdTag, [TimeDrift], [PositionDrift]
   * ie. { FilePrefix: 'celeb', ListTag: 'Celebrities', ObjectTag: 'Celebrity', IdTag: 'Name' }
   */
  constructor(Bucket, Keys, DstBucket, DstPrefix, FilePrefix, options = {}) {
    if (!Bucket || !Keys) {
      throw new WebVttTrackError('missing Bucket, Keys');
    }

    if (!DstBucket || !DstPrefix) {
      throw new WebVttTrackError('missing DstBucket, DstPrefix');
    }

    if (!FilePrefix) {
      throw new WebVttTrackError('missing FilePrefix');
    }

    const {
      TimeDrift = 300,
      TimelineDrift = 1100,
      PositionDrift = 0.05,
      MinConfidence = 0.5,
    } = options;

    this.$bucket = Bucket;

    this.$keys = (Array.isArray(Keys))
      ? Keys.filter((x) => {
        const { name } = PATH.parse(x);
        return name.indexOf(FilePrefix) >= 0;
      }) : [Keys];

    this.$dstBucket = DstBucket;
    this.$dstPrefix = DstPrefix;
    this.$kind = FilePrefix;
    this.$timeDrift = TimeDrift;
    this.$timelineDrift = TimelineDrift;
    this.$posDrift = PositionDrift;
    this.$minConfidence = MinConfidence;
  }

  get [Symbol.toStringTag]() {
    return 'BaseVttTrack';
  }

  get bucket() {
    return this.$bucket;
  }

  get keys() {
    return this.$keys;
  }

  get dstBucket() {
    return this.$dstBucket;
  }

  get dstPrefix() {
    return this.$dstPrefix;
  }

  get kind() {
    return this.$kind;
  }

  get timeDrift() {
    return this.$timeDrift;
  }

  set timeDrift(val) {
    this.$timeDrift = val;
  }

  get timelineDrift() {
    return this.$timelineDrift;
  }

  set timelineDrift(val) {
    this.$timelineDrift = val;
  }

  get posDrift() {
    return this.$posDrift;
  }

  set posDrift(val) {
    this.$posDrift = val;
  }

  get minConfidence() {
    return this.$minConfidence;
  }

  set minConfidence(val) {
    this.$minConfidence = val;
  }

  get minConfidencePercent() {
    return this.$minConfidence * 100;
  }

  get vttPrefix() {
    return PATH.join(this.dstPrefix, 'vtt', this.kind);
  }

  get metaPrefix() {
    return PATH.join(this.dstPrefix, 'meta', this.kind);
  }

  /**
   * @function floatToTimeString
   * @description format float timecode into time string, 00:00:00.000
   * @param {string|number} offset - timecode in second
   */
  static floatToTimeString(offset) {
    return BaseVttTrack.toTimeString(Math.floor(Number.parseFloat(offset) * 1000));
  }

  /**
   * @function toTimeString
   * @description convert timecode into time string, 00:00:00.000
   * @param {number} offset - timecode in seconds
   */
  static toTimeString(offset) {
    /**
     * @function padding
     * @description zero padding to number string based on the 'base'
     * @param {number|float} num - number to convert and pad to string
     * @param {number} base - log10 number
     */
    function padding(num, base = 100) {
      if (num > base) {
        return num.toString();
      }

      const array = num.toString().split('');

      let shift = (Number.parseInt(Math.log10(base), 10)) - array.length;

      while (shift > 0) {
        array.unshift('0');
        shift -= 1;
      }

      return array.join('');
    }

    const offsetMillis = offset;
    const HH = Math.floor(offsetMillis / 3600000);
    const MM = Math.floor((offsetMillis % 3600000) / 60000);
    const SS = Math.floor((offsetMillis % 60000) / 1000);
    const mmm = Math.ceil(offsetMillis % 1000);

    return `${padding(HH)}:${padding(MM)}:${padding(SS)}.${padding(mmm, 1000)}`;
  }

  /**
   * @function download
   * @description download all corresponding metadata json files
   * @param {string} Bucket - media-analysis bucket
   * @param {string|Array} Keys - list of metadata result files, celebs1.json, celebs2.json
   */
  static async download(Bucket, Keys) {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const promises = (Array.isArray(Keys) ? Keys : [Keys]).map((Key) => {
      const promise = new Promise((resolve, reject) => {
        s3.getObject({
          Bucket, Key,
        }, (err, data) => {
          if (err) {
            reject(err);
            return;
          }

          const {
            base: file,
            name,
          } = PATH.parse(Key);

          /* index used to sort the result ascendingly */
          const match = name.match(/([0-9]+$)/);
          const index = Number.parseInt((match && match[0]) || 1, 10);

          resolve({
            index,
            file,
            data: JSON.parse(data.Body.toString()),
          });
        });
      });

      return promise;
    });

    const responses = await Promise.all(promises);

    return responses.sort((a, b) => a.index - b.index);
  }

  /**
   * @function upload
   * @description wrapper function to S3.pubObject api
   * @param {objec} params - s3 param for upload
   */
  static async upload(params) {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    await s3.putObject(params).promise();

    return params.Key;
  }

  /* eslint-disable no-unused-vars */
  /**
   * @function createMappings
   * @description pure function for sub-class to implement, to provide the structure for parsing
   * {
   *   Name_1: [{ Timestamp, Item: { Confidence, BoundingBox } }],
   * },
   * {
   *   Name_2: [{ Timestamp, Item: { Confidence, BoundingBox } }, ...],
   * }
   *
   * where Timestamp, Item.Confidence, Item.BoundingBox keys are mandatory
   *
   * @param {string} downloaded
   */
  createMappings(downloaded) {
    throw new WebVttTrackError('BaseVttTrack.createMappings NOT IMPLEMENTED');
  }

  /* eslint-disable no-continue */
  /**
   * @function createCuesPseudoData
   * @description createCuesPseudoData generates the 1st pass tracks data that are
   * sensitive to timecode AND coordinate differences.
   * @param {string} name
   * @param {object} data - data genereted from createMappings
   */
  createCuesPseudoData(name, data) {
    const TIME_DRIFT = this.timeDrift;
    const POSITION_DRIFT = this.posDrift;

    while (data.length) {
      if (!data[0].Timestamp || !data[0].Item || !data[0].Item.BoundingBox) {
        data.splice(0, 1);
      } else {
        break;
      }
    }

    if (!data.length) {
      return [];
    }

    /* create initial value */
    const {
      Timestamp,
    } = data[0];

    const {
      BoundingBox: {
        Left,
        Top,
        Width,
        Height,
      },
      Confidence,
    } = data[0].Item;

    /* pointer/cursor to walk through the list */
    let Current = {
      confidence: Confidence,
      tstart: Timestamp,
      tend: Timestamp,
      count: 1,
      x: Left,
      y: Top,
      w: Width,
      h: Height,
    };

    const collection = [];
    for (let i = 1; i < data.length; i += 1) {
      const {
        Timestamp: Tcur,
      } = data[i];

      const {
        BoundingBox,
        Confidence: confidence,
      } = data[i].Item;

      /* case 0: if no BoundingBox, simply update the end time */
      if (!BoundingBox) {
        /* only update timecode if within drift threshold */
        if ((Tcur - Current.tend) < TIME_DRIFT) {
          Current.tend = Tcur;
        }
        /* update and average the confidence level */
        Current.confidence = (!confidence)
          ? Current.confidence
          : ((Current.confidence * Current.count) + confidence) / (Current.count + 1);
        Current.count += 1;
        continue;
      }

      const Next = {
        confidence,
        tstart: Tcur,
        tend: Tcur,
        count: 1,
        x: BoundingBox.Left,
        y: BoundingBox.Top,
        w: BoundingBox.Width,
        h: BoundingBox.Height,
      };

      /* case 1: if timestamp is far apart (1000ms), it is a break */
      if ((Next.tstart - Current.tend) >= TIME_DRIFT) {
        collection.push(Object.assign({}, Current));
        Current = Next;
        continue;
      }

      /* case 2: if motion (of center point) is far apart (0.1/10%), it is a break */
      const x = Math.abs((Current.x + (Current.w / 2)) - (Next.x + (Next.w / 2)));
      const y = Math.abs((Current.y + (Current.h / 2)) - (Next.y + (Next.h / 2)));
      if (Math.sqrt((x * x) + (y * y)) > POSITION_DRIFT) {
        collection.push(Object.assign({}, Current));
        Current = Next;
        continue;
      }

      /* case 3: otherwise, move the tend cursor */
      Current.tend = Next.tstart;

      /* update and average the confidence level */
      Current.confidence = (!confidence)
        ? Current.confidence
        : ((Current.confidence * Current.count) + confidence) / (Current.count + 1);
      Current.count += 1;
    }

    /* case 4: make sure to collect the last timestamp */
    Current.tend = data[data.length - 1].Timestamp;
    collection.push(Object.assign({}, Current));

    return collection;
  }

  /**
   * @function createTimelines
   * @description createTimelines takes the 1st pass pseudo-cue-data that produces
   * timecode and coordinate sensitive tracks. It them removes the coordinate factor
   * and combines adjacent tracks based on timecode.
   * @param {string} name
   * @param {object} data
   */
  createTimelines(name, data) {
    const filtered = data; // data.filter(x => x.confidence !== undefined);

    if (!filtered.length) {
      return undefined;
    }

    /* combine timelines based on timecode different */
    const TIME_DRIFT = this.timelineDrift;
    const timelines = [];

    let t0 = filtered[0];
    for (let i = 1; i < filtered.length; i += 1) {
      const {
        confidence,
        tstart,
        tend,
        count,
      } = filtered[i];

      /* combine track */
      if ((tstart - t0.tend) <= TIME_DRIFT) {
        t0.tend = tend;
        t0.confidence = ((t0.confidence * t0.count) + (confidence * count)) / (t0.count + count);
        t0.count += count;
        continue;
      }

      timelines.push({
        Confidence: t0.confidence, Count: t0.count, In: t0.tstart, Out: t0.tend,
      });
      t0 = filtered[i];
    }

    /* special case: the timestamps never has discontinuity. */
    if (!timelines.length && (t0.tend - t0.tstart) > 0) {
      timelines.push({
        Confidence: t0.confidence,
        Count: t0.count,
        In: t0.tstart,
        Out: t0.tend,
      });
    }

    return timelines;
  }
  /* eslint-enable no-continue */


  /**
   * @function createCue
   * @description  create vtt cue element based on start time, end time, and position
   * @param {string} name
   * @param {object} cue
   */
  createCue(name, cue) {
    const {
      confidence,
      tstart,
      tend,
      x,
      y,
      w,
    } = cue;

    const t0 = BaseVttTrack.toTimeString(tstart);
    const t1 = BaseVttTrack.toTimeString(tend);

    const line = Math.floor((y) * 100);
    const position = Math.floor((x + (w / 2)) * 100);
    const align = 'center';
    const extra = (confidence)
      ? ` <c.confidence>(${Number.parseFloat(confidence).toFixed(2)})</c>`
      : '';

    const vtt = [];
    vtt.push(`${t0} --> ${t1} align:${align} line:${line}% position:${position}% size:20%`);
    vtt.push(`<c.${this.kind}>${name}</c>${extra}`);
    vtt.push('');

    return vtt;
  }

  /**
   * @function createWebVtt
   * @description  create vtt file
   * @param {string} name
   * @param {object} cue
   */
  createWebVtt(name, cues) {
    let vtt = ['WEBVTT', ''];

    cues.forEach((cue) => {
      const cc = this.createCue(name, cue);
      vtt = vtt.concat(cc);
    });

    return vtt.join('\n');
  }
  /* eslint-enable no-unused-vars */

  /**
   * @function run
   * @description start the process
   */
  async run() {
    try {
      const downloaded = await BaseVttTrack.download(this.bucket, this.keys);
      const mappings = this.createMappings(downloaded);
      const keys = Object.keys(mappings);
      process.env.ENV_QUIET || console.log(`Found ${keys.length}  ${this.kind}: ${keys.join(', ')}`);

      const promisesVtt = [];
      const promisesMeta = [];

      keys.forEach(async (key) => {
        const basename = key.toLowerCase().replace(/[^a-zA-Z0-9\-_.]/g, '_');

        const pseudoData = this.createCuesPseudoData(key, mappings[key]);

        /* create WebVTT track */
        const vtt = this.createWebVtt(key, pseudoData);

        promisesVtt.push(BaseVttTrack.upload({
          Bucket: this.dstBucket,
          Key: PATH.join(this.vttPrefix, `${basename}.vtt`),
          Body: vtt.toString(),
          ContentType: 'text/vtt',
          ContentDisposition: 'attachment',
        }));

        /* create chapters */
        const chapters = this.createTimelines(key, pseudoData) || [];

        if (chapters.length) {
          promisesMeta.push(BaseVttTrack.upload({
            Bucket: this.dstBucket,
            Key: PATH.join(this.metaPrefix, `${basename}.json`),
            Body: JSON.stringify(chapters, null, 2),
            ContentType: 'application/json',
            ContentDisposition: 'attachment',
          }));
        }
      });

      const VttKeys = await Promise.all(promisesVtt);
      const MetaKeys = await Promise.all(promisesMeta);

      const response = {
        Kind: this.kind,
        Bucket: this.dstBucket,
      };

      if (VttKeys.length) {
        response.VttTracks = { Prefix: this.vttPrefix, Keys: VttKeys };
      }

      if (MetaKeys.length) {
        response.MetaTracks = { Prefix: this.metaPrefix, Keys: MetaKeys };
      }

      process.env.ENV_QUIET || console.log(JSON.stringify(response, null, 2));

      return response;
    } catch (e) {
      throw new WebVttTrackError(e);
    }
  }
}

/**
 * @class CelebVttTrack
 * @description create per celebrity webvtt file
 */
class CelebVttTrack extends BaseVttTrack {
  constructor(Bucket, Keys, DstBucket, DstPrefix) {
    super(Bucket, Keys, DstBucket, DstPrefix, 'celebs', {
      MinConfidence: 0.7,
    });
  }

  get [Symbol.toStringTag]() {
    return 'CelebVttTrack';
  }

  /**
   * @function createMappings
   * @description create map per celebrity
   * @param {Array} downloaded - a list of celebrities metadata files
   */
  createMappings(downloaded) {
    const mappings = {};

    downloaded.forEach((download) => {
      const {
        data,
      } = download;

      data.Celebrities.forEach((c) => {
        const {
          Timestamp,
          Celebrity: Item,
        } = c;

        const key = Item.Name.toString();

        mappings[key] = mappings[key] || [];
        mappings[key].push({ Timestamp, Item });
      });
    });
    return mappings;
  }
}

/**
 * @class PersonVttTrack
 * @description create per person webvtt file
 */
class PersonVttTrack extends BaseVttTrack {
  constructor(Bucket, Keys, DstBucket, DstPrefix) {
    super(Bucket, Keys, DstBucket, DstPrefix, 'persons', {
      MinConfidence: 0.8,
    });
  }

  get [Symbol.toStringTag]() {
    return 'PersonVttTrack';
  }

  /**
   * @function createMappings
   * @description create map per person
   * @param {Array} downloaded - a list of person metadata files
   */
  createMappings(downloaded) {
    const mappings = {};

    downloaded.forEach((download) => {
      const {
        data,
      } = download;

      data.Persons.forEach((c) => {
        const {
          Timestamp,
          Person: Item,
        } = c;

        const key = Item.Index.toString();

        mappings[key] = mappings[key] || [];
        mappings[key].push({ Timestamp, Item });
      });
    });
    return mappings;
  }

  /**
   * @function createCue
   * @description override base class
   * @param {string} name - person
   * @param {object} cue - cue structure
   */
  createCue(name, cue) {
    const tstart = BaseVttTrack.toTimeString(cue.tstart);
    const tend = BaseVttTrack.toTimeString(cue.tend);

    const line = Math.floor((cue.y) * 100);
    const position = Math.floor((cue.x + (cue.w / 2)) * 100);
    const align = 'middle';

    const vtt = [];
    vtt.push(`${tstart} --> ${tend} line:${line}% position:${position}% align:${align}`);
    vtt.push(`<c.${this.kind}>Person ${name}</c>`);
    vtt.push('');

    return vtt;
  }
}

/**
 * @class FaceVttTrack
 * @description create per face webvtt file
 */
class FaceVttTrack extends BaseVttTrack {
  constructor(Bucket, Keys, DstBucket, DstPrefix) {
    super(Bucket, Keys, DstBucket, DstPrefix, 'faces', {
      MinConfidence: 0.8,
    });
  }

  get [Symbol.toStringTag]() {
    return 'FaceVttTrack';
  }

  /**
   * @function createMappings
   * @description create map per face
   * @param {Array} downloaded - a list of face metadata files
   */
  createMappings(downloaded) {
    const mappings = {};

    downloaded.forEach((download) => {
      const {
        data: {
          Faces,
        },
      } = download;

      Faces.forEach((face) => {
        const {
          Timestamp,
          Face: {
            BoundingBox,
            Emotions,
          },
        } = face;

        Emotions.forEach((emotion) => {
          const {
            Type,
            Confidence,
          } = emotion;

          if (Confidence > this.minConfidencePercent) {
            const key = Type.toLowerCase();

            mappings[key] = mappings[key] || [];
            mappings[key].push({
              Timestamp,
              Item: {
                Name: key,
                BoundingBox,
                Confidence,
              },
            });
          }
        });
      });
    });
    return mappings;
  }
}

/**
 * @class FaceMatchVttTrack
 * @description create per matched face (against indexed collection) webvtt file
 */
class FaceMatchVttTrack extends BaseVttTrack {
  constructor(Bucket, Keys, DstBucket, DstPrefix) {
    super(Bucket, Keys, DstBucket, DstPrefix, 'face_matches');

    this.minConfidence = 0.6;
    this.timeDrift = 500;
  }

  get [Symbol.toStringTag]() {
    return 'FaceMatchVttTrack';
  }

  /**
   * @function createMappings
   * @description create map per face
   * @param {Array} downloaded - a list of face metadata files
   */
  createMappings(downloaded) {
    const lookup = {};
    const mappings = {};

    downloaded.forEach((download) => {
      const {
        data,
      } = download;

      data.Persons.forEach((c) => {
        const {
          Timestamp,
          FaceMatches = [],
          Person: {
            Index,
            Face,
          },
        } = c;

        const Confidence = (Face && Face.Confidence)
          || (FaceMatches.length > 0 && FaceMatches[0].Face && FaceMatches[0].Face.Confidence);

        const idx = Index.toString();

        /* case 1: filter low confidence */
        if (Confidence < this.minConfidencePercent) {
          return;
        }

        if (FaceMatches.length > 0) {
          /* eslint-disable arrow-body-style */
          const match = FaceMatches.reduce((prev, cur) => {
            return (prev.Similarity > cur.Similarity) ? prev : cur;
          });
          /* eslint-enable arrow-body-style */

          /* eslint-disable no-param-reassign */
          const { Similarity: matchConfidence, Face: { ExternalImageId } } = match || {};

          if (ExternalImageId) {
            /* capitalize name for webvtt */
            const name = ExternalImageId.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase());

            mappings[name] = mappings[name] || [];
            c.Person.Confidence = matchConfidence || Confidence;

            mappings[name].push({
              Timestamp,
              Item: c.Person,
            });

            /* register name to lookup table */
            lookup[idx] = name;
          }
        } else if (lookup[idx]) {
          /* this could be too aggressive as the similarity could be low... */
          c.Person.Confidence = Confidence;

          mappings[lookup[idx]].push({
            Timestamp: c.Timestamp,
            Item: c.Person,
          });
        }
      });
    });

    return mappings;
  }
}

/**
 * @class LabelVttTrack
 * @description create per label webvtt file
 */
class LabelVttTrack extends BaseVttTrack {
  constructor(Bucket, Keys, DstBucket, DstPrefix) {
    super(Bucket, Keys, DstBucket, DstPrefix, 'labels', {
      MinConfidence: 0.8,
    });
  }

  get [Symbol.toStringTag]() {
    return 'LabelVttTrack';
  }

  createMappings(downloaded) {
    const mappings = {};

    downloaded.forEach((download) => {
      const {
        data,
      } = download;

      data.Labels.forEach((c) => {
        const {
          Timestamp,
          Label: Item,
        } = c;

        if (Item.Confidence > this.minConfidencePercent) {
          const key = Item.Name.toString();

          /* labels don't have bounding, stuff '0' */
          Item.BoundingBox = {
            Left: 0,
            Top: 0,
            Width: 0,
            Height: 0,
          };

          mappings[key] = mappings[key] || [];
          mappings[key].push({ Timestamp, Item });
        }
      });
    });

    return mappings;
  }

  /**
   * @function createCue
   * @description override base class
   * @param {string} name - label
   * @param {object} cue - cue structure
   */
  createCue(name, cue) {
    const {
      confidence,
      tstart,
      tend,
    } = cue;

    const t0 = BaseVttTrack.toTimeString(tstart);
    const t1 = BaseVttTrack.toTimeString(tend);

    const align = 'center';
    const extra = (confidence)
      ? ` <c.confidence>(${Number.parseFloat(confidence).toFixed(2)})</c>`
      : '';

    const vtt = [];
    vtt.push(`${t0} --> ${t1} align:${align} size:20%`);
    vtt.push(`<c.${this.kind}>${name}</c>${extra}`);
    vtt.push('');

    return vtt;
  }
}


/**
 * @class SubtitleVttTrack
 * @description create subtitle webvtt track from transcription
 */
class SubtitleVttTrack extends BaseVttTrack {
  constructor(Bucket, Keys, DstBucket, DstPrefix, Dictionary = {}) {
    super(Bucket, Keys, DstBucket, DstPrefix, 'transcript');

    this.$dictionary = Object.assign({}, Dictionary);
  }

  get [Symbol.toStringTag]() {
    return 'SubtitleVttTrack';
  }

  get dictionary() {
    return this.$dictionary;
  }

  createMappings(downloaded) {
    let subtitleItems = [];

    downloaded.forEach((download) => {
      const {
        data: {
          results: {
            items,
          },
        },
      } = download;

      subtitleItems = subtitleItems.concat(items);
    });

    return { transcript: subtitleItems };
  }

  /**
   * @function lookup
   * @description replace phrase if it is found in dictionary
   * @param {string} phrase
   */
  lookup(phrase) {
    const words = phrase.replace(/-/g, ' ');
    return this.dictionary[words] ? this.dictionary[words] : words;
  }

  /**
   * @function lookahead
   * @description look ahead to try N words dictionary lookup
   * @param {(object|Array)} items - array of items for x-gram detection
   * @param {object} base - previous result { confidence, content }
   */
  lookahead(first, ...items) {
    const {
      confidence = 1,
      content = '',
    } = first;

    const phrase = items.reduce((acc, cur) => {
      const {
        type: t,
        alternatives: [{
          content: cc,
        }],
      } = cur;

      return (t === 'punctuation') ? `${acc}${cc}` : `${acc} ${cc}`;
    }, content);

    const suggested = this.lookup(phrase);

    /* collect all confidence levels */
    const minConfidence = ((xxx = items) => {
      const confidences = xxx.map((x) => {
        const {
          alternatives: [{
            confidence: xc = 1,
          }],
        } = x;

        return xc;
      });

      confidences.push(confidence);

      return Math.min(...confidences);
    })();

    return (suggested === phrase)
      ? {
        confidence: minConfidence,
        content: phrase,
        modified: false,
      }
      : {
        confidence: minConfidence,
        content: suggested,
        modified: true,
      };
  }

  createCuesPseudoData(name, data) {
    return data;
  }

  /**
   * @function createWebVtt
   * @param {string} name - not used
   * @param {array} data - list of transcription items
   */
  createWebVtt(name, data) {
    let webvtt = '';
    let tprev = 0;
    let lineTerms = 0;
    let lastPause = 0;
    let dialogIndex = 1;

    for (let i = 0; i < data.length; i += 1) {
      /* eslint-disable camelcase */
      const {
        type,
        start_time = 0,
        end_time = 0,
      } = data[i];

      const tsta = Number.parseFloat(start_time);
      const tend = Number.parseFloat(end_time);
      /* eslint-enable camelcase */

      const c = webvtt.substr(-1);

      if (type === 'punctuation' && (c === ' ' || c === '\n')) {
        webvtt = webvtt.slice(0, -1);
      }

      /* potential pause in the speech */
      const inferredEndOfSentence = (tsta - tprev) > 0.9;

      /* force a break on sentence every 3 seconds */
      const breakPerThreeSeconds = (tsta - lastPause) > 3;

      if (!lineTerms || inferredEndOfSentence || breakPerThreeSeconds) {
        lastPause = tsta;

        /* insert indexing */
        if (dialogIndex === 1) {
          webvtt += 'WEBVTT';
        }

        webvtt += `\n\n${dialogIndex}\n`;
        webvtt += `${BaseVttTrack.floatToTimeString(tsta)} --> ${BaseVttTrack.floatToTimeString(tsta + 3)}\n`;
        dialogIndex += 1;
        lineTerms = 1;
      }

      /* remember the last end time for detecting potential pause */
      if (tend) {
        tprev = tend;
      }

      /* here goes we try to lookahead and make corrections */
      const {
        alternatives: [{
          confidence = 1,
          content,
        }],
      } = data[i];

      let confidenceLevel = confidence;
      let phrase = this.lookup(content);

      /* lookahead(N-gram-count) */
      /* try 3 words first */
      if ((i + 2) < data.length) {
        const trigram = this.lookahead(...data.slice(i, i + 3));

        if (trigram && trigram.modified) {
          confidenceLevel = trigram.confidence;
          phrase = trigram.content;
          i += 2;
        } else {
          /* try 2 words first */
          const bigram = this.lookahead(...data.slice(i, i + 2));

          if (bigram && bigram.modified) {
            confidenceLevel = bigram.confidence;
            phrase = bigram.content;
            i += 1;
          }
        }
      }

      /* decorate text based on confidence level */
      let textClass = 'unsure';

      if (confidenceLevel > 0.5) {
        textClass = 'five';
      }

      if (confidenceLevel > 0.6) {
        textClass = 'six';
      }

      if (confidenceLevel > 0.7) {
        textClass = 'seven';
      }

      if (confidenceLevel > 0.8) {
        textClass = 'eight';
      }

      webvtt = (confidenceLevel > 0.9)
        ? `${webvtt}${phrase} `
        : `${webvtt}<c.${textClass}>${phrase} </c>`;

      /* line break */
      const enableLineBreak = false;

      if (enableLineBreak) {
        if ((lineTerms % 7 === 0) || ((lineTerms > 1) && (type === 'punctuation'))) {
          webvtt += '\n';
          lineTerms = 1;
        }
        lineTerms += 1;
      }
    } // for loop

    webvtt += '\n';

    return webvtt;
  }

  /* eslint-disable no-unused-vars */
  /**
   * @function createTimelines
   * @description return 'undefined' to disable timeline creation
   * @param {string} name
   * @param {array} data
   */
  createTimelines(name, data) {
    return undefined;
  }
  /* eslint-enable no-unused-vars */
}

/**
 * @class EntityJsonTrack
 * @description create JSON track from Comprehend result
 * This is not a webvtt track as comprehend provides word offset, not timestamp.
 */
class EntityJsonTrack extends BaseVttTrack {
  constructor(Bucket, Keys, DstBucket, DstPrefix) {
    super(Bucket, Keys, DstBucket, DstPrefix, 'entities');
  }

  get [Symbol.toStringTag]() {
    return 'EntityJsonTrack';
  }

  /**
   * @function run
   * @description override run
   */
  async run() {
    try {
      const mappings = {};

      const downloaded = await BaseVttTrack.download(this.bucket, this.keys);

      downloaded.forEach((download) => {
        const {
          data: {
            ResultList:
            [{
              Entities,
            }],
          },
        } = download;

        Entities.forEach((entity) => {
          const {
            Score,
            Type,
            Text,
          } = entity;

          if (Score > this.minConfidence) {
            const text = Text.toLowerCase();

            mappings[Type] = mappings[Type] || {};

            if (mappings[Type][text]) {
              const m = mappings[Type][text];

              mappings[Type][text].Confidence =
                ((m.Confidence * m.Count) + (Score)) / (m.Count + 1);
              mappings[Type][text].Count += 1;
            } else {
              mappings[Type][text] = { Count: 1, Confidence: Score };
            }
          }
        });
      });

      const Key = PATH.join(this.metaPrefix, `${this.kind}.json`);

      const params = {
        Bucket: this.dstBucket,
        Key,
        Body: JSON.stringify(mappings, null, 2),
        ContentType: 'application/json',
        ContentDisposition: 'attachment',
      };

      await BaseVttTrack.upload(params);

      const response = {
        Kind: this.kind,
        Bucket: this.dstBucket,
        MetaTracks: {
          Prefix: this.metaPrefix,
          Keys: [Key],
        },
      };

      process.env.ENV_QUIET || console.log(JSON.stringify(response, null, 2));

      return response;
    } catch (e) {
      throw new WebVttTrackError(e);
    }
  }
}

/**
 * @class KeyPhraseJsonTrack
 * @description create JSON track from Comprehend result
 * This is not a webvtt track as comprehend provides word offset, not timestamp.
 */
class KeyPhraseJsonTrack extends BaseVttTrack {
  constructor(Bucket, Keys, DstBucket, DstPrefix) {
    super(Bucket, Keys, DstBucket, DstPrefix, 'phrases');
  }

  get [Symbol.toStringTag]() {
    return 'KeyPhraseJsonTrack';
  }

  async run() {
    try {
      const mappings = {};

      const downloaded = await BaseVttTrack.download(this.bucket, this.keys);

      downloaded.forEach((download) => {
        const {
          data: {
            ResultList: [{
              KeyPhrases: phrases,
            }],
          },
        } = download;

        phrases.forEach((phrase) => {
          const {
            Score,
            Text,
          } = phrase;

          if (Score > this.minConfidence) {
            const text = Text.toLowerCase();
            mappings.KeyPhrases = mappings.KeyPhrases || {};

            if (mappings.KeyPhrases[text]) {
              const m = mappings.KeyPhrases[text];

              mappings.KeyPhrases[text].Confidence =
                ((m.Confidence * m.Count) + (Score)) / (m.Count + 1);
              mappings.KeyPhrases[text].Count += 1;
            } else {
              mappings.KeyPhrases[text] = { Count: 1, Confidence: Score };
            }
          }
        });
      });

      const Key = PATH.join(this.metaPrefix, `${this.kind}.json`);

      const params = {
        Bucket: this.dstBucket,
        Key,
        Body: JSON.stringify(mappings, null, 2),
        ContentType: 'application/json',
        ContentDisposition: 'attachment',
      };

      await BaseVttTrack.upload(params);

      const response = {
        Kind: this.kind,
        Bucket: this.dstBucket,
        MetaTracks: {
          Prefix: this.metaPrefix,
          Keys: [Key],
        },
      };

      process.env.ENV_QUIET || console.log(JSON.stringify(response, null, 2));

      return response;
    } catch (e) {
      throw new WebVttTrackError(e);
    }
  }
}

/**
 * @class MetadataTrackFactory
 * @description Factory class to provide helper functions
 */
class MetadataTrackFactory {
  get [Symbol.toStringTag]() {
    return 'MetadataTrackFactory';
  }

  /**
   * @static
   * @function createInstanceByKind
   * @description helper function to create Track instance
   * @param {string} Kind - faces, celebs, entities, and etc
   * @param {string} Bucket - media-analytics-solution bucket
   * @param {string} Keys - media-analytics-solution result keys
   * @param {string} DstBucket - destination bucket, ibc2018
   * @param {string} DstPrefix - destination key prefix
   */
  static createInstanceByKind(Kind, Bucket, Keys, DstBucket, DstPrefix) {
    if (Kind === 'persons') {
      return new PersonVttTrack(Bucket, Keys, DstBucket, DstPrefix);
    }

    if (Kind === 'celebs') {
      return new CelebVttTrack(Bucket, Keys, DstBucket, DstPrefix);
    }

    if (Kind === 'faces') {
      return new FaceVttTrack(Bucket, Keys, DstBucket, DstPrefix);
    }

    if (Kind === 'face_matches') {
      return new FaceMatchVttTrack(Bucket, Keys, DstBucket, DstPrefix);
    }

    if (Kind === 'labels') {
      return new LabelVttTrack(Bucket, Keys, DstBucket, DstPrefix);
    }

    if (Kind === 'transcript') {
      return new SubtitleVttTrack(Bucket, Keys, DstBucket, DstPrefix);
    }

    if (Kind === 'entities') {
      return new EntityJsonTrack(Bucket, Keys, DstBucket, DstPrefix);
    }

    if (Kind === 'phrases') {
      return new KeyPhraseJsonTrack(Bucket, Keys, DstBucket, DstPrefix);
    }

    throw new WebVttTrackError(`${Kind} NOT SUPPORTED`);
  }
}

module.exports = {
  BaseVttTrack,
  CelebVttTrack,
  PersonVttTrack,
  FaceVttTrack,
  FaceMatchVttTrack,
  LabelVttTrack,
  SubtitleVttTrack,
  WebVttTrackError,
  EntityJsonTrack,
  KeyPhraseJsonTrack,
  MetadataTrackFactory,
};
