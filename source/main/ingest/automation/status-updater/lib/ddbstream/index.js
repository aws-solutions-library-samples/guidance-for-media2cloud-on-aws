// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  unmarshall,
} = require('@aws-sdk/util-dynamodb');
const PATH = require('path');
const {
  Environment,
  CommonUtils,
  DB,
  Indexer,
} = require('core-lib');

const EVENT_INSERT = 'INSERT';
const EVENT_REMOVE = 'REMOVE';
const EVENT_MODIFY = 'MODIFY';
const MEDIA_TYPES = [
  'video',
  'audio',
  'document',
  'image',
];
const INDEX_CONTENT = Indexer.getContentIndex();
const PROXY_PREFIXES = [
  '/transcode/',
  '/mediainfo/',
  '/imageinfo/',
  '/docinfo/',
];
const HALF_HOUR = 30 * 60 * 1000;

class DDBStreamEvent {
  constructor(event, context) {
    this.$records = event.Records.map((x) => ({
      event: x.eventName,
      oldImage: DDBStreamEvent.unmarshallData(x.dynamodb.OldImage),
      newImage: DDBStreamEvent.unmarshallData(x.dynamodb.NewImage),
    }));
    this.$event = event;
    this.$context = context;
  }

  static unmarshallData(data) {
    if (data === undefined) {
      return data;
    }
    return unmarshall(data);
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get records() {
    return this.$records;
  }

  async deleteFromAnalysisTable(uuid) {
    const db = new DB({
      Table: Environment.DynamoDB.AIML.Table,
      PartitionKey: Environment.DynamoDB.AIML.PartitionKey,
      SortKey: Environment.DynamoDB.AIML.SortKey,
    });

    return Promise.all(MEDIA_TYPES
      .map((type) =>
        db.purge(uuid, type)
          .catch((e) => {
            console.error(
              'ERR:',
              'DDBStreamEvent.deleteFromAnalysisTable:',
              'db.purge:',
              e.name,
              e.message,
              uuid
            );
            return undefined;
          })));
  }

  async deleteFromS3(uuid, keepProxies = false) {
    const bucket = Environment.Proxy.Bucket;
    const prefix = PATH.join(uuid, '/');
    let fileDeleted = 0;
    let response;
    const tnow = Date.now();
    do {
      response = await CommonUtils.listObjects(bucket, prefix, {
        ContinuationToken: (response || {}).NextContinuationToken,
        MaxKeys: 300,
      }).catch((e) => {
        console.error(
          'ERR:',
          'DDBStreamEvent.deleteFromS3:',
          'CommonUtils.listObjects:',
          e.name,
          e.message,
          prefix
        );
        return undefined;
      });

      if (response && response.Contents) {
        let contents = response.Contents;
        if (keepProxies) {
          contents = contents.filter((x) => {
            /* if LastModified less than 30 mins, don't delete the object */
            const lastModified = new Date(x.LastModified).getTime();
            if ((tnow - lastModified) <= HALF_HOUR) {
              return false;
            }
            /* if object is one of the prefixes, don't delete the object */
            for (let i = 0; i < PROXY_PREFIXES.length; i++) {
              if (x.Key.indexOf(PROXY_PREFIXES[i]) > 0) {
                return false;
              }
            }
            return true;
          });
        }
        await Promise.all(contents
          .map((x) =>
            CommonUtils.deleteObject(bucket, x.Key)
              .then(() =>
                fileDeleted += 1)
              .catch((e) => {
                console.error(
                  'ERR:',
                  'DDBStreamEvent.deleteFromS3:',
                  'CommonUtils.deleteObject:',
                  e.name,
                  e.message,
                  x.Key
                );
                return undefined;
              })));
      }
    } while ((response || {}).NextContinuationToken);
    return fileDeleted;
  }

  async deleteDocumentFromOpenSearch(uuid) {
    const indexer = new Indexer();

    return indexer.deleteDocument(
      INDEX_CONTENT,
      uuid
    ).catch((e) => {
      console.log(
        'ERR:',
        'indexer.deleteDocument:',
        INDEX_CONTENT,
        uuid,
        JSON.stringify(e.body)
      );
      return undefined;
    });
  }

  async dropAnalysisFieldsFromOpenSearch(uuid) {
    const indexer = new Indexer();

    return indexer.dropAnalysisFields(
      INDEX_CONTENT,
      uuid
    ).catch((e) => {
      console.log(
        'ERR:',
        'indexer.dropAnalysisFields:',
        INDEX_CONTENT,
        uuid,
        JSON.stringify(e.body)
      );
      return undefined;
    });
  }

  async onRemoveEvent(event) {
    // AssetRemoval state machine to handle deleting assets
    return undefined;
    /*
    const uuid = (event.oldImage || {}).uuid;
    if (!uuid) {
      return undefined;
    }
    return Promise.all([
      this.deleteFromAnalysisTable(uuid),
      this.deleteFromS3(uuid),
      this.deleteDocumentFromOpenSearch(uuid),
    ]);
    */
  }

  async onInsertEvent(event) {
    return undefined;
  }

  async onModifyEvent(event) {
    const uuid = (event.oldImage || {}).uuid
      || (event.newImage || {}).uuid;
    if (!uuid) {
      return undefined;
    }
    /* case 1: deleting analysis column */
    if (event.newImage.analysis === undefined
      && event.oldImage.analysis !== undefined) {
      return this.onRemoveFieldAnalysis(uuid);
    }
    /* case 2: status/overallStatus change event */
    if (event.newImage.overallStatus !== event.oldImage.overallStatus
      || event.newImage.status !== event.oldImage.status) {
      return this.onUpdateFieldStatus(event);
    }
    return undefined;
  }

  async onRemoveFieldAnalysis(uuid) {
    const keepProxies = true;
    return Promise.all([
      /* delete entries from analysis table */
      this.deleteFromAnalysisTable(uuid),
      /* delete all metadata from S3 */
      this.deleteFromS3(uuid, keepProxies),
      /* delete document from OpenSearch */
      this.dropAnalysisFieldsFromOpenSearch(uuid),
    ]);
  }

  async onUpdateFieldStatus(event) {
    const uuid = event.newImage.uuid;
    /* update selected field(s) */
    const status = (event.oldImage.status !== event.newImage.status)
      ? event.newImage.status
      : undefined;
    const overallStatus = (event.oldImage.overallStatus !== event.newImage.overallStatus)
      ? event.newImage.overallStatus
      : undefined;
    const fields = {
      status,
      overallStatus,
    };
    await this.updateOpenSearch(uuid, fields);
    return undefined;
  }

  async updateOpenSearch(uuid, fields) {
    const indexer = new Indexer();

    return indexer.update(
      INDEX_CONTENT,
      uuid,
      fields
    ).catch((e) => {
      console.error(
        'ERR:',
        'DDBStreamEvent.updateOpenSearch:',
        'indexer.update:',
        e.name,
        e.message,
        INDEX_CONTENT,
        uuid,
        JSON.stringify(fields)
      );
      return undefined;
    });
  }

  async process() {
    const responses = await Promise.all(this.records.map((x) =>
      ((x.event === EVENT_REMOVE)
        ? this.onRemoveEvent(x)
        : (x.event === EVENT_INSERT)
          ? this.onInsertEvent(x)
          : (x.event === EVENT_MODIFY)
            ? this.onModifyEvent(x)
            : undefined)));
    return responses;
  }
}

module.exports = DDBStreamEvent;
