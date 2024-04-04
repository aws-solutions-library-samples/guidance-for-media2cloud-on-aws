// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import StoreDefinitions from './storeDefs.js';

const DATABASE_NAME = 'm2cv4';
const DATABASE_VERSION = 1;
const RW = 'readwrite';

/* singleton implementation */
let _singleton;

class LocalStoreDB {
  constructor() {
    this.monkeyPatch();
    this.$db = undefined;

    _singleton = this;
  }

  get db() {
    return this.$db;
  }

  set db(val) {
    this.$db = val;
  }

  isSupported() {
    return !!window.indexedDB;
  }

  monkeyPatch() {
    /* remove cross-browser prefixing */
    if (!window.indexedDB) {
      window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    }
    if (!window.IDBTransaction) {
      window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || { READ_WRITE: RW };
    }
    if (!window.IDBKeyRange) {
      window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
    }
  }

  async open() {
    if (!this.isSupported()) {
      throw new Error('indexedDB not supported');
    }
    if (this.db) {
      return this.db;
    }
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onerror = (e) => {
        console.error(e);
        reject(e);
      };

      request.onsuccess = async () => {
        const names = Object.values(StoreDefinitions.Stores);
        const db = request.result;
        await Promise.all(names.map(name =>
          this.removeExpired(db, name)
            .catch((e) => {
              console.error(`ERR: onsuccess: ${name}: ${e.message}`);
              return e;
            })));
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const names = Object.values(StoreDefinitions.Stores);
        const ttl = StoreDefinitions.TimeToLive.Name;
        const db = request.result;
        names.map(name =>
          db.createObjectStore(name)
            .createIndex(ttl, ttl));
      };
    });
    return this.db;
  }

  async close() {
    if (!this.db) {
      return;
    }
    this.db.close();
    this.db = undefined;
  }

  async openStore(name, rw = RW) {
    if (!this.db) {
      await this.open();
    }
    return this.db.transaction([name], rw).objectStore(name);
  }

  async getItem(name, key) {
    const store = await this.openStore(name);
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onerror = (e) => {
        console.error(`getItem.onerror: ${e.message}`);
        resolve(undefined);
      };
      request.onsuccess = event =>
        resolve((event.target.result || {}).value);
    });
  }

  async putItem(name, key, value, ttl = StoreDefinitions.TimeToLive.Value) {
    const store = await this.openStore(name);
    return new Promise((resolve) => {
      const request = store.put({
        value,
        [StoreDefinitions.TimeToLive.Name]: new Date(Date.now() + ttl),
      }, key);
      request.onerror = (e) => {
        console.error(`putItem.onerror: ${e.message}`);
        resolve(undefined);
      };
      request.onsuccess = event =>
        resolve(event.target.result.value);
    });
  }

  async deleteItem(name, key) {
    const store = await this.openStore(name);
    return new Promise((resolve) => {
      const request = store.delete(key);
      request.onerror = (e) => {
        console.error(`deleteItem.onerror: ${e.message}`);
        resolve();
      };
      request.onsuccess = () =>
        resolve();
    });
  }

  async deleteItemsBy(name, prefix) {
    /* trick to work with prefix */
    /* https://hacks.mozilla.org/2014/06/breaking-the-borders-of-indexeddb/ */
    const store = await this.openStore(name);
    return new Promise((resolve) => {
      const query = IDBKeyRange.bound(
        prefix,
        `${prefix}\uffff`,
        false,
        false
      );
      const request = store.openCursor(query);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve();
          return;
        }
        console.log(`deleteItemsByPrefix: ${cursor.primaryKey}`);
        cursor.delete();
        cursor.continue();
      };

      request.onerror = (e) => {
        console.error(`deleteItemsByPrefix.onerror: ${e.message}`);
        resolve();
      };
    });
  }

  async removeExpired(db, name) {
    return new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = db.transaction([name], RW);
      } catch (e) {
        reject(e);
        return;
      }
      const ttl = StoreDefinitions.TimeToLive.Name;
      const index = transaction.objectStore(name).index(ttl);
      const range = IDBKeyRange.upperBound(new Date());
      index.openCursor(range).onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(db);
          return;
        }
        console.log(`expired item: ${cursor.primaryKey}`);
        cursor.delete();
        cursor.continue();
      };
    });
  }

  async clearAllStores() {
    const names = Object.values(StoreDefinitions.Stores);
    return Promise.all(names.map((name) =>
      this.cleanStore(name)));
  }

  async cleanStore(name) {
    if (!name) {
      return undefined;
    }
    const store = await this.openStore(name);
    return store.clear();
  }
}

const GetLocalStoreDB = () => {
  if (_singleton === undefined) {
    const notused_ = new LocalStoreDB();
  }

  return _singleton;
};

export {
  GetLocalStoreDB,
  LocalStoreDB,
  DATABASE_NAME,
  DATABASE_VERSION,
};
