// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  join,
} = require('node:path');
const {
  SearchFacesByImageCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes: {
    Rekognition: {
      FaceMatch,
    },
  },
  CommonUtils,
  FrameCaptureModeHelper: {
    computeFrameNumAndTimestamp,
  },
  FaceIndexer,
  JimpHelper: {
    MIME_JPEG,
    imageFromS3,
  }
} = require('core-lib');
const BaseDetectFrameIterator = require('../shared/baseDetectFrameIterator');

const {
  makeFrameCaptureFileName
} = BaseDetectFrameIterator;
const {
  faceIdToNumber,
  resolveExternalImageId,
} = FaceIndexer;

const DEBUG_LOCAL = (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined);

const NAMED_KEY = 'Persons';
const FACEMATCH_QUALITY = 'LOW';
const FACEMATCH_MIN_WIDTH = 40;
const FACEMATCH_MIN_HEIGHT = 40;
const MAX_PITCH = 90;
const MAX_ROLL = 90;
const MAX_YAW = 90;
const MAX_FACES_PER_IMAGE = 5;
const ENABLE_QUALITY_CHECK = false;

class DetectFaceMatchIterator extends BaseDetectFrameIterator {
  constructor(stateData) {
    super(stateData, FaceMatch, NAMED_KEY);
    const data = stateData.data[FaceMatch];

    this.$faceCollectionId = data.faceCollectionId;
    this.$recognizedFaces = [];
    this.$cachedImage = undefined;
    this.$faceIndexer = new FaceIndexer();

    this.$paramOptions = {
      CollectionId: this.faceCollectionId,
      FaceMatchThreshold: data.minConfidence,
      QualityFilter: FACEMATCH_QUALITY,
      MaxFaces: 1,
    };
  }

  get [Symbol.toStringTag]() {
    return 'DetectFaceMatchIterator';
  }

  get faceCollectionId() {
    return this.$faceCollectionId;
  }

  get recognizedFaces() {
    return this.$recognizedFaces;
  }

  set recognizedFaces(val) {
    this.$recognizedFaces = val;
  }

  get cachedImage() {
    return this.$cachedImage;
  }

  set cachedImage(val) {
    this.$cachedImage = val;
  }

  get faceIndexer() {
    return this.$faceIndexer;
  }

  async detectFrame(bucket, key, frameNo, timestamp, options, boundingbox) {
    const params = this.makeParams(bucket, key, {
      ...this.paramOptions,
      ...options,
    });

    const command = new SearchFacesByImageCommand(params);

    let response = await this.detectFn(command)
      .then((res) =>
        this.amendSearchFacesByImageResponse(
          res,
          frameNo,
          timestamp,
          boundingbox
        ));

    response = await response;

    return response;
  }

  parseFaceMatchResult(data, frameNo, timestamp, boundingbox) {
    if (!data
      || !data.SearchedFaceConfidence
      || !data.FaceMatches
      || !data.FaceMatches.length) {
      return undefined;
    }

    if (!this.modelMetadata) {
      this.modelMetadata = {
        FaceModelVersion: data.FaceModelVersion,
      };
    }

    const minConfidence = this.minConfidence;
    const bestMatched = data.FaceMatches
      .sort((a, b) =>
        b.Similarity - a.Similarity)
      .shift();
    if (!bestMatched
      || bestMatched.Similarity < minConfidence
      || !(bestMatched.Face || {}).ExternalImageId) {
      return undefined;
    }

    const index = faceIdToNumber(bestMatched.Face.FaceId);
    bestMatched.Similarity = Number(bestMatched.Similarity.toFixed(2));

    const matchedFaces = [
      {
        Timestamp: timestamp,
        FrameNumber: frameNo,
        Person: {
          Index: index,
          Confidence: Number(data.SearchedFaceConfidence.toFixed(2)),
          Face: {
            BoundingBox: boundingbox || data.SearchedFaceBoundingBox,
          },
        },
        FaceMatches: [bestMatched],
      },
    ];

    this.recognizedFaces = this.recognizedFaces.concat(matchedFaces);

    return matchedFaces;
  }

  getUniqueNames(dataset) {
    const faceIdMap = {};
    for (const record of dataset) {
      const { Face: face } = record.FaceMatches[0];
      const {
        Name: name,
        FaceId: faceId,
        ExternalImageId: externalImageId,
      } = face;

      if (faceIdMap[faceId]) {
        // update the Name field if it is an actual face (not faceId)
        if (!name && faceIdMap[faceId] !== faceId) {
          face.Name = faceIdMap[faceId];
        }
      } else {
        faceIdMap[faceId] = name || resolveExternalImageId(externalImageId, faceId);
      }
    }

    const uniqueNames = Object.values(faceIdMap);
    return uniqueNames;
  }

  async processFrame(
    bucket,
    prefix,
    idx,
    faces = []
  ) {
    const {
      data: { [this.subCategory]: data },
    } = this.stateData;
    const { frameCapture, framerate } = data;

    const [frameNo, timestamp] = computeFrameNumAndTimestamp(idx, framerate, frameCapture);

    const name = makeFrameCaptureFileName(idx);
    const frame = { frameNo, timestamp, name };

    return await this.processFrame2(bucket, prefix, frame, faces);
  }

  async matchFaces(
    bucket,
    key,
    frameNo,
    timestamp,
    faces
  ) {
    // if fail to load image, fall back to default api call
    const image = await imageFromS3(bucket, key);
    if (!image) {
      return undefined;
    }

    // cache the image for other process to use
    this.cachedImage = image;

    let filtered = faces.slice(0);
    if (ENABLE_QUALITY_CHECK) {
      filtered = [];

      const imgW = image.bitmap.width;
      const imgH = image.bitmap.height;
      for (const face of faces) {
        let {
          Face: {
            BoundingBox: { Width: w, Height: h },
            Pose: { Roll: roll, Pitch: pitch, Yaw: yaw },
          },
        } = face;
        w = Math.round(imgW * w);
        h = Math.round(imgH * h);

        if (w < FACEMATCH_MIN_WIDTH || h < FACEMATCH_MIN_HEIGHT) {
          continue;
        }

        // if pose is defined, check the Yaw, Pitch, Roll
        pitch = Math.abs(pitch);
        if (pitch > MAX_PITCH) {
          continue;
        }

        roll = Math.abs(roll);
        if (roll > MAX_ROLL) {
          continue;
        }

        yaw = Math.abs(yaw);
        if (yaw > MAX_YAW) {
          continue;
        }

        filtered.push(face);
      }
    }

    // crop faces from image and recursively runs search face apis
    if (filtered.length > MAX_FACES_PER_IMAGE) {
      filtered.sort((a, b) => {
        const { Face: { BoundingBox: { Width: aW, Height: aH } } } = a;
        const { Face: { BoundingBox: { Width: bW, Height: bH } } } = b;
        return (bW * bH) - (aW * aH);
      });
      filtered = filtered.slice(0, MAX_FACES_PER_IMAGE);
    }

    let promises = [];
    for (const { Face: { BoundingBox: bbox } } of filtered) {
      promises.push(this.cropAndMatchFace(image, bbox, frameNo, timestamp));
    }
    promises = await Promise.all(promises);

    return promises
      .filter((x) => x)
      .reduce((a0, c0) =>
        a0.concat(c0), []);
  }

  async cropAndMatchFace(
    image,
    box,
    frameNo,
    timestamp
  ) {
    const imgW = image.bitmap.width;
    const imgH = image.bitmap.height;

    let { Top: t, Left: l, Width: w, Height: h } = box;
    l = Math.round(l * imgW);
    t = Math.round(t * imgH);
    w = (Math.round(w * imgW) >> 1) << 1;
    h = (Math.round(h * imgH) >> 1) << 1;

    // scale the bounding box
    const scaleW = Math.min(imgW, (Math.round(w * 1.5) >> 1) << 1);
    const scaleH = Math.min(imgH, (Math.round(h * 1.5) >> 1) << 1);

    l = Math.max(0, l - Math.ceil((scaleW - w) / 2));
    t = Math.max(0, t - Math.ceil((scaleH - h) / 2));
    w = scaleW;
    h = scaleH;

    // check out of bound
    if ((l + w) > imgW) {
      w = imgW - l;
    }
    if ((t + h) > imgH) {
      h = imgH - t;
    }

    // crop face
    let cropped = image
      .clone()
      .crop(l, t, w, h);

    if (DEBUG_LOCAL) {
      const origW = Math.round(box.Width * imgW);
      const origH = Math.round(box.Height * imgH);
      const name = `${frameNo}-${origW}x${origH}.jpg`;
      let prefix = '_facematch';
      if (origW < 40 || origH < 40) {
        prefix = join(prefix, 'supersmallfaces');
      } else if (origW < 48 || origH < 48) {
        prefix = join(prefix, 'smallfaces');
      }
      await cropped.writeAsync(join(prefix, name));
    }

    cropped = await cropped.getBufferAsync(MIME_JPEG);

    const params = {
      Image: {
        Bytes: cropped,
      },
    };

    return this.detectFrame(
      undefined,
      undefined,
      frameNo,
      timestamp,
      params,
      box
    );
  }

  async processFrame2(
    bucket,
    prefix,
    frame,
    faces = []
  ) {
    const { frameNo, timestamp, name } = frame;

    this.recognizedFaces = [];
    this.cachedImage = undefined;

    let facesInFrame = faces;
    if (facesInFrame.length === 0) {
      const item = (this.faceapiMap || {})[String(frameNo)];
      if (item !== undefined) {
        facesInFrame = item.faces;
      }
    }

    if (facesInFrame.length === 0) {
      return undefined;
    }

    const key = join(prefix, name);
    const dataset = await this.matchFaces(
      bucket,
      key,
      frameNo,
      timestamp,
      facesInFrame
    );

    if (dataset === undefined) {
      return dataset;
    }

    if (frame.extendFrameDuration !== undefined) {
      for (const item of dataset) {
        item.ExtendFrameDuration = frame.extendFrameDuration;
      }
    }
    this.dataset = this.dataset.concat(dataset);

    return dataset;
  }

  async amendSearchFacesByImageResponse(
    data,
    frameNo,
    timestamp,
    boundingbox
  ) {
    if (!data
      || !data.SearchedFaceConfidence
      || !data.FaceMatches
      || !data.FaceMatches.length
    ) {
      return undefined;
    }

    // lookup faceId <-> celeb
    const faceMap = {};
    for (const facematch of data.FaceMatches) {
      const { Face: { FaceId: faceId } } = facematch;
      if (faceMap[faceId] === undefined) {
        faceMap[faceId] = [];
      }
      faceMap[faceId].push(facematch);
    }

    const faceIds = Object.keys(faceMap);
    if (faceIds.length > 0) {
      await this.faceIndexer.batchGet(faceIds);
      for (const faceId of faceIds) {
        const found = this.faceIndexer.lookup(faceId);
        for (const { Face: face } of faceMap[faceId]) {
          face.Name = (found || {}).celeb || resolveExternalImageId(face.ExternalImageId, false);
        }
      }
    }

    return this.parseFaceMatchResult(
      data,
      frameNo,
      timestamp,
      boundingbox
    );
  }

  skipFrame(frame = {}) {
    let skipped = super.skipFrame(frame);
    if (skipped) {
      return skipped;
    }

    // skip if there is no face in the image
    if (this.faceapiMap !== undefined) {
      const { frameNo } = frame;
      const { faces = [] } = this.faceapiMap[String(frameNo)] || {};
      if (faces.length === 0) {
        skipped = true;
      }
    }

    return skipped;
  }
}

module.exports = DetectFaceMatchIterator;
