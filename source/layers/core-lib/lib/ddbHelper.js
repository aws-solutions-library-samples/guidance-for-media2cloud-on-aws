// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  marshall,
  unmarshall,
} = require('@aws-sdk/util-dynamodb');

const marshalling = (data) => {
  const duped = JSON.parse(JSON.stringify(data));

  [
    'ExclusiveStartKey',
    'ExpressionAttributeValues',
    'Item',
    'Key',
  ].forEach((attr) => {
    if (duped[attr] !== undefined) {
      duped[attr] = marshall(duped[attr]);
    }
  });

  [
    'KeyConditions',
    'QueryFilter',
    'ScanFilter',
  ].forEach((attr) => {
    if (duped[attr] !== undefined) {
      Object.keys(duped[attr])
        .forEach((key) => {
          duped[attr][key].AttributeValueList =
            marshall(duped[attr][key].AttributeValueList);
        });
    }
  });

  [
    'AttributeUpdates',
    'Expected',
  ].forEach((attr) => {
    if (duped[attr] !== undefined) {
      Object.keys(duped[attr])
        .forEach((key) => {
          if (duped[attr][key].AttributeValueList !== undefined) {
            duped[attr][key].AttributeValueList =
              marshall(duped[attr][key].AttributeValueList);
          }
          if (duped[attr][key].Value !== undefined) {
            duped[attr][key].Value =
              marshall({
                _: duped[attr][key].Value,
              })._;
          }
        });
    }
  });

  /* BatchXXXItem */
  if (duped.RequestItems) {
    Object.keys(duped.RequestItems)
      .forEach((key) => {
        /* BatchWriteItem */
        if (Array.isArray(duped.RequestItems[key])) {
          duped.RequestItems[key].forEach((item) => {
            if (item.DeleteRequest !== undefined
            && item.DeleteRequest.Key !== undefined) {
              item.DeleteRequest.Key = marshall(item.DeleteRequest.Key);
            }
            if (item.PutRequest !== undefined
              && item.PutRequest.Item !== undefined) {
              item.PutRequest.Item = marshall(item.PutRequest.Item);
            }
          });
        /* BatchGetItem */
        } else if (duped.RequestItems[key].Keys) {
          duped.RequestItems[key].Keys = duped.RequestItems[key].Keys
            .map((item) =>
              marshall(item));
        }
      });
  }

  return duped;
};

const unmarshalling = (data) => {
  const duped = JSON.parse(JSON.stringify(data));

  [
    'Item',
    'LastEvaluatedKey',
    'Attributes',
  ].forEach((attr) => {
    if (duped[attr] !== undefined) {
      duped[attr] = unmarshall(duped[attr]);
    }
  });

  [
    'Items',
  ].forEach((attr) => {
    if (Array.isArray(duped[attr])) {
      duped[attr] = duped[attr]
        .map((item) =>
          unmarshall(item));
    }
  });

  if (duped.ItemCollectionMetrics !== undefined) {
    /* Get/Put/UpdateItem response */
    if (duped.ItemCollectionMetrics.ItemCollectionKey !== undefined) {
      duped.ItemCollectionMetrics.ItemCollectionKey =
        unmarshall(duped.ItemCollectionMetrics.ItemCollectionKey);
    /* BatchWriteItem response */
    } else {
      Object.keys(duped.ItemCollectionMetrics)
        .forEach((key) => {
          if (Array.isArray(duped.ItemCollectionMetrics[key])) {
            duped.ItemCollectionMetrics[key].forEach((item) => {
              if (item.ItemCollectionKey !== undefined) {
                item.ItemCollectionKey = unmarshall(item.ItemCollectionKey);
              }
            });
          }
        });
    }
  }

  /* BatchGetItem response */
  if (duped.Responses !== undefined) {
    Object.keys(duped.Responses)
      .forEach((key) => {
        duped.Responses[key] = duped.Responses[key]
          .map((item) =>
            unmarshall(item));
      });
  }

  if (duped.UnprocessedKeys !== undefined) {
    Object.keys(duped.UnprocessedKeys)
      .forEach((key) => {
        if (Array.isArray(duped.UnprocessedKeys[key].Keys)) {
          duped.UnprocessedKeys[key].Keys =
            duped.UnprocessedKeys[key].Keys
              .map((item) =>
                unmarshall(item));
        }
      });
  }

  /* BatchWriteItem response */
  if (duped.UnprocessedItems !== undefined) {
    Object.keys(duped.UnprocessedItems)
      .forEach((key) => {
        if (Array.isArray(duped.UnprocessedItems[key])) {
          duped.UnprocessedItems[key].forEach((item) => {
            if (item.DeleteRequest !== undefined
            && item.DeleteRequest.Key !== undefined) {
              item.DeleteRequest.Key = unmarshall(item.DeleteRequest.Key);
            }
            if (item.PutRequest !== undefined
            && item.PutRequest.Item !== undefined) {
              item.PutRequest.Item = unmarshall(item.PutRequest.Item);
            }
          });
        }
      });
  }

  return duped;
};

module.exports = {
  marshalling,
  unmarshalling,
};
