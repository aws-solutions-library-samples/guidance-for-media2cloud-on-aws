/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */
class BasePreview extends mxReadable(class {}) {
  constructor(parent, modalId) {
    super();
    this.$parent = parent;
    this.$element = undefined;
    this.$current = undefined;
    this.$carousel = undefined;
    this.$imageEditor = undefined;
    this.$modal = $(`#${modalId}`);
  }

  static get States() {
    return window.AWSomeNamespace.States;
  }

  static get Statuses() {
    return window.AWSomeNamespace.Statuses;
  }

  static get Constants() {
    return {
      Id: {
        IndexedFaceCollection: 'face-index-collection-id',
        QueuedFaceCollection: 'face-ready-to-process-id',
      },
      Actions: {
        SendToGroundTruth: 'snd-to-gt',
        ReAnalyze: 're-analyze',
        Snapshot: 'snapshot',
        UnlockLabels: 'unlock-labels',
      },
    };
  }

  get parent() {
    return this.$parent;
  }

  get modal() {
    return this.$modal;
  }

  get element() {
    return this.$element;
  }

  set element(val) {
    this.$element = val;
  }

  get current() {
    return this.$current;
  }

  set current(val) {
    this.$current = val;
  }

  get carousel() {
    return this.$carousel;
  }

  set carousel(val) {
    this.$carousel = val;
  }

  get imageEditor() {
    return this.$imageEditor;
  }

  set imageEditor(val) {
    this.$imageEditor = val;
  }

  /**
   * @abstract
   * @function getLoadingId
   * @description subclass to provide implementation
   */
  getLoadingId() {
    throw new Error('subclass to implement');
  }

  /**
   * @abstract
   * @function getIndexFaceCollectionId
   * @description subclass to provide implementation
   */
  getIndexFaceCollectionId() {
    return BasePreview.Constants.Id.IndexedFaceCollection;
  }

  /**
   * @abstract
   * @function getQueuedFaceCollectionId
   * @description subclass to provide implementation
   */
  getQueuedFaceCollectionId() {
    return BasePreview.Constants.Id.QueuedFaceCollection;
  }

  domUninit() {
    this.modal.children().remove();
    this.current = undefined;
    this.element = undefined;
    this.carousel = undefined;
  }

  /**
   * @function addToIndexedFaceCollection
   * @description render indexed face thumbnails
   * @param {*} params
   */
  addToIndexedFaceCollection(params = {}) {
    const id = this.getIndexFaceCollectionId();
    if ($(`#${id}`).find(`[data-face-id="${params.faceId}"]`).length === 0) {
      this.addToCollection(id, params);
    }
  }

  /**
   * @function addToQueuedFaceCollection
   * @description render queued face thumbnails
   * @param {*} params
   */
  addToQueuedFaceCollection(params = {}) {
    const id = this.getQueuedFaceCollectionId();
    if ($(`#${id}`).find(`[data-temp-id="${params.tempId}"]`).length === 0) {
      this.addToCollection(id, params);
    }
    const action = BasePreview.Constants.Actions.SendToGroundTruth;
    this.modal.find(`[data-action="${action}"]`).first().removeClass('collapse');
  }

  /**
   * @function addToCollection
   * @description render indexed or queued face thumbnails
   * @param {string} parent
   * @param {*} params
   */
  addToCollection(parent, params = {}) {
    const size = '96px';
    const thumbnail = $('<div/>')
      .addClass('col-auto p-2')
      .append($('<div/>')
        .addClass('card')
        .css('width', size)
        .append($('<img/>')
          .addClass('card-img-top')
          .attr('src', params.dataUrl)
          .attr('width', size)
          .attr('height', size)
          .attr('data-content-uuid', params.uuid)
          .attr('data-content-url', params.conentUrl)
          .attr('data-name', params.name)
          .attr('data-face-id', params.faceId)
          .attr('data-temp-id', params.tempId)
          .attr('data-timecode', params.timecode)
          .attr('data-image-url', params.imageUrl)
          .attr('data-submitted', params.submitted)
          .attr('data-mode', params.mode))
        .append($('<div/>')
          .addClass('card-body text-center text-truncate p-1')
          .append('<small/>')
          .addClass('text-muted')
          .append(BasePreview.capitalize(params.name || params.tempId))));
    return $(`#${parent}`).append(thumbnail);
  }

  /**
   * @async
   * @function indexFace
   * @description call APIGW endpoint to index face
   * @param {object} data - cropped image data
   */
  async indexFace(data) {
    let key;
    switch (((this.current || {}).constructor || {}).name) {
      case 'VideoCard':
        key = this.current.getVideoKey();
        break;
      case 'ImageCard':
        key = this.current.getImageKey();
        break;
      default:
        break;
    }

    if (!key) {
      throw new Error('indexFace failed to find key');
    }

    const modified = {
      uuid: this.current.uuid,
      contentUrl: `s3://${SolutionManifest.Proxy.Bucket}/${key}`,
      ...data,
    };

    const responses = await ApiHelper.indexFace(modified);
    responses.forEach(x => this.addToIndexedFaceCollection(x));
    return responses;
  }

  /**
   * @async
   * @function queueFace
   * @description queue face for Ground Truth to process
   * @param {object} data
   */
  async queueFace(data) {
    let key;
    switch (((this.current || {}).constructor || {}).name) {
      case 'VideoCard':
        key = this.current.getVideoKey();
        break;
      case 'ImageCard':
        key = this.current.getImageKey();
        break;
      default:
        break;
    }

    if (!key) {
      throw new Error('queueFace failed to find key');
    }

    const modified = {
      tempId: AppUtils.uuid4(),
      uuid: this.current.uuid,
      contentUrl: `s3://${SolutionManifest.Proxy.Bucket}/${key}`,
      ...data,
    };
    delete modified.name;

    const responses = await ApiHelper.queueFace(modified);
    responses.forEach(x => this.addToQueuedFaceCollection(x));
    return responses;
  }

  /**
   * @async
   * @function scanFaces
   * @description scan indexed and queued faces from DDB
   */
  async scanFaces() {
    const id = this.getLoadingId();
    try {
      AppUtils.loading(id, true);

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
      AppUtils.loading(id, false);
    }
  }

  /**
   * @function removeFaces
   * @description remove indexed and queued faces from ui
   */
  removeFaces() {
    [
      this.getIndexFaceCollectionId(),
      this.getQueuedFaceCollectionId(),
    ].forEach(id => $(`#${id}`).empty());
  }

  /**
   * @async
   * @function reloadFaces
   * @description reload indexed and queued faces
   */
  async reloadFaces() {
    this.removeFaces();
    await this.scanFaces();
  }

  /**
   * @async
   * @function onGroundTruthMessage
   * @description process ground truth messages
   */
  async onGroundTruthMessage(msg) {
    if (this.current && msg.uuid === this.current.uuid) {
      const action = BasePreview.Constants.Actions.SendToGroundTruth;
      const button = this.carousel.find(`[data-action="${action}"]`).first();

      if (msg.operation === BasePreview.States.JobCompleted) {
        button.removeAttr('disabled');
        return this.reloadFaces();
      }
      button.attr('disabled', 'disabled');
    }
    return undefined;
  }

  /**
   * @async
   * @function onSendToGroundTruth
   * @description send request to Ground Truth to index queued faces
   */
  async onSendToGroundTruth() {
    const id = this.getLoadingId();
    try {
      AppUtils.loading(id, true);
      return ApiHelper.startLabelingWorkflow({
        uuid: this.current.uuid,
      });
    } catch (e) {
      console.error(encodeURIComponent(e.message));
      throw e;
    } finally {
      AppUtils.loading(id, false);
    }
  }

  /**
   * @async
   * @function onReAnalyze
   * @description re-run media analysis with everything disabled except face-match
   */
  async onReAnalyze() {
    const id = this.getLoadingId();
    try {
      AppUtils.loading(id, true);

      const running = this.current.isBusy();
      if (running) {
        alert(`'${this.current.basename}' is currently in process, ${running}`);
        return;
      }

      await ApiHelper.startAnalysisWorkflow({
        uuid: this.current.uuid,
        input: {
          aiOptions: {
            facematch: true,
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
      AppUtils.loading(id, false);
    }
  }

  /**
   * @async
   * @function onSnapshot
   * @description process on snapshot event. Bring up image editor modal for face cropping.
   * @param {Object} element - source element, either video or image
   * @param {number} w - canvas width
   * @param {number} h - canvas height
   * @param {number} [timecode] - time code to the video
   */
  async onSnapshot(element, w, h, timecode = 0) {
    try {
      const canvas = $('<canvas/>').attr('width', w).attr('height', h);
      const context = canvas[0].getContext('2d');
      context.fillRect(0, 0, w, h);
      context.drawImage(element[0], 0, 0, w, h);
      /* create a blob */
      const snapshot = canvas[0].toDataURL();
      return this.imageEditor.show(snapshot, w, h, timecode);
    } catch (e) {
      console.error(encodeURIComponent(e.message));
      return undefined;
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

    const parent = elem.closest('details[data-track-group]').first();
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
   * @function onAction
   * @description currently not used
   * @param {string} action
   * @param {object} event - original event
   */
  async onAction(action, event) {
    if (action === BasePreview.Constants.Actions.Snapshot) {
      await this.onSnapshot();
    } else if (action === BasePreview.Constants.Actions.ReAnalyze) {
      await this.onReAnalyze();
    } else if (action === BasePreview.Constants.Actions.SendToGroundTruth) {
      await this.onSendToGroundTruth();
    } else if (action === BasePreview.Constants.Actions.UnlockLabels) {
      await this.onToggleLabelLockState(event);
    }
    return undefined;
  }

  registerCarouselEvents() {
    this.carousel.find('[data-toggle="tooltip"]').tooltip();

    this.carousel.find('[data-action]').each((key, val) => {
      $(val).off('click').on('click', async (event) => {
        event.preventDefault();
        await this.onAction($(event.currentTarget).data('action'), event);
      });
    });

    this.carousel.find('[data-track]').each((key, val) => {
      this.registerTrackButttonEvent(val);
    });

    this.carousel.find('label.xs-switch').each((key, val) => {
      $(val).off('click').on('click', (event) => {
        event.preventDefault();
        AppUtils.loading(this.getLoadingId(), true);
        const input = $(event.currentTarget).find('[data-track-group-toggle]').first();
        const allIsOn = !(input.prop('checked'));
        input.prop('checked', allIsOn);

        const trkGrp = input.data('track-group-toggle');
        this.carousel.find(`[data-track-group="${trkGrp}"]`).each((k, v) => {
          const trackIsOn = $(v).attr('aria-pressed') !== 'false';
          if (allIsOn !== trackIsOn) {
            $(v).click();
          }
        });
        AppUtils.loading(this.getLoadingId(), false);
      });
    });
  }

  registerTrackButttonEvent(val) {
    $(val).off('click').on('click', (event) => {
      event.preventDefault();
      const target = $(event.currentTarget);
      const track = target.data('track');
      const isOn = target.attr('aria-pressed') === 'false';
      const canEdit = target.hasClass('editable');
      this.toggleTrack(track, isOn);
      if (canEdit) {
        this.onEditLabel(target.get(0));
      }
    });
  }

  async domCreateCarousel(id, slides, tooltips) {
    this.carousel.children().remove();

    /* indicators */
    let items = $('<ol/>').addClass('carousel-indicators');
    for (let i = 0; i < slides.length; i += 1) {
      const li = $('<li/>')
        .attr('data-target', `#${id}`)
        .attr('data-slide-to', i.toString())
        .attr('data-toggle', 'tooltip')
        .attr('data-placement', 'top')
        .attr('title', tooltips[i]);
      if (i === 0) {
        li.addClass('active');
      }
      items.append(li);
    }
    this.carousel.append(items);

    /* slides */
    items = $('<div/>').addClass('carousel-inner');
    while (slides.length) {
      items.append(slides.shift());
    }
    this.carousel.append(items);

    /* next/previous */
    [{
      direction: 'prev',
      text: 'Previous',
      icon: 'fa-angle-left',
    }, {
      direction: 'next',
      text: 'Next',
      icon: 'fa-angle-right',
    }].forEach((x) => {
      items = $('<a/>').addClass(`carousel-control-${x.direction}`)
        .attr('href', `#${id}`)
        .attr('role', 'button')
        .attr('data-slide', x.direction)
        .css('z-index', 9999)
        .append($('<i/>').addClass('fas fa-3x').addClass(x.icon)
          .attr('aria-hidden', true)
          .css('color', '#888'))
        .append($('<span/>').addClass('sr-only')
          .append(x.text));
      this.carousel.append(items);
    });
    return this.registerCarouselEvents();
  }

  static createPreview(id) {
    return $('<div/>').addClass('col-sm p-0 m-auto')
      .append($('<div/>').addClass('row-sm mt-1')
        .attr('id', id));
  }

  static createInfoview(id, spinnerId) {
    return $('<div/>').addClass('col-sm p-0 m-auto')
      .append($('<div/>').addClass('modal-body')
        .append($('<div/>').addClass('container mt-2')
          .append($('<div/>').addClass('spinner-grow text-secondary loading collapse')
            .attr('id', spinnerId)
            .attr('role', 'status')
            .css('height', '3rem')
            .css('width', '3rem')
            .css('margin-right', '25%')
            .css('margin-top', '20%')
            .append($('<span/>').addClass('sr-only').html('Loading...')))
          .append($('<div/>').addClass('carousel slide')
            .attr('id', id)
            .attr('data-ride', 'carousel')
            .attr('data-interval', 'false'))));
  }

  static createModalLayout(leftView, rightView) {
    const row = $('<div/>').addClass('row p-0');
    if (leftView) {
      row.append(leftView);
    }
    if (rightView) {
      row.append(rightView);
    }
    return $('<div/>').addClass('modal-dialog modal-xl')
      .attr('role', 'document')
      .append($('<div/>').addClass('modal-content')
        .append($('<div/>').addClass('container')
          .append(row)));
  }

  static createCarouselSlide(body, category, type, active) {
    const image = $('<img/>').addClass('d-block w-100')
      .attr('src', BasePreview.createBackgroundImage(category.toUpperCase()))
      .attr('alt', category);

    const content = $('<div/>').addClass('carousel-content d-none d-md-block')
      .attr('data-track-category', category)
      .attr('data-track-type', type)
      .append(body)
      .append($('<div/>').addClass('mb-5'));

    const slide = $('<div/>').addClass('carousel-item')
      .attr('id', `carousel-${category.toLowerCase()}`);
    if (active) {
      slide.addClass('active');
    }
    return slide.append(image).append(content);
  }

  static createCarouselContent(title) {
    return $('<div/>').addClass('container')
      .append($('<span/>').addClass('lead text-capitalize mt-2 mb-2 d-block')
        .append(title));
  }

  static createBackgroundImage(name, options = {}) {
    const {
      width: w = 800,
      height: h = 800,
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
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  static createContentListItem(title, trkGrp, options = {}) {
    const details = $('<details/>').addClass((options.details || {}).margins || 'mb-3');
    if (trkGrp) {
      details.attr('data-track-group', trkGrp);
    }
    return details.append(BasePreview.createContentListItemTitle(title, trkGrp, options));
  }

  /**
   *
   * @param {string} title - title text
   * @param {string} [trkGrp] - set switch button 'data-track-group-toggle' to trkGrp
   * @param {object} [options]
   * @param {boolean} [options.canEdit] - enable editable (lock) button
   * @param {number} [options.fontsize] - header font size
   */
  static createContentListItemTitle(title, trkGrp, options = {}) {
    const summary = $('<summary/>').addClass('mb-1 mt-1');
    const lead = $('<span/>').addClass('lead text-capitalize')
      .css('font-size', `${options.fontsize || 1.25}rem`)
      .append(title);

    if (options.canEdit) {
      lead.append($('<a/>').addClass('overlay-action')
        .attr('href', '#')
        .append($('<i/>').addClass('fas fa-lock ml-1')
          .css('color', '3333')
          .css('font-size', '0.85rem')
          .attr('title', 'Lock/unlock labels for edit')
          .attr('alt', 'Lock/unlock labels for edit')
          .attr('data-action', BasePreview.Constants.Actions.UnlockLabels)
          .attr('data-toggle', 'tooltip')
          .attr('data-placement', 'bottom')
          .attr('data-lock-state', 'locked')));
    }

    return (!trkGrp)
      ? summary.append(lead)
      : summary.append($('<div/>').addClass('d-inline')
        .append(lead)
        .append(BasePreview.createOnOffSwitch(trkGrp)));
  }

  /**
   * @static
   * @function createOnOffSwitch
   * @description create on/off toggle switch
   * @param {string} trkGrp - set 'data-track-group-toggle' to trkGrp
   * @param {*} text - switch display text
   */
  static createOnOffSwitch(trkGrp, text = 'Display all') {
    return $('<div/>').addClass('float-right align-baseline')
      .append($('<label/>').addClass('xs-switch align-middle')
        .append($('<input/>')
          .attr('type', 'checkbox')
          .attr('data-track-group-toggle', trkGrp))
        .append($('<span/>').addClass('xs-slider round')))
      .append($('<span/>').addClass('ml-1 align-middle')
        .append(text));
  }

  /**
   * @static
   * @function createButton
   * @description create carousel button
   * @param {string} trkId - set 'data-track' to id
   * @param {string} text - button display text
   * @param {string} [trkGrp] - set 'data-track-group'
   * @param {object} [options]
   * @param {*} [options.enabled] - button default enable state
   * @param {*} [options.maxlen] - button max character length
   * @param {*} [options.fontsize] - button text font size
   * @param {*} [options.canEdit] - enable editable UI
   */
  static createButton(trkId, text, trkGrp = undefined, options = {}) {
    const enabled = (options.enabled === undefined) ? false : options.enabled;
    const maxlen = options.maxlen || 46;
    const fontsize = `${options.fontsize || 0.75}rem`;
    const button = $('<button/>').addClass('btn btn-sm mb-2')
      .addClass(options.btnStyle || 'btn-primary')
      .attr('type', 'button')
      .attr('aria-pressed', 'false')
      .attr('autocomplete', 'off')
      .attr('data-toggle', 'button')
      .attr('data-track', trkId)
      .attr('data-default-enabled', enabled)
      .css('font-size', fontsize)
      .append(BasePreview.shorten(BasePreview.capitalize(text), maxlen));

    if (trkGrp) {
      button.attr('data-track-group', trkGrp);
    }

    if (options.canEdit) {
      button.append($('<a href="#"/>')
        .append($('<i/>').addClass('far fa-times-circle ml-1 collapse')
          .attr('data-toggle', 'tooltip')
          .attr('data-placement', 'bottom')
          .attr('title', 'Edit this label')
          .attr('alt', 'Edit this label')
          .css('color', '#fff')));
    }
    return button;
  }

  /**
   * @static
   * @function createMarkInOutButton
   * @description create mark in/out button
   * @param {string} text - button text
   * @param {number} markin  - mark in timecode
   * @param {number} markout - mark out timecode
   * @param {object} [options]
   * @param {string} [options.btnStyle] default to btn-prmiary with mr-1 margin
   */
  static createMarkInOutButton(text, markin, markout, options = {}) {
    const tooltip = `${BasePreview.readableDuration(markin)} / ${BasePreview.readableDuration(markout)}`;
    return $('<button/>').addClass('btn btn-sm mb-2')
      .addClass(options.btnStyle || 'btn-primary mr-1')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'top')
      .attr('data-mark-in', markin)
      .attr('data-mark-out', markout)
      .attr('title', tooltip)
      .append(text);
  }

  static createCanvas(data, zindex, classes = 'image-canvas-overlay collapse', css = {}) {
    const canvas = $('<canvas/>');
    Object.keys(data).forEach(x => canvas.attr(x, data[x]));
    canvas.css('z-index', zindex);
    if (typeof classes === 'string') {
      canvas.addClass(classes);
    } else if (Array.isArray(classes)) {
      classes.forEach(x => canvas.addClass(x));
    }
    Object.keys(css).forEach(x => canvas.css(x, css[x]));
    return canvas;
  }

  static createSourceListItem(data) {
    const source = BasePreview.createContentListItem('Source', undefined, {
      fontsize: 1,
    });

    const dl = $('<dl/>').addClass('row text-left');
    const keys = Object.keys(data);
    keys.forEach((x) => {
      if (x === 'mediainfo' || x === 'proxies' || x === 'storageClass') {
        return;
      }
      let value;
      switch (x) {
        case 'fileSize':
          value = BasePreview.readableFileSize(data[x]);
          break;
        case 'lastModified':
        case 'timestamp':
          value = new Date(data[x]).toISOString();
          break;
        case 'key':
          value = $('<a/>')
            .attr('href', BaseCard.signedUrl(data.bucket, data[x]))
            .attr('target', '_blank')
            .html(data[x]);
          break;
        default:
          value = (Array.isArray(data[x]))
            ? data[x].join(', ')
            : data[x];
          break;
      }
      dl.append($('<dt/>').addClass('col-sm-3').html(BasePreview.capitalize(x)))
        .append($('<dd/>').addClass('col-sm-9').html(value));
    });
    return source.append(dl);
  }

  static createProxyListItem(data) {
    const proxies = BasePreview.createContentListItem('Proxies', undefined, {
      fontsize: 1,
    });

    for (let i = 0; i < data.proxies.length; i++) {
      const heading = `#${String(i + 1).padStart(2, '0')} (${data.proxies[i].type})`;
      const proxy = BasePreview.createContentListItem(heading, undefined, {
        details: {
          margins: 'mb-1 ml-2',
        },
        fontsize: 0.85,
      });

      const dl = $('<dl/>').addClass('row text-left');
      Object.keys(data.proxies[i]).forEach((x) => {
        let value;
        switch (x) {
          case 'fileSize':
            value = BasePreview.readableFileSize(data.proxies[i][x]);
            break;
          case 'lastModified':
          case 'timestamp':
            value = new Date(data.proxies[i][x]).toISOString();
            break;
          case 'key':
            value = $('<a/>')
              .attr('href', BaseCard.signedUrl(data.proxies[i].bucket, data.proxies[i][x]))
              .attr('target', '_blank')
              .html(data.proxies[i][x]);
            break;
          default:
            value = (Array.isArray(data.proxies[i][x]))
              ? data.proxies[i][x].join(', ')
              : data.proxies[i][x];
            break;
        }
        dl.append($('<dt/>').addClass('col-sm-3').html(BasePreview.capitalize(x)))
          .append($('<dd/>').addClass('col-sm-9').html(value));
      });
      proxies.append(proxy.append(dl));
    }
    return proxies;
  }

  static createMediainfoListItem(data) {
    const mediainfo = BasePreview.createContentListItem('Mediainfo', undefined, {
      fontsize: 1,
    });

    const tracks = ((data.mediainfo || {}).file || {}).track || [];
    for (let i = 0; i < tracks.length; i++) {
      const stream = BasePreview.createContentListItem(BasePreview.capitalize(tracks[i].$.type), undefined, {
        details: {
          margins: 'mb-1 ml-2',
        },
        fontsize: 0.85,
      });

      const dl = $('<dl/>').addClass('row text-left');
      Object.keys(tracks[i]).filter(x => x !== '$').forEach(x =>
        dl.append($('<dt/>').addClass('col-sm-6').html(BasePreview.capitalize(x)))
          .append($('<dd/>').addClass('col-sm-6').html(BasePreview.shorten(tracks[i][x], 50))));
      mediainfo.append(stream.append(dl));
    }
    return mediainfo;
  }

  static createAttributeListItem(data) {
    const keys = Object.keys(data.attributes || {});
    if (!keys.length) {
      return undefined;
    }

    const attributes = BasePreview.createContentListItem('Additional attributes', undefined, {
      fontsize: 1,
    });

    const dl = $('<dl/>').addClass('row text-left');
    keys.forEach(x =>
      dl.append($('<dt/>').addClass('col-sm-3').html(x))
        .append($('<dd/>').addClass('col-sm-9').html(data.attributes[x].toString())));
    return attributes.append(dl);
  }

  static createRekognitionSummaryListItem(category, data) {
    const subtypes = Object.keys(data || {});
    if (!subtypes.length) {
      return undefined;
    }

    const options = {
      details: {
        margins: 'mb-1 ml-2',
      },
      fontsize: 0.85,
    };

    const rekognition = BasePreview.createContentListItem(category, undefined, {
      fontsize: 1,
    });
    while (subtypes.length) {
      const subtype = subtypes.shift();
      rekognition.append(BasePreview.createAnalysisSummaryListItem(subtype, data[subtype], options));
    }
    return rekognition;
  }

  static createComprehendSummaryListItem(category, data) {
    const subtypes = Object.keys(data || {});
    if (!subtypes.length) {
      return undefined;
    }

    const options = {
      details: {
        margins: 'mb-1 ml-2',
      },
      fontsize: 0.85,
    };

    const comprehend = BasePreview.createContentListItem(category, undefined, {
      fontsize: 1,
    });
    while (subtypes.length) {
      const subtype = subtypes.shift();
      comprehend.append(BasePreview.createAnalysisSummaryListItem(subtype, data[subtype], options));
    }
    return comprehend;
  }

  static createTranscribeSummaryListItem(category, data) {
    return (Object.keys(data).length)
      ? BasePreview.createAnalysisSummaryListItem(category, data)
      : undefined;
  }

  static createTextractSummaryListItem(category, data) {
    return (Object.keys(data).length)
      ? BasePreview.createAnalysisSummaryListItem(category, data)
      : undefined;
  }

  static createAnalysisSummaryListItem(category, data, options) {
    const detection = BasePreview.createContentListItem(category, undefined, {
      fontsize: 1,
      ...options,
    });

    const elapsed = BasePreview.readableDuration(data.endTime - data.startTime);
    const url = BaseCard.signedUrl(SolutionManifest.Proxy.Bucket, data.output);
    detection.append($('<dl/>').addClass('row text-left')
      .append($('<dt/>').addClass('col-sm-3').html('Elapsed'))
      .append($('<dd/>').addClass('col-sm-9').html(elapsed))
      .append($('<dt/>').addClass('col-sm-3').html('Job Id'))
      .append($('<dd/>').addClass('col-sm-9').html(data.name || data.id || '--'))
      .append($('<dt/>').addClass('col-sm-3').html('JSON file'))
      .append($('<dd/>').addClass('col-sm-9')
        .append($('<a/>').attr('href', url).attr('target', '_blank').html(data.output))));
    return detection;
  }

  static createSnapshotContent() {
    const container = BasePreview.createCarouselContent('');

    /* description and snapshot ui */
    const description = $('<div/>')
      .addClass('col-sm-9 px-0')
      .append($('<p/>')
        .html('Click on <strong>Snapshot</strong> to index a face.<br>By indexing a face and adding it to your Amazon Rekognition collection, it greatly improves the face matching process and as a result, it yields a much better, accurate result.'))
      .append($('<p/>')
        .html('When you finish indexing faces, click on <strong>Re-analyze</strong> to re-process the analysis.'));
    const snapshot = $('<div/>')
      .addClass('col-sm mt-auto mb-auto px-0')
      .append($('<div/>')
        .append($('<button/>')
          .addClass('btn btn-sm btn-primary float-right mb-3')
          .attr('type', 'button')
          .attr('data-action', BasePreview.Constants.Actions.Snapshot)
          .html('Snapshot'))
        .append($('<button/>')
          .addClass('btn btn-sm btn-success float-right mb-3')
          .attr('type', 'button')
          .attr('data-action', BasePreview.Constants.Actions.ReAnalyze)
          .html('Re-analyze')));
    container.append($('<div/>')
      .addClass('row')
      .append(description)
      .append(snapshot));

    /* indexed faces ui */
    let id = BasePreview.Constants.Id.IndexedFaceCollection;
    container
      .append($('<div/>')
        .addClass('row')
        .append($('<div/>')
          .addClass('col-sm-8 px-0')
          .append($('<span/>')
            .addClass('lead mt-2 mb-2 d-block')
            .html('Indexed faces'))))
      .append($('<div/>')
        .addClass('row')
        .attr('id', id));

    /* queued faces and send to GT ui */
    id = BasePreview.Constants.Id.QueuedFaceCollection;
    container
      .append($('<div/>')
        .addClass('row')
        .append($('<div/>')
          .addClass('col-sm-6 px-0')
          .append($('<span/>')
            .addClass('lead mt-2 mb-2 d-block')
            .html('Queued faces')))
        .append($('<div/>')
          .addClass('col-sm mt-auto mb-auto px-0')
          .append($('<button/>')
            .addClass('btn btn-primary btn-sm float-right collapse')
            .attr('type', 'button')
            .attr('data-action', BasePreview.Constants.Actions.SendToGroundTruth)
            .html('Send to GroundTruth'))))
      .append($('<div/>')
        .addClass('row')
        .attr('id', id));
    return container;
  }

  static createTranscribeContent(id) {
    /* subtitle on/off switch */
    const xswitch = $('<div/>').addClass('input-group mb-3')
      .append($('<label/>').addClass('switch')
        .append($('<input/>')
          .attr('id', id)
          .attr('type', 'checkbox')
          .attr('checked', 'checked'))
        .append($('<span/>').addClass('slider round')))
      .append($('<span/>').addClass('col-sm-3 col-form-label')
        .append('Subtitle'));

    /* subtitle render view */
    const subtitle = $('<div/>').addClass('d-block')
      .attr('data-target', 'subtitle');

    return BasePreview.createCarouselContent('Transcribe')
      .append(xswitch)
      .append(subtitle);
  }

  static createComprehendListItem(container, category, data) {
    if (!data) {
      return container;
    }
    let group;
    let subcategories;
    switch (category) {
      case 'keyphrase':
      case 'sentiment':
        group = BasePreview.createContentListItem(`${BasePreview.capitalize(category)} (${data.length})`, undefined, {
          fontsize: 1,
        });
        data.forEach(x =>
          group.append(BasePreview.createMarkInOutButton(`${x.text} (${x.confidence})`, x.begin, x.end)));
        container.append(group);
        break;
      case 'entity':
        subcategories = Array.from(new Set(data.map(x => x.type)));
        while (subcategories.length) {
          const subcategory = subcategories.shift();
          const subset = data.filter(x => x.type === subcategory);
          group = BasePreview.createContentListItem(`${BasePreview.capitalize(subcategory.toLowerCase())} (${subset.length})`, undefined, {
            fontsize: 1,
          });
          subset.forEach(x =>
            group.append(BasePreview.createMarkInOutButton(`${x.text} (${x.confidence})`, x.begin, x.end)));
          container.append(group);
        }
        break;
      default:
        break;
    }
    return container;
  }

  static async createComprehendContent(data) {
    const container = BasePreview.createCarouselContent('Comprehend');
    const categories = Object.keys(data || {});
    const responses = await Promise.all(categories.map(x => (
      (data[x] || {}).metadata
        ? BaseCard.download(SolutionManifest.Proxy.Bucket, data[x].metadata).catch(e => undefined)
        : undefined
    )));
    categories.forEach((x, idx) =>
      BasePreview.createComprehendListItem(container, x, responses[idx]));
    return container;
  }
}
