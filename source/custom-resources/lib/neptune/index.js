// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  NeptuneClient,
  CreateDBClusterCommand,
  CreateDBInstanceCommand,
  DeleteDBClusterCommand,
  DeleteDBInstanceCommand,
} = require('@aws-sdk/client-neptune');
const {
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

class X0 extends mxBaseResponse(class {}) {}

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;

const DEFAULT_ENGINE = 'neptune';
const DEFAULT_ENGINE_VERSION = '1.2.1.0';
const DEFAULT_DELETION_PROTECTION = false;
const DEFAULT_STORAGE_ENCRYPTED = true;
const DEFAULT_MIN_CAPACITY = 1;
const DEFAULT_MAX_CAPACITY = 32;
const DEFAULT_INSTANCE_CLASS = 'db.serverless';
const DEFAULT_MULTIAZ = false;

async function createDBCluster(data) {
  const minCapacity = Number(
    (data.ServerlessV2ScalingConfiguration || {})
      .MinCapacity || DEFAULT_MIN_CAPACITY
  );
  const maxCapacity = Number(
    (data.ServerlessV2ScalingConfiguration || {})
      .MaxCapacity || DEFAULT_MAX_CAPACITY
  );

  const params = {
    DBClusterIdentifier: data.DBClusterIdentifier,
    Engine: data.Engine || DEFAULT_ENGINE,
    EngineVersion: data.EngineVersion || DEFAULT_ENGINE_VERSION,
    DeletionProtection: data.DeletionProtection || DEFAULT_DELETION_PROTECTION,
    StorageEncrypted: data.StorageEncrypted || DEFAULT_STORAGE_ENCRYPTED,
    ServerlessV2ScalingConfiguration: {
      MinCapacity: minCapacity,
      MaxCapacity: maxCapacity,
    },
  };

  if (data.DBSubnetGroupName !== undefined) {
    params.DBSubnetGroupName = data.DBSubnetGroupName;
  }
  if (Array.isArray(data.AvailabilityZones)) {
    params.AvailabilityZones = data.AvailabilityZones;
  }
  if (Array.isArray(data.VpcSecurityGroupIds)) {
    params.VpcSecurityGroupIds = data.VpcSecurityGroupIds;
  }
  if (data.Tags) {
    params.Tags = data.Tags;
  }

  const _neptune = xraysdkHelper(new NeptuneClient({
    customUserAgent: CUSTOM_USER_AGENT,
    retryStrategy: retryStrategyHelper(),
  }));

  const command = new CreateDBClusterCommand(params);
  return _neptune.send(command);
}

async function deleteDBCluster(data) {
  const params = {
    DBClusterIdentifier: data.DBClusterIdentifier,
    SkipFinalSnapshot: true,
  };

  const _neptune = xraysdkHelper(new NeptuneClient({
    customUserAgent: CUSTOM_USER_AGENT,
    retryStrategy: retryStrategyHelper(),
  }));

  const command = new DeleteDBClusterCommand(params);
  return _neptune.send(command);
}

async function createDBInstance(data) {
  const params = {
    DBClusterIdentifier: data.DBClusterIdentifier,
    DBInstanceIdentifier: data.DBInstanceIdentifier,
    DBInstanceClass: data.DBInstanceClass || DEFAULT_INSTANCE_CLASS,
    Engine: data.Engine || DEFAULT_ENGINE,
    EngineVersion: data.EngineVersion || DEFAULT_ENGINE_VERSION,
    MultiAZ: data.MultiAZ || DEFAULT_MULTIAZ,
    StorageEncrypted: data.StorageEncrypted || DEFAULT_STORAGE_ENCRYPTED,
  };

  if (data.Tags) {
    params.Tags = data.Tags;
  }

  const _neptune = xraysdkHelper(new NeptuneClient({
    customUserAgent: CUSTOM_USER_AGENT,
    retryStrategy: retryStrategyHelper(),
  }));

  const command = new CreateDBInstanceCommand(params);
  return _neptune.send(command);
}

async function deleteDBInstance(data) {
  const params = {
    DBInstanceIdentifier: data.DBInstanceIdentifier,
    SkipFinalSnapshot: true,
  };

  const _neptune = xraysdkHelper(new NeptuneClient({
    customUserAgent: CUSTOM_USER_AGENT,
    retryStrategy: retryStrategyHelper(),
  }));

  const command = new DeleteDBInstanceCommand(params);
  return _neptune.send(command);
}

/**
 * @function NeptuneDBCluster
 * @param {object} event
 * @param {object} context
 */
exports.NeptuneDBCluster = async (event, context) => {
  let x0;
  try {
    x0 = new X0(event, context);

    const data = event.ResourceProperties.Data;
    const missing = [
      'DBClusterIdentifier',
    ].filter(x => data[x] === undefined);

    if (missing.length) {
      throw new M2CException(`missing ${missing.join(', ')}`);
    }

    /* create resources */
    if (x0.isRequestType('Create')) {
      return createDBCluster(data)
        .then((res) => {
          x0.storeResponseData(
            'DBClusterIdentifier',
            res.DBCluster.DBClusterIdentifier
          );
          x0.storeResponseData(
            'Endpoint',
            `${res.DBCluster.Endpoint}:${res.DBCluster.Port}`
          );
          x0.storeResponseData(
            'ReaderEndpoint',
            `${res.DBCluster.ReaderEndpoint}:${res.DBCluster.Port}`
          );
          x0.storeResponseData(
            'AvailabilityZones',
            res.DBCluster.AvailabilityZones.join(',')
          );
          x0.storeResponseData(
            'VpcSecurityGroupIds',
            res.DBCluster.VpcSecurityGroups
              .map((x) =>
                x.VpcSecurityGroupId)
              .join(',')
          );
          x0.storeResponseData('Status', 'SUCCESS');
          console.log(
            'NeptuneDBCluster:',
            'createDBCluster:',
            JSON.stringify(res, null, 2)
          );
          return x0.responseData;
        });
    }

    /* delete resources */
    if (x0.isRequestType('Delete')) {
      return deleteDBCluster(data)
        .then((res) => {
          x0.storeResponseData('Status', 'SUCCESS');
          console.log(
            'NeptuneDBCluster:',
            'deleteDBCluster:',
            JSON.stringify(res, null, 2)
          );
          return x0.responseData;
        });
    }

    /* update resources - not supported */
    x0.storeResponseData('Status', 'SKIPPED');
    return x0.responseData;
  } catch (e) {
    console.error(
      'ERR:',
      'NeptuneDBCluster:',
      e.$metadata.httpStatusCode,
      e.name,
      e.message
    );

    if (x0) {
      x0.storeResponseData('Status', 'FAILED');
      return x0.responseData;
    }

    /* throw error if x0 is not even available */
    throw e;
  }
};

/**
 * @function NeptuneDBInstance
 * @param {object} event
 * @param {object} context
 */
exports.NeptuneDBInstance = async (event, context) => {
  let x0;
  try {
    x0 = new X0(event, context);

    const data = event.ResourceProperties.Data;
    const missing = [
      'DBClusterIdentifier',
      'DBInstanceIdentifier',
    ].filter(x => data[x] === undefined);

    if (missing.length) {
      throw new M2CException(`missing ${missing.join(', ')}`);
    }

    /* create resources */
    if (x0.isRequestType('Create')) {
      return createDBInstance(data)
        .then((res) => {
          x0.storeResponseData(
            'DBInstanceIdentifier',
            res.DBInstance.DBInstanceIdentifier
          );
          x0.storeResponseData(
            'VpcId',
            res.DBInstance.DBSubnetGroup.VpcId
          );
          x0.storeResponseData(
            'VpcSecurityGroupIds',
            res.DBInstance.VpcSecurityGroups
              .map((x) =>
                x.VpcSecurityGroupId)
              .join(',')
          );
          x0.storeResponseData(
            'SubnetIdentifiers',
            res.DBInstance.DBSubnetGroup.Subnets
              .map((x) =>
                x.SubnetIdentifier)
              .join(',')
          );
          x0.storeResponseData(
            'SubnetAvailabilityZones',
            res.DBInstance.DBSubnetGroup.Subnets
              .map((x) =>
                x.SubnetAvailabilityZone.Name)
              .join(',')
          );
          x0.storeResponseData('Status', 'SUCCESS');
          console.log(
            'NeptuneDBInstance:',
            'createDBInstance:',
            JSON.stringify(res, null, 2)
          );
          return x0.responseData;
        });
    }

    /* delete resources */
    if (x0.isRequestType('Delete')) {
      return deleteDBInstance(data)
        .then((res) => {
          x0.storeResponseData('Status', 'SUCCESS');
          console.log(
            'NeptuneDBInstance:',
            'deleteDBInstance:',
            JSON.stringify(res, null, 2)
          );
          return x0.responseData;
        });
    }

    /* update resources - not supported */
    x0.storeResponseData('Status', 'SKIPPED');
    return x0.responseData;
  } catch (e) {
    console.error(
      'ERR:',
      'NeptuneDBInstance:',
      e.$metadata.httpStatusCode,
      e.name,
      e.message
    );

    if (x0) {
      x0.storeResponseData('Status', 'FAILED');
      return x0.responseData;
    }

    /* throw error if x0 is not even available */
    throw e;
  }
};
