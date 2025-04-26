// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import AppUtils from '../app/shared/appUtils.js';
import ApiHelper from '../app/shared/apiHelper.js';
import {
  GetS3Utils,
} from '../app/shared/s3utils.js';

const {
  readableDuration,
  shorten,
  validateUuid,
} = AppUtils;
const {
  getRecord,
} = ApiHelper;

const ID = 'embeddedapp';
const POSTER = '/images/background.png';

export default class EmbeddedApp {
  async show() {
    const params = _parseSearchParams(document.location);

    const parent = $(`#${ID}`);
    parent.children().remove();

    const container = $('<div/>')
      .addClass('col-12 m-0 p-0');
    parent.append(container);

    container.ready(async () => {
      const elements = await this.buildEmbeddedVideo(params);
      container.append(elements);
    });

    return this;
  }

  async hide() {
    const parent = $(`#${ID}`);
    parent.children().remove();
    return this;
  }

  async buildEmbeddedVideo(params = {}) {
    const { uuid, celeb, begin, end } = params;

    if (!uuid || !validateUuid(uuid)) {
      return await _videoWithoutSource();
    }

    const ingest = await getRecord(uuid)
      .catch(() => undefined);

    if (!ingest) {
      return await _videoWithoutSource();
    }

    const { basename, duration } = ingest;
    const url = await _getPresignUrl(ingest);

    let timestamps = [];
    if (begin !== undefined) {
      timestamps.push([begin, end]);
    }

    // has celebrity name
    if (celeb !== undefined) {
      if (timestamps.length === 0) {
        timestamps = await _getFacematchTimestamps(ingest, celeb);
      }

      // still no timestamp?
      if (timestamps.length === 0) {
        return await _videoWithSource(url, basename, duration);
      }

      // enable playlist
      if (timestamps.length > 1) {
        return await _videoPlaylist(url, timestamps, celeb);
      }

      // single timestamp
      return await _videoWithSingleTimestamp(url, basename, timestamps, celeb);
    }

    // no celeb
    if (timestamps.length === 0) {
      return await _videoWithSource(url, basename, duration);
    }

    // single timestamp
    return await _videoWithSingleTimestamp(url, basename, timestamps);
  }
}

function _parseSearchParams(location) {
  const params = {};

  const searchParams = (new URL(location)).searchParams;
  for (const [key, value] of searchParams.entries()) {
    if (!value || ['undefined', 'all'].includes(value.toLowerCase())) {
      continue;
    }

    if (['begin', 'end'].includes(key)) {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        params[key] = num;
      }
    } else {
      params[key] = value;
    }
  }

  return params;
}

async function _getPresignUrl(data) {
  const {
    destination: { bucket },
    proxies = [],
  } = data;

  const key = (proxies.find((x) => x.type === 'video') || {}).key;

  const s3utils = GetS3Utils();

  return await s3utils.signUrl(bucket, key);
}

async function _getFacematchTimestamps(data, celeb) {
  const {
    destination: { bucket, prefix },
  } = data;
  const timestamps = [];

  let facematch = `${prefix}/metadata/facematch/facematch.json`;
  facematch = facematch.replace(/\/{1,}/g, '/');

  const s3utils = GetS3Utils();
  facematch = await s3utils.getObject(bucket, facematch)
    .catch(() => undefined);

  if (facematch === undefined) {
    return timestamps;
  }

  facematch = await facematch.Body.transformToString()
    .then((res) => JSON.parse(res));
  facematch = facematch[celeb] || [];

  for (const { begin, end } of facematch) {
    timestamps.push([begin, end]);
  }

  return timestamps;
}

async function _videoWithoutSource() {
  console.log('Video without source');

  const video = _buildVideoElement();
  return [video, undefined];
}

async function _videoWithSource(url, basename, duration) {
  console.log(`Video with source: ${basename}: ${readableDuration(duration, false)}`);

  const video = _buildVideoElement();
  video.attr('src', url);

  const [box, nameEl, durationEl] = _buildOverlayElement();
  const name = shorten(basename, 20);
  nameEl.text(name);
  durationEl.text(readableDuration(duration, false));

  return [video, box];
}

async function _videoWithSingleTimestamp(url, basename, timestamps, optionalCeleb = '') {
  console.log(`Video with single timestamp: ${basename}: ${optionalCeleb}: ${readableDuration(timestamps[0], false)} / ${Number.isNaN(timestamps[1]) ? '--' : readableDuration(timestamps[1], false)}`);

  let [tsta, tend] = timestamps[0];

  let src = url;
  src = `${src}#t=${tsta / 1000}`;

  if (tend !== undefined && !Number.isNaN(tend)) {
    src = `${src},${tend / 1000}`;
  }

  const video = _buildVideoElement();
  video.attr('src', src);

  const [box, nameEl, durationEl] = _buildOverlayElement();

  if (optionalCeleb.length > 0) {
    nameEl.text(optionalCeleb);
  } else {
    nameEl.text(shorten(basename, 20));
  }

  let duration = '-- / --';
  duration = duration.replace('--', readableDuration(tsta, false));
  if (tend !== undefined && !Number.isNaN(tend)) {
    duration = duration.replace('--', readableDuration(tend, false));
  }
  durationEl.text(duration);

  return [video, box];
}

async function _videoPlaylist(url, timestamps, celeb) {
  console.log(`Video playlist: ${celeb}: ${timestamps.length} segments.`);

  const video = _buildVideoElement();
  const [box, nameEl, durationEl] = _buildOverlayElement();

  video.ready(() => {
    let playlistIndex = 0;
    let tsta;
    let tend;
    let src;
    let duration;
    let name;

    [tsta, tend] = timestamps[playlistIndex++];
    src = `${url}#t=${tsta / 1000},${tend / 1000}`;
    video.attr('src', src);

    name = `${celeb} (${playlistIndex} of ${timestamps.length})`;
    nameEl.text(name);

    duration = `${readableDuration(tsta, false)} / ${readableDuration(tend, false)}`;
    durationEl.text(duration);

    video.on('pause', () => {
      // all segment played
      if (timestamps.length === playlistIndex) {
        video.off('pause');
        video[0].pause();
        durationEl.text('All segments ended');
        return;
      }

      // user pause event
      if (playlistIndex > 0) {
        console.log(`pause: ${video[0].currentTime}, ${timestamps[playlistIndex - 1]}`);
        const currentTime = Math.round(video[0].currentTime * 1000);
        if (currentTime < timestamps[playlistIndex - 1][1]) {
          console.log('User paused');
          video[0].pause();
          return;
        }
      }

      // play next segment
      [tsta, tend] = timestamps[playlistIndex++];
      src = `${url}#t=${tsta / 1000},${tend / 1000}`;
      video.attr('src', src);

      name = `${celeb} (${playlistIndex} of ${timestamps.length})`;
      nameEl.text(name);

      duration = `${readableDuration(tsta, false)} / ${readableDuration(tend, false)}`;
      durationEl.text(duration);
    });
  });

  return [video, box];
}

function _buildVideoElement() {
  const video = $('<video/>')
    .attr('crossorigin', 'anonymous')
    .attr('preload', 'metadata')
    .attr('autoplay', 'autoplay')
    .attr('controls', true)
    .attr('width', '100%')
    .attr('poster', POSTER)
    .css('aspect-ratio', '16 / 9')
    .css('background', 'black');

  return video;
}

function _buildOverlayElement() {
  const box = $('<div/>')
    .addClass('bbox')
    .css('background-color', 'black')
    .css('border-color', 'white')
    .css('left', 10)
    .css('top', 10);

  const nameEl = $('<div/>')
    .addClass('inline-text-sm')
    .addClass('text-white');
  box.append(nameEl);

  const durationEl = $('<div/>')
    .addClass('inline-text-sm')
    .addClass('text-white');
  box.append(durationEl);

  return [box, nameEl, durationEl];
}
