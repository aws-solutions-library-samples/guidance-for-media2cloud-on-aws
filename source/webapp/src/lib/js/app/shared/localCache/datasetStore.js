// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetS3Utils,
} from '../s3utils.js';
import StoreDefinitions from './storeDefs.js';
import BaseStore from './baseStore.js';

/* singleton implementation */
let _singleton;

class DatasetStore extends BaseStore {
  constructor() {
    super(StoreDefinitions.Stores.Dataset);
    _singleton = this;
  }

  async getDataset(bucket, key) {
    let dataset = await this.getItem(key)
      .catch(() =>
        undefined);

    if (!dataset) {
      const s3utils = GetS3Utils();
      dataset = await s3utils.getObject(bucket, key)
        .catch(() => undefined);
      if (dataset) {
        dataset = await dataset.Body.transformToString()
          .then((res) =>
            JSON.parse(res));

        await this.putItem(key, dataset);
      }
    }

    return dataset;
  }
}

const GetDatasetStore = () => {
  if (_singleton === undefined) {
    const notused_ = new DatasetStore();
  }

  return _singleton;
};

export {
  GetDatasetStore,
  DatasetStore,
};
