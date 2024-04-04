// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment: {
    StateMachines: {
      AssetRemoval,
    },
  },
} = require('core-lib');
const StatePrepareAnalysis = require('./states/prepare-analysis');
const StateSimilaritySearch = require('./states/similarity-search');
const StateDeleteRecord = require('./states/delete-record');

function _parseEvent(event) {
  if (event.detail === undefined) {
    return event;
  }

  // call from Amazon EventBridge, parse the output from dynamic frame segmentation state machine
  const parsed = JSON.parse(event.detail.output);

  // default to the first state of the state machine
  parsed.operation = 'StatePrepareAnalysis';

  // check to see if event comes from Asset Removal State Machine
  if (event.detail.stateMachineArn.includes(AssetRemoval)) {
    parsed.operation = 'StateDeleteRecord';
  }

  return parsed;
}

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)};`);
  console.log(`context = ${JSON.stringify(context, null, 2)};`);

  try {
    const parsed = _parseEvent(event);
    const op = parsed.operation;

    let instance;
    if (StatePrepareAnalysis.canHandle(op)) {
      instance = new StatePrepareAnalysis(parsed, context);
    } else if (StateSimilaritySearch.canHandle(op)) {
      instance = new StateSimilaritySearch(parsed, context);
    } else if (StateDeleteRecord.canHandle(op)) {
      instance = new StateDeleteRecord(parsed, context);
    } else {
      throw new Error(`${op} not implemented`);
    }

    const responseData = await instance.process();

    console.log('responseData', JSON.stringify(responseData, null, 2));
    return responseData;
  } catch (e) {
    console.log(e);
    throw e;
  }
};
