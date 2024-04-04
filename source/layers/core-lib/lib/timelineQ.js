// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  M2CException,
} = require('./error');
const FaceIndexer = require('./faceIndexer');

const THRESHOLD_TIMEDRIFT = 1200; // 1200ms
const THRESHOLD_POSITIONDRIFT = 0.10; // 10%

class BaseItem {
  constructor(item = {}, options = {}) {
    this.$name = item.name;
    this.$confidence = item.confidence;
    this.$begin = item.begin;
    this.$end = item.end;
    this.$boundingBox = {
      ...item.boundingBox,
    };
    this.$parentName = item.parentName;
    this.$cx = this.computeCenterX();
    this.$cy = this.computeCenterY();
    this.$count = 1;
    this.$timeDriftThreshold = options.timeDriftExceedThreshold
      || THRESHOLD_TIMEDRIFT;
    this.$positionDriftThreshold = options.positionDriftThreshold
      || THRESHOLD_POSITIONDRIFT;
  }

  get [Symbol.toStringTag]() {
    return 'BaseItem';
  }

  canUse() {
    throw new M2CException('sub class to implement');
  }

  get timeDriftThreshold() {
    return this.$timeDriftThreshold;
  }

  set timeDriftExceedThreshold(val) {
    this.$timeDriftThreshold = val;
  }

  get positionDriftThreshold() {
    return this.$positionDriftThreshold;
  }

  set positionDriftExceedThreshold(val) {
    this.$positionDriftThreshold = val;
  }

  get boundingBox() {
    return this.$boundingBox;
  }

  set boundingBox(val) {
    this.$boundingBox = {
      ...val,
    };
    this.cx = this.computeCenterX();
    this.cy = this.computeCenterY();
  }

  get w() {
    return this.boundingBox.Width;
  }

  set w(val) {
    this.boundingBox.Width = val;
    this.cx = this.computeCenterX();
  }

  get h() {
    return this.boundingBox.Height;
  }

  set h(val) {
    this.boundingBox.Height = val;
    this.cy = this.computeCenterY();
  }

  get x() {
    return this.boundingBox.Left;
  }

  set x(val) {
    this.boundingBox.Left = val;
    this.cx = this.computeCenterX();
  }

  get y() {
    return this.boundingBox.Top;
  }

  set y(val) {
    this.boundingBox.Top = val;
    this.cy = this.computeCenterY();
  }

  get name() {
    return this.$name;
  }

  set name(val) {
    this.$name = val;
  }

  get parentName() {
    return this.$parentName;
  }

  set parentName(val) {
    this.$parentName = val;
  }

  get confidence() {
    return this.$confidence;
  }

  set confidence(val) {
    this.$confidence = val;
  }

  get begin() {
    return this.$begin;
  }

  set begin(val) {
    this.$begin = val;
  }

  get end() {
    return this.$end;
  }

  set end(val) {
    this.$end = val;
  }

  get cx() {
    return this.$cx;
  }

  set cx(val) {
    this.$cx = val;
  }

  get cy() {
    return this.$cy;
  }

  set cy(val) {
    this.$cy = val;
  }

  get count() {
    return this.$count;
  }

  set count(val) {
    this.$count = val;
  }

  get cueText() {
    return [
      this.name,
      this.parentName ? `<c.small>${this.parentName}</c>` : undefined,
      `<c.confidence>(${Math.round(this.confidence)}%)</c>`,
    ].filter(x => x).join('\n');
  }

  get cueAlignment() {
    const cx = this.cx === undefined ? 0.5 : this.cx;
    const cy = this.cy === undefined ? 0.5 : this.cy;
    const line = Math.floor(cy * 100);
    const position = Math.floor(cx * 100);
    return [
      'align:center',
      `line:${line}%`,
      `position:${position}%`,
      'size:25%',
    ].join(' ');
  }

  computeCenterX() {
    return this.x === undefined || this.w === undefined
      ? undefined
      : this.x + this.w / 2;
  }

  computeCenterY() {
    return this.y === undefined || this.h === undefined
      ? undefined
      : this.y + this.h / 2;
  }

  toJSON() {
    return {
      name: this.name,
      confidence: Number(this.confidence.toFixed(2)),
      begin: this.begin,
      end: this.end,
      cx: this.cx,
      cy: this.cy,
      count: this.count,
    };
  }
}

class CelebItem extends BaseItem {
  constructor(item, options) {
    super({
      name: item.Celebrity.Name,
      confidence: item.Celebrity.Confidence || (item.Celebrity.Face || {}).BoundingBox,
      begin: item.Timestamp,
      end: item.Timestamp,
      boundingBox: item.Celebrity.BoundingBox || (item.Celebrity.Face || {}).BoundingBox,
    }, options);
  }

  canUse() {
    return this.w !== undefined;
  }

  get [Symbol.toStringTag]() {
    return 'CelebItem';
  }
}

class LabelItem extends BaseItem {
  constructor(item, options) {
    super({
      name: item.Label.Name,
      parentName: (item.Label.Parents || []).map(x => x.Name).join(', '),
      confidence: item.Label.Confidence,
      begin: item.Timestamp,
      end: item.Timestamp,
      boundingBox: ((item.Label.Instances || [])[0] || {}).BoundingBox,
    }, options);
  }

  canUse() {
    return true;
  }

  get [Symbol.toStringTag]() {
    return 'LabelItem';
  }
}

class FaceMatchItem extends BaseItem {
  constructor(item, options) {
    const face = item.FaceMatches[0].Face;

    const faceId = face.FaceId;
    let name = face.Name;
    if (!name) {
      name = FaceIndexer.resolveExternalImageId(
        face.ExternalImageId,
        faceId
      );
    }

    super({
      name,
      parentName: `Index ${item.Person.Index}`,
      confidence: item.FaceMatches[0].Similarity,
      begin: item.Timestamp,
      end: item.Timestamp,
      boundingBox: item.Person.BoundingBox || item.Person.Face.BoundingBox,
    }, options);
    this.$faceId = faceId;
  }

  canUse() {
    return !!this.name;
  }

  get [Symbol.toStringTag]() {
    return 'FaceMatchItem';
  }

  get faceId() {
    return this.$faceId;
  }

  get cueText() {
    return [
      this.name.replace(/_/g, ' '),
      `<c.confidence>(${Math.round(this.confidence)}%)</c>`,
    ].filter(x => x).join('\n');
  }

  toJSON() {
    return {
      ...super.toJSON(),
      faceId: this.faceId,
    };
  }
}

class ModerationItem extends BaseItem {
  constructor(item, options) {
    super({
      name: (options || {}).name || item.ModerationLabel.Name,
      parentName: item.ModerationLabel.ParentName,
      confidence: item.ModerationLabel.Confidence,
      begin: item.Timestamp,
      end: item.Timestamp,
      boundingBox: {}, // moderation doesn't provide boundingbox
    }, options);
  }

  canUse() {
    return !!this.name;
  }

  get [Symbol.toStringTag]() {
    return 'ModerationItem';
  }

  get cueText() {
    return [
      this.name,
      this.parentName ? `<c.small>${this.parentName}</c>` : undefined,
      `<c.confidence>(${Math.round(this.confidence)}%)</c>`,
    ].filter(x => x).join('\n');
  }
}

class PersonItem extends BaseItem {
  constructor(item, options) {
    super({
      name: item.Person.Index.toString(),
      parentName: [
        ((item.Person.Face || {}).Gender) ? item.Person.Face.Gender.Value : undefined,
        ((item.Person.Face || {}).AgeRange) ? `(${item.Person.Face.AgeRange.Low} - ${item.Person.Face.AgeRange.High})` : undefined,
      ].filter(x => x).join(' '),
      confidence: item.Person.Confidence || (item.Person.Face || {}).Confidence,
      begin: item.Timestamp,
      end: item.Timestamp,
      boundingBox: item.Person.BoundingBox,
    }, options);
  }

  canUse() {
    return this.confidence !== undefined;
  }

  get [Symbol.toStringTag]() {
    return 'PersonItem';
  }

  get cueText() {
    return [
      `Person ${this.name}`,
      this.parentName ? `<c.small>${this.parentName}</c>` : undefined,
      `<c.confidence>(${Math.round(this.confidence)}%)</c>`,
    ].filter(x => x).join('\n');
  }
}

class FaceItem extends BaseItem {
  constructor(item, options) {
    super({
      name: (item.Face.Gender || {}).Value,
      parentName: [
        (item.Face.AgeRange) ? `(${item.Face.AgeRange.Low} - ${item.Face.AgeRange.High})` : undefined,
        (item.Face.Emotions.sort((a, b) => b.Confidence - a.Confidence)[0] || {}).Type,
      ].filter(x => x).join(' '),
      confidence: item.Face.Confidence,
      begin: item.Timestamp,
      end: item.Timestamp,
      boundingBox: item.Face.BoundingBox,
    }, options);
  }

  canUse() {
    return !!this.name;
  }

  get [Symbol.toStringTag]() {
    return 'FaceItem';
  }
}

class CustomLabelItem extends BaseItem {
  constructor(item, options) {
    super({
      name: item.CustomLabel.Name,
      confidence: item.CustomLabel.Confidence,
      begin: item.Timestamp,
      end: item.Timestamp,
      boundingBox: (item.CustomLabel.Geometry || {}).BoundingBox,
    }, options);
  }

  canUse() {
    return true;
  }

  get [Symbol.toStringTag]() {
    return 'CustomLabelItem';
  }

  get cueAlignment() {
    if (this.cx !== undefined && this.cy !== undefined) {
      return super.cueAlignment;
    }
    const line = 0;
    const position = 100;
    const align = 'end';
    return [
      `align:${align}`,
      `line:${line}%`,
      `position:${position}%`,
      'size:25%',
    ].join(' ');
  }
}

class TextItem extends BaseItem {
  constructor(item, options) {
    super({
      name: (item.TextDetection.Type === 'LINE')
        ? item.TextDetection.DetectedText
        : undefined,
      confidence: item.TextDetection.Confidence,
      begin: item.Timestamp,
      end: item.Timestamp,
      boundingBox: (item.TextDetection.Geometry || {}).BoundingBox,
    }, options);
  }

  canUse() {
    return !!this.name;
  }

  get [Symbol.toStringTag]() {
    return 'TextItem';
  }
}

class TimelineQ extends Array {
  static createTypedItem(item, options) {
    if (item.Celebrity) {
      return new CelebItem(item, options);
    }
    if (item.ModerationLabel) {
      return new ModerationItem(item, options);
    }
    if (item.Label) {
      return new LabelItem(item, options);
    }
    if (item.FaceMatches) {
      return new FaceMatchItem(item, options);
    }
    if (item.CustomLabel) {
      return new CustomLabelItem(item, options);
    }
    if (item.Person) {
      return new PersonItem(item, options);
    }
    if (item.Face) {
      return new FaceItem(item, options);
    }
    if (item.TextDetection) {
      return new TextItem(item, options);
    }
    throw new M2CException('fail to create typed item');
  }

  /**
   * @static
   * @function computeGeometricMean
   * @description static helper function to compute the geometric mean of an array of numbers
   * @param {Array} items - an array of number
   */
  static computeGeometricMean(items) {
    const filtered = items.filter(x => x !== undefined);
    if (!filtered.length) {
      return undefined;
    }
    const power = 1 / filtered.length;
    return filtered.reduce((a0, c0) => a0 * Math.pow(c0, power), 1); // eslint-disable-line
  }

  static timeDriftExceedThreshold(last, item) {
    if (!last || !item) {
      return false;
    }
    return (Math.abs(item.begin - last.end) > item.timeDriftThreshold);
  }

  static positionDriftExceedThreshold(last, item) {
    if (!last || !item) {
      return false;
    }
    const dx = last.cx - item.cx;
    const dy = last.cy - item.cy;
    return (Math.sqrt((dx * dx) + (dy * dy)) > item.positionDriftThreshold);
  }

  pop() {
    return this.splice(0, 1)[0];
  }

  get first() {
    return this[0];
  }

  get last() {
    return this[this.length - 1];
  }

  /**
   * @function reduceAll
   * @description reduce queue into a single BaseItem object by
   * computing geometric mean of object's properties
   * @returns {BaseItem} a BaseItem object as a result of combining the queue items
   */
  reduceAll() {
    const item0 = this.first;
    if (!item0) {
      return undefined;
    }
    item0.end = this.last.end;
    item0.count = this.length;
    item0.confidence = TimelineQ.computeGeometricMean(this.map(x => x.confidence));
    item0.x = TimelineQ.computeGeometricMean(this.map(x => x.x));
    item0.y = TimelineQ.computeGeometricMean(this.map(x => x.y));
    item0.w = TimelineQ.computeGeometricMean(this.map(x => x.w));
    item0.h = TimelineQ.computeGeometricMean(this.map(x => x.h));
    item0.name = (this.filter(x => x.name)[0] || {}).name;
    item0.parentName = (this.filter(x => x.parentName)[0] || {}).parentName;
    this.length = 0;
    return item0;
  }
}

module.exports = TimelineQ;
