// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import StoreDefinitions from './storeDefs.js';
import BaseStore from './baseStore.js';

/* singleton implementation */
let _singleton;

class FaceStore extends BaseStore {
  constructor() {
    super(StoreDefinitions.Stores.Faces);
    _singleton = this;
  }
}

const GetFaceStore = () => {
  if (_singleton === undefined) {
    const notused_ = new FaceStore();
  }

  return _singleton;
};

export {
  GetFaceStore,
  FaceStore,
};
