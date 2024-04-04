// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import StoreDefinitions from './storeDefs.js';
import BaseStore from './baseStore.js';

const EXPIRES_IN_YEAR = 365 * 24 * 60 * 60 * 1000;

/* singleton implementation */
let _singleton;

class SettingStore extends BaseStore {
  constructor() {
    super(StoreDefinitions.Stores.Settings);
    _singleton = this;
  }

  async putItem(id, blob, expires = EXPIRES_IN_YEAR) {
    return this.db.putItem(this.storeName, id, blob, expires);
  }
}

const GetSettingStore = () => {
  if (_singleton === undefined) {
    const notused_ = new SettingStore();
  }

  return _singleton;
};

export {
  GetSettingStore,
  SettingStore,
};
