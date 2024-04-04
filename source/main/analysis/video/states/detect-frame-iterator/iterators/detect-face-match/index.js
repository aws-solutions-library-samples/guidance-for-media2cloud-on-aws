// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SearchFacesByImageCommand,
} = require('@aws-sdk/client-rekognition');
const PATH = require('path');
const JIMP = require('jimp');
const {
  AnalysisTypes: {
    Rekognition: {
      FaceMatch,
    },
  },
  CommonUtils,
  FrameCaptureModeHelper,
  FaceIndexer,
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

const NAMED_KEY = 'Persons';
const FACEMATCH_QUALITY = 'LOW';
const FACEMATCH_MIN_WIDTH = 60;
const FACEMATCH_MIN_HEIGHT = 60;
const MAX_PITCH = 50;
const MAX_ROLL = 50;
const MAX_YAW = 50;
const MAX_FACES_PER_IMAGE = 5;

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

    const index = FaceIndexer.faceIdToNumber(bestMatched.Face.FaceId);
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
    return [
      ...new Set(dataset
        .map((x) => {
          const face = x.FaceMatches[0].Face;
          const faceId = face.FaceId;

          let name = face.Name;
          if (!name) {
            name = FaceIndexer.resolveExternalImageId(
              face.ExternalImageId,
              faceId
            );
          }
          return name;
        })),
    ];
  }

  async processFrame(
    bucket,
    prefix,
    idx,
    faces
  ) {
    this.recognizedFaces = [];
    this.cachedImage = undefined;

    if (!faces || faces.length === 0) {
      return super.processFrame(
        bucket,
        prefix,
        idx
      );
    }

    const data = this.stateData.data[this.subCategory];
    const frameCapture = data.frameCapture;
    const [
      frameNo,
      timestamp,
    ] = FrameCaptureModeHelper.computeFrameNumAndTimestamp(
      idx,
      data.framerate,
      frameCapture
    );

    const name = BaseDetectFrameIterator.makeFrameCaptureFileName(idx);
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(frameCapture.prefix, name);

    const dataset = await this.matchFaces(
      data.bucket,
      key,
      frameNo,
      timestamp,
      faces
    );

    if (dataset) {
      this.dataset = this.dataset.concat(dataset);
    }

    return dataset;
  }

  async matchFaces(
    bucket,
    key,
    frameNo,
    timestamp,
    faces
  ) {
    // if fail to load image, fall back to default api call
    const image = await this.loadImage(bucket, key);
    if (!image) {
      return this.detectFrame(
        bucket,
        key,
        frameNo,
        timestamp
      );
    }

    // cache the image for other process to use
    this.cachedImage = image;

    // crop faces from image and recursively runs search face apis
    const imgW = image.bitmap.width;
    const imgH = image.bitmap.height;

    let filtered = [];
    faces.forEach((face, idx) => {
      const w = Math.round(imgW * face.Face.BoundingBox.Width);
      const h = Math.round(imgH * face.Face.BoundingBox.Height);
      if (w < FACEMATCH_MIN_WIDTH || h < FACEMATCH_MIN_HEIGHT) {
        return;
      }

      // if pose is defined, check the Yaw, Pitch, Roll
      const pose = face.Face.Pose;
      if (Math.abs(pose.Pitch) > MAX_PITCH) {
        return;
      }
      if (Math.abs(pose.Roll) > MAX_ROLL) {
        return;
      }
      if (Math.abs(pose.Yaw) > MAX_YAW) {
        return;
      }

      filtered.push(face);
    });

    if (filtered.length > MAX_FACES_PER_IMAGE) {
      filtered = filtered
        .sort((a, b) =>
          (b.Face.BoundingBox.Width * b.Face.BoundingBox.Height) -
          (a.Face.BoundingBox.Width * a.Face.BoundingBox.Height))
        .slice(0, MAX_FACES_PER_IMAGE);
    }

    const facematches = await Promise.all(filtered
      .map((face) =>
        this.cropAndMatchFace(
          image,
          face.Face.BoundingBox,
          frameNo,
          timestamp
        )));

    return facematches
      .filter((x) =>
        x)
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

    // ensure coord not out of bound
    let w = Math.round(imgW * box.Width);
    let h = Math.round(imgH * box.Height);
    w = (Math.min(Math.max(w, 0), imgW) >> 1) << 1;
    h = (Math.min(Math.max(h, 0), imgH) >> 1) << 1;

    let l = Math.round(imgW * box.Left);
    let t = Math.round(imgH * box.Top);
    l = Math.min(Math.max(l, 0), imgW - w);
    t = Math.min(Math.max(t, 0), imgH - h);

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

    return this.detectFrame(
      undefined,
      undefined,
      frameNo,
      timestamp,
      params,
      box
    );
  }

  async loadImage(bucket, key) {
    const signed = await CommonUtils.getSignedUrl({
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

  async processFrame2(
    bucket,
    prefix,
    frame,
    faces
  ) {
    this.recognizedFaces = [];
    this.cachedImage = undefined;

    if (faces === undefined) {
      return super.processFrame2(
        bucket,
        prefix,
        frame
      );
    }

    if (faces.length === 0) {
      return undefined;
    }

    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(prefix, frame.name);

    const dataset = await this.matchFaces(
      bucket,
      key,
      frame.frameNo,
      frame.timestamp,
      faces
    );

    if (dataset) {
      this.dataset = this.dataset.concat(dataset);
    }
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
    const facesToGet = [];

    data.FaceMatches
      .forEach((x) => {
        const face = x.Face;
        const found = this.faceIndexer.lookup(face.FaceId);
        if (found === undefined) {
          facesToGet.push(face);
        } else if (found && found.celeb) {
          face.Name = found.celeb;
        }
      });

    if (facesToGet.length > 0) {
      const faceIds = facesToGet
        .map((x) =>
          x.FaceId);

      await this.faceIndexer.batchGet(faceIds)
        .then((res) => {
          // try look up again!
          if (res.length > 0) {
            facesToGet.forEach((face) => {
              const found = this.faceIndexer.lookup(face.FaceId);
              if (found && found.celeb) {
                face.Name = found.celeb;
              } else {
                // do not return external image id if it can't resolve the name!
                face.Name = FaceIndexer.resolveExternalImageId(
                  face.ExternalImageId,
                  false
                );
              }
            });
          }
          return res;
        });
    }

    return this.parseFaceMatchResult(
      data,
      frameNo,
      timestamp,
      boundingbox
    );
  }
}

module.exports = DetectFaceMatchIterator;
