// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  AnalysisTypes,
  CommonUtils,
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

    this.$detections = [{
      instance: new DetectFaceIterator(stateData),
      subCategory: SUBCATEGORY_FACE,
    }];

    if (data[SUBCATEGORY_CELEB]) {
      this.$detections.push({
        instance: new DetectCelebIterator(stateData),
        subCategory: SUBCATEGORY_CELEB,
      });
    }

    if (data[SUBCATEGORY_FACEMATCH]) {
      this.$detections.push({
        instance: new DetectFaceMatchIterator(stateData),
        subCategory: SUBCATEGORY_FACEMATCH,
      });
    }
  }

  get [Symbol.toStringTag]() {
    return 'DetectIdentityComboIterator';
  }

  get detections() {
    return this.$detections;
  }

  get faceDetection() {
    return (this.detections
      .find((x) =>
        x.subCategory === SUBCATEGORY_FACE) || {})
      .instance;
  }

  get celebDetection() {
    return (this.detections
      .find((x) =>
        x.subCategory === SUBCATEGORY_CELEB) || {})
      .instance;
  }

  get facematchDetection() {
    return (this.detections
      .find((x) =>
        x.subCategory === SUBCATEGORY_FACEMATCH) || {})
      .instance;
  }

  async process() {
    const instance = this.detections[0].instance;
    if (instance.stateData.data.framesegmentation) {
      return this.processWithFrameSegmentation();
    }

    const subCategory = this.detections[0].subCategory;
    const data = instance.stateData.data[subCategory];

    const bucket = data.bucket;
    const prefix = data.frameCapture.prefix;
    const numFrames = data.frameCapture.numFrames;

    const startTime = Date.now();
    this.detections.forEach((x) => {
      const subcategory = x.instance.stateData.data[x.subCategory];
      subcategory.startTime = subcategory.startTime || startTime;
    });

    let lambdaTimeout = false;

    const t0 = new Date();
    while (!lambdaTimeout && data.cursor < numFrames) {
      await this.processFrame(
        bucket,
        prefix,
        data.cursor
      );

      this.detections.forEach((x) => {
        const subcategory = x.instance.stateData.data[x.subCategory];
        subcategory.cursor += 1;
      });

      /* make sure we allocate enough time for the next iteration */
      lambdaTimeout = this.quitNow();
    }

    await Promise.all(this.detections
      .map((x) => {
        const xInstance = x.instance;
        const outPrefix = xInstance.makeRawDataPrefix(x.subCategory);
        const dataset = xInstance.dataset;
        xInstance.mapData = xInstance.getUniqueNames(dataset);

        return xInstance.updateOutputs(
          bucket,
          outPrefix
        );
      }));

    const consumed = new Date() - t0;
    const remained = this.getRemainingTime();
    console.log(`COMPLETED: frame #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);

    return (data.cursor >= numFrames)
      ? this.setCompleted()
      : this.setProgress(Math.round((data.cursor / numFrames) * 100));
  }

  getRemainingTime() {
    const instance = this.detections[0].instance;
    return instance.stateData.getRemainingTime();
  }

  quitNow() {
    const instance = this.detections[0].instance;
    return instance.stateData.quitNow();
  }

  async processFrame(
    bucket,
    prefix,
    idx
  ) {
    const dataset = await this.faceDetection.processFrame(
      bucket,
      prefix,
      idx
    );

    const faces = this.getFaces(dataset);
    /* no face found, skip celeb and facematch */
    if (!faces || !faces.length) {
      return undefined;
    }

    const promises = [];
    if (this.celebDetection) {
      promises.push(this.celebDetection.processFrame(
        bucket,
        prefix,
        idx
      ));
    }
    if (this.facematchDetection) {
      promises.push(this.facematchDetection.processFrame(
        bucket,
        prefix,
        idx,
        faces
      ));
    }

    return Promise.all(promises);
  }

  getFaces(faces) {
    return (faces || [])
      .sort((a, b) => {
        const a0 = a.Face.BoundingBox;
        const b0 = b.Face.BoundingBox;
        return (b0.Width * b0.Height) - (a0.Width * a0.Height);
      })
      .slice(0, MAX_FACEMATCH_PER_IMAGE);
  }

  setCompleted() {
    const endTime = Date.now();

    const stateData = this.faceDetection.setCompleted();
    stateData.data[SUBCATEGORY_FACE].endTime = endTime;

    if (this.celebDetection) {
      this.celebDetection.setCompleted();
      stateData.data[SUBCATEGORY_CELEB] =
        this.celebDetection.stateData.data[SUBCATEGORY_CELEB];
      stateData.data[SUBCATEGORY_CELEB].endTime = endTime;
    }

    if (this.facematchDetection) {
      this.facematchDetection.setCompleted();
      stateData.data[SUBCATEGORY_FACEMATCH] =
        this.facematchDetection.stateData.data[SUBCATEGORY_FACEMATCH];
      stateData.data[SUBCATEGORY_FACEMATCH].endTime = endTime;
    }

    return stateData;
  }

  setProgress(pencentage) {
    const stateData = this.faceDetection.setProgress(pencentage);

    if (this.celebDetection) {
      this.celebDetection.setProgress(pencentage);
      stateData.data[SUBCATEGORY_CELEB] =
        this.celebDetection.stateData.data[SUBCATEGORY_CELEB];
    }

    if (this.facematchDetection) {
      this.facematchDetection.setProgress(pencentage);
      stateData.data[SUBCATEGORY_FACEMATCH] =
        this.facematchDetection.stateData.data[SUBCATEGORY_FACEMATCH];
    }

    return stateData;
  }

  async processWithFrameSegmentation() {
    const instance = this.detections[0].instance;
    const subCategory = this.detections[0].subCategory;
    const data = instance.stateData.data[subCategory];

    const bucket = data.bucket;
    const frameSegmentationJson = instance.stateData.data.framesegmentation.key;
    const frameSegmentation = await CommonUtils.download(bucket, frameSegmentationJson)
      .then((res) =>
        JSON.parse(res));

    console.log(
      '=== Using processWithFrameSegmentation: numFrames:',
      frameSegmentation.length
    );

    const numFrames = frameSegmentation.length;
    const prefix = PATH.parse(frameSegmentationJson).dir;

    const startTime = Date.now();
    this.detections.forEach((x) => {
      const subcategory = x.instance.stateData.data[x.subCategory];
      subcategory.startTime = subcategory.startTime || startTime;
    });

    let lambdaTimeout = false;

    const t0 = new Date();
    while (!lambdaTimeout && data.cursor < numFrames) {
      const frame = frameSegmentation[data.cursor];
      await this.processFrame2(
        bucket,
        prefix,
        frame
      );

      this.detections.forEach((x) => {
        const subcategory = x.instance.stateData.data[x.subCategory];
        subcategory.cursor += 1;
      });

      /* make sure we allocate enough time for the next iteration */
      lambdaTimeout = this.quitNow();
    }

    await Promise.all(this.detections
      .map((x) => {
        const xInstance = x.instance;
        const outPrefix = xInstance.makeRawDataPrefix(x.subCategory);
        const dataset = xInstance.dataset;
        xInstance.mapData = xInstance.getUniqueNames(dataset);

        return xInstance.updateOutputs(
          bucket,
          outPrefix
        );
      }));

    const consumed = new Date() - t0;
    const remained = this.getRemainingTime();
    console.log(`COMPLETED: frame #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);

    if (data.cursor >= numFrames) {
      return this.setCompleted();
    }

    let percentage = (data.cursor / numFrames) * 100;
    percentage = Math.round(percentage);

    return this.setProgress(percentage);
  }

  async processFrame2(
    bucket,
    prefix,
    frame
  ) {
    const dataset = await this.faceDetection.processFrame2(
      bucket,
      prefix,
      frame
    );

    const faces = this.getFaces(dataset);
    /* no face found, skip celeb and facematch */
    if (!faces || !faces.length) {
      return undefined;
    }

    const promises = [];
    if (this.celebDetection) {
      promises.push(this.celebDetection.processFrame2(
        bucket,
        prefix,
        frame
      ));
    }
    if (this.facematchDetection) {
      promises.push(this.facematchDetection.processFrame2(
        bucket,
        prefix,
        frame,
        faces
      ));
    }

    return Promise.all(promises);
  }
}

module.exports = DetectIdentityComboIterator;
