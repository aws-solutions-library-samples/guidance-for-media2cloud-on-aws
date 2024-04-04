// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment: {
    StateMachines: {
      Ingest,
      Analysis,
      AssetRemoval,
      UpdateFaceIndexer,
    },
  },
} = require('core-lib');

const IngestWorkflow = require('./lib/workflow/ingest');
const AnalysisWorkflow = require('./lib/workflow/analysis');
const AssetRemovalWorkflow = require('./lib/workflow/assetRemoval');
const UpdateFaceIndexerWorkflow = require('./lib/workflow/updateFaceIndexer');

exports.handler = async (event, context) => {
  let workflow;
  try {
    console.log(`event = ${JSON.stringify(event, null, 2)};`);

    const output = JSON.parse(event.detail.output);
    const stateMachine = event.detail.stateMachineArn
      .split(':')
      .pop();

    if (stateMachine === Ingest) {
      workflow = new IngestWorkflow(event, context);
    } else if (stateMachine === Analysis) {
      workflow = new AnalysisWorkflow(event, context);
    } else if (stateMachine === AssetRemoval) {
      workflow = new AssetRemovalWorkflow(event, context);
    } else if (stateMachine === UpdateFaceIndexer) {
      workflow = new UpdateFaceIndexerWorkflow(event, context);
    } else {
      throw new Error(`fail to find workflow for ${output.status}`);
    }

    const response = await workflow.process();
    console.log('response', response);

    return response;
  } catch (e) {
    console.error(e);
  } finally {
    if (workflow) {
      workflow.close();
    }
  }

  return event;
};
