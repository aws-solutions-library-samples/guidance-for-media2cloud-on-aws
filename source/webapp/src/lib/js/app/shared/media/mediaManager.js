// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import ApiHelper from '../apiHelper.js';
import MediaFactory from './mediaFactory.js';
import MediaTypes from './mediaTypes.js';
import {
  RegisterIotMessageEvent,
} from '../iotSubscriber.js';

const {
  Statuses: {
    Processing: STATUS_PROCESSING,
    Completed: STATUS_COMPLETED,
    Error: STATUS_ERROR,
    IngestStarted: STATUS_INGEST_STARTED,
    IngestCompleted: STATUS_INGEST_COMPLETED,
    AnalysisStarted: STATUS_ANALYSIS_STARTED,
    AnalysisCompleted: STATUS_ANALYSIS_COMPLETED,
  },
} = SolutionManifest;

const DEFAULT_PAGESIZE = 10;
const PROCESSINGJOBS_PAGESIZE = 20;
const PAGING_NOTSTARTED = Symbol('Paging not started');
const PAGING_NOMOREDATA = Symbol('Paging no more data');
const MEDIATYPES = [
  MediaTypes.Video,
  MediaTypes.Podcast,
  MediaTypes.Photo,
  MediaTypes.Document,
];

const ON_MEDIA_ADDED = 'mediamanager:media:added';
const ON_MEDIA_UPDATED = 'mediamanager:media:updated';
const ON_MEDIA_ERROR = 'mediamanager:media:error';

/* singleton implementation */
let _singleton;

/* receive update event on media */
const _receivers = {};

const _onMediaEvent = (event, media) => {
  setTimeout(async () => {
    const names = Object.keys(_receivers);
    try {
      await Promise.all(
        names.map((name) =>
          _receivers[name](event, media)
            .catch((e) => {
              console.error(
                'ERR:',
                `_onMediaEvent.${event}.${name}:`,
                e.message
              );
              return undefined;
            }))
      );

      console.log(
        'INFO:',
        `_onMediaEvent.${event}:`,
        `${names.length} receivers:`,
        names.join(', ')
      );
    } catch (e) {
      console.error(
        'ERR:',
        `_onMediaEvent.${event}:`,
        e
      );
    }
  }, 10);
};

class MediaManager {
  constructor() {
    this.$collection = MEDIATYPES
      .reduce((a0, c0) => ({
        ...a0,
        [c0]: {
          nextToken: PAGING_NOTSTARTED,
          items: [],
        },
      }), {});

    this.$overallStatusNextTokens = [
      STATUS_PROCESSING,
      STATUS_COMPLETED,
      STATUS_ERROR,
    ].reduce((a0, c0) => ({
      ...a0,
      [c0]: PAGING_NOTSTARTED,
    }));

    this.$pageSize = DEFAULT_PAGESIZE;

    RegisterIotMessageEvent(
      'mediamanager',
      this.onIotMessage.bind(this)
    );
    console.log('RegisterIotMessageEvent', 'mediamanager');

    _singleton = this;
  }

  get collection() {
    return this.$collection;
  }

  get pageSize() {
    return this.$pageSize;
  }

  set pageSize(val) {
    this.$pageSize = Number(val || DEFAULT_PAGESIZE);
  }

  get overallStatusNextTokens() {
    return this.$overallStatusNextTokens;
  }

  addMediaToCollection(media) {
    if (!media) {
      return undefined;
    }

    let mediaArray = media;
    if (!Array.isArray(media)) {
      mediaArray = [
        media,
      ];
    }

    mediaArray.forEach((item) => {
      const typedCollection = this.collection[item.type];
      if ((typedCollection || {}).items !== undefined) {
        const found = typedCollection.items
          .find((x) =>
            x.uuid === item.uuid);
        if (!found) {
          typedCollection.items.push(item);
        }
      }
    });

    return mediaArray;
  }

  getNextTokenByType(type) {
    return (this.collection[type] || {}).nextToken;
  }

  setNextTokenByType(type, token) {
    this.collection[type].nextToken = token || PAGING_NOMOREDATA;
  }

  noMoreData(type) {
    return this.getNextTokenByType(type) === PAGING_NOMOREDATA;
  }

  async scanRecordsByCategory(type) {
    try {
      if (this.noMoreData(type)) {
        return undefined;
      }

      const query = {
        pageSize: this.pageSize,
        type,
      };

      const nextToken = this.getNextTokenByType(type);
      if (nextToken && typeof nextToken !== 'symbol') {
        query.token = nextToken;
      }

      const response = await ApiHelper.scanRecords(query);
      this.setNextTokenByType(type, response.NextToken);

      const medias = await this.batchInsertMedia(response.Items);
      this.addMediaToCollection(medias);

      return medias;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async scanRecords() {
    let records = await Promise.all(MEDIATYPES
      .map((type) =>
        this.scanRecordsByCategory(type)));
    records = records.flat(1);
    return records;
  }

  async scanProcessingRecords() {
    try {
      let mediaArray = await this.scanRecordsByStatus(STATUS_PROCESSING, 1)
        .then((res) =>
          res.Items);

      if (mediaArray) {
        mediaArray = await this.batchInsertMedia(mediaArray);
      }

      this.addMediaToCollection(mediaArray);

      return mediaArray;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async scanErrorRecords() {
    try {
      let mediaArray = await this.scanRecordsByStatus(STATUS_ERROR)
        .then((res) =>
          res.Items);

      if (mediaArray) {
        mediaArray = await this.batchInsertMedia(mediaArray);
      }

      this.addMediaToCollection(mediaArray);

      return mediaArray;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async scanCompletedRecords() {
    try {
      let mediaArray = await this.scanRecordsByStatus(STATUS_COMPLETED)
        .then((res) =>
          res.Items);

      if (mediaArray) {
        mediaArray = await this.batchInsertMedia(mediaArray);
      }

      this.addMediaToCollection(mediaArray);

      return mediaArray;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async scanRecordsByStatus(
    overallStatus,
    pageSize = PROCESSINGJOBS_PAGESIZE
  ) {
    try {
      const query = {
        overallStatus,
        pageSize,
      };

      const token = this.overallStatusNextTokens[overallStatus];
      if (token && typeof token !== 'symbol') {
        query.token = token;
      }

      return ApiHelper.scanRecords(query)
        .then((res) => {
          if ((res || {}).NextToken) {
            this.overallStatusNextTokens[overallStatus] = res.NextToken;
          }
          return res;
        });
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  noMoreProccessingJob() {
    return this.noMoreDataByStatus(STATUS_PROCESSING);
  }

  noMoreCompletedJob() {
    return this.noMoreDataByStatus(STATUS_COMPLETED);
  }

  noMoreErrorJob() {
    return this.noMoreDataByStatus(STATUS_ERROR);
  }

  noMoreDataByStatus(status) {
    return this.overallStatusNextTokens[status] === PAGING_NOMOREDATA;
  }

  async batchInsertMedia(items) {
    const mediaArray = await Promise.all(items
      .map((item) =>
        this.insertMedia(item)));

    return mediaArray
      .filter((x) =>
        x !== undefined);
  }

  async insertMedia(item) {
    try {
      let media = this.findMediaByUuid(item.uuid);
      if (media !== undefined) {
        return undefined;
      }

      media = await MediaFactory.lazyCreateMedia(item.uuid);

      return media;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async removeMedia(item) {
    try {
      /* remove media in backend */
      await ApiHelper.purgeRecord(item.uuid);

      /* remove item from media manager */
      const types = Object.keys(this.collection);

      while (types.length) {
        const type = types.shift();

        let found = (this.collection[type].items || [])
          .findIndex((media) =>
            media.uuid === item.uuid);

        if (found > -1) {
          found = this.collection[type].items
            .splice(found, 1);

          return found[0];
        }
      }

      return undefined;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  findMediaByType(type) {
    return (this.collection[type] || {}).items || [];
  }

  findMediaByUuid(uuid) {
    const types = Object.keys(this.collection);

    while (types.length) {
      const items = this.findMediaByType(types.shift());

      const item = items.find((media) =>
        media.uuid === uuid);

      if (item !== undefined) {
        return item;
      }
    }

    return undefined;
  }

  findMediaByStatus(status) {
    const mediaArray = Object.keys(this.collection)
      .map((type) =>
        this.findMediaByType(type)
          .filter((media) =>
            media.status === status))
      .flat(1)
      .filter((media) =>
        media !== undefined);

    return mediaArray;
  }

  findMediaByOverallStatus(overallStatus) {
    const mediaArray = Object.keys(this.collection)
      .map((type) =>
        this.findMediaByType(type)
          .filter((media) =>
            media.overallStatus === overallStatus))
      .flat(1)
      .filter((media) =>
        media !== undefined);

    return mediaArray;
  }

  findProcessingMedias() {
    return this.findMediaByOverallStatus(STATUS_PROCESSING);
  }

  findCompletedMedias() {
    return this.findMediaByOverallStatus(STATUS_COMPLETED);
  }

  findErrorMedias() {
    return this.findMediaByOverallStatus(STATUS_ERROR);
  }

  async onIotMessage(payload) {
    let media = this.findMediaByUuid(payload.uuid);

    if (!media) {
      console.log(
        'onIotMessage',
        'insertMedia',
        payload
      );

      media = await this.insertMedia(payload);
      this.addMediaToCollection(media);

      if (media) {
        return _onMediaEvent(
          ON_MEDIA_ADDED,
          media
        );
      }

      return undefined;
    }

    if (payload.status === STATUS_ANALYSIS_STARTED
    || payload.status === STATUS_ANALYSIS_COMPLETED) {
      await media.refresh();
    }

    if (payload.status === STATUS_INGEST_STARTED
    || payload.status === STATUS_INGEST_COMPLETED
    || payload.status === STATUS_ANALYSIS_STARTED
    || payload.status === STATUS_ANALYSIS_COMPLETED) {
      return _onMediaEvent(
        ON_MEDIA_UPDATED,
        media
      );
    }

    if (payload.overallStatus === STATUS_ERROR) {
      await media.setError();
      return _onMediaEvent(
        ON_MEDIA_ERROR,
        media
      );
    }

    return media;
  }

  async lazyGetByUuid(uuid) {
    try {
      let media = this.findMediaByUuid(uuid);
      if (media) {
        return media;
      }

      media = await MediaFactory.lazyCreateMedia(uuid);

      return media;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }
}

const GetMediaManager = () => {
  if (_singleton === undefined) {
    const notused_ = new MediaManager();
  }

  return _singleton;
};

const RegisterMediaEvent = (name, target) => {
  if (!name || typeof target !== 'function') {
    return false;
  }

  _receivers[name] = target;
  return true;
};

const UnregisterMediaEvent = (name) => {
  delete _receivers[name];
};

export {
  MediaManager,
  GetMediaManager,
  RegisterMediaEvent,
  UnregisterMediaEvent,
  ON_MEDIA_ADDED,
  ON_MEDIA_UPDATED,
  ON_MEDIA_ERROR,
};
