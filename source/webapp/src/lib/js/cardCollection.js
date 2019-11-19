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
/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-alert */

/**
 * @class CardCollection
 * @description managing a collection of VideoCard
 */
class CardCollection {
  constructor(params = {}) {
    this.$element = $(params.collectionId || CardCollection.Id.CollectionId);
    this.$cards = [];
    this.$nextToken = undefined;
    this.$videoPreview = new VideoPreview(this);
    this.$imagePreview = new ImagePreview(this);
  }

  get [Symbol.toStringTag]() {
    return 'CardCollection';
  }

  static get Id() {
    return {
      CollectionId: '#videoCollectionId',
      LoadMoreData: '#idLoadMoreData',
    };
  }

  get element() {
    return this.$element;
  }

  get cards() {
    return this.$cards;
  }

  set cards(val) {
    this.$cards.splice(-1, 0, ...val);
  }

  get nextToken() {
    return this.$nextToken;
  }

  set nextToken(val) {
    this.$nextToken = val;
  }

  get videoPreview() {
    return this.$videoPreview;
  }

  get imagePreview() {
    return this.$imagePreview;
  }

  /**
   * @function handleEvent
   * @description manage UI events
   * @param {VideoCard} card
   * @param {string} action
   */
  async handleEvent(card, action) {
    try {
      AppUtils.loading('spinning-icon');

      /* play request */
      if (action === 'play') {
        await this.videoPreview.show(card);
        return;
      }

      if (action === 'preview') {
        await this.imagePreview.show(card);
        return;
      }

      const runningProcess = card.isBusy();
      if (runningProcess) {
        alert(`'${card.basename}' is still being processed by ${runningProcess}`);
        return;
      }

      /* generate metadata */
      if (action === 'metadata') {
        const yesno = window.confirm(`Start to analyze '${card.basename}' now?`);
        if (yesno) {
          await this.onStartAnalysisWorkflow(card);
          return;
        }
      }

      /* restore request */
      if (action === 'restore') {
        await this.onStartIngestWorkflow(card);
        return;
      }

      /* purging record */
      if (action === 'remove') {
        const yesno = window.confirm(`Removing '${card.basename}' will also delete the database record. Continue?`);
        if (yesno) {
          await this.onDelete(card);
          return;
        }
      }
    } catch (e) {
      alert(`ERR: ${action} failed. ${e.message}`);
    } finally {
      AppUtils.loading('spinning-icon', false);
    }
  }

  async scanCollection() {
    const query = {
      pageSize: Storage.getOption('pageSize', 10),
    };

    if (this.nextToken) {
      query.token = this.nextToken;
    }

    const {
      Items,
      NextToken,
    } = await ApiHelper.scanRecords(query);

    this.nextToken = NextToken;

    return Items;
  }

  createCard(data, idx = this.cards.length) {
    let card = this.cards.find(x => x.uuid === data.uuid);
    if (!card) {
      card = CardFactory.createCard(data, this);
      this.cards.splice(-1, 0, card);
    }
    return card;
  }

  async insertCard(item, idx = this.cards.length) {
    const uuid = (typeof item === 'string') ? item : item.uuid;
    if (!uuid) {
      throw new Error(`invalid item, ${JSON.stringify(item, null, 2)}`);
    }

    const data = await ApiHelper.getRecord(uuid);
    if (!Object.keys(data).length) {
      return undefined;
    }

    const card = CardFactory.createCard(data, this);
    await card.domInit();

    this.domInsertAt(Math.max(0, idx), card);
    return card;
  }

  /**
   * @function connect
   * @description load a collection of video cards from dynamodb
   */
  async connect() {
    try {
      AppUtils.loading('spinning-icon');
      const items = await this.scanCollection();
      while (items.length) {
        await this.insertCard(items.shift());
      }
      this.registerEvents();
    } catch (e) {
      console.error(encodeURIComponent(e.message));
      throw e;
    } finally {
      AppUtils.loading('spinning-icon', false);
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

  registerEvents() {
    /* load more data button */
    $(CardCollection.Id.LoadMoreData).off('click').on('click', async (event) => {
      event.preventDefault();
      if (this.nextToken) {
        AppUtils.loading('spinning-icon');
        const items = await this.scanCollection().catch(e => undefined);
        while (items.length) {
          await this.insertCard(items.shift()).catch(e => undefined);
        }
        AppUtils.loading('spinning-icon', false);
      }
      $(CardCollection.Id.LoadMoreData).prop('disabled', !this.nextToken);
    });
  }

  /**
   * @function findByUUID
   * @description find video card based on uuid
   * @param {string} uuid
   */
  findByUUID(uuid) {
    return uuid && this.cards.find(x =>
      x.uuid === uuid);
  }

  async onIngestStateMessage(msg) {
    if (!msg.uuid) {
      return this;
    }

    const card = this.findByUUID(msg.uuid) || await this.insertCard(msg, 0);

    await card.onIngestMessage(msg);
    return this;
  }

  async onGroundTruthStateMessage(msg) {
    await Promise.all([
      this.imagePreview.onGroundTruthMessage(msg),
      this.videoPreview.onGroundTruthMessage(msg),
    ]);

    const card = this.findByUUID(msg.uuid);
    if (card) {
      await card.onGroundTruthMessage(msg);
    }
    return this;
  }

  async onAnalysisStateMessage(msg) {
    if (!msg.uuid) {
      return this;
    }
    const card = this.findByUUID(msg.uuid);
    await card.onAnalysisMessage(msg);
    return this;
  }

  /**
   * @function messageHook
   * @description manage status reported from IotSubscriber
   * @param {object} status - status from IotSubscriber
   */
  async messageHook(msg) {
    try {
      switch (msg.stateMachine) {
        case SO0050.StateMachines.GroundTruth:
          await this.onGroundTruthStateMessage(msg);
          break;
        case SO0050.StateMachines.Ingest:
          await this.onIngestStateMessage(msg);
          break;
        case SO0050.StateMachines.Analysis:
          await this.onAnalysisStateMessage(msg);
          break;
        default:
          break;
      }
    } catch (e) {
      console.error(encodeURIComponent(e.message));
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
    if (this.cards.findIndex(x => x.uuid === card.uuid) < 0) {
      this.cards.splice(-1, 0, card);
    }

    if (!this.element.find(`#card-${card.uuid}`).length) {
      const sibling = this.element.children().eq(index);
      card.domInsertAfter(sibling);
    }
    return this;
  }

  /**
   * @function onDelete
   * @description when user clicks on 'trash' button, delete video card
   * @param {VideoCard} card
   */
  async onDelete(card) {
    const index = this.cards.findIndex(x =>
      x.uuid === card.uuid);

    if (index === undefined) {
      return;
    }

    await card.purge();
    this.cards.splice(index, 1);
  }

  /**
   * @function onSearch
   * @description search Elasticsearch engine
   * @param {Object} results
   */
  async onSearch(results, beginSearch = false) {
    try {
      if (!results) {
        this.cards.forEach(x => x.domShow());
      } else {
        if (beginSearch) {
          this.cards.forEach(x =>
            x.domHide());
        }
        const promises = [];
        results.uuids.forEach((uuid) => {
          const matched = this.cards.find(card =>
            card.uuid === uuid);

          if (matched) {
            matched.domShow();
          } else {
            promises.push(this.insertCard(uuid).catch(() => undefined));
          }
        });
        await Promise.all(promises);
      }
    } catch (e) {
      console.error(encodeURIComponent(e.message));
    }
  }

  async onStartIngestWorkflow(card) {
    return ApiHelper.startIngestWorkflow({
      bucket: SO0050.Ingest.Bucket,
      uuid: card.uuid,
      key: card.key,
    });
  }

  async onStartAnalysisWorkflow(card) {
    return ApiHelper.startAnalysisWorkflow({
      uuid: card.uuid,
      input: {
        aiOptions: this.getAimlOptions(),
      },
    });
  }

  getAimlOptions() {
    return {
      /* rekog */
      celeb: Storage.getOption('celeb', SO0050.AIML.celeb),
      face: Storage.getOption('face', SO0050.AIML.face),
      faceMatch: Storage.getOption('faceMatch', SO0050.AIML.faceMatch),
      label: Storage.getOption('label', SO0050.AIML.label),
      moderation: Storage.getOption('moderation', SO0050.AIML.moderation),
      person: Storage.getOption('person', SO0050.AIML.person),
      text: Storage.getOption('text', SO0050.AIML.text),
      /* comprehend */
      transcript: Storage.getOption('transcript', SO0050.AIML.transcript),
      entity: Storage.getOption('entity', SO0050.AIML.entity),
      keyphrase: Storage.getOption('keyphrase', SO0050.AIML.keyphrase),
      sentiment: Storage.getOption('sentiment', SO0050.AIML.sentiment),
      topic: Storage.getOption('topic', SO0050.AIML.topic),
      /* document */
      document: Storage.getOption('document', SO0050.AIML.document),
      /* advanced settings */
      languageCode: Storage.getOption('languageCode', SO0050.AIML.languageCode),
      customVocabulary: Storage.getOption('customVocabulary', SO0050.AIML.customVocabulary),
      faceCollectionId: Storage.getOption('faceCollectionId', SO0050.AIML.faceCollectionId),
      minConfidence: Storage.getOption('minConfidence', SO0050.AIML.minConfidence),
      // vocabularies: Storage.getOption('vocabularies', SO0050.AIML.vocabularies),
    };
  }
}
