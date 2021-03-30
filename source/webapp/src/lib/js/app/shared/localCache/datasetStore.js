import S3Utils from '../s3utils.js';
import StoreDefinitions from './storeDefs.js';
import BaseStore from './baseStore.js';

export default class DatasetStore extends BaseStore {
  constructor() {
    super(StoreDefinitions.Stores.Dataset);
  }

  static getSingleton() {
    if (!(window.AWSomeNamespace || {}).DatasetStoreSingleton) {
      window.AWSomeNamespace = {
        ...window.AWSomeNamespace,
        DatasetStoreSingleton: new DatasetStore(),
      };
    }
    return window.AWSomeNamespace.DatasetStoreSingleton;
  }

  async getDataset(bucket, key) {
    let dataset = await this.getItem(key).catch(() => undefined);
    if (!dataset) {
      dataset = await S3Utils.getObject(bucket, key)
        .then(data => JSON.parse(data.Body.toString()))
        .catch(() => undefined);
      if (dataset) {
        await this.putItem(key, dataset);
      }
    }
    return dataset;
  }
}
