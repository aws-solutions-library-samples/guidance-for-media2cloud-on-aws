// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const FS = require('node:fs');
const PATH = require('node:path');
const {
  DetectFacesCommand,
} = require('@aws-sdk/client-rekognition');
const Jimp = require('jimp');
const {
  AnalysisTypes: {
    Rekognition: {
      Celeb,
      FaceMatch,
    },
    AutoFaceIndexer,
  },
  CommonUtils,
  M2CException,
  FaceIndexer,
  JimpHelper,
} = require('core-lib');
const DetectCelebIterator = require('../detect-celeb');
const DetectFaceMatchIterator = require('../detect-face-match');
const {
  RunCommand,
} = require('../shared/baseDetectFrameIterator');

const DEBUG_ENABLED = (
  process.env.ENV_DEBUG !== undefined &&
  process.env.AWS_LAMBDA_FUNCTION_NAME === undefined
);

const MIN_SIMILARITY = 90;
const BBOX_MINCONFIDENCE = 98;
const PREFIX_FULLIMAGE = 'fullimage';

const DEFAULT_FILTER_SETINGS = {
  minFaceW: 64,
  minFaceH: 64,
  maxPitch: 26,
  maxRoll: 26,
  maxYaw: 26,
  minBrightness: 30,
  minSharpness: 12, // 18,
  minCelebConfidence: 100, // 99,
  // Laplacian Variance to check blurriness of the face
  minLaplacianVariance: 0, // 18,
};

let FilterSettings = DEFAULT_FILTER_SETINGS;

class AutoFaceIndexerIterator {
  constructor(stateData) {
    const data = stateData.data;

    if (!data[Celeb]) {
      throw new M2CException(`${Celeb} must be specified`);
    }

    if (DEBUG_ENABLED) {
      _createDir(AutoFaceIndexer);
    }

    _setFilterSettings((data[AutoFaceIndexer] || {}).filterSettings);

    this.$celebIterator = new DetectCelebIterator(stateData);
    this.$facematchIterator = new DetectFaceMatchIterator(stateData);

    if (data[AutoFaceIndexer].startTime === undefined) {
      data[AutoFaceIndexer].startTime = Date.now();
    }
    if (data[AutoFaceIndexer].facesIndexed === undefined) {
      data[AutoFaceIndexer].facesIndexed = 0;
    }
    if (data[AutoFaceIndexer].apiCount === undefined) {
      data[AutoFaceIndexer].apiCount = 0;
    }
    if (data[AutoFaceIndexer].faceApiCount === undefined) {
      data[AutoFaceIndexer].faceApiCount = 0;
    }
    this.$autoFaceIndexerData = data[AutoFaceIndexer];
    this.$faceIndexer = new FaceIndexer();
  }

  get [Symbol.toStringTag]() {
    return 'AutoFaceIndexerIterator';
  }

  get celebIterator() {
    return this.$celebIterator;
  }

  get facematchIterator() {
    return this.$facematchIterator;
  }

  get autoFaceIndexerData() {
    return this.$autoFaceIndexerData;
  }

  set autoFaceIndexerData(val) {
    this.$autoFaceIndexerData = val;
  }

  get faceIndexer() {
    return this.$faceIndexer;
  }

  async process() {
    const instance = this.celebIterator;

    if (instance.stateData.data.framesegmentation) {
      return this.processWithFrameSegmentation();
    }

    const data = instance.stateData.data[Celeb];

    const bucket = data.bucket;
    const prefix = data.frameCapture.prefix;
    const numFrames = data.frameCapture.numFrames;

    const iterators = [
      [this.celebIterator, Celeb],
      [this.facematchIterator, FaceMatch],
    ];

    const startTime = Date.now();

    iterators.forEach((x) => {
      const [
        iterator,
        subcategory,
      ] = x;
      const categoryData = iterator.stateData.data[subcategory];
      categoryData.startTime = categoryData.startTime || startTime;
    });

    let lambdaTimeout = false;

    const t0 = new Date();
    while (!lambdaTimeout && data.cursor < numFrames) {
      await this.processFrame(
        bucket,
        prefix,
        data.cursor
      );

      iterators.forEach((x) => {
        const [
          iterator,
          subcategory,
        ] = x;
        const categoryData = iterator.stateData.data[subcategory];
        categoryData.cursor += 1;
      });

      /* make sure we allocate enough time for the next iteration */
      lambdaTimeout = this.quitNow();
    }

    await Promise.all(iterators
      .map((x) => {
        const [
          iterator,
          subcategory,
        ] = x;
        const outPrefix = iterator.makeRawDataPrefix(subcategory);
        const dataset = iterator.dataset;
        iterator.mapData = iterator.getUniqueNames(dataset);

        return iterator.updateOutputs(
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
    const instance = this.celebIterator;
    return instance.stateData.getRemainingTime();
  }

  quitNow() {
    const instance = this.celebIterator;
    return instance.stateData.quitNow();
  }

  async processFrame(
    bucket,
    prefix,
    idx
  ) {
    const dataset = await this.celebIterator.processFrame(
      bucket,
      prefix,
      idx
    );

    const faces = this.getUnrecognizedFaces(dataset);
    /* no face found, skip celeb and facematch */
    if (!faces || !faces.length) {
      return undefined;
    }

    const promises = [];
    if (this.facematchIterator) {
      promises.push(this.facematchIterator.processFrame(
        bucket,
        prefix,
        idx,
        faces
      ));
    }

    return Promise.all(promises);
  }

  getUnrecognizedFaces(celebrities) {
    let unrecognizedFaces = [];

    if (!celebrities) {
      return unrecognizedFaces;
    }

    (celebrities.CelebrityFaces || [])
      .forEach((celeb) => {
        // filter out confidence higher than 99%
        if (Math.round(celeb.MatchConfidence) > FilterSettings.minCelebConfidence) {
          return;
        }

        // filter out boundingbox confidence less than 95%
        if (Math.round(celeb.Face.Confidence) < 95) {
          return;
        }

        const matched = {
          Face: {
            BoundingBox: celeb.Face.BoundingBox,
            Pose: celeb.Face.Pose,
            Quality: (celeb.Face || {}).Quality,
          },
          // optional
          Name: celeb.Name,
          Confidence: celeb.MatchConfidence,
          Gender: (celeb.KnownGender || {}).Type,
        };
        matched.Face.CenterXY = _computeFaceCenterXY(matched);

        unrecognizedFaces.push(matched);
      });

    unrecognizedFaces = _filterDuplicated(unrecognizedFaces);

    (celebrities.UnrecognizedFaces || [])
      .forEach((unrecognizedFace) => {
        // filter out boundingbox confidence less than 95%
        if (Math.round(unrecognizedFace.Confidence) < BBOX_MINCONFIDENCE) {
          return;
        }

        const matched = {
          Face: {
            BoundingBox: unrecognizedFace.BoundingBox,
            Pose: unrecognizedFace.Pose,
            Quality: unrecognizedFace.Quality,
          },
        };
        matched.Face.CenterXY = _computeFaceCenterXY(matched);

        unrecognizedFaces.push(matched);
      });

    return unrecognizedFaces;
  }

  getFaceMatchedFaces(faceMatches) {
    const qualified = [];

    faceMatches
      .forEach((matched) => {
        if (matched.FaceMatches[0].Similarity > MIN_SIMILARITY) {
          const face = matched.Person;
          face.Face.CenterXY = _computeFaceCenterXY(face);
          qualified.push(face);
        }
      });

    return qualified;
  }

  setCompleted() {
    this.setMetrics();

    const endTime = Date.now();
    this.autoFaceIndexerData.endTime = endTime;

    const stateData = this.celebIterator.setCompleted();
    stateData.data[Celeb].endTime = endTime;

    this.facematchIterator.setCompleted();
    stateData.data[FaceMatch] =
      this.facematchIterator.stateData.data[FaceMatch];
    stateData.data[FaceMatch].endTime = endTime;

    return stateData;
  }

  setProgress(pencentage) {
    this.setMetrics();

    const stateData = this.celebIterator.setProgress(pencentage);

    this.facematchIterator.setProgress(pencentage);
    stateData.data[FaceMatch] =
      this.facematchIterator.stateData.data[FaceMatch];

    return stateData;
  }

  async processWithFrameSegmentation() {
    const instance = this.celebIterator;
    const data = instance.stateData.data[Celeb];

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

    const iterators = [
      [this.celebIterator, Celeb],
      [this.facematchIterator, FaceMatch],
    ];

    const startTime = Date.now();
    iterators.forEach((x) => {
      const [
        iterator,
        subcategory,
      ] = x;
      const categoryData = iterator.stateData.data[subcategory];
      categoryData.startTime = categoryData.startTime || startTime;
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

      iterators.forEach((x) => {
        const [
          iterator,
          subcategory,
        ] = x;
        const categoryData = iterator.stateData.data[subcategory];
        categoryData.cursor += 1;
      });

      /* make sure we allocate enough time for the next iteration */
      lambdaTimeout = this.quitNow();
    }

    await Promise.all(iterators
      .map((x) => {
        const [
          iterator,
          subcategory,
        ] = x;
        const outPrefix = iterator.makeRawDataPrefix(subcategory);
        const dataset = iterator.dataset;
        iterator.mapData = iterator.getUniqueNames(dataset);

        return iterator.updateOutputs(
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
    console.log(
      '==== PROCESSING ====',
      frame.frameNo,
      frame.timestamp
    );

    await this.celebIterator.processFrame2(
      bucket,
      prefix,
      frame
    );

    const unrecognizedFaces = this.getUnrecognizedFaces(
      this.celebIterator.originalResponse
    );

    // no face found, skip celeb and facematch
    if (unrecognizedFaces.length === 0) {
      return undefined;
    }

    await this.facematchIterator.processFrame2(
      bucket,
      prefix,
      frame,
      unrecognizedFaces
    );

    const uuid = this.facematchIterator.stateData.uuid;
    const collectionId = this.facematchIterator.faceCollectionId;
    const frameImage = this.facematchIterator.cachedImage;
    const recognizedFaces = this.getFaceMatchedFaces(
      this.facematchIterator.recognizedFaces
    );
    // const recognizedFaces = this.facematchIterator.recognizedFaces;

    let response;

    response = await this.cropAndBlitFaces(
      frameImage,
      unrecognizedFaces,
      recognizedFaces
    );

    const parsed = PATH.parse(frame.name);

    // dump the frame image before occlusion
    await _debugDumpFrame(
      response.blitImage,
      `${parsed.name}-before${parsed.ext}`
    );

    response = await this.filterOccludedFaces(
      response.blitImage,
      response.faceImages
    );

    const {
      blitImage,
      faceImages,
    } = response;

    if (!blitImage || (faceImages || []).length === 0) {
      return undefined;
    }

    const bytes = await blitImage.getBufferAsync(Jimp.MIME_JPEG);

    // dump the frame image for debugging
    await _debugDumpFrame(
      blitImage,
      `${parsed.name}-after${parsed.ext}`
    );

    const externalImageId = FaceIndexer.createExternalImageId(
      uuid,
      frame.timestamp
    );

    const indexed = await this.faceIndexer.indexFaces(
      collectionId,
      externalImageId,
      bytes,
      faceImages.length + 1
    );

    if (((indexed || {}).FaceRecords || []).length === 0) {
      return undefined;
    }

    indexed.FaceRecords
      .forEach((face) => {
        face.Face.CenterXY = _computeFaceCenterXY(face);
      });

    let promises = [];
    const facePrefix = PATH.join(AutoFaceIndexer, collectionId);
    const facematchDataset = this.facematchIterator.dataset;

    // found the faces that were indexed successfully
    // and register the faces
    // store the full image as well
    let fullImageKey;

    while (indexed.FaceRecords.length > 0) {
      const indexedFace = indexed.FaceRecords.shift();
      const found = _findFace(indexedFace, faceImages);

      if (found) {
        const faceId = indexedFace.Face.FaceId;
        const userId = indexedFace.Face.UserId;
        const image = found.image;
        const name = found.name;
        const confidence = Math.round(found.confidence || indexedFace.Face.Confidence);

        // adding Name and Confidence to the datapoint
        if (name) {
          indexedFace.Face.Name = name;
          indexedFace.Face.Confidence = confidence;
        }

        const key = await _storeFaceS3(
          faceId,
          bucket,
          facePrefix,
          image
        );

        if (fullImageKey === undefined) {
          const fullImagePrefix = PATH.join(facePrefix, PREFIX_FULLIMAGE);

          fullImageKey = await _storeFullImageS3(
            uuid,
            bucket,
            fullImagePrefix,
            frame.timestamp,
            frameImage
          );
        }

        const fields = {
          uuid,
          collectionId,
          externalImageId,
          userId,
          key,
          fullImageKey,
          name,
          confidence,
        };

        // optional fields
        if (indexedFace.FaceDetail !== undefined) {
          if (indexedFace.FaceDetail.Gender !== undefined
          && indexedFace.FaceDetail.Gender.Confidence >= 90) {
            fields.gender = indexedFace.FaceDetail.Gender.Value;
          }
          if (indexedFace.FaceDetail.AgeRange !== undefined) {
            fields.ageRange = [
              indexedFace.FaceDetail.AgeRange.Low,
              indexedFace.FaceDetail.AgeRange.High,
            ].join(',');
          }
        }

        promises.push(this.faceIndexer.registerFace(faceId, fields)
          .then((res) => {
            const datapoint = _createDatapoint(frame, indexedFace, found);
            facematchDataset.push(datapoint);
            return res;
          }));
      }
    }

    promises = await Promise.all(promises);

    return promises;
  }

  async cropAndBlitFaces(
    frameImage,
    unrecognizedFaces,
    recognizedFaces
  ) {
    const facesToIndex = _filterFaces(
      unrecognizedFaces,
      recognizedFaces,
      frameImage
    );

    if (facesToIndex.length === 0) {
      return {};
    }

    return this.blitFaces(
      frameImage,
      facesToIndex
    );
  }

  async blitFaces(
    frameImage,
    faces
  ) {
    const imgW = frameImage.bitmap.width;
    const imgH = frameImage.bitmap.height;

    const combined = await new Promise((resolve, reject) => {
      const _ = new Jimp(imgW, imgH, 0xffffffff, (e, img) => {
        if (e) {
          console.error(e);
          reject(e);
        } else {
          resolve(img);
        }
      });
    });

    const cropped = [];

    for (let i = 0; i < faces.length; i += 1) {
      const face = faces[i];
      const box = face.Face.BoundingBox;
      const name = face.Name;
      const confidence = Math.round(face.Confidence || 0);

      // ensure coord not out of bound
      let w = Math.round(imgW * box.Width);
      let h = Math.round(imgH * box.Height);
      w = (Math.min(Math.max(w, 0), imgW) >> 1) << 1;
      h = (Math.min(Math.max(h, 0), imgH) >> 1) << 1;

      let l = Math.round(imgW * box.Left);
      let t = Math.round(imgH * box.Top);
      l = Math.min(Math.max(l, 0), imgW - w);
      t = Math.min(Math.max(t, 0), imgH - h);

      // compute center point
      const cx = box.Left + (box.Width / 2);
      const cy = box.Top + (box.Height / 2);

      // crop face
      const img = frameImage
        .clone()
        .crop(l, t, w, h);

      combined.blit(img, l, t);
      cropped.push({
        image: img,
        bbox: box,
        name,
        confidence,
        xy: [cx, cy],
      });

      // ignore face that is blurry
      if (FilterSettings.minLaplacianVariance > 0) {
        const variance = await JimpHelper.computeLaplacianVariance(img);

        if (variance > FilterSettings.minLaplacianVariance) {
          combined.blit(img, l, t);
          cropped.push({
            image: img,
            bbox: box,
            name,
            confidence,
            xy: [cx, cy],
          });
        }
      }
    }

    return {
      blitImage: combined,
      faceImages: cropped,
    };
  }

  async detectOccludedFaces(bytes) {
    const occluded = [];

    const command = new DetectFacesCommand({
      Image: {
        Bytes: bytes,
      },
      Attributes: [
        'FACE_OCCLUDED',
      ],
    });

    const response = await RunCommand(command)
      .then((res) => {
        this.autoFaceIndexerData.faceApiCount += 1;
        return res;
      })
      .catch((e) => {
        console.warn(
          'WARN:',
          'BaseDetectFrameIterator.detectFn:',
          `${command.constructor.name}:`,
          e.$metadata.httpStatusCode,
          e.name,
          e.message,
          JSON.stringify(command.input)
        );
        return undefined;
      });

    ((response || {}).FaceDetails || [])
      .forEach((face) => {
        if (
          (face.FaceOccluded.Value === true) ||
          (face.FaceOccluded.Confidence < 85)
        ) {
          const matched = {
            Face: face,
          };
          matched.Face.CenterXY = _computeFaceCenterXY(matched);
          occluded.push(matched);
        }
      });

    return occluded;
  }

  async filterOccludedFaces(blitImage, faceImages = []) {
    if (!blitImage || faceImages.length === 0) {
      return {
        blitImage,
        faceImages,
      };
    }

    // one last check to detect occluded faces
    const bytes = await blitImage.getBufferAsync(Jimp.MIME_JPEG);
    const occludedFaces = await this.detectOccludedFaces(bytes);

    if (occludedFaces.length === 0) {
      return {
        blitImage,
        faceImages,
      };
    }

    const toBeRemoved = [];
    occludedFaces.forEach((face) => {
      const xy = face.Face.CenterXY;

      faceImages.forEach((face2, idx) => {
        if (face2 && _inProximity(xy, face2.xy)) {
          toBeRemoved.push(face2);
          faceImages[idx] = undefined;
        }
      });
    });

    const filtered = faceImages
      .filter((x) =>
        x !== undefined);

    if (filtered.length === 0) {
      return {
        blitImage: undefined,
        faceImages: [],
      };
    }

    // now, we need to mask out the occluded faces
    const imgW = blitImage.bitmap.width;
    const imgH = blitImage.bitmap.height;

    for (let i = 0; i < toBeRemoved.length; i += 1) {
      // mask the occluded faces
      const image = toBeRemoved[i].image;
      const bbox = toBeRemoved[i].bbox;

      image.scan(0, 0, image.bitmap.width, image.bitmap.height, (px, py, idx) => {
        const rgba = image.bitmap.data;
        rgba[idx + 0] = 255;
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 255;
      });

      // compute the top left position to blit the white image
      let l = Math.round(imgW * bbox.Left);
      let t = Math.round(imgH * bbox.Top);
      l = Math.min(Math.max(l, 0), imgW - image.bitmap.width);
      t = Math.min(Math.max(t, 0), imgH - image.bitmap.height);

      blitImage.blit(image, l, t);
    }

    return {
      blitImage,
      faceImages: filtered,
    };
  }

  setMetrics() {
    this.autoFaceIndexerData.facesIndexed += this.faceIndexer.facesIndexed;
    this.autoFaceIndexerData.apiCount += this.faceIndexer.apiCount;
  }
}

function _setFilterSettings(userFilterSettings = {}) {
  FilterSettings = {
    ...FilterSettings,
    userFilterSettings,
  };
}

async function _storeFaceS3(
  faceId,
  bucket,
  prefix,
  image
) {
  // scale to 64 pixels
  const factor = 64 / image.bitmap.width;
  let scaled = image.scale(factor);
  scaled = await scaled.getBufferAsync(Jimp.MIME_JPEG);

  let name = faceId.replaceAll('-', '');
  name = `${name}.jpg`;

  await _debugDumpFrame(
    scaled,
    name
  );

  return CommonUtils.uploadFile(
    bucket,
    prefix,
    name,
    scaled
  ).then(() =>
    PATH.join(prefix, name));
}

async function _storeFullImageS3(
  uuid,
  bucket,
  prefix,
  frameTimeStamp,
  image
) {
  // scale to 640 pixels
  const factor = 640 / image.bitmap.width;
  let scaled = image.scale(factor);
  scaled = await scaled.getBufferAsync(Jimp.MIME_JPEG);

  let name = uuid.replaceAll('-', '');
  name = `${name}:${frameTimeStamp}.jpg`;

  await _debugDumpFrame(
    scaled,
    name
  );

  return CommonUtils.uploadFile(
    bucket,
    prefix,
    name,
    scaled
  ).then(() =>
    PATH.join(prefix, name));
}

function _createDatapoint(frame, indexed, faceInFrameImage) {
  // randomly create a unique integer
  const index = FaceIndexer.faceIdToNumber(indexed.Face.FaceId);

  return {
    Timestamp: frame.timestamp,
    FrameNumber: frame.frameNo,
    Person: {
      Index: index,
      Confidence: 100,
      Face: {
        BoundingBox: faceInFrameImage.bbox,
      },
    },
    FaceMatches: [{
      Face: indexed.Face,
      Similarity: 100,
    }],
  };
}

function _filterFaces(
  unrecognizedFaces,
  recognizedFaces,
  frameImage
) {
  const qualified = [];

  const imgW = frameImage.bitmap.width;
  const imgH = frameImage.bitmap.height;

  const recognizedFaceCoords = recognizedFaces
    .map((face) =>
      face.Face.CenterXY);

  unrecognizedFaces.forEach((face) => {
    const {
      Face: {
        BoundingBox,
        Pose,
        Quality,
      },
    } = face;

    // face too small, skip it
    const w = Math.round(imgW * BoundingBox.Width);
    const h = Math.round(imgH * BoundingBox.Height);

    if (w < FilterSettings.minFaceW || h < FilterSettings.minFaceH) {
      return;
    }

    // awkward pose, skip it
    if (Pose !== undefined) {
      if (Math.abs(Pose.Pitch) > FilterSettings.maxPitch) {
        return;
      }
      if (Math.abs(Pose.Roll) > FilterSettings.maxRoll) {
        return;
      }
      if (Math.abs(Pose.Yaw) > FilterSettings.maxYaw) {
        return;
      }
    }

    // quality
    if (Quality !== undefined) {
      if (Math.abs(Quality.Brightness) < FilterSettings.minBrightness) {
        return;
      }
      if (Math.abs(Quality.Sharpness) < FilterSettings.minSharpness) {
        return;
      }
    }

    // already in collection, skip it
    const idx = _findIndexByFaceCenterXY(
      face.Face.CenterXY,
      recognizedFaceCoords
    );
    if (idx >= 0) {
      return;
    }

    qualified.push(face);
  });

  return qualified;
}

function _filterDuplicated(faces) {
  if (faces.length < 2) {
    return faces;
  }

  // remove duplicated faces based on bbox
  const centerXYs = [];
  const filtered = [];

  filtered.push(faces[0]);
  centerXYs.push(faces[0].Face.CenterXY);
  faces.shift();

  while (faces.length) {
    const face = faces.shift();

    const idx = _findIndexByFaceCenterXY(
      face.Face.CenterXY,
      centerXYs
    );

    if (idx < 0) {
      filtered.push(face);
      centerXYs.push(face.Face.CenterXY);
    } else if (face.Confidence > filtered[idx].Confidence) {
      filtered[idx] = face;
      centerXYs[idx] = face.Face.CenterXY;
    }
  }

  return filtered;
}

function _computeFaceCenterXY(face) {
  const {
    Face: {
      BoundingBox: box,
    },
  } = face;

  const cx = box.Left + (box.Width / 2);
  const cy = box.Top + (box.Height / 2);

  return [cx, cy];
}

function _findFace(target, facesInFrameImage) {
  const xy = target.Face.CenterXY;

  const centerXYs = facesInFrameImage
    .map((face) =>
      face.xy);

  const idx = _findIndexByFaceCenterXY(xy, centerXYs);
  if (idx < 0) {
    return undefined;
  }

  return facesInFrameImage[idx];
}

function _inProximity(a, b) {
  const [cx0, cy0] = a;
  const [cx1, cy1] = b;

  // compute distances and return if distance < 1%
  let distance = Math.sqrt(
    ((cx0 - cx1) ** 2) + ((cy0 - cy1) ** 2)
  );
  distance = Math.round(distance * 100);
  return (distance <= 1);
}

function _findIndexByFaceCenterXY(target, centerXYs) {
  return centerXYs
    .findIndex((xy) =>
      _inProximity(target, xy));
}

function _createDir(path) {
  try {
    FS.mkdirSync(path, {
      recursive: true,
    });
  } catch (e) {
    // do nothing
  }
}

async function _debugDumpFrame(image, name) {
  if (!DEBUG_ENABLED || !image) {
    return undefined;
  }

  const file = PATH.join(AutoFaceIndexer, name);
  console.log(`=== [DEBUG]: SAVING ${file}`);

  if (image instanceof Buffer) {
    return FS.writeFileSync(file, image);
  }

  if (image instanceof Jimp) {
    let cloned = image.clone();

    const imgW = image.bitmap.width;
    if (imgW > 640) {
      cloned = cloned.scale((640 / imgW));
    }

    return cloned.writeAsync(file);
  }

  return undefined;
}

module.exports = AutoFaceIndexerIterator;
