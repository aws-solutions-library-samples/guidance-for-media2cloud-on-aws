// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
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
const INDEX_INGEST = 'ingest';
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
    return (data !== undefined)
      ? AWS.DynamoDB.Converter.unmarshall(data)
      : undefined;
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
    return Promise.all(MEDIA_TYPES.map((type) =>
      db.purge(uuid, type)
        .catch((e) =>
          console.error(`[ERR]: db.delete: ${uuid} ${e.code} ${e.message}`))));
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
      }).catch((e) =>
        console.error(`[ERR]: CommonUtils.listObjects: ${prefix} ${e.code} ${e.message}`));
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
            for (let prefix of PROXY_PREFIXES) {
              if (x.Key.indexOf(prefix) > 0) {
                return false;
              }
            }
            return true;
          });
        }
        await Promise.all(contents.map((x) =>
          CommonUtils.deleteObject(bucket, x.Key)
            .then(() =>
              fileDeleted += 1)
            .catch((e) =>
              console.error(`[ERR]: CommonUtils.deleteObject: ${x.Key} ${e.code} ${e.message}`))));
      }
    } while ((response || {}).NextContinuationToken);
    return fileDeleted;
  }

  async deleteFromOpenSearch(uuid, myIndices) {
    const indexer = new Indexer();
    const indices = myIndices || Indexer.getIndices();
    return Promise.all(indices.map((name) =>
      indexer.deleteDocument(name, uuid)
        .catch((e) =>
          console.error(`[ERR]: indexer.deleteDocument: ${name}: ${uuid}: ${JSON.stringify(e.body, null, 2)}`))));
  }

  async onRemoveEvent(event) {
    const uuid = (event.oldImage || {}).uuid;
    if (!uuid) {
      return undefined;
    }
    return Promise.all([
      /* delete entries from analysis table */
      this.deleteFromAnalysisTable(uuid),
      /* delete all metadata from S3 */
      this.deleteFromS3(uuid),
      /* delete document from OpenSearch */
      this.deleteFromOpenSearch(uuid),
    ]);
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
    const indices = Indexer.getIndices()
      .filter((x) =>
        x !== INDEX_INGEST);
    return Promise.all([
      /* delete entries from analysis table */
      this.deleteFromAnalysisTable(uuid),
      /* delete all metadata from S3 */
      this.deleteFromS3(uuid, keepProxies),
      /* delete document from OpenSearch */
      this.deleteFromOpenSearch(uuid, indices),
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
    await this.updateOpenSearch(uuid, fields, [
      INDEX_INGEST,
    ]);
    return undefined;
  }

  async updateOpenSearch(uuid, fields, indices) {
    if (!indices.length || !uuid) {
      return undefined;
    }
    const doc = JSON.parse(JSON.stringify(fields));
    if (Object.keys(doc).length === 0) {
      return undefined;
    }
    const indexer = new Indexer();
    return Promise.all(indices.map((name) =>
      indexer.indexDocument(name, uuid, doc)
        .catch((e) =>
          console.error(`[ERR]: indexer.indexDocument: ${name}: ${uuid}: ${JSON.stringify(e.body)}`))));
  }

  async process() {
    const responses = await Promise.all(this.records.map((x) => {
      switch (x.event) {
        case EVENT_REMOVE:
          this.onRemoveEvent(x);
          break;
        case EVENT_INSERT:
          this.onInsertEvent(x);
          break;
        case EVENT_MODIFY:
          this.onModifyEvent(x);
          break;
        default:
          return undefined;
      }
    }));
    return responses;
  }
}

module.exports = DDBStreamEvent;
