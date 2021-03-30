import LocalStoreDB from './localStoreDB.js';

export default class BaseStore {
  constructor(storeName) {
    this.$storeName = storeName;
    this.$db = LocalStoreDB.getSingleton();
  }

  get storeName() {
    return this.$storeName;
  }

  get db() {
    return this.$db;
  }

  async getItem(id) {
    return this.db.getItem(this.storeName, id);
  }

  async putItem(id, blob) {
    return this.db.putItem(this.storeName, id, blob);
  }

  async deleteItem(id) {
    return this.db.deleteItem(this.storeName, id);
  }
}
