// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  M2CException,
} = require('core-lib');
const BaseState = require('../shared/base');

class StateImportCollection extends BaseState {
  get input() {
    return this.event.input;
  }

  async process() {
    if (this.input.action !== 'import') {
      throw new M2CException('invalid action');
    }

    const collectionId = this.input.collectionId;
    if (collectionId === undefined) {
      throw new M2CException('invalid collection id');
    }

    let token = this.input.token;
    do {
      await this.faceIndexer.importFaces(collectionId, token)
        .then((res) => {
          token = res.token;
        });
    } while (token !== undefined && !this.lambdaTimeout());

    // reset the token to signal the state machine
    this.input.token = token;

    console.log('response', this.event);

    return this.event;
  }
}

module.exports = StateImportCollection;
