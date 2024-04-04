// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  Environment: {
    Proxy: {
      Bucket,
    },
    DynamoDB: {
      Ingest,
      AIML,
    },
  },
  DB,
  Indexer,
  CommonUtils,
  StateData,
} = require('core-lib');

const INDEX_CONTENT = Indexer.getContentIndex();
const WITHIN_X_MINS = 5 * 60 * 1000;
const MEDIA_TYPES = [
  'video',
  'audio',
  'document',
  'image',
];

class StateAssetRemoval {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get uuid() {
    return ((this.event || {}).input || {}).uuid;
  }

  async deleteRecordsFromDDB(uuid) {
    const promises = [];

    // delete from ingest table
    const dbIngest = new DB({
      Table: Ingest.Table,
      PartitionKey: Ingest.PartitionKey,
    });

    promises.push(dbIngest.purge(uuid)
      .catch((e) => {
        console.error(
          'ERR:',
          'StateAssetRemoval.deleteRecordsFromDDB:',
          'dbIngest.purge:',
          e.name,
          e.message,
          uuid
        );
        return undefined;
      }));

    // delete from analysis table
    const dbAnalysis = new DB({
      Table: AIML.Table,
      PartitionKey: AIML.PartitionKey,
      SortKey: AIML.SortKey,
    });

    MEDIA_TYPES
      .forEach((type) => {
        promises.push(dbAnalysis.purge(uuid, type)
          .catch((e) => {
            console.error(
              'ERR:',
              'StateAssetRemoval.deleteRecordsFromDDB:',
              'dbAnalysis.purge:',
              e.name,
              e.message,
              uuid,
              type
            );
            return undefined;
          }));
      });

    return Promise.all(promises);
  }

  async deleteFromS3(uuid) {
    const bucket = Bucket;
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const prefix = PATH.join(uuid, '/');
    const tnow = Date.now();

    let fileDeleted = 0;
    let response;

    do {
      const params = {
        ContinuationToken: (response || {}).NextContinuationToken,
        MaxKeys: 300,
      };

      response = await CommonUtils.listObjects(bucket, prefix, params)
        .catch((e) => {
          console.error(
            'ERR:',
            'StateAssetRemoval.deleteFromS3:',
            'CommonUtils.listObjects:',
            e.name,
            e.message,
            prefix
          );
          return undefined;
        });

      if (response && response.Contents) {
        const contents = response.Contents
          .filter((x) => {
            /* if LastModified less than X mins, don't delete the object */
            const lastModified = new Date(x.LastModified).getTime();
            if (Math.abs(tnow - lastModified) <= WITHIN_X_MINS) {
              return false;
            }
            return true;
          });

        await Promise.all(contents
          .map((x) =>
            CommonUtils.deleteObject(bucket, x.Key)
              .then(() =>
                fileDeleted += 1)
              .catch((e) => {
                console.error(
                  'ERR:',
                  'StateAssetRemoval.deleteFromS3:',
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

  async process() {
    const promises = [];
    const uuid = this.uuid;

    promises.push(this.deleteFromS3(uuid));
    promises.push(this.deleteRecordsFromDDB(uuid));
    promises.push(this.deleteDocumentFromOpenSearch(uuid));

    await Promise.all(promises);

    return {
      uuid,
      status: StateData.Statuses.Removed,
    };
  }
}

module.exports = StateAssetRemoval;
