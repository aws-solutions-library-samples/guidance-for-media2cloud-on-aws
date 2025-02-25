// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  parse,
  join,
} = require('node:path');
const {
  AnalysisTypes: {
    AutoFaceIndexer,
  },
  CommonUtils: {
    download,
    uploadFile,
    uuid4,
  },
  JimpHelper: {
    MIME_JPEG,
    imageFromS3,
    imageFromScratch,
  },
  FaceIndexer: {
    createExternalImageId,
  },
} = require('core-lib');
const BaseState = require('../shared/base');

const DEBUG_LOCAL = (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined);

// 270x360 [1890x1080] (compose 21 faces per image)
const GRIDSIZE = [7, 3];
const MAXFACESPERINDEX = GRIDSIZE[0] * GRIDSIZE[1];
const MAXFACEDIMENSION = [270, 360];
const MAXSTOREDDIMENSION = [640, 854];
const PREFIX_FULLIMAGE = 'fullimage';
const BAILOUT_RETRY = 10;

class StateIndexFacesToCollection extends BaseState {
  async process() {
    console.log(`event = ${JSON.stringify(this.event)}`);

    const { bucket, prefix, output, retries } = this.event;

    if (retries && retries >= BAILOUT_RETRY) {
      throw new Error('Too many retries');
    }

    const items = await download(bucket, join(prefix, output))
      .then((res) =>
        JSON.parse(res));

    let toBeProcessed = [];

    for (const item of items) {
      const { faces, faceId, errorMessage } = item;
      if (faceId !== undefined) {
        continue;
      }
      if (errorMessage !== undefined) {
        continue;
      }
      if (faces.length === 0) {
        continue;
      }

      // only care the largest face identified
      faces.sort((a, b) => {
        const areaA = a.box.w * a.box.h;
        const areaB = b.box.w * b.box.h;
        return areaB - areaA;
      });

      toBeProcessed.push(item);
    }

    if (toBeProcessed.length === 0) {
      return this.setCompleted();
    }

    while (toBeProcessed.length > 0) {
      if (this.lambdaTimeout()) {
        break;
      }

      const sliced = toBeProcessed.splice(0, MAXFACESPERINDEX);
      await this.batchIndexFaces(bucket, sliced);
    }

    // update the json file in case for re-entry
    await uploadFile(bucket, prefix, output, items);

    const remaining = items.filter((item) =>
      item.faceId === undefined && item.errorMessage === undefined && item.faces.length > 0);

    if (remaining.length === 0) {
      return this.setCompleted();
    }

    let progress = (items.length - remaining.length) / items.length;
    progress = Math.round(progress * 100);
    return this.setProcessing(progress);
  }

  setCompleted() {
    this.event.indexStatus = 'COMPLETED';
    delete this.event.retries;
    return this.event;
  }

  setProcessing(progress) {
    this.event.indexStatus = 'PROCESSING';
    this.event.progress = progress;
    if (this.event.retries === undefined) {
      this.event.retries = 0;
    }
    this.event.retries += 1;
    return this.event;
  }

  async batchIndexFaces(bucket, items) {
    const uuid = uuid4();

    let promises = [];
    for (const item of items) {
      promises.push(this.prepareImageVariances(bucket, item)
        .then((res) =>
          item.tempData = res));
    }

    if (promises.length === 0) {
      return undefined;
    }

    promises = await Promise.all(promises);

    // create composite image
    const compositeImage = await this.createCompositeImage(uuid, items);

    const { collectionId } = items[0];
    const externalImageId = createExternalImageId(uuid, 0);
    const maxFaces = items.length + 1;
    const bytes = await compositeImage.getBufferAsync(MIME_JPEG);

    const w = compositeImage.bitmap.width;
    const h = compositeImage.bitmap.height;
    const indexed = await this.faceIndexer.indexFaces(collectionId, externalImageId, bytes, maxFaces);

    await this.parseIndexingResults(items, indexed, [w, h]);

    for (const item of items) {
      const faceId = await this.registerFace(bucket, item);
      item.faceId = faceId;
      // clean up the temporary data
      delete item.tempData;
    }

    return items;
  }

  async prepareImageVariances(bucket, item) {
    const { key, faces } = item;

    const image = await imageFromS3(bucket, key);

    // crop face
    const imgW = image.bitmap.width;
    const imgH = image.bitmap.height;

    let { box: { l, t, w, h } } = faces[0];
    l = Math.round(l * imgW);
    t = Math.round(t * imgH);
    w = (Math.round(w * imgW) >> 1) << 1;
    h = (Math.round(h * imgH) >> 1) << 1;

    // factor in aspect ratio (3:4)
    let arW = (Math.round(h * 3 / 4) >> 1) << 1;
    let arH = (Math.round(w * 4 / 3) >> 1) << 1;
    if (arW > w) {
      arH = (Math.round(arW * 4 / 3) >> 1) << 1;
    } else {
      arW = (Math.round(arH * 3 / 4) >> 1) << 1;
    }

    // scale the bounding box
    const scaleW = Math.min(imgW, (Math.round(arW * 1.5) >> 1) << 1);
    const scaleH = Math.min(imgH, (Math.round(arH * 1.5) >> 1) << 1);

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

    const cropped = image
      .clone()
      .crop(l, t, w, h)
      .resize(...MAXFACEDIMENSION);

    // scale down the original image
    const factor = MAXSTOREDDIMENSION[0] / image.bitmap.width;
    const scaled = image.scale(factor);

    if (DEBUG_LOCAL) {
      await cropped.writeAsync(join('_faceindexer', `${item.name}.jpg`));
    }

    return { cropped, scaled };
  }

  async createCompositeImage(uuid, items) {
    const [w, h] = MAXFACEDIMENSION;
    const [nCols, nRows] = GRIDSIZE;

    const compositeW = Math.min(items.length, nCols) * w;
    const compositeH = Math.ceil(items.length / nCols) * h;
    const compositeImage = await imageFromScratch(compositeW, compositeH);

    const duped = items.slice();
    for (let i = 0; i < nRows; i += 1) {
      if (duped.length === 0) {
        break;
      }

      for (let j = 0; j < nCols; j += 1) {
        const item = duped.shift();
        if (item === undefined) {
          break;
        }

        const l = j * w;
        const t = i * h;
        const { tempData } = item;

        console.log(`relativeCoord: ${l}, ${t}`);

        compositeImage.blit(tempData.cropped, l, t);
        tempData.relativeCoord = { l, t, w, h };
        tempData.uuid = uuid;
      }
    }

    if (DEBUG_LOCAL) {
      const collectionId = items[0].collectionId;
      await compositeImage.writeAsync(join('_faceindexer', `${collectionId}-${uuid}.jpg`));
    }

    return compositeImage;
  }

  async parseIndexingResults(items, results, dimension) {
    const [imgW, imgH] = dimension;
    for (const faceRecord of results.FaceRecords) {
      let {
        Face: {
          BoundingBox: { Left: l, Top: t, Width: w, Height: h },
        },
      } = faceRecord;

      const centerXY = [
        (l + (w / 2)) * imgW,
        (t + (h / 2)) * imgH,
      ];

      let matched;
      for (const item of items) {
        const { tempData: { relativeCoord } } = item;
        if (_pointInBox(relativeCoord, centerXY)) {
          matched = item;
          break;
        }
      }
      if (!matched) {
        throw new Error('Cannot find face in composite image');
      }
      matched.tempData.faceRecord = faceRecord;
    }

    // make sure to log faces that are not indexed...
    for (const faceRecord of results.UnindexedFaces) {
      const {
        FaceDetail: {
          BoundingBox: { Left: l, Top: t, Width: w, Height: h },
        },
        Reasons,
      } = faceRecord;

      const centerXY = [
        (l + (w / 2)) * imgW,
        (t + (h / 2)) * imgH,
      ];

      let matched;
      for (const item of items) {
        const { tempData: { relativeCoord } } = item;
        if (_pointInBox(relativeCoord, centerXY)) {
          matched = item;
          break;
        }
      }
      if (matched) {
        const errorMessage = `Fail to index ${matched.name}. Reasons: ${Reasons.join(',')}`;
        console.log(errorMessage);
        matched.errorMessage = errorMessage;
      }
    }
  }

  async registerFace(bucket, item) {
    const {
      faces: [face],
      tempData: { uuid, faceRecord, cropped, scaled },
      collectionId,
      name: celeb,
    } = item;
    const {
      Face: { FaceId: faceId, UserId: userId, Confidence: confidence, ExternalImageId: externalImageId },
      FaceDetail: faceDetail = {},
    } = faceRecord;

    const { box: { l, t, w, h } } = face;
    const coord = `${l.toFixed(4)},${t.toFixed(4)},${w.toFixed(4)},${h.toFixed(4)}`;

    const fields = {
      uuid,
      collectionId,
      externalImageId,
      userId,
      coord,
      celeb,
      confidence: Math.round(confidence),
      key: undefined,
      fullImageKey: undefined,
    };

    // optional fields
    const {
      Gender: gender = {},
      AgeRange: ageRange = {},
    } = faceDetail;

    if (gender.Confidence !== undefined && gender.Confidence >= 90.0) {
      fields.gender = gender.Value;
    }
    if (ageRange.Low !== undefined && ageRange.High !== undefined) {
      fields.ageRange = [ageRange.Low, ageRange.High].join(',');
    }

    let promises = [];

    // store thumbnail image
    promises.push(_storeFaceThumbnail(bucket, collectionId, faceId, cropped)
      .then((res) =>
        fields.key = res));

    // store full image
    promises.push(_storeFaceFullImage(bucket, collectionId, celeb, scaled)
      .then((res) =>
        fields.fullImageKey = res));

    promises = await Promise.all(promises);

    // now register to db
    await this.faceIndexer.registerFace(faceId, fields);

    return faceId;
  }
}

function _pointInBox(coord, xy) {
  const { l, t, w, h } = coord;
  const [cx, cy] = xy;

  if (l < cx && cx < (l + w) && t < cy && cy < (t + h)) {
    return true;
  }

  return false;
}

async function _storeFaceThumbnail(bucket, collectionId, faceId, image) {
  let scaled = image;
  if (image.bitmap.width > 64) {
    const factor = 64 / image.bitmap.width;
    scaled = image.scale(factor);
  }
  const thumbnail = await scaled.getBufferAsync(MIME_JPEG);

  const prefix = join(AutoFaceIndexer, collectionId);
  let name = faceId.replaceAll('-', '');
  name = `${name}.jpg`;

  if (DEBUG_LOCAL) {
    await scaled.writeAsync(join('_faceindexer', `${faceId} thumbnail.jpg`));
  }

  await uploadFile(bucket, prefix, name, thumbnail);

  return join(prefix, name);
}

async function _storeFaceFullImage(bucket, collectionId, celeb, image) {
  let scaled = image;
  if (image.bitmap.width > 640) {
    const factor = 640 / image.bitmap.width;
    scaled = image.scale(factor);
  }
  const fullImage = await scaled.getBufferAsync(MIME_JPEG);

  const prefix = join(AutoFaceIndexer, collectionId, PREFIX_FULLIMAGE);
  const name = `${celeb}.jpg`;

  if (DEBUG_LOCAL) {
    await scaled.writeAsync(join('_faceindexer', `${celeb} fullimage.jpg`));
  }

  await uploadFile(bucket, prefix, name, fullImage);

  return join(prefix, name);
}

module.exports = StateIndexFacesToCollection;
