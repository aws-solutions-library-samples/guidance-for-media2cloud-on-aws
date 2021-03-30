import ApiHelper from '../apiHelper.js';

export default class FaceCollection {
  constructor() {
    this.$indexedFaces = [];
    this.$queuedFaces = [];
  }

  static async getSingleton() {
    if (!window.AWSomeNamespace.faceCollectionInstance) {
      window.AWSomeNamespace.faceCollectionInstance = new FaceCollection();
    }
    return window.AWSomeNamespace.faceCollectionInstance;
  }

  get indexedFaces() {
    return this.$indexedFaces;
  }

  get queuedFaces() {
    return this.$queuedFaces;
  }

  resetCollection() {
    this.indexedFaces.length = 0;
    this.queuedFaces.length = 0;
  }

  async load() {
    const responses = await new Promise([
      ApiHelper.getIndexFaces(),
      ApiHelper.getQueueFaces(),
    ]);
  }
}
