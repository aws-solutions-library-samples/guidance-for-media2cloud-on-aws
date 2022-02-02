// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import StoreDefinitions from './storeDefs.js';
import BaseStore from './baseStore.js';

const EXPIRES_IN_YEAR = 365 * 24 * 60 * 60 * 1000;

export default class SettingStore extends BaseStore {
  constructor() {
    super(StoreDefinitions.Stores.Settings);
  }

  static getSingleton() {
    if (!(window.AWSomeNamespace || {}).SettingStoreSingleton) {
      window.AWSomeNamespace = {
        ...window.AWSomeNamespace,
        SettingStoreSingleton: new SettingStore(),
      };
    }
    return window.AWSomeNamespace.SettingStoreSingleton;
  }

  async putItem(id, blob, expires = EXPIRES_IN_YEAR) {
    return this.db.putItem(this.storeName, id, blob, expires);
  }
}
