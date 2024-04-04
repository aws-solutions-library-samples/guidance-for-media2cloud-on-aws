// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisTypes: {
    Rekognition,
  },
} = require('core-lib');
const IndexCelebIterator = require('../index-celeb');
const IndexFaceIterator = require('../index-face');
const IndexFaceMatchIterator = require('../index-face-match');

const SUBCATEGORY_CELEB = Rekognition.Celeb;
const SUBCATEGORY_FACE = Rekognition.Face;
const SUBCATEGORY_FACEMATCH = Rekognition.FaceMatch;

class IndexComboIterator {
  constructor(stateData) {
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'IndexComboIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const data = this.stateData.data;

    let promises = [
      SUBCATEGORY_CELEB,
      SUBCATEGORY_FACE,
      SUBCATEGORY_FACEMATCH,
    ].map((subCategory) => {
      let iterator;

      if (data[subCategory] === undefined) {
        return true;
      }

      if (subCategory === SUBCATEGORY_CELEB) {
        iterator = new IndexCelebIterator(this.stateData);
      } else if (subCategory === SUBCATEGORY_FACE) {
        iterator = new IndexFaceIterator(this.stateData);
      } else if (subCategory === SUBCATEGORY_FACEMATCH) {
        iterator = new IndexFaceMatchIterator(this.stateData);
      }

      if (iterator === undefined) {
        return true;
      }

      return iterator.process()
        .then((res) => {
          data[subCategory] = res.data[subCategory];
          return (res.status === StateData.Statuses.Completed);
        });
    });

    promises = await Promise.all(promises);

    let done = 0;
    promises.forEach((x) => {
      if (x !== false) {
        done += 1;
      }
    });

    if (done === promises.length) {
      this.stateData.setCompleted();
    } else {
      const percentage = Math.round((done / promises.length) * 100);
      this.stateData.setProgress(percentage);
    }

    return this.stateData.toJSON();
  }
}

module.exports = IndexComboIterator;
