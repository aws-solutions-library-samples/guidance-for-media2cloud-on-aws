import SolutionManifest from '/solution-manifest.js';
import ApiHelper from '../apiHelper.js';
import AppUtils from '../appUtils.js';
import MediaFactory from './mediaFactory.js';
import MediaTypes from './mediaTypes.js';
import IotSubscriber from '../iotSubscriber.js';

const ID_DEMOAPP = '#demo-app';
const ON_MEDIAADDED = 'mediamanager:media:added';
const ON_MEDIAUPDATED = 'mediamanager:media:updated';
const ON_MEDIAERROR = 'mediamanager:media:error';
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

export default class MediaManager {
  constructor() {
    this.$eventSource = $('<div/>')
      .attr('id', `media-manager-${AppUtils.randomHexstring()}`);
    $(ID_DEMOAPP).append(this.$eventSource);

    this.$collection = MEDIATYPES.reduce((a0, c0) => ({
      ...a0,
      [c0]: {
        nextToken: PAGING_NOTSTARTED,
        items: [],
      },
    }), undefined);
    this.$overallStatusNextTokens = {
      [SolutionManifest.Statuses.Processing]: PAGING_NOTSTARTED,
      [SolutionManifest.Statuses.Completed]: PAGING_NOTSTARTED,
      [SolutionManifest.Statuses.Error]: PAGING_NOTSTARTED,
    };
    this.$pageSize = DEFAULT_PAGESIZE;
    this.subscribeIot();
  }

  static getSingleton() {
    if (!window.AWSomeNamespace.MediaManager) {
      window.AWSomeNamespace.MediaManager = new MediaManager();
    }
    return window.AWSomeNamespace.MediaManager;
  }

  static get Event() {
    return {
      Media: {
        Added: ON_MEDIAADDED,
        Updated: ON_MEDIAUPDATED,
        Error: ON_MEDIAERROR,
      },
    };
  }

  get eventSource() {
    return this.$eventSource;
  }

  get collection() {
    return this.$collection;
  }

  get pageSize() {
    return this.$pageSize;
  }

  set pageSize(val) {
    this.$pageSize = Number.parseInt(val || DEFAULT_PAGESIZE, 10);
  }

  get overallStatusNextTokens() {
    return this.$overallStatusNextTokens;
  }

  addMediaToCollection(media) {
    if (!media) {
      return undefined;
    }
    const medias = Array.isArray(media) ? media : [media];
    for (let i = 0; i < medias.length; i++) {
      const type = medias[i].type;
      if (this.collection[type] && this.collection[type].items !== undefined) {
        this.collection[type].items.push(medias[i]);
      }
    }
    return medias;
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
  }

  async scanRecords() {
    const records = await Promise.all(MEDIATYPES.map(type => this.scanRecordsByCategory(type)));
    return records.reduce((a0, c0) => a0.concat(c0), []);
  }

  async scanProcessingRecords() {
    const overallStatus = SolutionManifest.Statuses.Processing;
    const response = await this.scanRecordsByStatus(overallStatus, 1);
    console.log(JSON.stringify(response, null, 2));
    const medias = await this.batchInsertMedia(response.Items);
    this.addMediaToCollection(medias);
    return medias;
  }

  async scanErrorRecords() {
    const overallStatus = SolutionManifest.Statuses.Error;
    const response = await this.scanRecordsByStatus(overallStatus);
    console.log(JSON.stringify(response, null, 2));
    const medias = await this.batchInsertMedia(response.Items);
    this.addMediaToCollection(medias);
    return medias;
  }

  async scanCompletedRecords() {
    const overallStatus = SolutionManifest.Statuses.Completed;
    const response = await this.scanRecordsByStatus(overallStatus);
    console.log(JSON.stringify(response, null, 2));
    const medias = await this.batchInsertMedia(response.Items);
    this.addMediaToCollection(medias);
    return medias;
  }

  async scanRecordsByStatus(overallStatus, pageSize = PROCESSINGJOBS_PAGESIZE) {
    const token = this.overallStatusNextTokens[overallStatus];
    const query = {
      overallStatus,
      pageSize,
    };
    if (token && typeof token !== 'symbol') {
      query.token = token;
    }
    const response = await ApiHelper.scanRecords(query);
    this.overallStatusNextTokens[overallStatus] = response.NextToken || PAGING_NOMOREDATA;
    return response;
  }

  noMoreProccessingJob() {
    return this.noMoreDataByStatus(SolutionManifest.Statuses.Processing);
  }

  noMoreCompletedJob() {
    return this.noMoreDataByStatus(SolutionManifest.Statuses.Completed);
  }

  noMoreErrorJob() {
    return this.noMoreDataByStatus(SolutionManifest.Statuses.Error);
  }

  noMoreDataByStatus(status) {
    return this.overallStatusNextTokens[status] === PAGING_NOMOREDATA;
  }

  async batchInsertMedia(items) {
    return (await Promise.all(items.map(x => this.insertMedia(x)))).filter(x => x);
  }

  async insertMedia(item) {
    if (!(item || {}).uuid) {
      console.error('item contains no uuid');
      return undefined;
    }
    if (this.findMediaByUuid(item.uuid) !== undefined) {
      return undefined;
    }
    const media = await MediaFactory.createMedia(item.uuid).catch(e => e);
    if (media instanceof Error) {
      console.error(media.message);
      return undefined;
    }
    return media;
  }

  findMediaByType(type) {
    return (this.collection[type] || {}).items || [];
  }

  findMediaByUuid(uuid) {
    const types = Object.keys(this.collection);
    while (types.length) {
      const typedItems = this.findMediaByType(types.shift());
      const item = typedItems.find(x => x.uuid === uuid);
      if (item !== undefined) {
        return item;
      }
    }
    return undefined;
  }

  findMediaByStatus(status) {
    const medias = [];
    const types = Object.keys(this.collection);
    while (types.length) {
      const typedItems = this.findMediaByType(types.shift());
      medias.splice(medias.length, 0, ...typedItems.filter(x => x.status === status));
    }
    return medias.filter(x => x);
  }

  findMediaByOverallStatus(overallStatus) {
    const medias = [];
    const types = Object.keys(this.collection);
    while (types.length) {
      const typedItems = this.findMediaByType(types.shift());
      medias.splice(medias.length, 0, ...typedItems.filter(x => x.overallStatus === overallStatus));
    }
    return medias.filter(x => x);
  }

  findProcessingMedias() {
    return this.findMediaByOverallStatus(SolutionManifest.Statuses.Processing);
  }

  findCompletedMedias() {
    return this.findMediaByOverallStatus(SolutionManifest.Statuses.Completed);
  }

  findErrorMedias() {
    return this.findMediaByOverallStatus(SolutionManifest.Statuses.Error);
  }

  subscribeIot() {
    const iot = IotSubscriber.getSingleton();
    iot.eventSource.on(IotSubscriber.Event.Message.Received, async (event, payload) =>
      this.onIotMessage(payload));
  }

  async onIotMessage(payload) {
    console.log(`mediaManager: received ${JSON.stringify(payload, null, 2)}`);
    let media = this.findMediaByUuid(payload.uuid);
    if (!media) {
      media = await this.insertMedia(payload);
      this.addMediaToCollection(media);
      return (media)
        ? this.eventSource.trigger(MediaManager.Event.Media.Added, [media])
        : undefined;
    }
    if (payload.status === SolutionManifest.Statuses.IngestCompleted
      || payload.status === SolutionManifest.Statuses.AnalysisCompleted) {
      await media.refresh();
      return this.eventSource.trigger(MediaManager.Event.Media.Updated, [media]);
    }
    if (payload.overallStatus === SolutionManifest.Statuses.Error) {
      await media.setError();
      return this.eventSource.trigger(MediaManager.Event.Media.Error, [media]);
    }
    return media;
  }
}
