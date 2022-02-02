// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import StoreDefinitions from './storeDefs.js';
import BaseStore from './baseStore.js';

export default class FaceStore extends BaseStore {
  constructor() {
    super(StoreDefinitions.Stores.Faces);
  }

  static getSingleton() {
    if (!(window.AWSomeNamespace || {}).FaceStoreSingleton) {
      window.AWSomeNamespace = {
        ...window.AWSomeNamespace,
        FaceStoreSingleton: new FaceStore(),
      };
    }
    return window.AWSomeNamespace.FaceStoreSingleton;
  }
}
