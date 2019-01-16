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
/* eslint-disable no-unused-vars */
/* eslint-disable no-alert */

/**
 * @class Preview
 * @description preview modal to play proxy video and display all metadata
 */
class Preview {
  constructor(parent, params = {}) {
    const {
      /* top level modal id defined in demo.html */
      previewModalId = '#previewModalId',
    } = params;

    this.$modal = $(previewModalId);
    this.$parent = parent;
    this.$current = undefined;
    this.$subtitleOnOffId = 'subtitleOnOffId';

    this.domInit();
  }

  get modal() {
    return this.$modal;
  }

  get carousel() {
    return this.$carousel;
  }

  get parent() {
    return this.$parent;
  }

  get element() {
    return this.$element;
  }

  get subtitleOnOffId() {
    return this.$subtitleOnOffId;
  }

  get current() {
    return this.$current;
  }

  set current(val) {
    this.$current = val;
  }

  /**
   * @function domInit
   * @description initialize dom element
   */
  domInit() {
    const carouselContainerId = 'carouselContainerId';
    const playerId = 'player888';

    const element = $(`
    <div class="modal-dialog modal-lg" role="document">
      <div class="modal-content">
        <!-- Player -->
        <video id="${playerId}" width=100% controls crossOrigin="anonymous"></video>
        <div class="modal-body">
          <div class="container mt-2">
            <!-- carosoual -->
            <div id="${carouselContainerId}" class="carousel slide" data-ride="carousel" data-interval="false">
            </div>
            <!-- /carousel -->
          </div>
        </div>
      </div>
    </div>`);

    /* attach to preview modal */
    element.appendTo(this.modal);

    this.$carousel = $(`#${carouselContainerId}`);
    this.$element = $(`#${playerId}`);

    this.registerEvents();
  }

  /**
   * @deprecated
   * @function useLowresVideo
   * @description if query string lowres=true is enable, use lowres video instead
   * https://blah/blah/demo.html?lowres=true
   */
  static useLowresVideo() {
    // return new URLSearchParams(window.location.search).has('lowres');
    return false;
  }


  /* eslint-disable prefer-destructuring */
  /* eslint-disable class-methods-use-this */
  /**
   * @function createSvgImage
   * @description helper function to dynamically create SVG background text on carousal
   * @param {string} name
   * @param {object} options
   */
  createSvgImage(name, options = {}) {
    const {
      width: w = 800,
      height: h = 400,
      foreground: fg = '#e4e4e4',
      background: bg = '#ffffff',
      font = '40pt',
    } = options;

    const tag = `anchor_${name.toLowerCase().replace(/[^a-zA-Z0-9\-_.]/g, '_')}`;

    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <style type="text/css">
          #${tag} text {
            fill:${fg};font-weight:normal;font-family:Helvetica,monospace;font-size:${font}
          }
        </style>
      </defs>
      <g id="${tag}">
        <rect width="${w}" height="${h}" fill="${bg}">
        </rect>
        <g>
        <text x="50%" y="50%" alignment-baseline="middle" text-anchor="middle">${name.toUpperCase()}</text>
        </g>
      </g>
    </svg>`;

    const data = 'data:image/svg+xml;charset=UTF-8';

    return `${data},${encodeURIComponent(svg)}`;
  }

  /**
   * @function capitalize
   * @description capitalize name
   * @param {string} name
   */
  static capitalize(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * @function carouselButton
   * @description create clickable button on carousel
   * @param {string} text
   * @param {boolean} [enabled]
   */
  static carouselButton(text, enabled = false) {
    return `
    <button
      type="button"
      class="btn btn-primary btn-sm mb-2"
      data-toggle="button"
      aria-pressed="false"
      autocomplete="off"
      data-track="${text}"
      data-default-enabled="${enabled}"
    >${Preview.capitalize(text)}</button>`;
  }

  /**
   * @function carouselStaticButton
   * @description create non-clickable button on carousel
   * @param {string} text
   */
  static carouselStaticButton(text) {
    return `
    <button
      type="button"
      class="btn btn-primary btn-sm mb-2"
      autocomplete="off"
      disabled
    >${Preview.capitalize(text)}</button>`;
  }

  /**
   * @function carouselLead
   * @description carousel lead
   * @param {string} text
   */
  static carouselLead(text) {
    return `<span class="lead mt-2 mb-2 d-block">${text}</span>`;
  }

  /**
   * @function domCreateTracks
   * @description load webvtt track for current video card
   * @param {VideoCard} card
   */
  async domCreateTracks(card) {
    const {
      AWSomeNamespace: {
        VideoAsset,
      },
    } = window;

    const metadata = card.asset.machineMetadata;

    const count = await metadata.loadVttTracks();

    if (!count) {
      return [];
    }

    const Bucket = metadata.bucket;
    const tracks = [];

    Object.keys(metadata.instances).forEach((kind) => {
      const keys = metadata.instances[kind].vttKeys;
      keys.forEach((key) => {
        let basename = VideoCard.parseKey(key);
        basename = (kind === 'persons') ? `Person ${basename}` : basename;

        const bydefault = (kind === 'transcript') ? 'default' : '';
        const src = `${VideoAsset.signedUrl(Bucket, key)}`;
        tracks.push(`<track kind="subtitles" srclang="en" label="${basename}" src="${src}" ${bydefault}>`);
      });
    });

    return tracks;
  }

  /**
   * @function domCreateSource
   * @description load <video> source
   * @param {VideoCard} card
   */
  async domCreateSource(card) {
    const tracks = await this.domCreateTracks(card);

    const src = (Preview.useLowresVideo())
      ? card.asset.signedLowresUrl()
      : card.asset.signedProxyUrl();

    tracks.splice(0, 0, `<source src="${src}" type-"video/mp4">`);

    return tracks.join('\n');
  }

  /**
   * @function domCreateCarouselSlideTranscript
   * @description create transcription/subtitle carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideTranscript(card, active = '') {
    const svg = this.createSvgImage('transcript');

    const element = `
    <div class="carousel-item ${active}">
      <img class="d-block w-100" src="${svg}" alt="Transcript">
      <div class="carousel-content d-none d-md-block">
        <div class="container">
          <!-- switch -->
          <div class="input-group mb-3">
            <label class="switch">
              <input type="checkbox" id="${this.subtitleOnOffId}" checked="checked">
              <span class="slider round"></span>
            </label>
            <span class="col-sm-3 col-form-label">Subtitle</span>
          </div>
          <!-- subtitle display -->
          <div class="d-block" data-target="subtitle">
          </div>
        </div>
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
    const svg = this.createSvgImage('rekognition');

    const items = [];
    const metadata = card.asset.machineMetadata;

    /* face_matches */
    const matches = metadata.matches;
    if (matches) {
      items.push(Preview.carouselLead(`Collections (${matches.vttKeys.length})`));
      matches.vttKeys.forEach((key) => {
        const basename = VideoCard.parseKey(key);
        items.push(Preview.carouselButton(basename, true));
      });
    }

    /* celebs */
    const celebs = metadata.celebs;
    if (celebs) {
      items.push(Preview.carouselLead(`Celebrities (${celebs.vttKeys.length})`));
      celebs.vttKeys.forEach((key) => {
        const basename = VideoCard.parseKey(key);
        items.push(Preview.carouselButton(basename));
      });
    }

    /* emotions */
    const faces = metadata.faces;
    if (faces) {
      items.push(Preview.carouselLead(`Emotions (${faces.vttKeys.length})`));
      faces.vttKeys.forEach((key) => {
        const basename = VideoCard.parseKey(key);
        items.push(Preview.carouselButton(basename));
      });
    }

    /* labels */
    const labels = metadata.labels;
    if (labels) {
      items.push(Preview.carouselLead(`Labels (${labels.vttKeys.length})`));
      labels.vttKeys.forEach((key) => {
        const basename = VideoCard.parseKey(key);
        items.push(Preview.carouselButton(basename));
      });
    }

    /* persons */
    const persons = metadata.persons;
    if (persons) {
      items.push(Preview.carouselLead(`People (${persons.vttKeys.length})`));
      const indexes = persons.vttKeys.map(key => Number.parseInt(VideoCard.parseKey(key), 10));
      indexes.sort((a, b) => a - b).forEach((x) => {
        items.push(Preview.carouselButton(`Person ${x}`));
      });
    }

    if (!items.length) {
      items.push('No metaddata');
    }

    const element = `
    <div class="carousel-item ${active}">
      <img class="d-block w-100" src="${svg}" alt="Rekognition">
      <div class="carousel-content d-none d-md-block">
        ${items.join('\n')}
      </div>
    </div>
    `;

    return element;
  }

  /**
   * @function domCreateCarouselSlideComprehend
   * @description create comprehend carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideComprehend(card, active = '') {
    const {
      AWSomeNamespace: {
        VideoAsset,
      },
    } = window;

    const svg = this.createSvgImage('comprehend');

    const metadata = card.asset.machineMetadata;
    const promises = [];

    /* keyphrases */
    const keyphrases = metadata.keyphrases;
    if (keyphrases) {
      await keyphrases.loadMetaTracks();
      if (keyphrases.metaKeys.length) {
        promises.push(VideoAsset.download(keyphrases.bucket, keyphrases.metaKeys[0]));
      }
    }

    /* entities */
    const entities = metadata.entities;
    if (entities) {
      await entities.loadMetaTracks();
      if (entities.metaKeys.length) {
        promises.push(VideoAsset.download(entities.bucket, entities.metaKeys[0]));
      }
    }

    const items = [];

    if (!promises.length) {
      items.push('No metaddata');
    } else {
      const responses = await Promise.all(promises);
      responses.forEach((response) => {
        const result = JSON.parse(response);

        Object.keys(result).forEach((category) => {
          const subItems = Object.keys(result[category]);

          items.push(Preview.carouselLead(`${category} (${subItems.length})`));

          subItems.forEach((x) => {
            items.push(Preview.carouselStaticButton(x));
          });
        });
      });
    }

    const element = `
    <div class="carousel-item ${active}">
      <img class="d-block w-100" src="${svg}" alt="Comprehend">
      <div class="carousel-content d-none d-md-block">
        <div class="container">
          ${items.join('\n')}
        </div>
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
  async domCreateMediaInfoData(card) {
    const {
      AWSomeNamespace: {
        BaseAttributes,
      },
    } = window;

    const items = [];
    const mediainfo = await card.fetchMediainfo() || {};

    const {
      container: Container,
      audio: AudioTracks = [],
      video: VideoTracks = [],
    } = mediainfo;

    if (Container) {
      const {
        duration,
        fileSize,
        format,
        mimeType,
        totalBitrate,
      } = Container;

      items.push(Preview.carouselLead('Container'));
      items.push('<dl class="row text-left">');

      if (fileSize) {
        items.push(`<dt class="col-sm-3">Size</dt><dd class="col-sm-9">${BaseAttributes.readableFileSize(fileSize)}</dd>`);
      }

      if (duration) {
        items.push(`<dt class="col-sm-3">Duration</dt><dd class="col-sm-9">${BaseAttributes.readableDuration(duration)}</dd>`);
      }

      if (format) {
        items.push(`<dt class="col-sm-3">Format</dt><dd class="col-sm-9">${format}</dd>`);
      }

      if (mimeType) {
        items.push(`<dt class="col-sm-3">Type</dt><dd class="col-sm-9">${mimeType}</dd>`);
      }

      if (totalBitrate) {
        items.push(`<dt class="col-sm-3">Total Bitrate</dt><dd class="col-sm-9">${BaseAttributes.readableBitrate(totalBitrate)}</dd>`);
      }

      items.push('</dl>');
    }

    if (VideoTracks.length) {
      VideoTracks.forEach((video, idx) => {
        items.push(Preview.carouselLead(`Video #${idx}`));
        items.push('<dl class="row text-left">');

        const {
          aspectRatio,
          bitDepth,
          bitrate,
          codec,
          colorSpace,
          framerate,
          height,
          profile,
          scanType,
          width,
        } = video;

        if (codec) {
          items.push(`<dt class="col-sm-3">Codec</dt><dd class="col-sm-9">${codec}</dd>`);
        }

        if (aspectRatio) {
          items.push(`<dt class="col-sm-3">Aspect ration</dt><dd class="col-sm-9">${aspectRatio}</dd>`);
        }

        if (height && width) {
          items.push(`<dt class="col-sm-3">Resolution</dt><dd class="col-sm-9">${width} x ${height}</dd>`);
        }

        if (framerate) {
          items.push(`<dt class="col-sm-3">Framerate</dt><dd class="col-sm-9">${framerate}</dd>`);
        }

        if (bitrate) {
          items.push(`<dt class="col-sm-3">Bitrate</dt><dd class="col-sm-9">${BaseAttributes.readableBitrate(bitrate)}</dd>`);
        }

        if (profile) {
          items.push(`<dt class="col-sm-3">Profile</dt><dd class="col-sm-9">${profile}</dd>`);
        }

        if (colorSpace) {
          items.push(`<dt class="col-sm-3">Color space</dt><dd class="col-sm-9">${colorSpace}</dd>`);
        }

        if (scanType) {
          items.push(`<dt class="col-sm-3">Scan type</dt><dd class="col-sm-9">${scanType}</dd>`);
        }

        if (bitDepth) {
          items.push(`<dt class="col-sm-3">Bit depth</dt><dd class="col-sm-9">${bitDepth}</dd>`);
        }

        items.push('</dl>');
      });
    }

    if (AudioTracks.length) {
      AudioTracks.forEach((audio, idx) => {
        items.push(Preview.carouselLead(`Audio #${idx}`));
        items.push('<dl class="row text-left">');

        const {
          bitrateMode,
          channels,
          codec,
          samplePerFrame,
          samplingRate,
        } = audio;

        if (codec) {
          items.push(`<dt class="col-sm-3">Codec</dt><dd class="col-sm-9">${codec}</dd>`);
        }

        if (channels) {
          items.push(`<dt class="col-sm-3">Channels</dt><dd class="col-sm-9">${channels}</dd>`);
        }

        if (bitrateMode) {
          items.push(`<dt class="col-sm-3">Mode</dt><dd class="col-sm-9">${bitrateMode}</dd>`);
        }

        if (samplingRate) {
          items.push(`<dt class="col-sm-3">Sampling rate</dt><dd class="col-sm-9">${samplingRate} Hz</dd>`);
        }

        if (samplePerFrame) {
          items.push(`<dt class="col-sm-3">Samples per frame</dt><dd class="col-sm-9">${samplePerFrame}</dd>`);
        }

        items.push('</dl>');
      });
    }
    return items;
  }

  /**
   * @function domCreateGlacierInfoData
   * @description create data block for archive metadata
   * @param {VideoCard} card
   */
  domCreateGlacierInfoData(card) {
    const items = [];
    const uuid = card.asset.uuid;
    const glacier = card.asset.glacier;
    const system = glacier.system;
    const description = glacier.description;
    const archiveDate = glacier.archiveDateISOFormat;
    const comments = glacier.comments;
    const category = glacier.category;
    const name = glacier.name;
    const barcode = glacier.barcode;

    items.push(Preview.carouselLead('Archive system'));
    items.push('<dl class="row text-left">');
    items.push(`<dt class="col-sm-3">Bucket</dt><dd class="col-sm-9">${glacier.bucket}</dd>`);
    items.push(`<dt class="col-sm-3">System</dt><dd class="col-sm-9">${system} (${description})</dd>`);
    items.push(`<dt class="col-sm-3">Category</dt><dd class="col-sm-9">${category}</dd>`);
    items.push(`<dt class="col-sm-3">Name</dt><dd class="col-sm-9">${name}</dd>`);
    items.push(`<dt class="col-sm-3">ID</dt><dd class="col-sm-9">${uuid}</dd>`);
    items.push(`<dt class="col-sm-3">Comments</dt><dd class="col-sm-9">${comments}</dd>`);
    items.push(`<dt class="col-sm-3">Barcode</dt><dd class="col-sm-9">${barcode}</dd>`);
    items.push(`<dt class="col-sm-3">Date</dt><dd class="col-sm-9">${archiveDate}</dd>`);
    items.push(`<dt class="col-sm-3">Files</dt><dd class="col-sm-9">${glacier.files.length}</dd>`);
    items.push('</dl>');

    glacier.files.forEach((file, idx) => {
      const heading = file.name.split('/').filter(x => x).pop();

      items.push(Preview.carouselLead(`#${idx + 1} - ${heading}`));
      items.push('<dl class="row text-left">');
      items.push(`<dt class="col-sm-3">Location</dt><dd class="col-sm-9">${file.name}</dd>`);
      items.push(`<dt class="col-sm-3">UUID</dt><dd class="col-sm-9">${file.uuid}</dd>`);
      items.push(`<dt class="col-sm-3">MD5</dt><dd class="col-sm-9">${file.md5}</dd>`);
      items.push('</dl>');
    });

    return items;
  }

  /**
   * @function domCreateCarouselSlideMediainfo
   * @description create archive and mediainfo carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideMediainfo(card, active = '') {
    let items = [];

    items = items.concat(this.domCreateGlacierInfoData(card));
    items = items.concat(await this.domCreateMediaInfoData(card));

    const svg = this.createSvgImage('mediainfo');

    const element = `
    <div class="carousel-item ${active}">
      <img class="d-block w-100" src="${svg}" alt="Mediainfo">
      <div class="carousel-content d-none d-md-block">
        <div class="container">
          ${items.join('\n')}
        </div>
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
    const promises = Promise.all([
      this.domCreateCarouselSlideMediainfo(current, 'active'),
      this.domCreateCarouselSlideTranscript(current),
      this.domCreateCarouselSlideRekognition(current),
      this.domCreateCarouselSlideComprehend(current),
    ]);

    const items = await promises;

    const indicators = [];

    for (let i = 0; i < items.length; i += 1) {
      const active = (!i) ? 'active' : '';

      indicators.push(`
      <li data-target="#carouselContainerId" data-slide-to="0" class="${active}"></li>
      `);
    }

    const dom = `
    <ol class="carousel-indicators">
      ${indicators.join('\n')}
    </ol>
    <div class="carousel-inner">
      ${items.join('\n')}
    </div>
    <a class="carousel-control-prev" href="#carouselContainerId" role="button" data-slide="prev">
      <i class="fas fa-angle-left fa-3x" style="color: #888;" aria-hidden="true"></i>
      <span class="sr-only">Previous</span>
    </a>
    <a class="carousel-control-next" href="#carouselContainerId" role="button" data-slide="next">
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
      this.current = asset;

      this.carousel.children().remove();
      this.element.children().remove();

      const source = await this.domCreateSource(asset);

      const carouselItems = await this.domCreateCarousel(asset);

      $(carouselItems).appendTo(this.carousel);

      this.carousel.find('[data-action]').each((key, val) => {
        $(val).on('click', async (event) => {
          event.preventDefault();

          await this.onAction($(event.currentTarget).data('action'));
        });
      });

      this.carousel.find('[data-track]').each((key, val) => {
        $(val).on('click', (event) => {
          event.preventDefault();

          const onOff = $(event.currentTarget).attr('aria-pressed') === 'false';
          const track = $(event.currentTarget).data('track');
          console.log(`${track} track ${onOff ? 'enabled' : 'disabled'}`);

          this.toggleTrack(track, onOff);
        });
      });

      $(source).appendTo(this.element);

      this.element.children('track').each((key, val) => {
        $(val).on('load', (event) => {
          this.onTrackLoadEvent(event.currentTarget.track);
        });

        /* for subtitle, listen to cue change event as well */
        if ($(val).attr('label') === 'transcript') {
          $(val).on('cuechange', (event) => {
            this.onCueChangeEvent(event.currentTarget.track);
          });
        }
      });

      const switches = this.carousel.find(`#${this.subtitleOnOffId}`).first();

      switches.change((event) => {
        event.preventDefault();

        const onOff = $(event.currentTarget).prop('checked');

        this.toggleTrack('transcript', onOff);
      });

      this.modal.modal('show');
    } catch (e) {
      alert(e);
    }
  }

  /**
   * @function hide
   * @description on hide preview modal
   */
  hide() {
    this.modal.modal('hide');
  }

  /**
   * @function registerEvents
   * @description register to listen to preview modal events
   */
  registerEvents() {
    this.element.on('loadeddata', async () => {
      this.toggleTrack('transcript', true);
      this.carousel.find('[data-default-enabled="true"]').trigger('click');
    });

    this.modal.on('shown.bs.modal', async () => {
      try {
        await this.element[0].load();
        await this.element[0].play();
      } catch (e) {
        console.error(e.message);
      }
    });

    this.modal.on('hide.bs.modal', async () => {
      try {
        await this.element[0].pause();
      } catch (e) {
        console.error(e.message);
      }
    });

    this.modal.on('hidden.bs.modal', async () => {});
  }

  /* eslint-disable prefer-destructuring */
  toggleTrack(name, onOff) {
    const tracks = this.element[0].textTracks;
    for (let i = 0; i < tracks.length; i += 1) {
      if (tracks[i].label === name) {
        tracks[i].mode = (onOff) ? 'showing' : 'hidden';
        break;
      }
    }
  }

  /**
   * @function onTrackLoadEvent
   * @description when subtitle track is loaded, display the subtitle text
   * @param {TextTrack} track
   */
  onTrackLoadEvent(track) {
    if (track.label === 'transcript') {
      const subtitle = $('<div class="lead"></div>');
      const cues = track.cues;

      for (let i = 0; i < cues.length; i += 1) {
        const line = $(`<div class="d-inline" data-cue-index="${i + 1}"></div>`);

        line.append(cues[i].getCueAsHTML());
        line.children().removeClass();
        subtitle.append(line[0]);
      }

      const display = this.carousel.find('div[data-target="subtitle"]').first();
      subtitle.appendTo(display);
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
   */
  async onAction(action) {
    return undefined;
  }
  /* eslint-enable prefer-destructuring */
}
