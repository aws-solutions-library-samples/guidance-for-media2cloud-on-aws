// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const CRYPTO = require('crypto');
const JIMP = require('jimp');
const {
  AnalysisTypes,
  CommonUtils,
} = require('core-lib');
const BaseDetectFrameIterator = require('../shared/baseDetectFrameIterator');

/**
 * WORKAROUND: JIMP 0.16.1 (0.9.6 doesn't have the issue.)
 * jpeg-js decoder throws an error when maxMemoryUsageInMB > 512
 * Reference: https://github.com/oliver-moran/jimp/issues/915
 */
const JpegDecoder = JIMP.decoders['image/jpeg'];
JIMP.decoders['image/jpeg'] = (data) =>
  JpegDecoder(data, {
    maxResolutionInMP: 200,
    maxMemoryUsageInMB: 2048,
  });

const SUBCATEGORY = AnalysisTypes.Rekognition.FaceMatch;
const NAMED_KEY = 'Persons';
const FACEMATCH_QUALITY = 'LOW';
const FACEMATCH_MIN_WIDTH = 50;
const FACEMATCH_MIN_HEIGHT = 50;

class DetectFaceMatchIterator extends BaseDetectFrameIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    const data = stateData.data[SUBCATEGORY];
    this.$paramOptions = {
      CollectionId: data.faceCollectionId,
      FaceMatchThreshold: data.minConfidence,
      QualityFilter: FACEMATCH_QUALITY,
      MaxFaces: 1,
    };
  }

  get [Symbol.toStringTag]() {
    return 'DetectFaceMatchIterator';
  }

  async detectFrame(bucket, key, frameNo, timestamp, options, boundingbox) {
    const fn = this.rekog.searchFacesByImage.bind(this.rekog);
    const params = this.makeParams(bucket, key, {
      ...this.paramOptions,
      ...options,
    });
    return this.detectFn(fn, params)
      .then(result =>
        this.parseFaceMatchResult(result, frameNo, timestamp, boundingbox));
  }

  parseFaceMatchResult(data, frameNo, timestamp, boundingbox) {
    const id = ((((data || {}).FaceMatches || [])[0] || {}).Face || {}).ExternalImageId;
    return (!id)
      ? undefined
      : [
        {
          Timestamp: timestamp,
          FrameNumber: frameNo,
          Person: {
            /* use ExternalImageId to generate an unique integer */
            Index: CRYPTO.createHash('sha256').update(id).digest()
              .reduce((a0, c0) => a0 + c0, 0),
            BoundingBox: boundingbox || data.SearchedFaceBoundingBox,
            Confidence: data.SearchedFaceConfidence,
          },
          FaceMatches: data.FaceMatches,
        },
      ];
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    let keys = data.reduce((a0, c0) =>
      a0.concat((c0.FaceMatches || []).map(x0 =>
        (x0.Face || {}).ExternalImageId).filter(x => x)), []);
    keys = [...new Set(keys)];
    while (keys.length) {
      const key = keys.shift();
      const unique = new Set(mapData[key]);
      unique.add(seqFile);
      mapData[key] = [...unique];
    }
    return mapData;
  }

  async processFrame(idx, faces) {
    if (!faces) {
      return super.processFrame(idx);
    }
    const data = this.stateData.data[this.subCategory];
    const frameCapture = data.frameCapture;
    const [
      frameNo,
      timestamp,
    ] = BaseDetectFrameIterator.computeFrameNumAndTimestamp(
      idx,
      data.framerate,
      frameCapture.numerator,
      frameCapture.denominator
    );
    const name = BaseDetectFrameIterator.makeFrameCaptureFileName(idx);
    const key = PATH.join(frameCapture.prefix, name);
    const dataset = await this.matchFaces(data.bucket, key, frameNo, timestamp, faces);
    if (dataset) {
      this.dataset.splice(this.dataset.length, 0, ...dataset);
    }
    return dataset;
  }

  async matchFaces(bucket, key, frameNo, timestamp, faces) {
    /* #1: if faces is empty, match the largest face in a frame */
    if (!faces || !faces.length) {
      return this.detectFrame(bucket, key, frameNo, timestamp);
    }
    /* #2: match all faces in a frame if image is loaded */
    const image = await this.loadImage(bucket, key);
    if (!image) {
      return this.detectFrame(bucket, key, frameNo, timestamp);
    }
    const facematches = await Promise.all(faces.map(x =>
      this.cropAndMatchFace(image, x.Face.BoundingBox, frameNo, timestamp)));
    return facematches
      .filter(x => x)
      .reduce((a0, c0) => a0.concat(c0), []);
  }

  async cropAndMatchFace(image, box, frameNo, timestamp) {
    /* ensure coord is not out of bound */
    let w = Math.round(image.width * box.Width);
    let h = Math.round(image.height * box.Height);
    w = (Math.min(Math.max(w, 0), image.width) >> 1) << 1;
    h = (Math.min(Math.max(h, 0), image.height) >> 1) << 1;
    /* ensure face is large enough */
    if (w < FACEMATCH_MIN_WIDTH || h < FACEMATCH_MIN_HEIGHT) {
      return undefined;
    }
    let l = Math.round(image.width * box.Left);
    let t = Math.round(image.height * box.Top);
    l = Math.min(Math.max(l, 0), image.width - w);
    t = Math.min(Math.max(t, 0), image.height - h);

    // crop face
    let cropped = image
      .clone()
      .crop(l, t, w, h);
    cropped = await cropped.getBufferAsync(JIMP.MIME_JPEG);

    const params = {
      Image: {
        Bytes: cropped,
      },
    };
    return this.detectFrame(undefined, undefined, frameNo, timestamp, params, box);
  }

  async loadImage(bucket, key) {
    const signed = CommonUtils.getSignedUrl({
      Bucket: bucket,
      Key: key,
    });
    return new Promise((resolve, reject) => {
      JIMP.read(signed, (e, img) => {
        if (e) {
          console.error(e);
          reject(e);
          return;
        }
        resolve(img);
      });
    });
  }
}

module.exports = DetectFaceMatchIterator;
