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
 * @class CardCollection
 * @description managing a collection of VideoCard
 */
class CardCollection {
  constructor(params = {}) {
    const {
      collectionId = '#videoCollectionId',
    } = params;

    this.$element = $(collectionId);
    this.$cards = [];
    this.$dbConfig = undefined;
    this.$dbInstance = undefined;
    this.$preview = new Preview(this);
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'CardCollection';
  }
  /* eslint-enable class-methods-use-this */

  get element() {
    return this.$element;
  }

  get cards() {
    return this.$cards;
  }

  set cards(val) {
    this.$cards.splice(-1, 0, ...val);
  }

  get db() {
    return this.$dbInstance;
  }

  set db(val) {
    this.$dbInstance = val;
  }

  get dbConfig() {
    return this.$dbConfig;
  }

  set dbConfig(val) {
    this.$dbConfig = val;
  }

  get preview() {
    return this.$preview;
  }

  /* eslint-disable class-methods-use-this */
  /* eslint-disable no-alert */
  /**
   * @function handleEvent
   * @description manage UI events
   * @param {VideoCard} card
   * @param {string} action
   */
  async handleEvent(card, action) {
    const basename = card.asset.glacier.name;

    try {
      /* generate metadata */
      if (action === 'metadata') {
        if (card.metadataInProgress()) {
          alert(`${action}: '${basename}' already in process`);
        } else {
          await this.startMetadataStateMachine(card);
          alert(`${action}: '${basename}' request submitted`);
        }
        return;
      }

      /* restore request */
      if (action === 'restore') {
        if (card.restoreInProgress()) {
          alert(`${action}: '${basename}' already in process`);
        } else {
          await this.startIngestStateMachine(card);
        }
        return;
      }

      /* play request */
      if (action === 'play') {
        await this.preview.show(card);
        return;
      }

      /* purging record */
      if (action === 'remove') {
        if (card.restoreInProgress() || card.restoreInProgress()) {
          alert(`cannot remove '${basename}' as it is still in process`);
        } else {
          /* eslint-disable no-restricted-globals */
          const yesno = confirm(`Removing '${basename}' will also delete the database record. Continue?`);

          if (yesno) {
            await this.onDelete(card);
          }
        }
      }
    } catch (e) {
      alert(`ERR: ${action} '${basename}' failed. ${e.message}`);
    }
  }
  /* eslint-enable no-alert */
  /* eslint-enable class-methods-use-this */

  /**
   * @function startIngestStateMachine
   * @description start ingest state machine
   * @param {VideoCard} card
   */
  async startIngestStateMachine(card) {
    const body = {
      Config: this.dbConfig.toJSON(),
      Data: card.asset.toJSON(),
    };

    const path = `/${this.dbConfig.ingestStateMachine}`;

    const response = await this.startExecution(path, body);

    return response;
  }

  /**
   * @function startMetadataStateMachine
   * @description start metadata state machine
   * @param {VideoCard} card
   */
  async startMetadataStateMachine(card) {
    const body = {
      Config: this.dbConfig.toJSON(),
      Data: card.asset.toJSON(),
    };

    const path = `/${this.dbConfig.metadataStateMachine}`;

    const response = await this.startExecution(path, body);

    return response;
  }

  /**
   * @function startExecution
   * @description auth http request to start state machine execution
   * @param {string} path
   * @param {string} body
   */
  async startExecution(path, body) {
    const endpoint = `${this.dbConfig.apiGatewayEndpoint}${path}`;

    const query = {
      requester: AWS.config.credentials.identityId,
    };

    return AppUtils.authHttpRequest('POST', endpoint, query, body);
  }

  /**
   * @function connect
   * @description load a collection of video cards from dynamodb
   */
  async connect() {
    try {
      /* solution-manifest.js is auto-generated by CloudFormation template */
      /* Global variable is the solution ID */
      const {
        DynamoDB: {
          Configuration: {
            Table,
            PartitionKey,
            ItemKey,
          },
        },
      } = SO0050;

      const {
        AWSomeNamespace: {
          DB,
          DBConfig,
        },
      } = window;

      const config = await DBConfig.loadFromDB(Table, PartitionKey, ItemKey);

      const db = new DB({
        Table: config.assetTable,
        PartitionKey: config.assetPartitionKey,
      });

      const collection = await db.scan();

      const promises = collection.map(async (x) => {
        const promise = await VideoCard.createFromData(x, this);
        return promise;
      });

      const cards = await Promise.all(promises);

      cards.forEach((card) => {
        this.domInsertAt(0, card);
      });

      this.dbConfig = config;
      this.db = db;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * @function disconnect
   * @description remove all video cards
   */
  async disconnect() {
    this.db = undefined;

    const promises = this.cards.map(async (card) => {
      const promise = await card.remove();
      return promise;
    });

    await Promise.all(promises);

    this.cards.splice(0);
  }


  /**
   * @function findByUUID
   * @description find video card based on uuid
   * @param {string} uuid
   */
  findByUUID(uuid) {
    return this.cards.find(x =>
      x.asset.uuid === uuid);
  }

  /**
   * @function messageHook
   * @description manage status reported from IotSubscriber
   * @param {object} status - status from IotSubscriber
   */
  async messageHook(status) {
    try {
      const {
        State,
        Status,
        Data: {
          UUID: uuid,
        },
      } = status;

      if (!uuid) {
        if (State === 's3' && Status === 'OBJECTCREATED') {
          return this;
        }

        throw new Error(`uuid not found: ${JSON.stringify(status)}`);
      }

      let asset = this.findByUUID(uuid);

      if (!asset) {
        const data = await this.db.fetch(uuid);

        asset = await VideoCard.createFromData(data, this);

        this.domInsertAt(0, asset);
      }

      await asset.onMessage(status);
    } catch (e) {
      console.error(e);
    }
    return this;
  }

  /**
   * @function domInsertAt
   * @description insert video card at specific location
   * @param {number} index
   * @param {VideoCard} card
   */
  domInsertAt(index, card) {
    /* skip if card already exists */
    if (this.cards.findIndex(x => x.asset.uuid === card.asset.uuid) >= 0) {
      return this;
    }

    this.cards.splice(-1, 0, card);

    const sibling = this.element.children().eq(index);

    card.domInsertAfter(sibling);

    return this;
  }

  /**
   * @function onDelete
   * @description when user clicks on 'trash' button, delete video card
   * @param {VideoCard} card
   */
  async onDelete(card) {
    const index = this.cards.findIndex(x =>
      x.asset.uuid === card.asset.uuid);

    if (index === undefined) {
      return;
    }

    await card.purge();

    this.cards.splice(index, 1);
  }

  /**
   * @function onSearch
   * @description search Elasticsearch engine
   * @param {string} searchParam
   */
  async onSearch(searchParam) {
    try {
      if (!searchParam) {
        // show all
        this.cards.forEach(x => x.domShow());
      } else {
        // hide all, do a search, and filter content
        this.cards.forEach(x =>
          x.domHide());

        const endpoint = `${this.dbConfig.analyticsApiEndpoint}/search`;

        const query = {
          searchterm: searchParam.toLowerCase().replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, ''),
          page: 1,
        };

        const {
          Items,
        } = await AppUtils.authHttpRequest('GET', endpoint, query);

        console.log(`searching ${query.searchterm} returns ${Items.length} items...`);

        const uuids = Items.map(x =>
          x.media_id);

        uuids.forEach((uuid) => {
          const matched = this.cards.find(card =>
            card.asset.uuid === uuid);

          if (matched) {
            matched.domShow();
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }
}
