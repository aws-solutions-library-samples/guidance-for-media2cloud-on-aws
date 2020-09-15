/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* eslint-disable no-alert */
/* eslint-disable no-plusplus */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-loop-func */
/* eslint-disable prefer-object-spread */
/* eslint-disable implicit-arrow-linebreak */

/**
 * @class VideoPreview
 * @description preview modal to play proxy video and display all metadata
 */
class VideoPreview extends BasePreview {
  constructor(parent, params = {}) {
    const {
      /* top level modal id defined in demo.html */
      videoModalId = 'video-preview-modal-id',
    } = params;
    super(parent, videoModalId);

    this.domInit();
    this.$carousel = $(`#${VideoPreview.Constants.Id.CarouselContainer}`);
    this.$imageEditor = new ImageEditor(this);
    this.$labelEditor = new LabelEditor(this);
    this.$tracks = {};
    this.$player = undefined;
    this.registerEvents();
  }

  static get Constants() {
    return {
      Id: {
        PlayerContainer: 'player888-container',
        VideoPlayer: 'player888',
        SubtitleSwitch: 'subtitle-switch-id',
        CarouselContainer: 'video-carousel-container-id',
        IndexedFaceCollection: 'face-index-collection-id',
        QueuedFaceCollection: 'face-ready-to-process-id',
        IngestInformation: 'video-ingest-info-id',
        Loading: 'carousel-loading-icon',
      },
    };
  }

  get imageEditor() {
    return this.$imageEditor;
  }

  get labelEditor() {
    return this.$labelEditor;
  }

  get player() {
    return this.$player;
  }

  set player(val) {
    this.$player = val;
  }

  get tracks() {
    return this.$tracks;
  }

  set tracks(val) {
    this.$tracks = Object.assign({}, val);
  }

  /**
   * @function domInit
   * @description initialize dom element
   */
  domInit() {
    const element = $(`
    <div class="modal-dialog modal-xl" role="document">
      <div class="modal-content">
        <div class="container">
          <div class="row p-0">
            <!-- video player -->
            <div class="col-sm p-0 m-auto">
              <div class="row-sm mt-1" id="${VideoPreview.Constants.Id.PlayerContainer}">
              </div>
              <div class="row-sm mt-4 mb-4">
                <div
                  class="container text-muted"
                  id="${VideoPreview.Constants.Id.IngestInformation}"
                  style="font-size: 80%;"
                >
                </div>
              </div>
            </div>
            <!-- information  -->
            <div class="col-sm p-0 m-auto">
              <div class="modal-body">
                <div class="container mt-2">
                  <!-- loading icon -->
                  <div
                    id="${VideoPreview.Constants.Id.Loading}"
                    class="spinner-grow text-secondary loading collapse"
                    style="height: 3em; width: 3em;"
                    role="status">
                    <span class="sr-only">Loading...</span>
                  </div>
                  <!-- carousel -->
                  <div
                    id="${VideoPreview.Constants.Id.CarouselContainer}"
                    class="carousel slide"
                    data-ride="carousel"
                    data-interval="false">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`);

    /* attach to preview modal */
    element.appendTo(this.modal);
  }

  /**
   * @function domCreateTracks
   * @description load webvtt track for current video card
   * @param {VideoCard} card
   */
  async domCreateTracks(card) {
    const tracks = [];
    let keys;
    let data;

    data = card.getVideoAnalysis();
    keys = Object.keys(data || {});
    while (keys.length) {
      const key = keys.shift();
      const prefix = (key === 'person') ? 'person_' : '';
      this.tracks = ((data[key].trackBasenames || {}).vtt || []).reduce((acc, cur) => {
        const src = VideoCard.signedUrl(SO0050.Proxy.Bucket, `${data[key].vtt}/${cur}.vtt`);
        return Object.assign(acc, {
          [`${prefix}${cur}`]: src,
        });
      }, this.tracks);
    }

    data = card.getComprehendAnalysis();
    keys = Object.keys(data || {});
    while (keys.length) {
      const key = keys.shift();
      this.tracks = ((data[key].trackBasenames || {}).vtt || []).reduce((acc, cur) => {
        const src = VideoCard.signedUrl(SO0050.Proxy.Bucket, `${data[key].vtt}/${cur}.vtt`);
        return Object.assign(acc, {
          [cur]: src,
        });
      }, this.tracks);
    }
    return tracks;
  }

  /**
   * @function domCreateSource
   * @description load <video> source
   * @param {VideoCard} card
   */
  async domCreateSource(card) {
    const tracks = await this.domCreateTracks(card);
    const src = card.getVideo();
    this.player.src({
      type: 'video/mp4',
      src,
    });
    return tracks.join('\n');
  }

  /**
   * @function domCreateCarouselSlideTranscript
   * @description create transcription/subtitle carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideTranscript(card, active = '') {
    const svg = BasePreview.createSvgImage('transcript', {
      height: 800,
    });

    const element = `
    <div class="carousel-item ${active}" id="carousel-transcript">
      <img class="d-block w-100" src="${svg}" alt="Transcript">
      <div class="carousel-content d-none d-md-block" data-track-category="transcript" data-track-type="audio">
        <div class="container">
          <!-- switch -->
          <div class="input-group mb-3">
            <label class="switch">
              <input type="checkbox" id="${VideoPreview.Constants.Id.SubtitleSwitch}" checked="checked">
              <span class="slider round"></span>
            </label>
            <span class="col-sm-3 col-form-label">Subtitle</span>
          </div>
          <!-- subtitle display -->
          <div class="d-block" data-target="subtitle">
          </div>
        </div>
        <div class="mb-5"></div>
      </div>
    </div>
    `;

    return element;
  }

  /**
   * @function domCreateCarouselSlideRekognition
   * @description create rekognition carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideRekognition(card, active = '') {
    const svg = BasePreview.createSvgImage('rekognition', {
      height: 800,
    });

    const data = card.getVideoAnalysis();
    const keys = Object.keys(data || {});

    let items = [];
    while (keys.length) {
      const key = keys.shift();
      const vtts = (data[key].trackBasenames || {}).vtt || [];
      if (vtts.length) {
        const prefix = key === 'person' ? 'person_' : '';
        items.push(`<div data-track-name="${key}">`);
        items.push(BasePreview.carouselEditableLead(`${BasePreview.capitalize(key)} (${vtts.length})`, key));
        items = items.concat(vtts.map(x =>
          BasePreview.carouselEditableButton(`${prefix}${x}`, `${prefix}${x}`, false, key)));
        items.push('</div>');
      }
    }

    if (!items.length) {
      items.push('No metadata');
    }

    const element = `
    <div class="carousel-item ${active}" id="carousel-rekognition">
      <img class="d-block w-100" src="${svg}" alt="Rekognition">
      <div class="carousel-content d-none d-md-block" data-track-category="rekognition" data-track-type="video">
        ${items.join('\n')}
        <div class="mb-5"></div>
      </div>
    </div>
    `;

    return element;
  }

  domCreateComprehendCategory(kind, data) {
    if (kind === 'keyphrase') {
      return [
        BasePreview.carouselLead(`${BasePreview.capitalize(kind)} (${data.length})`),
      ].concat(data.map(x =>
        BasePreview.carouselTimeButton(x)));
    }

    if (kind === 'entity') {
      let items = [];
      const types = Array.from(new Set(data.map(x => x.type)));
      while (types.length) {
        const type = types.shift();
        const subset = data.filter(x => x.type === type);
        items = items.concat(BasePreview.carouselLead(`${BasePreview.capitalize(type.toLowerCase())} (${subset.length})`));
        items = items.concat(subset.map(x =>
          BasePreview.carouselTimeButton(x)));
      }
      return items;
    }

    if (kind === 'sentiment') {
      return [
        BasePreview.carouselLead(`${BasePreview.capitalize(kind.toLowerCase())} (${data.length})`),
      ].concat(data.map(x =>
        BasePreview.carouselTimeButton(x)));
    }

    // if (kind === 'topic') {
    // }

    return undefined;
  }

  /**
   * @function domCreateCarouselSlideComprehend
   * @description create comprehend carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideComprehend(card, active = '') {
    const svg = BasePreview.createSvgImage('comprehend', {
      height: 800,
    });

    const data = card.getComprehendAnalysis();
    const keys = Object.keys(data || {});

    const responses = await Promise.all(keys.map((x) => {
      if ((data[x] || {}).metadata) {
        return VideoCard.download(SO0050.Proxy.Bucket, data[x].metadata).catch(e => undefined);
      }
      return undefined;
    }));

    const items = keys.reduce((acc, cur, idx) =>
      acc.concat(this.domCreateComprehendCategory(cur, responses[idx])), []).filter(x => x);

    if (!items.length) {
      items.push('No metadata');
    }

    const element = `
    <div class="carousel-item ${active}" id="carousel-comprehend">
      <img class="d-block w-100" src="${svg}" alt="Comprehend">
      <div class="carousel-content d-none d-md-block" data-track-category="comprehend" data-track-type="audio">
        <div class="container">
          ${items.join('\n')}
        </div>
        <div class="mb-5"></div>
      </div>
    </div>
    `;

    return element;
  }

  /**
   * @function domCreateCarouselSlideCollection
   * @description create face collection carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideCollection(card, active = '') {
    const svg = BasePreview.createSvgImage('face collection', {
      height: 800,
    });

    const element = `
    <div class="carousel-item ${active}" id="carousel-face-collection">
      <img class="d-block w-100" src="${svg}" alt="FaceCollection">
      <div class="carousel-content d-none d-md-block">
        <div class="container">
          <div class="row">
            <!-- description -->
            <div class="col-sm-9 px-0">
              <p>
                Click on <strong>Snapshot</strong> to index a face.<br>
                By indexing a face and adding it to your Amazon Rekognition collection, it greatly improves the face matching process and as a result, it yields a much better, accurate result.
              </p>
              <p>
                When you finish indexing faces, click on <strong>Re-analyze</strong> to re-process the analysis.
              </p>
            </div>

            <!-- snapshot and re-analyze -->
            <div class="col-sm mt-auto mb-auto px-0">
              <div>
                <button
                  type="button"
                  class="btn btn-sm btn-primary float-right mb-3"
                  data-action="snapshot">
                  Snapshot
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-success float-right mb-3"
                  data-action="re-analyze">
                  Re-analyze
                </button>
              </div>
            </div>
          </div>

          <!-- faces being indexed -->
          <div class="row">
            <div class="col-sm-8 px-0">
              <span class="lead mt-2 mb-2 d-block">Indexed faces</span>
            </div>
          </div>
          <div class="row" id="${VideoPreview.Constants.Id.IndexedFaceCollection}">
          </div>

          <!-- faces queued for GT -->
          <div class="row">
            <div class="col-sm-6 px-0">
              <span class="lead mt-2 mb-2 d-block">Queued faces</span>
            </div>
            <div class="col-sm mt-auto mb-auto px-0">
              <button
                type="button"
                class="btn btn-primary btn-sm float-right collapse"
                data-action="send-to-ground-truth">
                Send to Ground Truth
              </button>
            </div>
          </div>
          <div class="row" id="${VideoPreview.Constants.Id.QueuedFaceCollection}">
          </div>
        </div>
        <div class="mb-5"></div>
      </div>
    </div>
    `;

    return element;
  }

  /**
   * @function domCreateMediaInfoData
   * @description create mediainfo data block
   * @param {VideoCard} card
   */
  domCreateMediaInfoData(card) {
    const items = [];
    items.push(BasePreview.carouselLead('Technical metadata'));

    let tracks = (card.mediainfo || {}).media || (card.mediainfo || {}).file || {};
    tracks = tracks.track || [];

    const container = tracks.filter(x =>
      x.$.type.toLowerCase() === 'general').shift();
    if (container) {
      items.push(BasePreview.carouselLead(container.$.type));
      items.push('<dl class="row text-left">');
      Object.keys(container).filter(x => x !== '$').forEach((key) => {
        items.push(`<dt class="col-sm-6">${BasePreview.capitalize(key)}</dt><dd class="col-sm-6">${BasePreview.shorten(container[key], 50)}</dd>`);
      });
      items.push('</dl>');
    }

    [
      'video',
      'audio',
    ].forEach((type) => {
      const streams = tracks.filter(x =>
        x.$.type.toLowerCase() === type);
      if (streams.length) {
        items.push(BasePreview.carouselLead(`${BasePreview.capitalize(type)} (${streams.length})`));
        let idx = 0;
        while (streams.length) {
          const stream = streams.shift();
          items.push(BasePreview.carouselLead(`Stream #${idx++}`));
          items.push('<dl class="row text-left">');
          Object.keys(stream).filter(x => x !== '$').forEach((key) => {
            items.push(`<dt class="col-sm-6">${BasePreview.capitalize(key)}</dt><dd class="col-sm-6">${BasePreview.shorten(stream[key], 50)}</dd>`);
          });
          items.push('</dl>');
        }
      }
    });

    const others = tracks.filter(x =>
      x.$.type.toLowerCase() !== 'general'
      && x.$.type.toLowerCase() !== 'video'
      && x.$.type.toLowerCase() !== 'audio');

    while (others.length) {
      const other = others.shift();
      items.push(BasePreview.carouselLead(BasePreview.capitalize(other.$.type)));
      items.push('<dl class="row text-left">');
      Object.keys(other).filter(x => x !== '$').forEach((key) => {
        items.push(`<dt class="col-sm-6">${BasePreview.capitalize(key)}</dt><dd class="col-sm-6">${BasePreview.shorten(other[key], 50)}</dd>`);
      });
      items.push('</dl>');
    }
    return items;
  }

  /**
   * @function domCreateIngestInfo
   * @description create data block for metadata
   * @param {VideoCard} card
   */
  domCreateIngestInfo(card) {
    const container = this.modal.find(`#${VideoPreview.Constants.Id.IngestInformation}`).first();
    container.children().remove();

    const src = card.getVideo();
    const location = BasePreview.shorten(`s3://${SO0050.Ingest.Bucket}/${card.key}`, 50);
    const items = [];
    items.push('<dl class="row text-left">');
    items.push(`<dt class="col-sm-3">ID</dt><dd class="col-sm-9">${card.uuid}</dd>`);
    items.push(`<dt class="col-sm-3">Name</dt><dd class="col-sm-9">${card.basename}</dd>`);
    items.push(`<dt class="col-sm-3">Type</dt><dd class="col-sm-9">${card.mime}</dd>`);
    items.push(`<dt class="col-sm-3">Size</dt><dd class="col-sm-9">${BasePreview.readableFileSize(card.fileSize)}</dd>`);
    items.push(`<dt class="col-sm-3">MD5</dt><dd class="col-sm-9">${card.md5 || '--'}</dd>`);
    items.push(`<dt class="col-sm-3">Location</dt><dd class="col-sm-9">${location}
      <a href="${src}" target="_blank">
        <i class="fas fa-cloud-download-alt ml-1"
          style="color: #888;"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Download proxy video"
        >
        </i>
      </a>
    </dd>`);
    items.push(`<dt class="col-sm-3">LastModified</dt><dd class="col-sm-9">${card.lastModifiedISOFormat}</dd>`);
    items.push('</dl>');

    const attributes = card.attributes || {};
    const keys = Object.keys(attributes);
    if (keys.length) {
      items.push(BasePreview.carouselLead('Additional attributes'));
      keys.forEach((x) => {
        items.push('<dl class="row text-left">');
        items.push(`<dt class="col-sm-3">${x}</dt><dd class="col-sm-9">${attributes[x].toString()}</dd>`);
        items.push('</dl>');
      });
    }

    $(items.join('\n')).appendTo(container);
  }

  /**
   * @function domCreateCarouselSlideSummary
   * @description summary of aiml process
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideSummary(card, active = '') {
    const items = [];
    let data;
    let keys;

    const svg = BasePreview.createSvgImage('Summary', {
      height: 800,
    });

    data = card.getVideoAnalysis();
    keys = Object.keys(data || {});
    while (keys.length) {
      const key = keys.shift();
      const elapsed = BasePreview.readableDuration(data[key].endTime - data[key].startTime);
      const url = VideoCard.signedUrl(SO0050.Proxy.Bucket, data[key].output);
      items.push(BasePreview.carouselLead(`${BasePreview.capitalize(key)} (Rekogntion)`));
      items.push('<dl class="row text-left">');
      items.push(`<dt class="col-sm-3">Elapsed</dt><dd class="col-sm-9">${elapsed}</dd>`);
      items.push(`<dt class="col-sm-3">Job Id</dt><dd class="col-sm-9">${data[key].id || '--'}</dd>`);
      items.push(`<dt class="col-sm-3">JSON File</dt><dd class="col-sm-9"><a href="${url}">download here</a></dd>`);
      items.push('</dl>');
    }

    data = card.getComprehendAnalysis();
    keys = Object.keys(data || {});
    while (keys.length) {
      const key = keys.shift();
      const elapsed = BasePreview.readableDuration(data[key].endTime - data[key].startTime);
      const url = VideoCard.signedUrl(SO0050.Proxy.Bucket, data[key].output);
      items.push(BasePreview.carouselLead(`${BasePreview.capitalize(key)} (Comprehend)`));
      items.push('<dl class="row text-left">');
      items.push(`<dt class="col-sm-3">Elapsed</dt><dd class="col-sm-9">${elapsed}</dd>`);
      items.push(`<dt class="col-sm-3">Job Id</dt><dd class="col-sm-9">${data[key].id || '--'}</dd>`);
      items.push(`<dt class="col-sm-3">JSON File</dt><dd class="col-sm-9"><a href="${url}">download here</a></dd>`);
      items.push('</dl>');
    }

    data = card.getTranscribeAnalysis();
    if ((data || {}).name) {
      const elapsed = BasePreview.readableDuration(data.endTime - data.startTime);
      const url = VideoCard.signedUrl(SO0050.Proxy.Bucket, data.output);
      items.push(BasePreview.carouselLead('Transcription (Transcribe)'));
      items.push('<dl class="row text-left">');
      items.push(`<dt class="col-sm-3">Elapsed</dt><dd class="col-sm-9">${elapsed}</dd>`);
      items.push(`<dt class="col-sm-3">Job Id</dt><dd class="col-sm-9">${data.name || '--'}</dd>`);
      items.push(`<dt class="col-sm-3">Text File</dt><dd class="col-sm-9"><a href="${url}">download here</a></dd>`);
      items.push('</dl>');
    }

    if (!items.length) {
      items.push('No data');
    }

    const element = `
    <div class="carousel-item ${active}" id="carousel-summary">
      <img class="d-block w-100" src="${svg}" alt="Summary">
      <div class="carousel-content d-none d-md-block">
        <div class="container">
          ${items.join('\n')}
        </div>
        <div class="mb-5"></div>
      </div>
    </div>
    `;

    return element;
  }

  /**
   * @function domCreateCarouselSlideMediainfo
   * @description create definition and mediainfo carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideMediainfo(card, active = '') {
    let items = [];

    // items = items.concat(this.domCreateGlacierInfoData(card));
    items = items.concat(this.domCreateMediaInfoData(card));

    const svg = BasePreview.createSvgImage('mediainfo', {
      height: 800,
    });

    const element = `
    <div class="carousel-item ${active}" id="carousel-mediainfo">
      <img class="d-block w-100" src="${svg}" alt="Mediainfo">
      <div class="carousel-content d-none d-md-block">
        <div class="container">
          ${items.join('\n')}
        </div>
        <div class="mb-5"></div>
      </div>
    </div>
    `;

    return element;
  }

  /**
   * @function domCreateCarousel
   * @description create carousel for the current video card
   * @param {VideoCard} current
   */
  async domCreateCarousel(current) {
    let items = [];
    items = items.concat(await this.domCreateCarouselSlideMediainfo(current, 'active'));
    items = items.concat(await this.domCreateCarouselSlideSummary(current));
    items = items.concat(await this.domCreateCarouselSlideTranscript(current));
    items = items.concat(await this.domCreateCarouselSlideRekognition(current));
    items = items.concat(await this.domCreateCarouselSlideComprehend(current));
    items = items.concat(await this.domCreateCarouselSlideCollection(current));

    const indicators = [];

    for (let i = 0; i < items.length; i += 1) {
      const active = (!i) ? 'active' : '';

      indicators.push(`
      <li data-target="#${VideoPreview.Constants.Id.CarouselContainer}" data-slide-to="0" class="${active}"></li>
      `);
    }

    const dom = `
    <ol class="carousel-indicators">
      ${indicators.join('\n')}
    </ol>
    <div class="carousel-inner">
      ${items.join('\n')}
    </div>
    <a class="carousel-control-prev" href="#${VideoPreview.Constants.Id.CarouselContainer}" role="button" data-slide="prev">
      <i class="fas fa-angle-left fa-3x" style="color: #888;" aria-hidden="true"></i>
      <span class="sr-only">Previous</span>
    </a>
    <a class="carousel-control-next" href="#${VideoPreview.Constants.Id.CarouselContainer}" role="button" data-slide="next">
      <i class="fas fa-angle-right fa-3x" style="color: #888;" aria-hidden="true"></i>
      <span class="sr-only">Next</span>
    </a>
    `;

    return dom;
  }

  /**
   * @function show
   * @description on show preview modal
   * @param {VideoCard} asset
   */
  async show(asset) {
    try {
      await asset.loadAimlResults();
      this.current = asset;

      this.createVideoPlayer();
      const parent = $(`#${VideoPreview.Constants.Id.VideoPlayer}`);
      const source = await this.domCreateSource(asset);
      $(source).appendTo(parent);

      this.domCreateIngestInfo(asset);

      this.carousel.children().remove();
      const carouselItems = await this.domCreateCarousel(asset);
      $(carouselItems).appendTo(this.carousel);

      this.carousel.find('[data-action]').each((key, val) => {
        $(val).off('click').on('click', async (event) => {
          event.preventDefault();
          await this.onAction($(event.currentTarget).data('action'), event);
        });
      });

      this.carousel.find('[data-track]').each((key, val) => {
        this.registerTrackButttonEvent(val);
      });

      const switches = this.carousel.find(`#${VideoPreview.Constants.Id.SubtitleSwitch}`).first();
      switches.off('change').change((event) => {
        event.preventDefault();
        const onOff = $(event.currentTarget).prop('checked');
        this.toggleTrack('transcript', onOff);
      });

      /* enable track group */
      this.carousel.find('[data-track-group-toggle]').each((key, val) => {
        $(val).off('change').change((event) => {
          event.preventDefault();
          AppUtils.loading(VideoPreview.Constants.Id.Loading, true);
          const setOn = $(event.currentTarget).prop('checked');
          const trackGroup = $(event.currentTarget).data('track-group-toggle');
          this.carousel.find(`[data-track-group="${trackGroup}"]`).each((k, v) => {
            const isOn = $(v).attr('aria-pressed') !== 'false';
            if (setOn !== isOn) {
              $(v).click();
            }
          });
          AppUtils.loading(VideoPreview.Constants.Id.Loading, false);
        });
      });

      /* mark in/out */
      this.carousel.find('[data-mark-in]').each((key, val) => {
        $(val).off('click').on('click', (event) => {
          event.preventDefault();
          const markIn = $(event.currentTarget).data('mark-in');
          const markOut = $(event.currentTarget).data('mark-out');
          const text = $(event.currentTarget).text();
          console.log(`${text}: ${BasePreview.readableDuration(markIn)} / ${BasePreview.readableDuration(markOut)}`);
          this.player.currentTime(markIn / 1000);
        });
      });

      this.modal.modal('show');
    } catch (e) {
      alert(e.message);
    }
  }

  /**
   * @function hide
   * @description on hide preview modal
   */
  hide() {
    this.modal.modal('hide');
  }

  createVideoPlayer() {
    this.removeVideoPlayer();

    $(`#${VideoPreview.Constants.Id.PlayerContainer}`).append(`<video
        id="${VideoPreview.Constants.Id.VideoPlayer}"
        class="video-js vjs-fluid"
        width=100%
        controls
        preload="metadata"
        crossorigin="anonymous"
        style="max-width: 600px; max-height: 800px;">
      </video>`);
    this.player = videojs(VideoPreview.Constants.Id.VideoPlayer, {
      textTrackDisplay: {
        allowMultipleShowingTracks: true,
      },
    });

    this.player.markers({
      markers: [],
    });
  }

  removeVideoPlayer() {
    this.tracks = undefined;
    if (this.player) {
      this.player.dispose();
    }
    this.player = undefined;
    $(`#${VideoPreview.Constants.Id.PlayerContainer}`).children().remove();
  }

  /**
   * @function loadTrack
   * @description load <track> and register listener
   * @param {string} label
   * @param {string} src
   * @param {boolean} onoff
   */
  loadTrack(label, src, onoff) {
    const trk = this.player.addRemoteTextTrack({
      kind: 'captions',
      language: 'en',
      label,
      src,
    }, false);

    trk.off('load');
    trk.on('load', (event) => {
      if (label === 'transcript') {
        event.target.track.off('cuechange');
        event.target.track.on('cuechange', () =>
          this.onCueChangeEvent(event.target.track));
      }
      event.target.track.mode = (onoff) ? 'showing' : 'hidden'; // eslint-disable-line
      this.onTrackLoadEvent(event.target.track);
    });
  }

  /**
   * @function registerEvents
   * @description register to listen to preview modal events
   */
  registerEvents() {
    this.modal.off('shown.bs.modal').on('shown.bs.modal', async () => {
      try {
        const data = this.current.getTranscribeAnalysis();
        if (data.vtt) {
          const src = VideoCard.signedUrl(SO0050.Proxy.Bucket, data.vtt);
          this.loadTrack('transcript', src, true);
        }
        this.player.load();
        this.player.play();
      } catch (e) {
        console.error(encodeURIComponent(e.message));
      }
    });

    this.modal.off('hide.bs.modal').on('hide.bs.modal', async () => {
      try {
        this.player.pause();
      } catch (e) {
        console.error(encodeURIComponent(e.message));
      }
    });

    this.modal.off('hidden.bs.modal').on('hidden.bs.modal', async () => {
      this.current = undefined;
      this.removeVideoPlayer();
    });

    this.modal.off('slide.bs.carousel').on('slide.bs.carousel', async (event) => {
      if (event.relatedTarget.id === 'carousel-face-collection') {
        await this.scanFaces();
      }
    });
  }

  /* eslint-disable prefer-destructuring */
  toggleTrack(name, onOff) {
    let found;
    const tracks = this.player.remoteTextTracks();
    for (let i = 0; i < tracks.length; i += 1) {
      if (tracks[i].label === name) {
        tracks[i].mode = (onOff) ? 'showing' : 'hidden';
        found = tracks[i];
        break;
      }
    }

    if (found) {
      this.toggleMarkers(found, onOff);
    } else if (this.tracks[name]) {
      this.loadTrack(name, this.tracks[name], onOff);
    }
  }

  /**
   * @function toggleMarkers
   * @description toggle markers on videojs
   * @param {TextTrack} track
   * @param {Boolean} onOff
   */
  toggleMarkers(track, onOff) {
    if (onOff) {
      return this.addMarkers(track);
    }
    return this.removeMarkers(track);
  }

  /**
   * @function addMarkers
   * @param {TextTrack} track
   */
  addMarkers(track) {
    const markers = [];
    for (let i = 0; i < track.cues.length; i++) {
      markers.push({
        time: track.cues[i].startTime,
        duration: track.cues[i].endTime - track.cues[i].startTime,
        text: track.label,
        overlayText: track.label,
      });
    }
    this.player.markers.add(markers);
  }

  /**
   * @function removeMarkers
   * @param {TextTrack} track
   */
  removeMarkers(track) {
    const indices = [];
    const markers = this.player.markers.getMarkers();
    for (let i = 0; i < markers.length; i++) {
      if (markers[i].overlayText === track.label) {
        indices.push(i);
      }
    }
    this.player.markers.remove(indices);
  }

  /**
   * @function onTrackLoadEvent
   * @description when subtitle track is loaded, display the subtitle text
   * @param {TextTrack} track
   */
  onTrackLoadEvent(track) {
    if (track.label === 'transcript') {
      const display = this.carousel.find('div[data-target="subtitle"]').first();
      const subtitle = $('<div class="lead"></div>');
      for (let i = 0; i < track.cues.length; i++) {
        const line = $(track.cues[i].getCueAsHTML());
        line.addClass('d-inline');
        line.attr('data-cue-index', i);
        subtitle.append(line);
      }
      subtitle.appendTo(display);
    } else {
      this.addMarkers(track);
    }
  }

  /**
   * @function onCueChangeEvent
   * @description on cue event, highlight the cue
   * @param {TextTrack} track
   */
  onCueChangeEvent(track) {
    const active = track.activeCues;
    if (active.length) {
      const id = active[0].id;
      this.carousel.find(`div[data-cue-index="${id}"]`).addClass('bg-highlight');
    }
  }

  /**
   * @function onAction
   * @description currently not used
   * @param {string} action
   * @param {object} event - original event
   */
  async onAction(action, event) {
    if (action === 'snapshot') {
      await this.onSnapshot();
    } else if (action === 're-analyze') {
      await this.onReAnalyze();
    } else if (action === 'send-to-ground-truth') {
      await this.onSendToGroundTruth();
    } else if (action === 'unlock-labels') {
      await this.onToggleLabelLockState(event);
    }
    return undefined;
  }
  /* eslint-enable prefer-destructuring */

  /**
   * @function onSnapshot
   * @description process on snapshot event. Bring up image editor modal for face cropping.
   */
  async onSnapshot() {
    try {
      this.player.pause();
      const timecodeInMS = Math.floor((this.player.currentTime() * 1000) + 0.5);

      let {
        width: w,
        height: h,
      } = this.player.el().getBoundingClientRect();
      w = Math.floor(w + 0.5);
      h = Math.floor(h + 0.5);

      const canvas = $(`<canvas width="${w}" height="${h}"></canvas>`);
      const context = canvas[0].getContext('2d');
      context.fillRect(0, 0, w, h);

      const video = $('video', this.player.el());
      context.drawImage(video[0], 0, 0, w, h);

      /* create a blob */
      const snapshot = canvas[0].toDataURL();
      await this.imageEditor.show(snapshot, w, h, timecodeInMS);
    } catch (e) {
      console.error(e.message);
    }
  }

  /**
   * @function onReAnalyze
   * @description re-run media analysis with everything disabled except face-match
   */
  async onReAnalyze() {
    try {
      AppUtils.loading(VideoPreview.Constants.Id.Loading, true);

      const running = this.current.isBusy();
      if (running) {
        alert(`'${this.current.basename}' is currently in process, ${running}`);
        return;
      }

      await ApiHelper.startAnalysisWorkflow({
        uuid: this.current.uuid,
        input: {
          aiOptions: {
            faceMatch: true,
            /* disable the rest of the detections */
            celeb: false,
            face: false,
            label: false,
            moderation: false,
            person: false,
            text: false,
            transcript: false,
            entity: false,
            keyphrase: false,
            sentiment: false,
            topic: false,
            document: false,
          },
        },
      });
    } catch (e) {
      console.error(encodeURIComponent(e.message));
      throw e;
    } finally {
      AppUtils.loading(VideoPreview.Constants.Id.Loading, false);
    }
  }

  /**
   * @function onSendToGroundTruth
   * @description send the queued faces to GT for tagging
   */
  async onSendToGroundTruth() {
    try {
      AppUtils.loading(VideoPreview.Constants.Id.Loading, true);

      return ApiHelper.startLabelingWorkflow({
        uuid: this.current.uuid,
      });
    } catch (e) {
      console.error(encodeURIComponent(e.message));
      throw e;
    } finally {
      AppUtils.loading(VideoPreview.Constants.Id.Loading, false);
    }
  }

  /**
   * @function onToggleLabelLockState
   * @description lock and unlock labels for editing
   * @param {object} event - current event
   */
  async onToggleLabelLockState(event) {
    const elem = $(event.currentTarget);
    const shouldUnlock = elem.data('lock-state') === 'locked';

    event.stopPropagation();

    elem.removeClass('fa-lock fa-unlock');
    if (shouldUnlock) {
      elem.addClass('fa-unlock');
      elem.data('lock-state', 'unlocked');
    } else {
      elem.addClass('fa-lock');
      elem.data('lock-state', 'locked');
    }

    const parent = elem.closest('div[data-track-name]').first();
    const labels = parent.find('button');
    labels.each((key, val) => {
      if (shouldUnlock) {
        $(val).find('i.fa-times-circle').removeClass('collapse');
        $(val).addClass('editable');
      } else {
        $(val).find('i.fa-times-circle').addClass('collapse');
        $(val).removeClass('editable');
      }
    });
  }

  /**
   * @function onEditLabel
   * @description on edit label, bring up edit label modal.
   * @param {object} event - current event
   */
  onEditLabel(target) {
    this.player.pause();
    setTimeout(async () => {
      await this.labelEditor.show(target);
    }, 300);
  }

  /**
   * @function indexFace
   * @description call APIGW endpoint to index face
   * @param {object} data - cropped image data
   */
  async indexFace(data) {
    const modified = Object.assign({
      uuid: this.current.uuid,
      contentUrl: `s3://${SO0050.Proxy.Bucket}/${this.current.getVideoKey()}`,
    }, data);

    const responses = await ApiHelper.indexFace(modified);

    responses.forEach(x =>
      this.addToIndexedFaceCollection(x));

    return responses;
  }

  /**
   * @function queueFace
   * @description queue face for Ground Truth to process
   * @param {object} data
   */
  async queueFace(data) {
    const modified = Object.assign({
      tempId: AppUtils.uuid4(),
      uuid: this.current.uuid,
      contentUrl: `s3://${SO0050.Proxy.Bucket}/${this.current.getVideoKey()}`,
    }, data);

    delete modified.name;

    const responses = await ApiHelper.queueFace(modified);
    responses.forEach(x =>
      this.addToQueuedFaceCollection(x));

    return responses;
  }

  /**
   * @function addToCollection
   * @param {string} parent - either add to face collection or GT queue
   * @param {*} params
   */
  addToCollection(parent, params = {}) {
    const thumbnailSize = '96px';
    $(`
    <div class="col-auto p-2">
      <div class="card" style="width: ${thumbnailSize}">
        <img
          class="card-img-top"
          src="${params.dataUrl}"
          width="${thumbnailSize}"
          height="${thumbnailSize}"
          data-content-uuid="${params.uuid}"
          data-content-url="${params.contentUrl}"
          data-name="${params.name}"
          data-face-id="${params.faceId}"
          data-temp-id="${params.tempId}"
          data-timecode="${params.timecode}"
          data-image-url="${params.imageUrl}"
          data-submitted="${params.submitted}"
          data-mode="${params.mode}">
        <div class="card-body text-center text-truncate p-1">
          <small class="text-muted">${BasePreview.capitalize(params.name || params.tempId)}</small>
        </div>
      </div>
    </div>
    `).appendTo($(`#${parent}`));
  }

  /**
   * @function addToIndexedFaceCollection
   * @description add face thumbnail to the modal
   * @param {*} params
   */
  addToIndexedFaceCollection(params = {}) {
    if ($(`#${VideoPreview.Constants.Id.IndexedFaceCollection}`).find(`[data-face-id="${params.faceId}"]`).length === 0) {
      this.addToCollection(VideoPreview.Constants.Id.IndexedFaceCollection, params);
    }
  }

  /**
   * @function addToQueuedFaceCollection
   * @description add face to GT queue
   * @param {*} params
   */
  addToQueuedFaceCollection(params = {}) {
    if ($(`#${VideoPreview.Constants.Id.QueuedFaceCollection}`).find(`[data-temp-id="${params.tempId}"]`).length === 0) {
      this.addToCollection(VideoPreview.Constants.Id.QueuedFaceCollection, params);
    }
    this.modal.find('[data-action="send-to-ground-truth"]').first().removeClass('collapse');
  }

  /**
   * @function scanFaces
   */
  async scanFaces() {
    try {
      AppUtils.loading(VideoPreview.Constants.Id.Loading, true);

      const responses = await Promise.all([
        ApiHelper.getIndexFaces(this.current.uuid),
        ApiHelper.getQueueFaces(this.current.uuid),
      ]);

      (responses[0] || []).forEach(x =>
        this.addToIndexedFaceCollection(x));

      (responses[1] || []).forEach(x =>
        this.addToQueuedFaceCollection(x));
    } catch (e) {
      console.error(encodeURIComponent(e.message));
    } finally {
      AppUtils.loading(VideoPreview.Constants.Id.Loading, false);
    }
  }

  removeFaces() {
    [
      VideoPreview.Constants.Id.IndexedFaceCollection,
      VideoPreview.Constants.Id.QueuedFaceCollection,
    ].forEach(id =>
      $(`#${id}`).empty());
  }

  async reloadFaces() {
    this.removeFaces();
    await this.scanFaces();
  }

  async onGroundTruthMessage(msg) {
    if (this.current && msg.uuid === this.current.uuid) {
      const button = this.carousel.find('[data-action="send-to-ground-truth"]').first();

      if (msg.operation === BasePreview.States.JobCompleted) {
        button.removeAttr('disabled');
        return this.reloadFaces();
      }
      button.attr('disabled', 'disabled');
    }
    return undefined;
  }

  registerTrackButttonEvent(val) {
    $(val).off('click').on('click', (event) => {
      event.preventDefault();
      const target = $(event.currentTarget);
      const onOff = target.attr('aria-pressed') === 'false';
      const track = target.data('track');
      this.toggleTrack(track, onOff);
      const onEditEvent = !!(target.hasClass('editable'));
      if (onEditEvent) {
        this.onEditLabel(target.get(0));
      }
    });
  }

  removeRemoteTextTrack(name) {
    let found;
    const tracks = this.player.remoteTextTracks();
    for (let i = 0; i < tracks.length; i += 1) {
      if (tracks[i].label === name) {
        found = tracks[i];
        break;
      }
    }
    if (found) {
      this.player.removeRemoteTextTrack(found);
      this.removeMarkers(found);
    }
  }

  removeLabel(cat, group, name, uri) {
    const label = name.toLowerCase().replace(/\s/g, '_');
    const trackGroup = this.carousel.find(`[data-track-category="${cat}"]`).find(`[data-track-name="${group}"]`).first();
    const track = trackGroup.find(`[data-track="${label}"]`).first();

    delete this.tracks[label];
    this.removeRemoteTextTrack(label);
    track.remove();
  }

  addLabel(cat, group, name, uri) {
    const label = name.toLowerCase().replace(/\s/g, '_');
    const trackGroup = this.carousel.find(`[data-track-category="${cat}"]`).find(`[data-track-name="${group}"]`).first();
    trackGroup.append(BasePreview.carouselEditableButton(label, name, false, group));

    this.tracks[label] = VideoCard.signedUrl(SO0050.Proxy.Bucket, uri);

    const button = trackGroup.find(`[data-track="${label}"]`).first();
    this.registerTrackButttonEvent(button);
    button.click();
  }

  reloadLabel(cat, group, name, uri) {
    const label = name.toLowerCase().replace(/\s/g, '_');
    const trackGroup = this.carousel.find(`[data-track-category="${cat}"]`).find(`[data-track-name="${group}"]`).first();
    const track = trackGroup.find(`[data-track="${label}"]`).first();

    this.tracks[label] = VideoCard.signedUrl(SO0050.Proxy.Bucket, uri);

    this.removeRemoteTextTrack(label);

    const isOn = track.attr('aria-pressed') === 'true';
    if (isOn) {
      this.toggleTrack(label, true);
    } else {
      track.click();
    }
  }

  async reloadAimlResults() {
    return this.current.loadAimlResults(true);
  }
}
