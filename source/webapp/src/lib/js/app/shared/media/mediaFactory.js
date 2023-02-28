// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import ApiHelper from '../apiHelper.js';
import S3Utils from '../s3utils.js';
import VideoMedia from './videoMedia.js';
import PhotoMedia from './photoMedia.js';
import PodcastMedia from './podcastMedia.js';
import DocumentMedia from './documentMedia.js';
// preview components
import VideoPreview from './preview/videoPreview.js';
import PodcastPreview from './preview/podcastPreview.js';
import PhotoPreview from './preview/photoPreview.js';
import DocumentPreview from './preview/documentPreview.js';
import MediaTypes from './mediaTypes.js';

export default class MediaFactory {
  static async createMedia(uuid) {
    const data = await ApiHelper.getRecord(uuid);
    if (!Object.keys(data).length) {
      throw new Error(`${uuid} contains no data`);
    }
    if (Array.isArray(data.mediainfo) && data.mediainfo.length > 0) {
      const mediainfo = await MediaFactory.fetchMediainfo(data);
      if (mediainfo) {
        data.mediainfo = mediainfo;
      }
    } else if (data.imageinfo) {
      const imageinfo = await MediaFactory.fetchImageinfo(data);
      if (imageinfo) {
        data.imageinfo = imageinfo;
      }
    }
    let media;
    switch (data.type) {
      case MediaTypes.Video:
      case 'mxf':
        media = new VideoMedia(data);
        break;
      case MediaTypes.Audio:
        media = new PodcastMedia(data);
        break;
      case MediaTypes.Image:
        media = new PhotoMedia(data);
        break;
      case MediaTypes.Document:
        media = new DocumentMedia(data);
        break;
      default:
        throw new Error(`${uuid} type '${data.type}' not supported`);
    }
    return media;
  }

  static async lazyCreateMedia(uuid) {
    const data = await ApiHelper.getRecord(uuid);
    if (!Object.keys(data).length) {
      throw new Error(`${uuid} contains no data`);
    }
    let media;
    switch (data.type) {
      case MediaTypes.Video:
      case 'mxf':
        media = new VideoMedia(data);
        break;
      case MediaTypes.Audio:
        media = new PodcastMedia(data);
        break;
      case MediaTypes.Image:
        media = new PhotoMedia(data);
        break;
      case MediaTypes.Document:
        media = new DocumentMedia(data);
        break;
      default:
        throw new Error(`${uuid} type '${data.type}' not supported`);
    }
    return media;
  }

  static async createPreviewComponent(media, optionalSearchResults) {
    await media.getAnalysisResults();
    switch (media.type) {
      case MediaTypes.Video:
        return new VideoPreview(media, optionalSearchResults);
      case MediaTypes.Audio:
        return new PodcastPreview(media, optionalSearchResults);
      case MediaTypes.Image:
        return (new PhotoPreview(media, optionalSearchResults)).preload();
      case MediaTypes.Document:
        return (new DocumentPreview(media, optionalSearchResults)).preload();
      default:
        return undefined;
    }
  }

  static async fetchMediainfo(data) {
    const bucket = data.destination.bucket;
    const key = data.mediainfo.find(x => /\.json$/.test(x));
    return (!bucket && !key)
      ? undefined
      : S3Utils.getObject(bucket, key)
        .then(response => JSON.parse(response.Body.toString()).mediaInfo)
        .catch(e => console.error(e));
  }

  static async fetchImageinfo(data) {
    const bucket = data.destination.bucket;
    const key = data.imageinfo;
    return (!bucket || !key)
      ? undefined
      : S3Utils.getObject(bucket, key)
        .then(response => JSON.parse(response.Body.toString()))
        .catch(e => console.error(e));
  }
}
