// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  mkdirSync,
  writeFileSync,
} = require('node:fs');
const {
  parse,
  join,
} = require('node:path');
const {
  DetectFacesCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes: {
    Rekognition: {
      Celeb,
      FaceMatch,
    },
    AutoFaceIndexer,
  },
  CommonUtils: {
    download,
    uploadFile,
  },
  M2CException,
  FaceIndexer,
  JimpHelper: {
    MIME_JPEG,
    imageFromScratch,
    computeLaplacianVariance,
  },
  FrameCaptureModeHelper: {
    computeFrameNumAndTimestamp,
  },
} = require('core-lib');
const DetectCelebIterator = require('../detect-celeb');
const DetectFaceMatchIterator = require('../detect-face-match');
const {
  RunCommand,
} = require('../shared/baseDetectFrameIterator');

const {
  makeFrameCaptureFileName,
} = DetectFaceMatchIterator;

const {
  createExternalImageId,
  faceIdToNumber,
} = FaceIndexer;

const DEBUG_ENABLED = (
  process.env.ENV_DEBUG !== undefined &&
  process.env.AWS_LAMBDA_FUNCTION_NAME === undefined
);

const MIN_SIMILARITY = 90;
const BBOX_MINCONFIDENCE = 98;
const PREFIX_FULLIMAGE = 'fullimage';
// Use DetectFaces API to detect occluded faces and filter out faces
const FILTER_OCCLUDEDFACES = false;

const DEFAULT_FILTER_SETTINGS = {
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
  occludedFaceFiltering: true,
};

let FilterSettings = DEFAULT_FILTER_SETTINGS;

class AutoFaceIndexerIterator {
  constructor(stateData) {
    const {
      data: {
        [Celeb]: celeb,
        [FaceMatch]: facematch,
        [AutoFaceIndexer]: autofaceindexer,
      },
    } = stateData;

    if (facematch === undefined) {
      throw new M2CException('FaceMatch must be specified');
    }

    if (autofaceindexer === undefined) {
      throw new M2CException('AutoFaceIndexer must be specified');
    }

    if (DEBUG_ENABLED) {
      _createDir(AutoFaceIndexer);
    }

    _setFilterSettings(autofaceindexer.filterSettings);

    this.$facematchIterator = new DetectFaceMatchIterator(stateData);
    if (celeb !== undefined) {
      this.$celebIterator = new DetectCelebIterator(stateData);
    }

    if (autofaceindexer.startTime === undefined) {
      autofaceindexer.startTime = Date.now();
    }
    if (autofaceindexer.facesIndexed === undefined) {
      autofaceindexer.facesIndexed = 0;
    }
    if (autofaceindexer.apiCount === undefined) {
      autofaceindexer.apiCount = 0;
    }
    if (autofaceindexer.faceApiCount === undefined) {
      autofaceindexer.faceApiCount = 0;
    }

    this.$autoFaceIndexerData = autofaceindexer;
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

  get framesegmentation() {
    return (this.$facematchIterator || {}).framesegmentation;
  }

  get faceapiMap() {
    return (this.$facematchIterator || {}).faceapiMap;
  }

  async process() {
    const iterators = [[this.facematchIterator, FaceMatch]];
    if (this.celebIterator !== undefined) {
      iterators.push([this.celebIterator, Celeb]);
    }

    let promises = [];
    const startTime = Date.now();
    for (const [iterator, subcategory] of iterators) {
      const {
        stateData: { data: { [subcategory]: iteratorData } },
      } = iterator;
      if (iteratorData.startTime === undefined) {
        iteratorData.startTime = startTime;
      }
      if (iteratorData.cursor === undefined) {
        iteratorData.cursor = 0;
      }

      promises.push(iterator.downloadSupplements());
    }
    promises = await Promise.all(promises);

    if ((this.framesegmentation || []).length > 0) {
      return this.processWithFrameSegmentation();
    }

    const {
      stateData: { data: { [FaceMatch]: data } },
    } = this.facematchIterator;
    const { bucket, frameCapture: { prefix, numFrames } } = data;

    let lambdaTimeout = false;

    const t0 = new Date();
    while (!lambdaTimeout && data.cursor < numFrames) {
      await this.processFrame(bucket, prefix, data.cursor);

      for (const [iterator, subcategory] of iterators) {
        const {
          stateData: { data: { [subcategory]: iteratorData } },
        } = iterator;
        iteratorData.cursor += 1;
      }

      /* make sure we allocate enough time for the next iteration */
      lambdaTimeout = this.quitNow();
    }

    promises = [];
    for (const [iterator, subcategory] of iterators) {
      const outPrefix = iterator.makeRawDataPrefix(subcategory);
      iterator.mapData = iterator.getUniqueNames(iterator.dataset);
      promises.push(iterator.updateOutputs(bucket, outPrefix));
    }
    promises = await Promise.all(promises);

    const consumed = new Date() - t0;
    const remained = this.getRemainingTime();
    console.log(`COMPLETED: frame #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);

    if (data.cursor >= numFrames) {
      return this.setCompleted();
    }

    const progress = Math.round((data.cursor / numFrames) * 100);
    return this.setProgress(progress);
  }

  getRemainingTime() {
    const instance = this.facematchIterator;
    return instance.stateData.getRemainingTime();
  }

  quitNow() {
    const instance = this.facematchIterator;
    return instance.stateData.quitNow();
  }

  async processFrame(
    bucket,
    prefix,
    idx
  ) {
    const {
      stateData: {
        data: { [FaceMatch]: { framerate, frameCapture } },
      },
    } = this.facematchIterator;

    const name = makeFrameCaptureFileName(idx);
    const [frameNo, timestamp] = computeFrameNumAndTimestamp(idx, framerate, frameCapture);

    const frame = { name, frameNo, timestamp };
    return await this.processFrame2(bucket, prefix, frame);
  }

  getUnrecognizedFaces(celebrities) {
    let unrecognizedFaces = [];

    if (!celebrities) {
      return unrecognizedFaces;
    }

    const minConfidenceAutoTag = this.celebIterator.minConfidence
      || this.facematchIterator.minConfidence;

    (celebrities.CelebrityFaces || [])
      .forEach((celeb) => {
        // Do not add to the face collection when
        // MatchConfidence is higher than the indexer min. celebrity confidence threshold
        if (Math.round(celeb.MatchConfidence) > FilterSettings.minCelebConfidence) {
          return;
        }

        // filter out boundingbox confidence less than 95%
        if (Math.round(celeb.Face.Confidence) < 95) {
          return;
        }

        // should we auto tag with the identified celebrity name?
        let autoTag;
        if (celeb.MatchConfidence >= minConfidenceAutoTag) {
          autoTag = celeb.Name;
        }

        const matched = {
          Face: {
            BoundingBox: celeb.Face.BoundingBox,
            Pose: celeb.Face.Pose,
            Quality: (celeb.Face || {}).Quality,
          },
          Confidence: celeb.MatchConfidence,
          Gender: (celeb.KnownGender || {}).Type,
          Name: autoTag, // optional
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

    const stateData = this.facematchIterator.setCompleted();
    stateData.data[FaceMatch].endTime = endTime;

    if (this.celebIterator) {
      this.celebIterator.setCompleted();
      stateData.data[Celeb] = this.celebIterator.stateData.data[Celeb];
      stateData.data[Celeb].endTime = endTime;
    }

    return stateData;
  }

  setProgress(pencentage) {
    this.setMetrics();

    const stateData = this.facematchIterator.setProgress(pencentage);
    if (this.celebIterator) {
      this.celebIterator.setProgress(pencentage);
      stateData.data[Celeb] = this.celebIterator.stateData.data[Celeb];
    }

    return stateData;
  }

  async processWithFrameSegmentation() {
    const {
      stateData: {
        data: { [FaceMatch]: data, framesegmentation: { key } },
      },
    } = this.facematchIterator;

    const { bucket } = data;
    const prefix = parse(key).dir;
    const numFrames = this.framesegmentation.length;

    console.log(
      '=== Using processWithFrameSegmentation: numFrames:',
      numFrames
    );

    const iterators = [[this.facematchIterator, FaceMatch]];
    if (this.celebIterator) {
      iterators.push([this.celebIterator, Celeb]);
    }

    let lambdaTimeout = false;

    const t0 = new Date();
    while (!lambdaTimeout && data.cursor < numFrames) {
      const frame = this.framesegmentation[data.cursor];
      await this.processFrame2(bucket, prefix, frame);

      for (const [iterator, subcategory] of iterators) {
        const {
          stateData: { data: { [subcategory]: iteratorData } },
        } = iterator;
        iteratorData.cursor += 1;
      }

      /* make sure we allocate enough time for the next iteration */
      lambdaTimeout = this.quitNow();
    }

    let promises = [];
    for (const [iterator, subcategory] of iterators) {
      const outPrefix = iterator.makeRawDataPrefix(subcategory);
      iterator.mapData = iterator.getUniqueNames(iterator.dataset);
      promises.push(iterator.updateOutputs(bucket, outPrefix));
    }
    await Promise.all(promises);

    const consumed = new Date() - t0;
    const remained = this.getRemainingTime();
    console.log(`COMPLETED: frame #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);

    if (data.cursor >= numFrames) {
      return this.setCompleted();
    }

    const progress = Math.round((data.cursor / numFrames) * 100);
    return this.setProgress(progress);
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

    let unrecognizedFaces;
    if (this.celebIterator !== undefined) {
      await this.celebIterator.processFrame2(bucket, prefix, frame);

      const { originalResponse: responseData } = this.celebIterator;
      unrecognizedFaces = this.getUnrecognizedFaces(responseData);
      // if celeb enabled but no detected, skip facematch
      if ((unrecognizedFaces || []).length === 0) {
        return undefined;
      }
    }

    // try faceapi results
    if ((unrecognizedFaces || []).length === 0) {
      const { faces = [] } = this.faceapiMap[String(frame.frameNo)] || {};
      if (faces.length > 0) {
        for (const face of faces) {
          const { Face: { CenterXY } } = face;
          if (CenterXY === undefined) {
            face.Face.CenterXY = _computeFaceCenterXY(face);
          }
        }
        unrecognizedFaces = faces;
      }
    }

    // still no face found, skip the rest
    if ((unrecognizedFaces || []).length === 0) {
      return undefined;
    }

    await this.facematchIterator.processFrame2(
      bucket,
      prefix,
      frame,
      unrecognizedFaces
    );

    const {
      stateData: { uuid },
      faceCollectionId: collectionId,
      cachedImage: frameImage,
    } = this.facematchIterator;

    if (frameImage === undefined) {
      return undefined;
    }

    let { recognizedFaces } = this.facematchIterator;
    recognizedFaces = this.getFaceMatchedFaces(recognizedFaces);

    let response;

    response = await this.cropAndBlitFaces(
      frameImage,
      unrecognizedFaces,
      recognizedFaces
    );

    const parsed = parse(frame.name);

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

    const bytes = await blitImage.getBufferAsync(MIME_JPEG);

    // dump the frame image for debugging
    await _debugDumpFrame(
      blitImage,
      `${parsed.name}-after${parsed.ext}`
    );

    const externalImageId = createExternalImageId(
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
    const facePrefix = join(AutoFaceIndexer, collectionId);
    const facematchDataset = this.facematchIterator.dataset;

    // found the faces that were indexed successfully
    // and register the faces
    // store the full image as well
    let fullImageKey;

    while (indexed.FaceRecords.length > 0) {
      const indexedFace = indexed.FaceRecords.shift();

      const found = _findFaceInFaceImages(indexedFace, faceImages);
      if (!found) {
        console.log(`Cannot find indexed face in face images. frame#${frame.frameNo}, timestamp#${frame.timestamp}, image=${frame.name}. ${JSON.stringify(indexedFace)}`);
        continue;
      }

      const [faceImage,] = found;
      const {
        Face: { FaceId: faceId, UserId: userId, Confidence: score },
      } = indexedFace;
      const image = faceImage.image;
      const name = faceImage.name;
      const confidence = Math.round(faceImage.confidence || score);

      // adding Name and Confidence to the datapoint
      if (name) {
        indexedFace.Face.Name = name;
        indexedFace.Face.Confidence = confidence;
      }

      // adding face coordinate
      const {
        Face: { BoundingBox: { Left: l, Top: t, Width: w, Height: h } },
      } = indexedFace;

      const coord = [l, t, w, h].map((x) =>
        x.toFixed(4)).join(',');

      const key = await _storeFaceS3(
        faceId,
        bucket,
        facePrefix,
        image
      );

      if (fullImageKey === undefined) {
        const fullImagePrefix = join(facePrefix, PREFIX_FULLIMAGE);
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
        celeb: name,
        confidence,
        coord,
      };

      // optional fields
      if ((((indexedFace.FaceDetail || {}).Gender || {}).Confidence || 0) >= 90) {
        const { FaceDetail: { Gender: { Value } } } = indexedFace;
        fields.gender = Value;
      }
      if (((indexedFace.FaceDetail || {}).AgeRange || {}).Low !== undefined) {
        const { FaceDetail: { AgeRange: { Low, High } } } = indexedFace;
        fields.ageRange = `${Low},${High}`;
      }

      promises.push(this.faceIndexer.registerFace(faceId, fields)
        .then((res) => {
          const datapoint = _createDatapoint(frame, indexedFace, found);
          facematchDataset.push(datapoint);
          return res;
        }));
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

    const combined = await imageFromScratch(imgW, imgH);

    const cropped = [];

    for (let i = 0; i < faces.length; i += 1) {
      const face = faces[i];
      const box = face.Face.BoundingBox;
      const name = face.Name;
      const confidence = Math.round(face.Confidence || 0);

      let { Top: t, Left: l, Width: w, Height: h } = box;
      // compute center point
      const cx = l + (w / 2);
      const cy = t + (h / 2);

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
        const variance = await computeLaplacianVariance(img);

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
    const { occludedFaceFiltering = true } = FilterSettings;
    if (!occludedFaceFiltering) {
      return { blitImage, faceImages };
    }

    if (!blitImage || faceImages.length === 0) {
      return { blitImage, faceImages };
    }

    // one last check to detect occluded faces
    const bytes = await blitImage.getBufferAsync(MIME_JPEG);
    const occludedFaces = await this.detectOccludedFaces(bytes);

    if (occludedFaces.length === 0) {
      return { blitImage, faceImages };
    }

    const toBeRemoved = [];

    for (const face of occludedFaces) {
      const found = _findFaceInFaceImages(face, faceImages);
      if (found) {
        const [faceImage, idx] = found;
        toBeRemoved.push(faceImage);
        faceImages[idx] = undefined;
      }
    }

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
    ...userFilterSettings,
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
  scaled = await scaled.getBufferAsync(MIME_JPEG);

  let name = faceId.replaceAll('-', '');
  name = `${name}.jpg`;

  await _debugDumpFrame(
    scaled,
    name
  );

  return uploadFile(
    bucket,
    prefix,
    name,
    scaled
  ).then(() =>
    join(prefix, name));
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
  scaled = await scaled.getBufferAsync(MIME_JPEG);

  let name = uuid.replaceAll('-', '');
  name = `${name}:${frameTimeStamp}.jpg`;

  await _debugDumpFrame(
    scaled,
    name
  );

  return uploadFile(
    bucket,
    prefix,
    name,
    scaled
  ).then(() =>
    join(prefix, name));
}

function _createDatapoint(frame, indexed, faceInFrameImage) {
  // randomly create a unique integer
  const index = faceIdToNumber(indexed.Face.FaceId);

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
    const found = _findOverlappedFace(face, recognizedFaces);
    if (found !== undefined) {
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
  const filtered = [];
  filtered.push(faces.shift());

  while (faces.length) {
    const face = faces.shift();
    const found = _findOverlappedFace(face, filtered);
    if (found === undefined) {
      filtered.push(face);
      continue;
    }

    if (face.Confidence > found.Confidence) {
      for (const [key, value] of Object.entries(face)) {
        found[key] = value;
      }
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

function _centerPointOverlapped(a, b) {
  const { Top: aT, Left: aL, Width: aW, Height: aH } = a;
  const { Top: bT, Left: bL, Width: bW, Height: bH } = b;

  const ax = aL + (aW / 2);
  const ay = aT + (aH / 2);
  const bx = bL + (bW / 2);
  const by = bT + (bH / 2);

  if ((bL < ax && ax < (bL + bW) && bT < ay && ay < (bT + bH))
    && (aL < bx && bx < (aL + aW) && aT < by && by < (aT + aH))) {
    return true;
  }

  return false
}

function _findOverlappedFace(target, faceRecords) {
  const { Face: { BoundingBox: coordA } } = target;

  for (const face of faceRecords) {
    const { Face: { BoundingBox: coordB } } = face;
    if (_centerPointOverlapped(coordA, coordB)) {
      return face;
    }
  }

  return undefined;
}

function _findFaceInFaceImages(target, faceImages) {
  const { Face: { BoundingBox: coordA } } = target;

  for (let idx = 0; idx < faceImages.length; idx += 1) {
    const faceImage = faceImages[idx];
    if (faceImage === undefined) {
      continue;
    }

    const { bbox: coordB } = faceImage;
    if (_centerPointOverlapped(coordA, coordB)) {
      return [faceImage, idx];
    }
  }

  return undefined;
}

function _createDir(path) {
  try {
    mkdirSync(path, {
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

  const file = join(AutoFaceIndexer, name);
  console.log(`=== [DEBUG]: SAVING ${file}`);

  if (image instanceof Buffer) {
    return writeFileSync(file, image);
  }

  if (typeof image.clone === 'function') {
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
