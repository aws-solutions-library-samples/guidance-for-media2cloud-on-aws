// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import AppUtils from '../../../../../../shared/appUtils.js';
import {
  GetImageStore,
} from '../../../../../../shared/localCache/imageStore.js';

const MEDIA_TYPE = 'video/mp4';
const ADS = [
  './images/CountdownClock_0.mp4',
  './images/CountdownClock_1.mp4',
];

export default class PreviewModal {
  constructor(parent, media, datapoint) {
    this.$parent = parent;
    this.$media = media;
    this.$datapoint = datapoint;
    this.$vjs = undefined;
    this.$id = AppUtils.randomHexstring();
    this.$store = GetImageStore();
    this.$cachedAds = [];
  }

  get parent() {
    return this.$parent;
  }

  get media() {
    return this.$media;
  }

  get store() {
    return this.$store;
  }

  get datapoint() {
    return this.$datapoint;
  }

  get vjs() {
    return this.$vjs;
  }

  set vjs(val) {
    this.$vjs = val;
  }

  get id() {
    return this.$id;
  }

  get cachedAds() {
    return this.$cachedAds;
  }

  set cachedAds(val) {
    this.$cachedAds = val;
  }

  async show() {
    const modal = $('<div/>')
      .addClass('modal fade videomodal')
      .attr('tabindex', -1)
      .attr('role', 'dialog')
      .attr('aria-labelledby', 'PreviewModal')
      .attr('aria-hidden', true);
    this.parent.append(modal);

    const dialog = $('<div/>')
      .addClass('modal-dialog modal-lg')
      .attr('role', 'document');
    modal.append(dialog);

    const content = $('<div/>')
      .addClass('modal-content')
      .css('border-radius', 0);
    dialog.append(content);

    const row = $('<div/>')
      .addClass('row no-gutters');
    content.append(row);

    const container = $('<div/>')
      .addClass('col-12 m-0 p-0');
    row.append(container);

    // prefetch ads
    this.cachedAds = await this.prefetchAds(ADS);

    const id = `vjs-${this.id}`;
    const videoContainer = this.createVideoContainer(id);
    container.append(videoContainer);
    this.vjs = this.loadVideoJs(id);

    modal.on('hidden.bs.modal', (event) => {
      this.parent.trigger('video:modal:hidden');
    });

    return modal.modal('show');
  }

  async destroy() {
    if (this.vjs) {
      this.vjs.dispose();
      this.vjs = undefined;
    }

    this.parent
      .find('div.videomodal')
      .remove();
  }

  createVideoContainer(id) {
    const container = $('<div/>')
      .addClass('video-container');

    const video = $('<video/>')
      .addClass('video-js vjs-fluid w-100')
      .attr('id', id)
      .attr('controls', 'controls')
      .attr('preload', 'metadata')
      .attr('crossorigin', 'anonymous');

    video.ready(() => {
      video.attr('poster', this.datapoint.url);
    });

    container.append(video);

    return container;
  }

  loadVideoJs(id) {
    // create videojs with ad plugins
    const vjs = videojs(id, {
      textTrackDisplay: {
        allowMultipleShowingTracks: true,
      },
      aspectRatio: '16:9',
      autoplay: true,
      playbackRates: [0.5, 1, 1.5, 2.0],
    });

    vjs.ready(async () => {
      const signed = await this.media.getProxyVideo();

      vjs.src({
        type: MEDIA_TYPE,
        src: signed,
      });

      const data = this.datapoint;
      const breakAt = data.timestamp;

      // create ad break vtt track to signal
      console.log('breakAt', breakAt);
      const cue = this.createAdBreakCue(breakAt);

      const remoteTrack = vjs.addRemoteTextTrack({
        kind: 'metadata',
        language: 'en',
        label: 'ad',
      }, false);

      remoteTrack.track.addCue(cue);
      remoteTrack.track.mode = 'hidden';

      const bindFn = this.onCueChange.bind(
        this,
        vjs,
        remoteTrack.track
      );

      remoteTrack.track.addEventListener(
        'cuechange',
        bindFn
      );

      let startTime = Math.round((breakAt - 10000) / 1000);
      startTime = Math.max(0, startTime);
      vjs.currentTime(startTime);
      vjs.volume(0.5);

      // ad plugins
      vjs.ads();

      vjs.on('contentchanged', () => {
        console.log('contentchanged');
        vjs.trigger('adsready');
      });

      vjs.on('readyforpreroll', () => {
        console.log('readyforpreroll');

        vjs.ads.startLinearAdMode();

        const idx = Math.floor(Math.random() * this.cachedAds.length);
        vjs.src({
          type: MEDIA_TYPE,
          src: this.cachedAds[idx],
        });

        vjs.one('adplaying', () => {
          console.log('adplaying');
          vjs.trigger('ads-ad-started');
        });

        vjs.one('adended', () => {
          vjs.ads.endLinearAdMode();
        });
      });
    });

    vjs.load();
    return vjs;
  }

  createAdBreakCue(breakAt) {
    return new window.vttjs.VTTCue(
      breakAt / 1000,
      (breakAt + 500) / 1000,
      'Ad'
    );
  }

  onCueChange(vjs, track, event) {
    vjs.trigger('adsready');

    console.log(
      'onCueChange:',
      vjs.currentTime()
    );

    if (track.activeCues && track.activeCues.length > 0) {
      const activeCue = track.activeCues[track.activeCues.length - 1];
      console.log(
        'activeCue:',
        activeCue,
        'at',
        activeCue.startTime
      );
    }
  }

  on(event, fn) {
    return this.parent.on(event, fn);
  }

  off(event) {
    return this.parent.off(event);
  }

  async prefetchAds(ads) {
    const promises = [];

    for (let i = 0; i < ads.length; i += 1) {
      promises.push(this.store.getBlob(ads[i]));
    }

    return Promise.all(promises);
  }
}
