// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  Worker,
  SHARE_ENV,
} = require('node:worker_threads');
const {
  AnalysisTypes: {
    Rekognition: {
      Celeb,
      Face,
      FaceMatch,
    },
  },
  StateData,
} = require('core-lib');

const WORKER_JS = 'worker.js';

class CreateComboTrackIterator {
  constructor(stateData) {
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'CreateComboTrackIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const progress = await this.spawnWorkerTheads();

    if (progress >= 100) {
      this.stateData.setCompleted();
    } else {
      this.stateData.setProgress(progress);
    }

    return this.stateData;
  }

  async spawnWorkerTheads() {
    let nWorkers = 0;
    let promises = [];

    // parameters for worker to re-create StateData object
    const stateData = this.stateData;
    const params = {
      stateMachine: stateData.stateMachine,
      event: stateData.event,
      context: JSON.parse(JSON.stringify(stateData.context)),
    };

    const data = stateData.data;
    [
      Celeb,
      Face,
      FaceMatch,
    ].forEach((subCategory) => {
      if (data[subCategory]) {
        promises.push(this.createWorkerThread(
          nWorkers++,
          subCategory,
          params
        ));
      }
    });

    if (promises.length === 0) {
      return 100;
    }

    promises = await Promise.all(promises);

    let done = 0;
    for (let i = 0; i < promises.length; i += 1) {
      if (promises[i] === true) {
        done += 1;
      }
    }

    return Math.round((done / promises.length) * 100);
  }

  async createWorkerThread(
    workerId,
    subCategory,
    data
  ) {
    const remaining = this.stateData.getRemainingTime();
    const bufferTime = 60 * 1000;
    const curTime = Date.now();
    const deadline = curTime + (remaining - bufferTime);

    return new Promise((resolve, reject) => {
      console.log(`WorkerThread #${workerId}: ${subCategory}`);

      const parsed = PATH.parse(__filename);
      const file = PATH.join(parsed.dir, WORKER_JS);

      const worker = new Worker(file, {
        env: SHARE_ENV,
        workerData: {
          ...data,
          workerId,
          subCategory,
          deadline,
        },
      });

      const errors = [];
      let done = false;

      worker.on('message', (message) => {
        if (message.status !== undefined) {
          console.log(
            'worker.on.status',
            workerId,
            subCategory,
            JSON.stringify(message)
          );
          this.stateData.data[subCategory] = message[subCategory];
          if (message.status === StateData.Statuses.Completed) {
            done = true;
          }
        } else if (message.error) {
          console.error(
            'ERR:',
            'worker.on.error',
            workerId,
            subCategory,
            message.error
          );
          errors.push(`WorkerId #${workerId}: ${subCategory}: ${message.error}`);
        }
      });

      worker.on('error', (e) => {
        console.log(`ERR: WorkerId #${workerId}: ${subCategory}: ${e.code} ${e.message}`);
        reject(e);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(
            'ERR:',
            `WorkerThread #${workerId}: ${subCategory}`,
            'exitCode:',
            code
          );
          reject(new Error(`exitCode ${code}`));
          return;
        }

        if (errors.length > 0) {
          reject(new Error(errors.join(',')));
          return;
        }

        console.log(`WorkerThread #${workerId} [RETURNED]: done? ${done}`);
        resolve(done);
      });
    });
  }
}

module.exports = CreateComboTrackIterator;
