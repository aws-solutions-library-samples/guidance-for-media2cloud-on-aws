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

/**
 * @class VideoCard
 * @description ui implementation of each video card
 */
class VideoCard {
  constructor(asset, parent) {
    if (!parent || !asset) {
      throw new Error('missing params, parent or asset');
    }

    this.$asset = asset;
    this.$parent = parent;
    this.$element = undefined;
    this.$stateMachine = undefined;
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'VideoCard';
  }
  /* eslint-enable class-methods-use-this */

  get parent() {
    return this.$parent;
  }

  set parent(val) {
    this.$parent = val;
  }

  get asset() {
    return this.$asset;
  }

  set asset(val) {
    this.$asset = val;
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

  /* eslint-disable class-methods-use-this */
  /**
   * @function domRemoveStatusOverlay
   * @description remove the status overlay ui
   * @param {number} delay - delay in milliseconds
   */
  domRemoveStatusOverlay(delay = undefined) {
    function delayFn() {
      const overlay = this.element.find('div.progress-overlay').first();
      overlay.children().remove();
    }

    const bindFn = delayFn.bind(this);

    if (!delay) {
      bindFn();
    } else {
      setTimeout(() => { bindFn(); }, delay);
    }
  }

  /**
   * @function domCreateOverlayProgress
   * @description create status/progress overlay ui
   */
  domCreateOverlayProgress() {
    const overlay = this.element.find('div.progress-overlay').first();

    const states = (() => {
      if (this.stateMachine === this.parent.dbConfig.ingestStateMachine) {
        return ['s3', 'mediainfo', 'transcode', 'ingest'];
      } else if (this.stateMachine === this.parent.dbConfig.metadataStateMachine) {
        return ['analytics', 'webvtt', 'mam'];
      }

      return undefined;
    })();

    if (!states) {
      return undefined;
    }

    const dom = states.reduce((acc, cur, index) => {
      acc.push(`<span class="badge badge-pill badge-secondary text-thin" data-state="${cur}">${cur}</span>`);
      acc.push('<span class="text-thin">&gt;</span>');
      return acc;
    }, []);

    dom.push(`
      <div class="progress mt-2" style="height: 2px;">
        <div class="progress-bar bg-success" data-action="progress" role="progressbar" style="width: 1%" aria-valuenow="1" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <p class="text-left mt-1 mb-2 small" data-action="status">initializing...</p>
    `);

    const element = $(dom.join('\n'));

    if (overlay) {
      element.appendTo(overlay);
    }
    return element;
  }

  /**
   * @function domUpdateOverlayProgress
   * @description update status/progress overlay ui
   * @param {string} State
   * @param {string} Status
   * @param {number} Progress
   * @param {string} [ErrorMessage]
   */
  domUpdateOverlayProgress(State, Status, Progress, ErrorMessage) {
    const overlay = this.element.find('div.progress-overlay').first();
    const badge = overlay.find(`[data-state="${State}"]`).first();
    const statusText = overlay.find('[data-action="status"]').first();
    const progressbar = overlay.find('[data-action="progress"]').first();

    if (badge) {
      if (Status === 'FAILED') {
        badge.removeClass('badge-light badge-secondary badge-success').addClass('badge-danger');
        statusText.html(ErrorMessage);
        return;
      }

      if (Progress === 100) {
        badge.removeClass('badge-light badge-secondary badge-danger').addClass('badge-success');
      } else {
        badge.removeClass('badge-light badge-secondary badge-danger').addClass('badge-light');
      }

      statusText.html(`${Progress}%...`);
      progressbar.css('width', `${Progress}%`).attr('aria-valuenow', Progress);
    }
  }

  /**
   * @function domUpdateThumbnail
   * @description update thumbnail image
   */
  async domUpdateThumbnail() {
    const basename = this.asset.glacier.name;

    const img = this.element.find('img.card-img-top').first();

    const imageUrl = this.asset.signedImageUrl();

    img.attr('src', imageUrl).attr('alt', `Play ${basename}`);
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

        if (cur === 'play') {
          return ['fa-play-circle', 'Play now'];
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
  async domUpdateOverlayActions() {
    const {
      AWSomeNamespace: {
        VideoAsset,
      },
    } = window;

    const proxy = this.asset.proxy;

    const proxyPromise = VideoAsset.fileExists(proxy.bucket, proxy.key);

    let dom = this.element.find('div[data-type="actions"]').first();

    const parent = dom.parent();

    dom.remove();

    const metadata = this.asset.machineMetadata.canLoadVttTracks();

    const proxyExists = await proxyPromise;

    const actions = [];

    if (!proxyExists) {
      actions.push('restore');
    } else {
      actions.push('play');
      if (!metadata) {
        actions.push('metadata');
      }
    }

    dom = this.domCreateOverlayActions(actions);

    $(dom).appendTo(parent);

    await this.domRegisterEvents();
  }
  /* eslint-enable class-methods-use-this */

  /**
   * @function domInit
   * @description initialize VideoCard ui
   * @param {boolean} badge - not used
   */
  async domInit(badge = false) {
    const {
      AWSomeNamespace: {
        VideoAsset,
      },
    } = window;

    const uuid = this.asset.uuid;
    const glacier = this.asset.glacier;
    const proxy = this.asset.proxy;
    const basename = glacier.name;

    const promiseProxy = VideoAsset.fileExists(proxy.bucket, proxy.key);
    const promiseGlacier = VideoAsset.headObject(glacier.bucket, glacier.videoKey);
    const cardId = `card-${this.asset.uuid}`;
    const newAsset = (badge) ? '<span class="badge badge-success">New</span>' : '';
    const imageUrl = this.asset.signedImageUrl() || './images/image.png';
    const metadata = this.asset.machineMetadata.canLoadVttTracks();
    const proxyExists = await promiseProxy;

    /* make sure to ignore exception from headObject */
    const {
      StorageClass = 'STANDARD',
      Restore = {},
      ErrorMessage,
    } = await promiseGlacier.catch((e) => {
      const r = {
        StorageClass: 'STANDARD',
        ErrorMessage: e.message,
      };
      return r;
    });

    const actions = [];

    if (ErrorMessage) {
      actions.push('not-found');
    } else if (!proxyExists) {
      actions.push('restore');
    } else {
      actions.push('play');
      if (!metadata) {
        actions.push('metadata');
      }
    }

    const dom = `
    <div class="col-sm-4 mt-4">
      <div class="card" id="${cardId}">
        <div class="overlay-container">
          <img class="card-img-top" src="${imageUrl}" alt="thumbnail">
          <div class="state-status-overlay mb-2 small pl-2 pr-2">
            <div class="progress-overlay">
              <!-- HERE GOES STATE MACHINE STATUS -->
            </div>
          </div>
          ${this.domCreateOverlayActions(actions)}
        </div>
        <div class="card-body small">
          <h6 class="card-title text-truncate lead">${basename}</h6>
          <dl class="row small">
            <dt class="col-sm-3 text-truncate">Name</dt><dd class="col-sm-9 text-truncate" data-field="name">${glacier.name}</dd>
            <dt class="col-sm-3 text-truncate">ID</dt><dd class="col-sm-9 text-truncate" data-field="uuid">${uuid}</dd>
            <dt class="col-sm-3 text-truncate">ArchiveDate</dt><dd class="col-sm-9 text-truncate" data-field="archiveDate">${glacier.archiveDateISOFormat}</dd>
            <dt class="col-sm-3 text-truncate">File(s)</dt><dd class="col-sm-9 text-truncate" data-field="files">${Object.keys(glacier.files).length}</dd>
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

    img.on('error', () =>
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
   * @param {VideoCard} sibling
   */
  domInsertAfter(sibling) {
    this.element.insertAfter(sibling);
  }

  /**
   * @function domShow
   * @description show video card
   */
  domShow() {
    const cardId = `#card-${this.asset.uuid}`;

    $(cardId).parent().removeClass('collapse');

    return this;
  }

  /**
   * @function domHide
   * @description hide video card
   */
  domHide() {
    const cardId = `#card-${this.asset.uuid}`;

    $(cardId).parent().addClass('collapse');

    return this;
  }

  /**
   * @function metadataInProgress
   * @description boolean to see if metadata state machine is still in progress
   */
  metadataInProgress() {
    const overlay = this.element.find('div.progress-overlay').first().children();
    return overlay.length > 0;
  }

  /**
   * @function restoreInProgress
   * @description boolean to see if restore state machine is still in progress, not used
   */
  restoreInProgress() {
    const overlay = this.element.find('div.progress-overlay').first().children();
    return overlay.length > 0;
  }

  /**
   * @static
   * @function createFromData
   * @param {object} params - data loaded from DynamoDB
   * @param {CardCollection} parent
   */
  static async createFromData(params, parent) {
    try {
      const {
        AWSomeNamespace: {
          VideoAsset,
        },
      } = window;

      if (!parent) {
        throw new Error('missing parent');
      }

      const asset = new VideoAsset(params);

      const card = new VideoCard(asset, parent);

      await card.domInit();

      return card;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * @static
   * @function onMessage
   * @description manage messages from Iot message broker, update overlay/hover ui states
   * @param {object} status - from IotSubscriber
   */
  async onMessage(status) {
    const {
      State,
      Status,
      Progress,
      StateMachine,
      ErrorMessage,
    } = status;

    if (ErrorMessage) {
      console.log(`${this.asset.glacier.name}: Error=${ErrorMessage}`);
    } else {
      console.log(`${this.asset.glacier.name}: State=${State}, Progress=${Progress}, Status=${Status}`);
    }

    const completed = (Status === 'COMPLETED' && (State === 'ingest' || State === 'mam'));

    /* refresh VideoAsset attributes */
    if (completed) {
      const Table = this.parent.dbConfig.assetTable;
      const PartitionKey = this.parent.dbConfig.assetPartitionKey;

      await this.asset.reload(Table, PartitionKey);
    }

    const current = (completed) ? undefined : StateMachine;
    const old = this.stateMachine;
    this.stateMachine = current;

    /* update UI accordingly */
    if (old !== current) {
      this.domRemoveStatusOverlay(completed ? 4000 : 0);

      if (completed) {
        await this.domUpdateThumbnail();
        await this.domUpdateOverlayActions();
      } else {
        this.domCreateOverlayProgress();
      }
    }

    this.domUpdateOverlayProgress(State, Status, Progress, ErrorMessage);
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
    const {
      AWSomeNamespace: {
        VideoAsset,
      },
    } = window;

    const promises = [];
    const analytics = this.asset.proxy;

    if (analytics.key) {
      const key = `${analytics.key.slice(0, analytics.key.lastIndexOf('/'))}/analytics/results.json`;
      promises.push(VideoAsset.deleteObject(analytics.bucket, key));
    }

    /* purge database entries */
    const cfg = this.parent.dbConfig;
    const databases = [{
      /* Asset table */
      Table: cfg.assetTable,
      PartitionKey: cfg.assetPartitionKey,
    }, {
      /* Mediainfo table */
      Table: cfg.mediainfoTable,
      PartitionKey: cfg.mediainfoPartitionKey,
    }];

    promises.push(this.asset.purgeDB(databases));

    this.element.remove();

    await Promise.all(promises);
  }

  /**
   * @function parseKey
   * @description parse and return basename of the s3 object key
   * @param {string} key
   */
  static parseKey(key) {
    let basename = key.split('/').filter(x => x).pop();

    basename = basename.split('.').filter(x => x).slice(0, -1).join('_');

    return basename;
  }

  /**
   * @function fetchMediainfo
   * @description get mediainfo from dynamodb
   */
  async fetchMediainfo() {
    const Table = this.parent.dbConfig.mediainfoTable;
    const PartitionKey = this.parent.dbConfig.mediainfoPartitionKey;

    const mediainfo = await this.asset.fetchMediainfo(Table, PartitionKey);

    return mediainfo;
  }
}
