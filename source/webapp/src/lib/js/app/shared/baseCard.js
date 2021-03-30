/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/**
 * @class BaseCard
 * @description base class to extract the basic properties of Video, Audio, Image, Document.
 */
class BaseCard extends mxReadable(class {}) {
  constructor(data = {}, parent) {
    super();

    const missing = BaseCard.MandatoryProps.filter(x => data[x] === undefined);
    if (missing.length) {
      throw new Error(`BaseCard.constructor missing ${missing.join(', ')}`);
    }

    if (!(parent instanceof CardCollection)) {
      throw new Error('parent must be instance of CardCollection');
    }

    this.$parent = parent;
    this.$data = {
      ...data,
    };
    this.$aimlResults = undefined;
    this.$element = undefined;
    this.$stateMachine = undefined;
    this.$timerOverlayProgress = undefined;
  }

  static get MandatoryProps() {
    return [
      'uuid',
      'type',
      /*
      'key',
      'basename',
      'mime',
      'fileSize',
      'storageClass',
      'lastModified',
      */
    ];
  }

  static get StateMachines() {
    return SolutionManifest.StateMachines;
  }

  static get States() {
    return window.AWSomeNamespace.States;
  }

  static get Statuses() {
    return window.AWSomeNamespace.Statuses;
  }

  get parent() {
    return this.$parent;
  }

  set parent(val) {
    this.$parent = val;
  }

  get data() {
    return this.$data;
  }

  set data(val) {
    this.$data = {
      ...val,
    };
  }

  get type() {
    return this.data.type;
  }

  get uuid() {
    return this.data.uuid;
  }

  get md5() {
    return this.data.md5;
  }

  get key() {
    return this.data.key;
  }

  get basename() {
    return this.data.basename;
  }

  get mime() {
    return this.data.mime;
  }

  get fileSize() {
    return this.data.fileSize;
  }

  get storageClass() {
    return this.data.storageClass;
  }

  get lastModified() {
    return this.data.lastModified;
  }

  get lastModifiedISOFormat() {
    return this.lastModified && new Date(this.lastModified).toISOString();
  }

  get proxies() {
    return this.data.proxies;
  }

  get attributes() {
    return this.data.attributes;
  }

  get executions() {
    return this.data.executions || [];
  }

  get aimlResults() {
    return this.$aimlResults;
  }

  set aimlResults(val) {
    this.$aimlResults = (val || []).length ? val.slice(0) : undefined;
  }

  hasAnalyzed() {
    return this.aimlResults || (this.data.analysis || []).length > 0;
  }

  get vttTracks() {
    return this.$vttTracks;
  }

  set vttTracks(val) {
    this.$vttTracks = (val && Object.assign({}, val)) || undefined;
  }

  get element() {
    return this.$element;
  }

  set element(val) {
    this.$element = $(val);
  }

  get stateMachine() {
    return this.$stateMachine;
  }

  set stateMachine(val) {
    this.$stateMachine = val;
  }

  get timerOverlayProgress() {
    return this.$timerOverlayProgress;
  }

  set timerOverlayProgress(val) {
    this.$timerOverlayProgress = val;
  }

  /**
   * @abstract
   * @async
   * @function proxyExists
   * @description subclass to implement
   */
  async proxyExists() {
    throw new Error('BaseCard.proxyExists not impl');
  }

  /**
   * @abstract
   * @async
   * @function getSignedThumbnail
   * @description subclass to implement
   */
  getSignedThumbnail() {
    throw new Error('BaseCard.getSignedThumbnail not impl');
  }

  async loadAimlResults(reload = false) {
    if (!this.aimlResults || reload) {
      this.aimlResults = await ApiHelper.getAnalysisResults(this.uuid);
    }
  }

  static async download(bucket, key) {
    const s3 = S3Utils.getInstance();
    return JSON.parse((await s3.getObject({
      Bucket: bucket,
      Key: key,
    }).promise()).Body.toString());
  }

  static signedUrl(bucket, key, expires = 60 * 60 * 2) {
    const s3 = S3Utils.getInstance();
    return (!bucket || !key)
      ? undefined
      : s3.getSignedUrl('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: expires,
      });
  }

  static async fileExists(bucket, key) {
    const s3 = S3Utils.getInstance();
    return (!bucket || !key)
      ? false
      : s3.headObject({
        Bucket: bucket,
        Key: key,
      }).promise().catch(() => undefined);
  }

  static parseKeyBasename(key) {
    const basename = key.split('/').filter(x0 => x0).pop();
    return basename.slice(0, basename.lastIndexOf('.'));
  }

  /**
   * @async
   * @function onIngestMessage
   * @description process ingest state machine message
   * @param {Object} msg
   */
  async onIngestMessage(msg) {
    if (msg.status === BaseCard.Statuses.Error) {
      console.log(`${this.basename}: Error=${encodeURIComponent(msg.errorMessage)}`);
    } else {
      console.log(`${this.basename}: operation=${msg.operation}, status=${msg.status}, progress=${msg.progress}`);
    }

    this.stateMachine = msg.stateMachine;
    if (msg.operation === BaseCard.States.CreateRecord) {
      await this.reloadAsset();
      await this.domInit();
      this.parent.domInsertAt(0, this);
    } else if (msg.operation === BaseCard.States.JobCompleted) {
      await this.reloadAsset();
      this.domUpdateThumbnail();
      this.domUpdateOverlayActions();
      this.domHideOverlayStatus(msg.stateMachine, 4000);
    }
    this.domUpdateOverlayStatus(msg);
  }

  /**
   * @async
   * @function onAnalysisMessage
   * @description process analysis state machine message
   * @param {Object} msg
   */
  async onAnalysisMessage(msg) {
    if (msg.status === BaseCard.Statuses.Error) {
      console.log(`${this.basename}: Error=${encodeURIComponent(msg.errorMessage)}`);
    } else {
      console.log(`${this.basename}: operation=${msg.operation}, status=${msg.status}, progress=${msg.progress}`);
    }

    this.stateMachine = msg.stateMachine;

    this.domUpdateOverlayStatus(msg);

    if (msg.operation === BaseCard.States.JobCompleted) {
      this.domHideOverlayStatus(msg.stateMachine, 2000);
      /* reload aiml results from DB */
      await this.loadAimlResults(true);
      this.domUpdateOverlayActions();
    }
  }

  /**
   * @async
   * @function onGroundTruthMessage
   * @description process labeling state machine message
   * @param {Object} msg
   */
  async onGroundTruthMessage(msg) {
    if (msg.status === BaseCard.Statuses.Error) {
      console.log(`${this.basename}: Error=${encodeURIComponent(msg.errorMessage)}`);
    } else {
      console.log(`${this.basename}: operation=${msg.operation}, status=${msg.status}, progress=${msg.progress}`);
    }

    this.stateMachine = msg.stateMachine;

    this.domUpdateOverlayStatus(msg);

    if (msg.operation === BaseCard.States.JobCompleted) {
      this.domHideOverlayStatus(msg.stateMachine, 2000);
    }

    const indicator = $(`#indicator-${msg.uuid}`);
    if (msg.operation === BaseCard.States.JobCompleted
      || msg.status === BaseCard.Statuses.Error) {
      indicator.addClass('collapse');
    } else {
      indicator.removeClass('collapse');
    }
  }

  /**
   * @async
   * @function showStatusOnLoad
   * @description if asset is in process (has running execution), show state machine status
   */
  async showStatusOnLoad() {
    if (!this.executions.length) {
      return undefined;
    }

    const msg = {
      uuid: this.uuid,
      status: BaseCard.Statuses.InProgress,
      progress: 1,
    };
    switch (this.executions[0]) {
      case BaseCard.StateMachines.Ingest:
        return this.onIngestMessage({
          ...msg,
          stateMachine: BaseCard.StateMachines.Ingest,
          operation: BaseCard.States.CheckRestoreStatus,
        });
      case BaseCard.StateMachines.Analysis:
        return this.onAnalysisMessage({
          ...msg,
          stateMachine: BaseCard.StateMachines.Analysis,
          operation: BaseCard.States.PrepareAnalysis,
        });
      case BaseCard.StateMachines.GroundTruth:
        return this.onGroundTruthMessage({
          ...msg,
          stateMachine: BaseCard.StateMachines.GroundTruth,
          operation: BaseCard.States.CreateLabelingJob,
        });
      default:
        break;
    }
    return undefined;
  }

  /**
   * @function domInitialized
   * @description check to see if dom has already been initialized
   */
  domInitialized() {
    return !!(this.element);
  }

  /**
   * @async
   * @function domInit
   * @description initialize BaseCard ui
   * @param {Object} media - image or video object
   */
  async domInit(media) {
    if (this.domInitialized()) {
      return undefined;
    }

    const src = await BaseCard.fileExists(SolutionManifest.Ingest.Bucket, this.key);
    const proxy = (media || {}).key && await BaseCard.fileExists(SolutionManifest.Proxy.Bucket, media.key);
    const actions = [];
    if (!src) {
      actions.push('not-found');
    } else if (!proxy) {
      actions.push('restore');
    } else {
      actions.push('preview');
      if (!this.hasAnalyzed()) {
        actions.push('metadata');
      }
    }

    this.element = $('<div/>').addClass('col-sm-4 mt-4')
      .append($('<div/>').addClass('card')
        .attr('id', `card-${this.uuid}`)
        .append(this.createCardSpinner())
        .append($('<div/>').addClass('overlay-container')
          .append(this.createCoverImage())
          .append(this.createOverlayStatus())
          .append(this.createOverlayActions(actions)))
        .append(this.createCardDescription()));

    return this.domRegisterEvents();
  }

  /**
   * @async
   * @function domRegisterEvents
   * @description register media card ui events
   */
  async domRegisterEvents() {
    const img = this.element.find('img.card-img-top').first();

    img.off('error').on('error', () =>
      img.attr('src', './images/image-not-found.png'));

    const overlay = this.element.find('[data-action]');

    overlay.off('click').click(async (event) => {
      event.preventDefault();
      const action = $(event.currentTarget).data('action');
      await this.parent.handleEvent(this, action);
    });
  }

  /**
   * @function domShow
   * @description show card
   */
  domShow() {
    const cardId = `#card-${this.uuid}`;

    $(cardId).parent().removeClass('collapse');

    return this;
  }

  /**
   * @function domHide
   * @description hide card
   */
  domHide() {
    const cardId = `#card-${this.uuid}`;

    $(cardId).parent().addClass('collapse');

    return this;
  }

  /**
   * @function domInsertAfter
   * @description insert 'this' card after the sibling
   * @param {VideoCard|ImageCard} sibling
   */
  domInsertAfter(sibling) {
    this.element.insertAfter(sibling);
  }

  /**
   * @function domUpdateThumbnail
   * @description update card thumbnail image
   */
  domUpdateThumbnail() {
    return (this.domInitialized())
      ? this.element.find('img.card-img-top').first()
        .attr('src', this.getSignedThumbnail())
        .attr('alt', `Play ${this.basename}`)
      : undefined;
  }

  /**
   * @function createOverlayActions
   * @description create action buttons on hover
   * @param {string} action - play, metadata, restore, not-found
   */
  createOverlayActions(actions) {
    const icons = $('<div/>').addClass('col align-self-center');
    for (let i = 0; i < actions.length; i++) {
      const [icon, tooltip] = (actions[i] === 'not-found')
        ? ['fa-exclamation-triangle', 'S3 object not found']
        : (actions[i] === 'restore')
          ? ['fa-share-square', 'Proxy not found! Restore now?']
          : (actions[i] === 'metadata')
            ? ['fa-search-plus', 'Create metadata']
            : (actions[i] === 'preview')
              ? ['fa-play-circle', 'View now']
              : [];
      if (!icon) {
        continue;
      }
      icons.append($('<div/>').addClass('overlay-action')
        .append($('<i/>').addClass('fas fa-3x')
          .addClass(icon)
          .attr('data-action', actions[i]))
        .append($('<p/>').addClass('center text-thin small')
          .html(tooltip)));
    }
    return $('<div/>')
      .addClass((actions.find(x => x === 'not-found') ? 'overlay-hover-warn' : 'overlay-hover-light'))
      .attr('data-type', 'actions')
      .append($('<div/>').addClass('overlay-text')
        .append($('<div/>').addClass('row align-items-center')
          .append(icons)));
  }

  /**
   * @function domUpdateOverlayActions
   * @description update action buttons on hover
   */
  domUpdateOverlayActions() {
    setTimeout(async () => {
      const actions = [];

      if (!this.domInitialized()) {
        return;
      }

      const exists = await this.proxyExists();
      actions.push(exists ? 'preview' : 'restore');

      if (!this.hasAnalyzed()) {
        actions.push('metadata');
      }

      const dom = this.element.find('div[data-type="actions"]').first();
      const parent = dom.parent();
      dom.remove();

      parent.append(this.createOverlayActions(actions));
      await this.domRegisterEvents();
    }, 10);
  }

  /**
   * @function domCreateStates
   * @description create badges based on the states definition
   * @param {Object} states - states to create badges
   */
  domCreateStates(states) {
    const badges = [];
    const keys = Object.keys(states);
    while (keys.length) {
      const key = keys.shift();
      badges.push($('<span/>').addClass('badge badge-pill badge-secondary text-thin')
        .attr('data-state', states[key].join(','))
        .html(key));
      badges.push($('<span/>').addClass('text-thin').html('&gt;'));
    }
    badges.pop();
    return badges;
  }

  /**
   * @function domCreateStateProgressBar
   * @description create state machine progress bar
   */
  domCreateStateProgressBar() {
    const items = [];
    items.push($('<div/>').addClass('progress mt-2')
      .css('height', '2px')
      .append($('<div/>').addClass('progress-bar bg-success')
        .attr('role', 'progressbar')
        .attr('data-action', 'progress')
        .attr('aria-valuenow', 1)
        .attr('aria-valuemin', 0)
        .attr('aria-valuemax', 100)
        .css('width', '1%')));
    items.push($('<p/>').addClass('text-left mt-1 mb-2 small')
      .attr('data-action', 'status')
      .html('initializing...'));
    return items;
  }

  /**
   * @function domCreateProcessOverlayStatus
   * @description create state machine overlay status ui
   */
  domCreateProcessOverlayStatus(stateMachine, states) {
    const overlay = $('<div/>').addClass('progress-overlay collapse')
      .attr('data-state-machine', stateMachine);

    const badges = this.domCreateStates(states);
    while (badges.length) {
      overlay.append(badges.shift());
    }
    const progress = this.domCreateStateProgressBar();
    while (progress.length) {
      overlay.append(progress.shift());
    }
    return overlay;
  }

  /**
   * @function domUpdateOverlayStatus
   * @description update state machine overlay status
   */
  domUpdateOverlayStatus(msg) {
    if (!this.domInitialized()) {
      return;
    }

    this.domShowOverlayStatus(msg.stateMachine);

    const overlay = this.element.find(`[data-state-machine="${msg.stateMachine}"]`).first();
    const states = overlay.find('[data-state]');

    if (msg.status === BaseCard.Statuses.Error) {
      const badge = overlay.find('.badge-secondary').first();
      const text = overlay.find('[data-action="status"]').first();
      badge.removeClass('badge-light badge-secondary badge-success')
        .addClass('badge-danger');
      text.html(BaseCard.shorten(msg.errorMessage || 'Unknown error', 60));
      console.log(encodeURIComponent(msg.errorMessage));
      return;
    }

    for (let i = 0; i < states.length; i++) {
      const badge = $(states[i]);
      const state = badge.data('state').split(',').filter(x => x);
      badge.removeClass('badge-light badge-secondary badge-success');
      if (state.indexOf(msg.operation) >= 0) {
        if (msg.status === BaseCard.Statuses.Completed) {
          badge.addClass('badge-success');
        } else if (msg.status === BaseCard.Statuses.Error) {
          badge.addClass('badge-danger');
        } else {
          badge.addClass('badge-light');
        }
        /* break to avoid processing upcoming states */
        break;
      }
      /* make sure all previous states are in 'green' */
      badge.addClass('badge-success');
    }

    const progressbar = overlay.find('[data-action="progress"]').first();
    const text = overlay.find('[data-action="status"]').first();
    text.html(`${msg.progress}%...`);
    progressbar.css('width', `${msg.progress}%`).attr('aria-valuenow', msg.progress);
  }

  /**
   * @function domShowOverlayStatus
   * @description show state machine overlay status
   */
  domShowOverlayStatus(stateMachine) {
    this.element.find('[data-state-machine]').each((k, v) => {
      if ($(v).data('state-machine') === stateMachine) {
        $(v).removeClass('collapse');
      } else {
        $(v).addClass('collapse');
      }
    });
  }

  /**
   * @function domHideOverlayStatus
   * @description hide state machine overlay status
   */
  domHideOverlayStatus(stateMachine, delay = 0) {
    setTimeout(() => {
      if (!this.domInitialized()) {
        return;
      }
      const overlay = this.element.find(`[data-state-machine="${stateMachine}"]`).first();
      overlay.addClass('collapse');
      overlay.find('[data-state]').each((idx, state) =>
        $(state).removeClass('badge-light badge-secondary badge-success'));
    }, delay);
  }

  /**
   * @function isBusy
   * @description check to see if content is still being processed.
   */
  isBusy() {
    let processing;
    this.element.find('[data-state-machine]').each((k, v) => {
      if (!$(v).hasClass('collapse')) {
        processing = $(v).data('state-machine');
      }
    });
    return processing;
  }

  /**
   * @function reloadAsset
   * @description fetch from database to refresh the asset attributes
   */
  async reloadAsset() {
    this.data = await ApiHelper.getRecord(this.uuid);
  }

  /**
   * @function remove
   */
  async remove() {
    this.element.remove();
    return this;
  }

  /**
   * @function purge
   * @description when user clicks on 'trash' button, purge will remove:
   *   * dynamodb asset and mediainfo records
   *   * analytics/results.json file
   * The function won't remove the original ingested file nor the proxy files
   * that are already generated.
   */
  async purge() {
    await ApiHelper.purgeRecord(this.uuid);
    this.element.remove();
    console.log(`removed ${this.uuid}...`);
  }

  createCardSpinner() {
    const id = `indicator-${this.uuid}`;
    return $('<div/>').addClass('spinner-grow text-light indicator collapse')
      .attr('id', id)
      .attr('role', 'status')
      .css('animation', 'spinner-grow 1.2s linear infinite')
      .append($('<span/>').addClass('sr-only')
        .html('Loading...'));
  }

  createCardDescription() {
    return $('<div/>').addClass('card-body small')
      .append($('<h6/>').addClass('card-title text-truncate lead')
        .html(this.basename))
      .append($('<dl/>').addClass('row small')
        .append($('<dt/>').addClass('col-sm-3 text-truncate')
          .html('Name'))
        .append($('<dd/>').addClass('col-sm-9 text-truncate')
          .attr('data-field', 'name')
          .html(this.basename))
        .append($('<dt/>').addClass('col-sm-3 text-truncate')
          .html('ID'))
        .append($('<dd/>').addClass('col-sm-9 text-truncate')
          .attr('data-field', 'uuid')
          .html(this.uuid))
        .append($('<dt/>').addClass('col-sm-3 text-truncate')
          .html('LastModified'))
        .append($('<dd/>').addClass('col-sm-9 text-truncate')
          .attr('data-field', 'ingest-date')
          .html(this.lastModifiedISOFormat || '--')))
      .append($('<div/>').addClass('float-right')
        .append($('<a/>').addClass('overlay-action')
          .attr('href', '#')
          .append($('<i/>').addClass('far fa-trash-alt fa-lg')
            .css('color', '#111')
            .attr('alt', 'Remove asset')
            .attr('data-action', 'remove')
            .attr('data-toggle', 'tooltip')
            .attr('data-placement', 'bottom')
            .attr('title', 'Remove asset and delete database records'))));
  }

  createCoverImage() {
    return $('<img/>').addClass('card-img-top')
      .attr('src', this.getSignedThumbnail())
      .attr('alt', 'thumbnail')
      .css('max-height', '200px')
      .css('object-fit', 'contain')
      .css('background-color', '#000');
  }

  createOverlayStatus() {
    return $('<div/>').addClass('state-status-overlay mb-2 small pl-2 pr-2')
      .append(this.domCreateIngestOverlayStatus())
      .append(this.domCreateAnalysisOverlayStatus())
      .append(this.domCreateLabelingOverlayStatus());
  }
}
