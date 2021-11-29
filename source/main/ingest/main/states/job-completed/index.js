// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const {
  Environment,
  DB,
  SNS,
  StateData,
  IngestError,
} = require('core-lib');

class StateJobCompleted {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateJobCompleted';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const overallStatus = StateData.Statuses.Processing;
    const status = StateData.Statuses.IngestCompleted;
    const uuid = this.stateData.uuid;

    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    await db.update(uuid, undefined, {
      overallStatus,
      status,
    }, false);

    this.stateData.setCompleted(status);
    await SNS.send(`ingest: ${this.stateData.uuid}`, this.stateData.toJSON()).catch(() => false);
    return this.stateData.toJSON();
  }
}

module.exports = StateJobCompleted;
