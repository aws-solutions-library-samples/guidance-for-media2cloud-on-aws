// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  workerData,
  parentPort,
} = require('worker_threads');
const {
  StateData,
  AnalysisTypes: {
    Rekognition: {
      Celeb,
      Face,
      FaceMatch,
    },
  },
} = require('core-lib');

const CreateCelebTrackIterator = require('../create-celeb-track');
const CreateFaceTrackIterator = require('../create-face-track');
const CreateFaceMatchTrackIterator = require('../create-face-match-track');

(async () => {
  try {
    console.log('workerData', JSON.stringify(workerData, null, 2));

    const missing = ['stateMachine', 'event', 'context', 'workerId', 'subCategory', 'deadline']
      .filter((x) =>
        workerData[x] === undefined);

    if (missing.length) {
      throw new Error(`missing workerData (${missing.join(', ')})`);
    }

    const {
      stateMachine,
      event,
      context,
      workerId,
      subCategory,
      deadline,
    } = workerData;

    // reconstruct getRemainingTimeInMillis from context
    const _context = {
      ...context,
      getRemainingTimeInMillis: () =>
        deadline - Date.now(),
    };
    const stateData = new StateData(
      stateMachine,
      event,
      _context
    );

    let instance;

    if (subCategory === Celeb) {
      instance = new CreateCelebTrackIterator(stateData);
    } else if (subCategory === Face) {
      instance = new CreateFaceTrackIterator(stateData);
    } else if (subCategory === FaceMatch) {
      instance = new CreateFaceMatchTrackIterator(stateData);
    } else {
      throw new Error(`${subCategory} not supported`);
    }

    const response = await instance.process();

    // signal parent
    parentPort.postMessage({
      workerId,
      status: response.status,
      progress: response.progress,
      [subCategory]: response.data[subCategory],
    });
  } catch (e) {
    console.error(e);
    console.log(
      'workerData',
      JSON.stringify(workerData, null, 2)
    );
    parentPort.postMessage({
      ...workerData,
      error: e.message,
    });
  }
})();
