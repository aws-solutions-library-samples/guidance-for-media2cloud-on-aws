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
/* eslint-disable no-nested-ternary */
/* eslint-disable no-continue */
/* eslint-disable class-methods-use-this */

/**
 * @class ImagePreview
 * @description preview modal to play proxy video and display all metadata
 */
class ImagePreview extends BasePreview {
  constructor(parent, params = {}) {
    const {
      /* top level modal id defined in demo.html */
      imageModalId = 'image-preview-modal-id',
    } = params;

    super(parent, imageModalId);

    this.$imageEditor = new ImageEditor(this, {
      modalId: 'image-editor-modal-id-2',
    });

    this.domInit();

    this.element = $(`#${ImagePreview.Constants.Id.ImagePreview}`);
    this.carousel = $(`#${ImagePreview.Constants.Id.CarouselContainer}`);

    this.registerEvents();
  }

  static get Constants() {
    return {
      Id: {
        ImagePreview: 'image-preview-id',
        CarouselContainer: 'image-carousel-container-id',
        IndexedFaceCollection: 'face-index-collection-id',
        QueuedFaceCollection: 'face-ready-to-process-id',
        CavnasList: 'image-canvas-list-id',
        Loading: 'image-carousel-loading-icon',
      },
      CanvasZIndex: 100,
      CommonAttributes: [
        'Make',
        'Model',
        'ImageSize',
        'ImageHeight',
        'ImageWidth',
        'Orientation',
        'ColorSpace',
        'XResolution',
        'YResolution',
        'CreateDate',
      ],
    };
  }

  get imageEditor() {
    return this.$imageEditor;
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
            <!-- image -->
            <div class="col-sm p-0 m-auto">
              <div class="overlay-container">
                <img
                  id="${ImagePreview.Constants.Id.ImagePreview}"
                  crossorigin="anonymous"
                  style="object-fit: contain; width: 100%; max-width: 600px; max-height: 800px;"
                >
                <!-- canvases -->
                <div id="${ImagePreview.Constants.Id.CavnasList}">
                  <canvas class="image-canvas-overlay" style="z-index: 20; background-color: #ff0000">
                  </canvas>
                </div>
              </div>
            </div>
            <!-- information -->
            <div class="col-sm p-0 m-auto">
              <div class="modal-body">
                <div class="container mt-2">
                  <!-- loading icon -->
                  <div
                    id="${ImagePreview.Constants.Id.Loading}"
                    class="spinner-grow text-secondary loading collapse"
                    style="height: 3em; width: 3em;"
                    role="status">
                    <span class="sr-only">Loading...</span>
                  </div>
                  <!-- carosoual -->
                  <div
                    id="${ImagePreview.Constants.Id.CarouselContainer}"
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

  createCelebCanvas(data, startIdx) {
    let idx = startIdx + ImagePreview.Constants.CanvasZIndex;

    const items = [];
    while (data.CelebrityFaces.length) {
      const celeb = data.CelebrityFaces.shift();
      items.push(`
        <canvas
          class="image-canvas-overlay collapse"
          data-type="celeb"
          data-track="canvas-${idx}"
          data-name="${celeb.Name}"
          data-confidence="${celeb.MatchConfidence}"
          data-coord="${celeb.Face.BoundingBox.Width},${celeb.Face.BoundingBox.Height},${celeb.Face.BoundingBox.Left},${celeb.Face.BoundingBox.Top}"
          data-init="false"
          style="z-index:${idx++};"
        ></canvas>
      `);
    }
    return items;
  }

  createFaceCanvas(data, startIdx) {
    let idx = startIdx + ImagePreview.Constants.CanvasZIndex;
    let faceIdx = 0;
    const items = [];
    while (data.FaceDetails.length) {
      const face = data.FaceDetails.shift();
      const box = face.BoundingBox;
      const gender = ((face.Gender || {}).Value)
        ? `data-gender="${face.Gender.Value} (${Number.parseFloat(face.Gender.Confidence).toFixed(2)})"`
        : '';
      const ageRange = ((face.AgeRange || {}).Low)
        ? `data-age-range="${face.AgeRange.Low}/${face.AgeRange.High}"`
        : '';

      items.push(`
        <canvas
          class="image-canvas-overlay collapse"
          data-type="face"
          data-track="canvas-${idx}"
          data-name="Face ${faceIdx++}"
          data-confidence="${face.Confidence}"
          data-coord="${box.Width},${box.Height},${box.Left},${box.Top}"
          ${gender}
          ${ageRange}
          data-init="false"
          style="z-index:${idx++};"
        ></canvas>
      `);
    }
    return items;
  }

  createFaceMatchCanvas(data, startIdx) {
    let idx = startIdx + ImagePreview.Constants.CanvasZIndex;
    const items = [];
    while (data.FaceMatches.length) {
      const item = data.FaceMatches.shift();
      const box = data.SearchedFaceBoundingBox;
      items.push(`
        <canvas
          class="image-canvas-overlay collapse"
          data-type="faceMatch"
          data-track="canvas-${idx}"
          data-name="${ImagePreview.capitalize(item.Face.ExternalImageId)}"
          data-confidence="${item.Similarity}"
          data-coord="${box.Width},${box.Height},${box.Left},${box.Top}"
          data-init="false"
          style="z-index:${idx++};"
        ></canvas>
      `);
    }
    return items;
  }

  createModerationCanvas(data, startIdx) {
    let idx = startIdx + ImagePreview.Constants.CanvasZIndex;
    const items = [];
    while (data.ModerationLabels.length) {
      const moderation = data.ModerationLabels.shift();
      if (!moderation.ParentName) {
        continue;
      }

      items.push(`
        <canvas
          class="image-canvas-overlay collapse"
          data-type="moderation"
          data-track="canvas-${idx}"
          data-name="${moderation.Name}"
          data-parent-name="${moderation.ParentName}"
          data-confidence="${moderation.Confidence}"
          data-coord="0,0,0,0"
          data-init="false"
          style="z-index:${idx++};"
        ></canvas>
      `);
    }
    return items;
  }

  createLabelCanvas(data, startIdx) {
    let idx = startIdx + ImagePreview.Constants.CanvasZIndex;
    const items = [];
    while (data.Labels.length) {
      const label = data.Labels.shift();
      let parents = label.Parents.map(x => x.Name);
      parents = (parents.length > 0)
        ? parents.join(', ')
        : '';

      if (label.Instances.length > 0) {
        let i = 0;
        while (label.Instances.length) {
          const instance = label.Instances.shift();
          const box = instance.BoundingBox;
          items.push(`
            <canvas
              class="image-canvas-overlay collapse"
              data-type="label"
              data-track="canvas-${idx}"
              data-name="${label.Name} ${i++}"
              data-parent-name="${parents}"
              data-confidence="${instance.Confidence}"
              data-coord="${box.Width},${box.Height},${box.Left},${box.Top}"
              data-init="false"
              style="z-index:${idx++};"
            ></canvas>
          `);
        }
      } else {
        items.push(`
          <canvas
            class="image-canvas-overlay collapse"
            data-type="label"
            data-track="canvas-${idx}"
            data-name="${label.Name}"
            data-parent-name="${parents}"
            data-confidence="${label.Confidence}"
            data-coord="0,0,0,0"
            data-init="false"
            style="z-index:${idx++};"
          ></canvas>
        `);
      }
    }
    return items;
  }

  createTextCanvas(data, startIdx) {
    let idx = startIdx + ImagePreview.Constants.CanvasZIndex;
    const items = [];
    while (data.TextDetections.length) {
      const text = data.TextDetections.shift();
      if (text.Type === 'WORD') {
        continue;
      }
      const box = text.Geometry.BoundingBox;
      items.push(`
        <canvas
          class="image-canvas-overlay collapse"
          data-type="text"
          data-track="canvas-${idx}"
          data-name="${text.DetectedText}"
          data-confidence="${Number.parseFloat(text.Confidence).toFixed(2)}"
          data-coord="${box.Width},${box.Height},${box.Left},${box.Top}"
          data-init="false"
          style="z-index:${idx++};"
        ></canvas>
      `);
    }
    return items;
  }

  createCanvas(data, startIdx) {
    if (data.CelebrityFaces) {
      return this.createCelebCanvas(data, startIdx);
    }
    if (data.FaceDetails) {
      return this.createFaceCanvas(data, startIdx);
    }
    if (data.FaceMatches) {
      return this.createFaceMatchCanvas(data, startIdx);
    }
    if (data.Labels) {
      return this.createLabelCanvas(data, startIdx);
    }
    if (data.ModerationLabels) {
      return this.createModerationCanvas(data, startIdx);
    }
    if (data.TextDetections) {
      return this.createTextCanvas(data, startIdx);
    }
    return [];
  }

  async domCreateCanvas(card) {
    const data = card.getImageAnalysis();
    let results = await Promise.all(Object.keys(data || {}).map((x) => {
      if (!(data[x] || {}).output) {
        return undefined;
      }
      return ImageCard.download(SO0050.Proxy.Bucket, data[x].output).catch(() => undefined);
    }));

    results = results.filter(x => x);
    let canvases = [];
    while (results.length) {
      const result = results.shift();
      canvases = canvases.concat(this.createCanvas(result, canvases.length));
    }
    return canvases.join('\n');
  }

  /**
   * @function domCreateCarouselSlideRekognition
   * @description create rekognition carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideRekognition(card, active = '') {
    const svg = BasePreview.createSvgImage('rekognition');

    const items = [];
    const canvasList = $(`#${ImagePreview.Constants.Id.CavnasList}`);
    [
      'celeb',
      'faceMatch',
      'face',
      'label',
      'text',
      'moderation',
    ].forEach((type) => {
      const kids = canvasList.find(`[data-type="${type}"]`);
      if (kids.length) {
        items.push(ImagePreview.carouselLead(`${ImagePreview.capitalize(type)} (${kids.length})`, type));
        kids.each((idx, item) => {
          const name = $(item).data('name');
          const confidence = Number.parseFloat($(item).data('confidence')).toFixed(2);
          const trackId = $(item).data('track');
          items.push(ImagePreview.carouselButton(trackId, `${name} (${confidence})`, false, type));
        });
      }
    });

    if (!items.length) {
      items.push('No metadata');
    }

    const element = `
    <div class="carousel-item ${active}" id="carousel-rekognition">
      <img class="d-block w-100" src="${svg}" alt="Rekognition">
      <div class="carousel-content d-none d-md-block">
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
        ImagePreview.carouselLead(`${ImagePreview.capitalize(kind)} (${data.length})`),
      ].concat(data.map(x =>
        ImagePreview.carouselTimeButton(x)));
    }

    if (kind === 'entity') {
      let items = [];
      const types = Array.from(new Set(data.map(x => x.type)));
      while (types.length) {
        const type = types.shift();
        const subset = data.filter(x => x.type === type);
        items = items.concat(ImagePreview.carouselLead(`${ImagePreview.capitalize(type.toLowerCase())} (${subset.length})`));
        items = items.concat(subset.map(x =>
          ImagePreview.carouselTimeButton(x)));
      }
      return items;
    }

    if (kind === 'sentiment') {
      return [
        ImagePreview.carouselLead(`${ImagePreview.capitalize(kind.toLowerCase())} (${data.length})`),
      ].concat(data.map(x =>
        ImagePreview.carouselTimeButton(x)));
    }

    // if (kind === 'topic') {
    // }

    return undefined;
  }

  /**
   * @function domCreateCarouselSlideCollection
   * @description create face collection carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideCollection(card, active = '') {
    const svg = BasePreview.createSvgImage('face collection');

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
          <div class="row" id="${ImagePreview.Constants.Id.IndexedFaceCollection}">
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
          <div class="row" id="${ImagePreview.Constants.Id.QueuedFaceCollection}">
          </div>
        </div>
        <div class="mb-5"></div>
      </div>
    </div>
    `;

    return element;
  }

  /**
   * @function domCreateCarouselSlideIngestInfo
   * @description create definition and mediainfo carousel slide
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideIngestInfo(card, active = '') {
    const svg = BasePreview.createSvgImage('ingest');

    const items = [];
    items.push(ImagePreview.carouselLead('Ingest information'));
    items.push('<dl class="row text-left">');
    items.push(`<dt class="col-sm-3">Bucket</dt><dd class="col-sm-9">${SO0050.Ingest.Bucket}</dd>`);
    items.push(`<dt class="col-sm-3">Key</dt><dd class="col-sm-9">${card.key}</dd>`);
    items.push(`<dt class="col-sm-3">ID</dt><dd class="col-sm-9">${card.uuid}</dd>`);
    items.push(`<dt class="col-sm-3">Mime</dt><dd class="col-sm-9">${card.mime}</dd>`);
    items.push(`<dt class="col-sm-3">Size</dt><dd class="col-sm-9">${card.fileSize}</dd>`);
    items.push(`<dt class="col-sm-3">MD5</dt><dd class="col-sm-9">${card.md5 || '--'}</dd>`);
    items.push(`<dt class="col-sm-3">LastModified</dt><dd class="col-sm-9">${card.lastModifiedISOFormat}</dd>`);
    items.push('</dl>');

    const attributes = card.attributes || {};
    const keys = Object.keys(attributes);
    if (keys.length) {
      items.push(ImagePreview.carouselLead('Additional attributes'));
      keys.forEach((x) => {
        items.push('<dl class="row text-left">');
        items.push(`<dt class="col-sm-3">${x}</dt><dd class="col-sm-9">${attributes[x].toString()}</dd>`);
        items.push('</dl>');
      });
    }

    const element = `
    <div class="carousel-item ${active}" id="carousel-ingest">
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
   * @function domCreateCarouselSlideSummary
   * @description summary of aiml process
   * @param {VideoCard} card
   * @param {string} [active]
   */
  async domCreateCarouselSlideSummary(card, active = '') {
    const svg = BasePreview.createSvgImage('Summary');

    const data = card.getImageAnalysis();
    const keys = Object.keys(data || {});

    const items = [];

    while (keys.length) {
      const key = keys.shift();
      const elapsed = ImageCard.readableDuration(data[key].endTime - data[key].startTime);
      const url = ImageCard.signedUrl(SO0050.Proxy.Bucket, data[key].output);
      items.push(ImagePreview.carouselLead(`${ImagePreview.capitalize(key)} (Rekogntion)`));
      items.push('<dl class="row text-left">');
      items.push(`<dt class="col-sm-3">Elapsed</dt><dd class="col-sm-9">${elapsed}</dd>`);
      items.push(`<dt class="col-sm-3">Job Id</dt><dd class="col-sm-9">${data[key].id || '--'}</dd>`);
      items.push(`<dt class="col-sm-3">JSON File</dt><dd class="col-sm-9"><a href="${url}">download here</a></dd>`);
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

  async domCreateCarouselSlideExifInfo(card, active = '') {
    const svg = BasePreview.createSvgImage('exif');

    const items = [];

    const imageinfo = Object.assign({}, card.imageinfo);
    if (Object.keys(imageinfo).length > 0) {
      /* General information */
      items.push(ImagePreview.carouselLead('General information'));
      items.push('<dl class="row text-left">');
      ImagePreview.Constants.CommonAttributes.forEach((x) => {
        items.push(`<dt class="col-sm-6">${x}</dt><dd class="col-sm-6">${ImagePreview.shorten(imageinfo[x] || '--')}</dd>`);
        delete imageinfo[x];
      });
      items.push('</dl>');

      /* GPS information */
      const gps = Object.keys(imageinfo).filter(x => x.indexOf('GPS') === 0);
      if (gps.length > 0) {
        items.push(ImagePreview.carouselLead('GPS information'));

        if (imageinfo.GPSLongitude && imageinfo.GPSLatitude) {
          if (await GoogleMap.getInstance()) {
            const mapId = `map-${this.current.uuid}`;
            items.push(`<div
              id="${mapId}"
              class="mb-3"
              data-lat="${imageinfo.GPSLatitude}"
              data-lng="${imageinfo.GPSLongitude}"
              style="height: 200px; width: 100%; background-color: #808080"></div>
            `);
          }
        }

        items.push('<dl class="row text-left">');
        while (gps.length) {
          const g0 = gps.shift();
          items.push(`<dt class="col-sm-6">${g0}</dt><dd class="col-sm-6">${ImagePreview.shorten(imageinfo[g0])}</dd>`);
          delete imageinfo[g0];
        }
        items.push('</dl>');
      }

      /* EXIF information */
      items.push(ImagePreview.carouselLead('Exif information'));
      items.push('<dl class="row text-left">');
      const keys = Object.keys(imageinfo).sort();
      while (keys.length) {
        const key = keys.shift();
        items.push(`<dt class="col-sm-6">${key}</dt><dd class="col-sm-6">${ImagePreview.shorten(imageinfo[key])}</dd>`);
      }
      items.push('</dl>');
    } else {
      items.push('no image info');
    }

    const element = `
    <div class="carousel-item ${active}" id="carousel-imageinfo">
      <img class="d-block w-100" src="${svg}" alt="Exifinfo">
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
    items = items.concat(await this.domCreateCarouselSlideIngestInfo(current, 'active'));
    items = items.concat(await this.domCreateCarouselSlideSummary(current));
    items = items.concat(await this.domCreateCarouselSlideExifInfo(current));
    items = items.concat(await this.domCreateCarouselSlideRekognition(current));
    items = items.concat(await this.domCreateCarouselSlideCollection(current));

    const indicators = [];

    for (let i = 0; i < items.length; i += 1) {
      const active = (!i) ? 'active' : '';

      indicators.push(`
      <li data-target="#${ImagePreview.Constants.Id.CarouselContainer}" data-slide-to="0" class="${active}"></li>
      `);
    }

    const dom = `
    <ol class="carousel-indicators">
      ${indicators.join('\n')}
    </ol>
    <div class="carousel-inner">
      ${items.join('\n')}
    </div>
    <a class="carousel-control-prev" href="#${ImagePreview.Constants.Id.CarouselContainer}" role="button" data-slide="prev">
      <i class="fas fa-angle-left fa-3x" style="color: #888;" aria-hidden="true"></i>
      <span class="sr-only">Previous</span>
    </a>
    <a class="carousel-control-next" href="#${ImagePreview.Constants.Id.CarouselContainer}" role="button" data-slide="next">
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
      this.element.attr('src', asset.getSignedImage());

      const canvases = $(`#${ImagePreview.Constants.Id.CavnasList}`);
      canvases.children().remove();
      const canvasItems = await this.domCreateCanvas(asset);
      $(canvasItems).appendTo(canvases);

      this.carousel.children().remove();
      const carouselItems = await this.domCreateCarousel(asset);
      $(carouselItems).appendTo(this.carousel);

      this.carousel.find('[data-action]').each((key, val) => {
        $(val).off('click').on('click', async (event) => {
          event.preventDefault();

          await this.onAction($(event.currentTarget).data('action'));
        });
      });

      this.carousel.find('[data-track]').each((key, val) => {
        $(val).off('click').on('click', (event) => {
          event.preventDefault();

          const onOff = $(event.currentTarget).attr('aria-pressed') === 'false';
          const trackId = $(event.currentTarget).data('track');
          console.log(`${trackId} track ${onOff ? 'enabled' : 'disabled'}`);

          this.toggleTrack(trackId, onOff);
        });
      });

      /* enable track group */
      this.carousel.find('[data-track-group-toggle]').each((key, val) => {
        $(val).off('change').change((event) => {
          event.preventDefault();

          // const onOff = $(event.currentTarget).prop('checked');
          const trackGroup = $(event.currentTarget).data('track-group-toggle');
          this.carousel.find(`[data-track-group="${trackGroup}"]`).each((k, v) => {
            $(v).click();
          });
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
    this.current = undefined;
  }

  async showMap() {
    const map = this.carousel.find(`#map-${this.current.uuid}`).first();
    if (map.length) {
      const lat = map.data('lat');
      const lng = map.data('lng');
      const gMap = await GoogleMap.getInstance();
      if (gMap) {
        gMap.render(map[0], lat, lng);
      }
    }
  }

  /**
   * @function registerEvents
   * @description register to listen to preview modal events
   */
  registerEvents() {
    this.modal.off('shown.bs.modal').on('shown.bs.modal', async () => {
    });

    this.modal.off('hide.bs.modal').on('hide.bs.modal', async () => {
    });

    this.modal.off('hidden.bs.modal').on('hidden.bs.modal', async () => {});

    this.modal.off('slide.bs.carousel').on('slide.bs.carousel', async (event) => {
      if (event.relatedTarget.id === 'carousel-face-collection') {
        await this.scanFaces();
      } else if (event.relatedTarget.id === 'carousel-imageinfo') {
        await this.showMap();
      }
    });

    this.element.off('load').on('load', () => {
      // console.log(`image = ${this.element.width()} x ${this.element.height()}`);
    });
  }

  /* eslint-disable prefer-destructuring */
  toggleTrack(trackId, onOff) {
    const canvas = $(`#${ImagePreview.Constants.Id.CavnasList}`).find(`[data-track="${trackId}"]`).first();

    if (!onOff) {
      canvas.addClass('collapse');
      return;
    }

    const init = !(canvas.data('init') === false);
    if (init) {
      canvas.removeClass('collapse');
      return;
    }

    const canvasW = canvas.width();
    const canvasH = canvas.height();
    /* note: need to explicitly set the canvas width and height */
    canvas[0].width = canvasW;
    canvas[0].height = canvasH;

    const ctx = canvas[0].getContext('2d');

    const coord = canvas.data('coord').split(',').map(x =>
      Number.parseFloat(x));
    const w = Math.floor(coord[0] * canvasW);
    const h = Math.floor(coord[1] * canvasH);
    let x = Math.floor(coord[2] * canvasW);
    let y = Math.floor(coord[3] * canvasH);

    const hasCoord = (w || h || x || y);
    if (hasCoord) {
      ctx.strokeStyle = '#ffffff'; // #ff9900
      ctx.moveTo(0, 0);
      ctx.strokeRect(x, y, w, h);
    }

    const name = canvas.data('name');
    const confidence = Number.parseFloat(canvas.data('confidence')).toFixed(2);
    const gender = canvas.data('gender');
    const ageRange = canvas.data('age-range');
    const parentName = canvas.data('parent-name');

    const text = [
      `${name} (${confidence})`,
      gender && `Gender: ${gender}`,
      ageRange && `Age: ${ageRange}`,
      parentName && `(${parentName})`,
    ].filter(x0 => x0);

    let fontSize;
    const lineSpace = 0;

    if (hasCoord) {
      fontSize = 12;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    } else {
      x = 0.5 * canvasW;
      y = 0.5 * canvasH;
      fontSize = 18;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    }
    ctx.font = `${fontSize}px sans-serif`;

    switch (canvas.data('type')) {
      case 'moderation':
      case 'celeb':
        ctx.fillStyle = '#ffffff';
        break;
      case 'faceMatch':
        ctx.fillStyle = '#ffffff';
        break;
      case 'face':
        ctx.fillStyle = '#ffffff';
        break;
      case 'label':
        ctx.fillStyle = '#ffffff';
        break;
      case 'text':
        ctx.fillStyle = '#ffffff';
        break;
      default:
        ctx.fillStyle = '#ffffff';
        break;
    }

    let y0 = Math.max((y - (text.length * (fontSize + lineSpace))), 2);
    while (text.length) {
      ctx.fillText(text.shift(), x, y0);
      y0 += (fontSize + lineSpace);
    }

    canvas.data('init', 'true');
    canvas.removeClass('collapse');
  }

  /**
   * @function onAction
   * @description currently not used
   * @param {string} action
   */
  async onAction(action) {
    if (action === 'snapshot') {
      await this.onSnapshot();
    } else if (action === 're-analyze') {
      await this.onReAnalyze();
    } else if (action === 'send-to-ground-truth') {
      await this.onSendToGroundTruth();
    }
    return undefined;
  }

  /**
   * @function onSnapshot
   * @description process on snapshot event. Bring up image editor modal for face cropping.
   */
  async onSnapshot() {
    try {
      const w = Math.floor(this.element.width() + 0.5);
      const h = Math.floor(this.element.height() + 0.5);

      const canvas = $(`<canvas width="${w}" height="${h}"></canvas>`);
      const context = canvas[0].getContext('2d');

      context.fillRect(0, 0, w, h);
      context.drawImage(this.element[0], 0, 0, w, h);

      /* create a blob */
      const snapshot = canvas[0].toDataURL();
      await this.imageEditor.show(snapshot, w, h, 0);
    } catch (e) {
      console.error(encodeURIComponent(e.message));
    }
  }

  /**
   * @function onReAnalyze
   * @description re-run media analysis with everything disabled except face-match
   */
  async onReAnalyze() {
    try {
      AppUtils.loading(ImagePreview.Constants.Id.Loading, true);

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
      AppUtils.loading(ImagePreview.Constants.Id.Loading, false);
    }
  }

  /**
   * @function onSendToGroundTruth
   * @description send the queued faces to GT for tagging
   */
  async onSendToGroundTruth() {
    try {
      AppUtils.loading(ImagePreview.Constants.Id.Loading, true);

      return ApiHelper.startLabelingWorkflow({
        uuid: this.current.uuid,
      });
    } catch (e) {
      console.error(encodeURIComponent(e.message));
      throw e;
    } finally {
      AppUtils.loading(ImagePreview.Constants.Id.Loading, false);
    }
  }

  /**
   * @function indexFace
   * @description call APIGW endpoint to index face
   * @param {object} data - cropped image data
   */
  async indexFace(data) {
    const modified = Object.assign({
      uuid: this.current.uuid,
      contentUrl: `s3://${SO0050.Proxy.Bucket}/${this.current.getImageKey()}`,
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
      contentUrl: `s3://${SO0050.Proxy.Bucket}/${this.current.getImageKey()}`,
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
          <small class="text-muted">${ImagePreview.capitalize(params.name || params.tempId)}</small>
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
    if ($(`#${ImagePreview.Constants.Id.IndexedFaceCollection}`).find(`[data-face-id="${params.faceId}"]`).length === 0) {
      this.addToCollection(ImagePreview.Constants.Id.IndexedFaceCollection, params);
    }
  }

  /**
   * @function addToQueuedFaceCollection
   * @description add face to GT queue
   * @param {*} params
   */
  addToQueuedFaceCollection(params = {}) {
    if ($(`#${ImagePreview.Constants.Id.QueuedFaceCollection}`).find(`[data-temp-id="${params.tempId}"]`).length === 0) {
      this.addToCollection(ImagePreview.Constants.Id.QueuedFaceCollection, params);
    }
    this.modal.find('[data-action="send-to-ground-truth"]').first().removeClass('collapse');
  }

  /**
   * @function scanFaces
   */
  async scanFaces() {
    try {
      AppUtils.loading(ImagePreview.Constants.Id.Loading, true);

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
      AppUtils.loading(ImagePreview.Constants.Id.Loading, false);
    }
  }

  removeFaces() {
    [
      ImagePreview.Constants.Id.IndexedFaceCollection,
      ImagePreview.Constants.Id.QueuedFaceCollection,
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

      if (msg.operation === ImagePreview.States.JobCompleted) {
        button.removeAttr('disabled');
        return this.reloadFaces();
      }
      button.attr('disabled', 'disabled');
    }
    return undefined;
  }
}
