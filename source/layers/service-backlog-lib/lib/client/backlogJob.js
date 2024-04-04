// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const BacklogTable = require('../backlog-table');
const EBHelper = require('../shared/ebHelper');
const {
  Topic,
} = require('../shared/defs');
const {
  M2CException,
} = require('../shared/error');

const STATUS_PENDING = 'PENDING';
const STATUS_PROCESSING = 'PROCESSING';

class BacklogJob {
  static isService(serviceApi) {
    return false;
  }

  getServiceTopic() {
    if (!Topic.Arn || !Topic.RoleArn) {
      throw new M2CException('missing environment variables');
    }
    return {
      RoleArn: Topic.RoleArn,
      SNSTopicArn: Topic.Arn,
    };
  }

  async createJobItem(id, serviceApi, serviceParams, status, jobId, ttl) {
    const ddb = BacklogTable.getTable();
    const gsiStatus = BacklogTable.getStatusGSI();
    const gsiJobId = BacklogTable.getJobIdGSI();

    const params = {
      TableName: ddb.name,
      Item: {
        [ddb.partition]: id,
        [ddb.sort]: serviceApi,
        [gsiStatus.partition]: status,
        [gsiStatus.sort]: new Date().getTime(),
        [gsiJobId.partition]: jobId,
        serviceParams,
        ttl: BacklogTable.timeToLiveInSeconds(ttl),
      },
      Expected: {
        [gsiStatus.partition]: {
          Exists: false,
        },
      },
    };
    const response = await BacklogTable.createItem(params)
      .then(() => params.Item)
      .catch((e) => {
        console.error(`ERR: BacklogTable.createJobItem: ${e.name}: ${e.message} (${id}) (${status}) (${jobId})`);
        throw e;
      });
    return EBHelper.send(response);
  }

  async updateJobId(item, jobId) {
    const ddb = BacklogTable.getTable();
    const gsiStatus = BacklogTable.getStatusGSI();
    const gsiJobId = BacklogTable.getJobIdGSI();

    const params = {
      TableName: ddb.name,
      Key: {
        [ddb.partition]: item.id,
        [ddb.sort]: item.serviceApi,
      },
      AttributeUpdates: {
        [gsiStatus.partition]: {
          Action: 'PUT',
          Value: STATUS_PROCESSING,
        },
        [gsiJobId.partition]: {
          Action: 'PUT',
          Value: jobId,
        },
      },
      Expected: {
        [gsiStatus.partition]: {
          ComparisonOperator: 'EQ',
          Value: STATUS_PENDING,
        },
      },
      ReturnValues: 'ALL_NEW',
    };
    const response = await BacklogTable.updateItem(params)
      .then(data => data.Attributes)
      .catch((e) => {
        console.error(`ERR: BacklogTable.updateJobId: ${e.name}: ${e.message} (${item.id}) (${jobId})`);
        throw e;
      });
    return EBHelper.send(response);
  }

  async deleteJob(jobId, jobStatus, output) {
    const item = (await this.getJobById(jobId)).shift();
    /* key doesn't exist */
    if (!item) {
      return undefined;
    }
    /* any custom work before deleting a job */
    await this.beforeDeleteJob(item, jobStatus);

    const ddb = BacklogTable.getTable();
    const response = await BacklogTable.deleteItem({
      TableName: ddb.name,
      Key: {
        [ddb.partition]: item.id,
        [ddb.sort]: item.serviceApi,
      },
      ReturnValues: 'ALL_OLD',
    })
      .then((data) =>
        data.Attributes)
      .catch((e) => {
        console.error(`ERR: BacklogTable.deleteJob: ${e.name}: ${e.message} (${item.id}) (${jobStatus}) (${jobId})`);
        throw e;
      });
    return EBHelper.send({
      ...response,
      status: jobStatus,
      ...output,
    });
  }

  async beforeDeleteJob(item, jobStatus) {
    return item;
  }

  async getJobById(jobId) {
    const ddb = BacklogTable.getTable();
    const gsiJobId = BacklogTable.getJobIdGSI();
    const params = {
      TableName: ddb.name,
      IndexName: gsiJobId.index,
      KeyConditions: {
        [gsiJobId.partition]: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [
            jobId,
          ],
        },
      },
    };
    return BacklogTable.queryItems(params);
  }

  async getQueuedJobs(prefix, previousJob, limit = 10) {
    const ddb = BacklogTable.getTable();
    const gsiStatus = BacklogTable.getStatusGSI();
    const params = {
      TableName: ddb.name,
      IndexName: gsiStatus.index,
      KeyConditions: {
        [gsiStatus.partition]: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [
            STATUS_PENDING,
          ],
        },
      },
      QueryFilter: {
        [ddb.sort]: {
          ComparisonOperator: 'BEGINS_WITH',
          AttributeValueList: [
            prefix,
          ],
        },
      },
      ScanIndexForward: true,
      Limit: limit,
    };
    return BacklogTable.queryItems(params, limit);
  }

  async startAndRegisterJob(id, serviceApi, serviceParams) {
    const response = await this.startJob(
      serviceApi,
      serviceParams
    ).catch(e => e);

    let status;
    let jobId;
    if (response instanceof Error) {
      if (this.noMoreQuotasException(response.name)) {
        status = STATUS_PENDING;
        // console.log(`${status} ${response.name}: ${response.message} (${id})`);
      } else {
        console.error(`ERR: BacklogTable.startAndRegisterJob: ${response.name}: ${response.message} (${id})`);
        throw response;
      }
    } else {
      status = STATUS_PROCESSING;
      jobId = this.parseJobId(response);
      // console.log(`${status} ${response.JobId} (${id})`);
    }

    return this.createJobItem(
      id,
      serviceApi,
      serviceParams,
      status,
      jobId
    );
  }

  // ddb stream callback
  async fetchAndStartJobs(prefix, previousJob) {
    const items = await this.getQueuedJobs(prefix, previousJob);
    const metrics = {
      started: [],
      notStarted: [],
      total: items.length,
    };

    while (items.length) {
      const item = items.shift();
      let response = await this.startJob(item.serviceApi, item.serviceParams)
        .catch(e => e);

      if (response instanceof Error) {
        if (this.noMoreQuotasException(response.name)) {
          return metrics;
        }
        // try next item
        metrics.notStarted.push(item.id);
        continue;
      }
      const jobId = this.parseJobId(response);
      response = await this.updateJobId(item, jobId)
        .catch(e => e);
      if (response instanceof Error) {
        if (response.name === 'ConditionalCheckFailedException') {
          metrics.started.push(item.id);
        } else {
          metrics.notStarted.push(item.id);
        }
      } else {
        metrics.started.push(item.id);
      }
    }
    return metrics;
  }

  async startJob(serviceApi, serviceParams) {
    throw new M2CException('subclass to implement startJob');
  }

  noMoreQuotasException(name) {
    return (name === 'LimitExceededException'
    || name === 'ProvisionedThroughputExceededException');
  }

  parseJobId(data) {
    return data.JobId;
  }
}

module.exports = BacklogJob;
