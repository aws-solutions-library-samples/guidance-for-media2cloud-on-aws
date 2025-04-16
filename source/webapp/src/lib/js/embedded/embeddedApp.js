// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import AppUtils from '../app/shared/appUtils.js';
import ApiHelper from '../app/shared/apiHelper.js';
import {
  GetS3Utils,
} from '../app/shared/s3utils.js';

const {
  readableDuration,
} = AppUtils;
const {
  getRecord,
} = ApiHelper;

const ID = 'embeddedapp';

export default class EmbeddedApp {
  async show() {
    const params = _parseSearchParams(document.location);

    const parent = $(`#${ID}`);
    parent.children().remove();

    const container = $('<div/>')
      .addClass('col-12 m-0 p-0');
    parent.append(container);

    container.ready(async () => {
      const video = await this.buildEmbeddedVideo(params);
      container.append(video);
    });

    return this;
  }

  async hide() {
    const parent = $(`#${ID}`);
    parent.children().remove();
    return this;
  }

  async buildEmbeddedVideo(params = {}) {
    const { uuid, celeb } = params;
    let { url, timestamps = [] } = await this.downloadData(uuid, celeb);

    const video = $('<video/>')
      .attr('crossorigin', 'anonymous')
      .attr('preload', 'metadata')
      .attr('autoplay', 'autoplay')
      .attr('controls', true)
      .attr('width', '100%')
      .css('aspect-ratio', '16 / 9')
      .css('background', 'black');

    // show name
    const box = $('<div/>')
      .addClass('bbox')
      .css('background-color', 'black')
      .css('border-color', 'white')
      .css('left', 10)
      .css('top', 10);

    const nameEl = $('<div/>')
      .addClass('inline-text-sm')
      .addClass('text-white')
      .append(celeb || '--');
    box.append(nameEl);

    const durationEl = $('<div/>')
      .addClass('inline-text-sm')
      .addClass('text-white')
      .append('-- / --');
    box.append(durationEl);

    let { begin, end } = params;
    begin = Number(begin);
    end = Number(end);

    if (!(Number.isNaN(begin) && Number.isNaN(end))) {
      timestamps = [];
      timestamps.push([begin, end]);
    }

    video.ready(() => {
      if (url === undefined || timestamps.length === 0) {
        return;
      }

      let playlistIndex = 0;
      let [tsta, tend] = timestamps[playlistIndex++];
      let src = `${url}#t=${tsta / 1000},${tend / 1000}`;
      video.attr('src', src);

      let duration = `${readableDuration(tsta, false)} / ${readableDuration(tend, false)}`;
      durationEl.text(duration);
      nameEl.text(`${celeb} (${playlistIndex} of ${timestamps.length})`);

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

        duration = `${readableDuration(tsta, false)} / ${readableDuration(tend, false)}`;
        durationEl.text(duration);
        nameEl.text(`${celeb} (${playlistIndex} of ${timestamps.length})`);
      });
    });

    return [video, box];
  }

  async downloadData(uuid, celeb) {
    let url;
    const timestamps = [];

    if (typeof uuid === 'string' && uuid !== 'undefined') {
      const ingest = await getRecord(uuid);

      const {
        destination: { bucket, prefix },
        proxies = [],
      } = ingest;

      const key = (proxies.find((x) => x.type === 'video') || {}).key;
      const s3utils = GetS3Utils();
      url = await s3utils.signUrl(bucket, key);

      if (typeof celeb === 'string' && celeb !== 'undefined') {
        let facematch = `${prefix}/metadata/facematch/facematch.json`;
        facematch = facematch.replace(/\/{1,}/g, '/');

        facematch = await s3utils.getObject(bucket, facematch)
          .catch(() => undefined);

        if (facematch) {
          facematch = await facematch.Body.transformToString()
            .then((res) => JSON.parse(res));
          facematch = facematch[celeb] || [];

          for (const { begin, end } of facematch) {
            timestamps.push([begin, end]);
          }
        }
      }
    }
    return { url, timestamps };
  }
}

function _parseSearchParams(location) {
  const params = {};

  const searchParams = (new URL(location)).searchParams;
  for (const [key, value] of searchParams.entries()) {
    if (value !== undefined && value !== 'undefined') {
      params[key] = value;
    }
  }

  return params;
}
