// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  DB,
} = require('core-lib');
const BaseState = require('../shared/baseState');

const DDB_TABLE = process.env.ENV_SHOPPABLE_DDB;
const PRIKEY = 'uuid';

class StateDeleteRecord extends BaseState {
  static canHandle(op) {
    return op === 'StateDeleteRecord';
  }

  async process() {
    const {
      uuid,
    } = this.event;

    // delete record
    const ddb = new DB({
      Table: DDB_TABLE,
      PartitionKey: PRIKEY,
    });

    return ddb.purge(uuid)
      .then(() =>
        this.event);
  }
}

module.exports = StateDeleteRecord;
