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
/* eslint-disable class-methods-use-this */
/* eslint-disable no-plusplus */
/* eslint-disable no-alert */

/**
 * @class ImageCard
 * @description ui implementation of each video card
 */
class ImageCard extends BaseCard {
  constructor(data, parent) {
    super(data, parent);

    this.$element = undefined;
    this.$stateMachine = undefined;
    this.$timerOverlayProgress = undefined;
  }

  static get StateMachines() {
    return SO0050.StateMachines;
  }

  get [Symbol.toStringTag]() {
    return 'ImageCard';
  }

  get proxies() {
    return this.data.proxies;
  }

  get imageinfo() {
    return this.data.imageinfo;
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

  get inProgress() {
    return !!this.$stateMachine;
  }

  get timerOverlayProgress() {
    return this.$timerOverlayProgress;
  }

  set timerOverlayProgress(val) {
    this.$timerOverlayProgress = val;
  }

  domInitialized() {
    return !!(this.element);
  }

  /**
   * @function domUpdateThumbnail
   * @description update thumbnail image
   */
  domUpdateThumbnail() {
    if (!this.domInitialized()) {
      return;
    }
    const img = this.element.find('img.card-img-top').first();
    img.attr('src', this.getSignedThumbnail()).attr('alt', `Play ${this.basename}`);
  }

  /**
   * @function domCreateOverlayActions
   * @description create on-hover action button
   * @param {string} action - play, metadata, restore, not-found
   */
  domCreateOverlayActions(actions) {
    const hover = (actions.find(x => x === 'not-found'))
      ? 'overlay-hover-warn'
      : 'overlay-hover-light';

    const elements = actions.reduce((acc, cur) => {
      const [
        faIcon,
        tooltip,
      ] = (() => {
        if (cur === 'not-found') {
          return ['fa-exclamation-triangle', 'S3 object not found'];
        }

        if (cur === 'restore') {
          return ['fa-share-square', 'Proxy not found! Restore now?'];
        }

        if (cur === 'metadata') {
          return ['fa-search-plus', 'Create metadata'];
        }

        if (cur === 'preview') {
          return ['fa-play-circle', 'View now'];
        }

        return [];
      })();

      return acc.concat(`
        <div class="overlay-action">
          <i class="fas ${faIcon} fa-3x" data-action="${cur}"></i>
          <p class="center text-thin small">${tooltip}</p>
        </div>
      `);
    }, []);

    return `
    <div class="${hover}" data-type="actions">
      <div class="overlay-text">
        <div class="row align-items-center">
          <div class="col align-self-center">
          ${elements.join('\n')}
          </div>
        </div>
      </div>
    </div>
    `;
  }

  /* eslint-disable prefer-destructuring */
  /**
   * @function domUpdateOverlayActions
   * @description update on-hover action button
   */
  domUpdateOverlayActions() {
    setTimeout(async () => {
      if (!this.domInitialized()) {
        return;
      }
      const proxy = this.getProxyByBaseName(this.basename);

      if (!(proxy || {}).key) {
        throw new Error('fail to find proxy video key');
      }

      const actions = [];
      const exists = await ImageCard.fileExists(SO0050.Proxy.Bucket, proxy.key);
      actions.push(exists ? 'preview' : 'restore');

      if (!this.hasAnalyzed()) {
        actions.push('metadata');
      }

      let dom = this.element.find('div[data-type="actions"]').first();
      const parent = dom.parent();

      dom.remove();
      dom = this.domCreateOverlayActions(actions);

      $(dom).appendTo(parent);
      await this.domRegisterEvents();
    }, 10);
  }

  domCreateStates(states) {
    const badges = Object.keys(states).reduce((acc, cur) => {
      acc.push(`<span class="badge badge-pill badge-secondary text-thin" data-state="${states[cur].join(',')}">${cur}</span>`);
      acc.push('<span class="text-thin">&gt;</span>');
      return acc;
    }, []);
    badges.pop();
    return badges.join('\n');
  }

  domCreateStateProgressBar() {
    return `
    <div class="progress mt-2" style="height: 2px;">
      <div class="progress-bar bg-success" data-action="progress" role="progressbar" style="width: 1%" aria-valuenow="1" aria-valuemin="0" aria-valuemax="100">
      </div>
    </div>
    <p class="text-left mt-1 mb-2 small" data-action="status">initializing...</p>`;
  }

  domCreateIngestOverlayStatus() {
    const states = this.domCreateStates({
      validate: [
        ImageCard.States.CreateRecord,
        ImageCard.States.CheckRestoreStatus,
      ],
      fixity: [
        ImageCard.States.ComputeChecksum,
        ImageCard.States.ValidateChecksum,
      ],
      imageinfo: [
        ImageCard.States.RunImageInfo,
      ],
      indexer: [
        ImageCard.States.UpdateRecord,
        ImageCard.States.IndexIngestResults,
        ImageCard.States.JobCompleted,
      ],
    });

    const progressbar = this.domCreateStateProgressBar();

    return `
    <div class="progress-overlay collapse" data-state-machine=${ImageCard.StateMachines.Ingest}>
      <!-- HERE GOES INGEST STATE MACHINE STATUS -->
      ${states}
      ${progressbar}
    </div>`;
  }

  domCreateAnalysisOverlayStatus() {
    const states = this.domCreateStates({
      started: [
        VideoCard.States.StartAnalysis,
      ],
      analyzing: [
        VideoCard.States.CheckAnalysisStatus,
        VideoCard.States.CollectAnalysisResults,
      ],
      indexer: [
        VideoCard.States.IndexAnalysisResults,
        VideoCard.States.JobCompleted,
      ],
    });

    const progressbar = this.domCreateStateProgressBar();

    return `
    <div class="progress-overlay collapse" data-state-machine=${ImageCard.StateMachines.Analysis}>
      <!-- HERE GOES ANALYSIS STATE MACHINE STATUS -->
      ${states}
      ${progressbar}
    </div>`;
  }

  domCreateLabelingOverlayStatus() {
    const states = this.domCreateStates({
      dataset: [
        ImageCard.States.CreateDataset,
      ],
      labeling: [
        ImageCard.States.CreateLabelingJob,
        ImageCard.States.CheckLabelingStatus,
      ],
      indexer: [
        ImageCard.States.IndexResults,
      ],
      completed: [
        ImageCard.States.JobCompleted,
      ],
    });

    const progressbar = this.domCreateStateProgressBar();

    return `
    <div class="progress-overlay collapse" data-state-machine=${ImageCard.StateMachines.GroundTruth}>
      <!-- HERE GOES INGEST STATE MACHINE STATUS -->
      ${states}
      ${progressbar}
    </div>`;
  }

  domShowOverlayStatus(stateMachine) {
    this.element.find('[data-state-machine]').each((k, v) => {
      if ($(v).data('state-machine') === stateMachine) {
        $(v).removeClass('collapse');
      } else {
        $(v).addClass('collapse');
      }
    });
  }

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

  domUpdateOverlayStatus(msg) {
    if (!this.domInitialized()) {
      return;
    }
    this.domShowOverlayStatus(msg.stateMachine);

    const overlay = this.element.find(`[data-state-machine="${msg.stateMachine}"]`).first();
    const states = overlay.find('[data-state]');

    if (msg.status === ImageCard.Statuses.Error) {
      const badge = overlay.find('.badge-secondary').first();
      const text = overlay.find('[data-action="status"]').first();
      badge.removeClass('badge-light badge-secondary badge-success')
        .addClass('badge-danger');
      text.html(ImageCard.shorten(encodeURIComponent(msg.errorMessage) || 'Unknown error', 60));
      console.log(encodeURIComponent(msg.errorMessage));
      return;
    }

    for (let i = 0; i < states.length; i++) {
      const badge = $(states[i]);
      const state = badge.data('state').split(',').filter(x => x);
      badge.removeClass('badge-light badge-secondary badge-success');
      if (state.indexOf(msg.operation) >= 0) {
        if (msg.status === ImageCard.Statuses.Completed) {
          badge.addClass('badge-success');
        } else if (msg.status === ImageCard.Statuses.Error) {
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
   * @function domInit
   * @description initialize ImageCard ui
   * @param {boolean} badge - not used
   */
  async domInit(badge = false) {
    if (this.domInitialized()) {
      return;
    }
    const image = this.getProxyByBaseName(this.basename);
    const original = await ImageCard.fileExists(SO0050.Ingest.Bucket, this.key);
    const proxy = (image || {}).key && await ImageCard.fileExists(SO0050.Proxy.Bucket, image.key);
    const imageUrl = this.getSignedThumbnail();

    const actions = [];
    if (!original) {
      actions.push('not-found');
    } else if (!proxy) {
      actions.push('restore');
    } else {
      actions.push('preview');
      if (!this.hasAnalyzed()) {
        actions.push('metadata');
      }
    }

    const dom = `
    <div class="col-sm-4 mt-4">
      <div class="card" id="card-${this.uuid}">
        <!-- loading icon -->
        <div
          id="indicator-${this.uuid}"
          class="spinner-grow text-light indicator collapse"
          style="animation: spinner-grow 1.2s linear infinite;"
          role="status">
          <span class="sr-only">Loading...</span>
        </div>

        <div class="overlay-container">
          <img
            class="card-img-top"
            src="${imageUrl}"
            alt="thumbnail"
            style="max-height: 200px; object-fit: contain; background-color: rgb(0,0,0);"
          >
          <div class="state-status-overlay mb-2 small pl-2 pr-2">
            ${this.domCreateIngestOverlayStatus()}
            ${this.domCreateAnalysisOverlayStatus()}
            ${this.domCreateLabelingOverlayStatus()}
          </div>
          ${this.domCreateOverlayActions(actions)}
        </div>
        <div class="card-body small">
          <h6 class="card-title text-truncate lead">${this.basename}</h6>
          <dl class="row small">
            <dt class="col-sm-3 text-truncate">Name</dt><dd class="col-sm-9 text-truncate" data-field="name">${this.basename}</dd>
            <dt class="col-sm-3 text-truncate">ID</dt><dd class="col-sm-9 text-truncate" data-field="uuid">${this.uuid}</dd>
            <dt class="col-sm-3 text-truncate">LastModified</dt><dd class="col-sm-9 text-truncate" data-field="ingestDate">${this.lastModifiedISOFormat || '--'}</dd>
          </dl>
          <div class="float-right">
            <a href="#" class="overlay-action">
              <i class="far fa-trash-alt fa-lg" style="color: #111"
                alt="Remove asset"
                data-action="remove"
                data-toggle="tooltip"
                data-placement="bottom"
                title="Remove asset and delete database records">
              </i>
            </a>
          </div>
        </div>
      </div>
    </div>
    `;

    this.element = $(dom);

    await this.domRegisterEvents();
  }
  /* eslint-enable prefer-destructuring */


  /**
   * @function domRegisterEvents
   * @description register video card ui  events
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
   * @function domInsertAfter
   * @description insert 'this' card after the sibling
   * @param {ImageCard} sibling
   */
  domInsertAfter(sibling) {
    this.element.insertAfter(sibling);
  }

  /**
   * @function domShow
   * @description show video card
   */
  domShow() {
    const cardId = `#card-${this.uuid}`;

    $(cardId).parent().removeClass('collapse');

    return this;
  }

  /**
   * @function domHide
   * @description hide video card
   */
  domHide() {
    const cardId = `#card-${this.uuid}`;

    $(cardId).parent().addClass('collapse');

    return this;
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

  async onGroundTruthMessage(msg) {
    if (msg.status === ImageCard.Statuses.Error) {
      console.log(`${this.basename}: Error=${encodeURIComponent(msg.errorMessage)}`);
    } else {
      console.log(`${this.basename}: operation=${msg.operation}, status=${msg.status}, progress=${msg.progress}`);
    }

    this.stateMachine = msg.stateMachine;

    this.domUpdateOverlayStatus(msg);

    if (msg.operation === ImageCard.States.JobCompleted) {
      this.domHideOverlayStatus(msg.stateMachine, 3000);
    }

    const indicator = $(`#indicator-${msg.uuid}`);
    if (msg.operation === ImageCard.States.JobCompleted
      || msg.status === ImageCard.Statuses.Error) {
      indicator.addClass('collapse');
    } else {
      indicator.removeClass('collapse');
    }
  }

  async onIngestMessage(msg) {
    if (msg.status === ImageCard.Statuses.Error) {
      console.log(`${this.basename}: Error=${encodeURIComponent(msg.errorMessage)}`);
    } else {
      console.log(`${this.basename}: operation=${msg.operation}, status=${msg.status}, progress=${msg.progress}`);
    }

    this.stateMachine = msg.stateMachine;
    if (msg.operation === ImageCard.States.CreateRecord) {
      await this.reloadAsset();
      await this.domInit();
      this.parent.domInsertAt(0, this);
    } else if (msg.operation === ImageCard.States.JobCompleted) {
      await this.reloadAsset();
      this.domUpdateThumbnail();
      this.domUpdateOverlayActions();
      this.domHideOverlayStatus(msg.stateMachine, 4000);
    }
    this.domUpdateOverlayStatus(msg);
  }

  async onAnalysisMessage(msg) {
    if (msg.status === ImageCard.Statuses.Error) {
      console.log(`${this.basename}: Error=${encodeURIComponent(msg.errorMessage)}`);
    } else {
      console.log(`${this.basename}: operation=${msg.operation}, status=${msg.status}, progress=${msg.progress}`);
    }

    this.stateMachine = msg.stateMachine;

    this.domUpdateOverlayStatus(msg);

    if (msg.operation === ImageCard.States.JobCompleted) {
      this.domHideOverlayStatus(msg.stateMachine, 2000);
      /* reload aiml results from DB */
      await this.loadAimlResults(true);
      this.domUpdateOverlayActions();
    }
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

  getProxyByBaseName(basename) {
    return (this.proxies || []).find((x) => {
      if (x.type !== 'image') {
        return false;
      }
      return ImageCard.parseKeyBasename(x.key) === basename;
    });
  }

  getSignedThumbnail() {
    const thumbnail = this.getProxyByBaseName(`${this.basename}_thumbnail`);
    if (!(thumbnail || {}).key) {
      return './images/image.png';
    }
    return ImageCard.signedUrl(SO0050.Proxy.Bucket, thumbnail.key);
  }

  getSignedImage() {
    const image = this.getProxyByBaseName(this.basename);
    if (!(image || {}).key) {
      throw new Error('fail to find proxy image');
    }
    return ImageCard.signedUrl(SO0050.Proxy.Bucket, image.key);
  }

  getImageKey() {
    const image = this.getProxyByBaseName(this.basename);
    if (!(image || {}).key) {
      throw new Error('fail to find proxy image');
    }
    return image.key;
  }

  getImageAnalysis() {
    const image = (this.aimlResults || []).filter(x => x.type === 'image').shift();
    return (image || {})['rekog-image'] || {};
  }
}
