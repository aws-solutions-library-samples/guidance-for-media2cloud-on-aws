// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  AnalysisTypes,
} = require('core-lib');
const DetectFaceIterator = require('../detect-face');
const DetectCelebIterator = require('../detect-celeb');
const DetectFaceMatchIterator = require('../detect-face-match');

const SUBCATEGORY_CELEB = AnalysisTypes.Rekognition.Celeb;
const SUBCATEGORY_FACE = AnalysisTypes.Rekognition.Face;
const SUBCATEGORY_FACEMATCH = AnalysisTypes.Rekognition.FaceMatch;
const MAX_FACEMATCH_PER_IMAGE = 5;

class DetectIdentityComboIterator {
  constructor(stateData) {
    const data = stateData.data;
    if (!data[SUBCATEGORY_FACE]) {
      throw new AnalysisTypes(`${SUBCATEGORY_FACE} must be specified`);
    }
    this.$faceDetection = new DetectFaceIterator(stateData);
    if (data[SUBCATEGORY_CELEB]) {
      this.$celebDetection = new DetectCelebIterator(stateData);
    }
    if (data[SUBCATEGORY_FACEMATCH]) {
      this.$facematchDetection = new DetectFaceMatchIterator(stateData);
    }
  }

  get [Symbol.toStringTag]() {
    return 'DetectIdentityComboIterator';
  }

  get faceDetection() {
    return this.$faceDetection;
  }

  get celebDetection() {
    return this.$celebDetection;
  }

  get facematchDetection() {
    return this.$facematchDetection;
  }

  async process() {
    const data = this.faceDetection.stateData.data[SUBCATEGORY_FACE];
    const numFrames = data.frameCapture.numFrames;
    const detections = [
      {
        instance: this.faceDetection,
        subCategory: SUBCATEGORY_FACE,
      },
      {
        instance: this.celebDetection,
        subCategory: SUBCATEGORY_CELEB,
      },
      {
        instance: this.facematchDetection,
        subCategory: SUBCATEGORY_FACEMATCH,
      },
    ];
    const startTime = Date.now();
    detections.map((x) => {
      if (!x.instance) {
        return undefined;
      }
      const subcategory = x.instance.stateData.data[x.subCategory];
      subcategory.startTime = subcategory.startTime || startTime;
      return startTime;
    });
    while (data.cursor < numFrames) {
      const t0 = new Date();
      await this.processFrame(data.cursor);
      await Promise.all(detections.map(x =>
        x.instance && x.instance.flushDataset()));
      detections.map(x =>
        x.instance && x.instance.stateData.data[x.subCategory].cursor++);
      /* make sure we allocate enough time for the next iteration */
      const remained = this.getRemainingTime();
      const consumed = new Date() - t0;
      console.log(`COMPLETED: frame #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);
      if (this.quitNow() || (remained - (consumed * 1.2) <= 0)) {
        break;
      }
    }
    await Promise.all(detections.map(x =>
      x.instance && x.instance.flushDataset(true)));
    return (data.cursor >= numFrames)
      ? this.setCompleted()
      : this.setProgress(Math.round((data.cursor / numFrames) * 100));
  }

  getRemainingTime() {
    return this.faceDetection.stateData.getRemainingTime();
  }

  quitNow() {
    return this.faceDetection.stateData.quitNow();
  }

  getFaces(faces) {
    return (faces || []).sort((a, b) => {
      const a0 = a.Face.BoundingBox;
      const b0 = b.Face.BoundingBox;
      return (b0.Width * b0.Height) - (a0.Width * a0.Height);
    }).slice(0, MAX_FACEMATCH_PER_IMAGE);
  }

  async processFrame(idx) {
    const dataset = await this.faceDetection.processFrame(idx);
    const faces = this.getFaces(dataset);
    /* no face found, skip celeb and facematch */
    if (!faces.length) {
      return undefined;
    }
    const promises = [];
    if (this.celebDetection) {
      promises.push(this.celebDetection.processFrame(idx));
    }
    if (this.facematchDetection) {
      promises.push(this.facematchDetection.processFrame(idx, faces));
    }
    return Promise.all(promises);
  }

  setCompleted() {
    const endTime = Date.now();
    this.faceDetection.stateData.setCompleted();
    const stateData = this.faceDetection.stateData.toJSON();
    stateData.data[SUBCATEGORY_FACE].endTime = endTime;
    if (this.celebDetection) {
      stateData.data[SUBCATEGORY_CELEB] =
        this.celebDetection.stateData.data[SUBCATEGORY_CELEB];
      stateData.data[SUBCATEGORY_CELEB].endTime = endTime;
    }
    if (this.facematchDetection) {
      stateData.data[SUBCATEGORY_FACEMATCH] =
        this.facematchDetection.stateData.data[SUBCATEGORY_FACEMATCH];
      stateData.data[SUBCATEGORY_FACEMATCH].endTime = endTime;
    }
    return stateData;
  }

  setProgress(pencentage) {
    this.faceDetection.stateData.setProgress(pencentage);
    const stateData = this.faceDetection.stateData.toJSON();
    if (this.celebDetection) {
      stateData.data[SUBCATEGORY_CELEB] =
        this.celebDetection.stateData.data[SUBCATEGORY_CELEB];
    }
    if (this.facematchDetection) {
      stateData.data[SUBCATEGORY_FACEMATCH] =
        this.facematchDetection.stateData.data[SUBCATEGORY_FACEMATCH];
    }
    return stateData;
  }
}

module.exports = DetectIdentityComboIterator;
