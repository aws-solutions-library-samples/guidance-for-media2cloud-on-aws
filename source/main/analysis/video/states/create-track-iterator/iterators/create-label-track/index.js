// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SQL,
  AnalysisTypes,
  CommonUtils,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Label;

class CreateLabelTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreateLabelTrackIterator';
  }

  async downloadSelected(bucket, key, name) {
    const query = `SELECT * FROM S3Object[*].Labels[*] s WHERE s.Label.Name = '${SQL.escape(name)}';`;
    return CommonUtils.selectS3Content(bucket, key, query).catch(() =>
      this.downloadJson(bucket, key, name));
  }

  async downloadJson(bucket, key, name) {
    const data = await CommonUtils.download(bucket, key)
      .then(x => JSON.parse(x));
    return ((data || {}).Labels || []).filter(x =>
      ((x.Label || {}).Name === name));
  }

  createTimeseriesData(name, datasets) {
    let desc;
    const timestamps = {};
    for (let dataset of datasets) {
      if (!desc && (dataset.Label.Parents || []).length > 0) {
        desc = dataset.Label.Parents.map(x => x.Name).join(';');
      }
      /* case 1: use instance's score */
      const boxes = (dataset.Label.Instances || []).map(x => ({
        c: Number.parseFloat(x.Confidence.toFixed(2)),
        w: Number.parseFloat(x.BoundingBox.Width.toFixed(4)),
        h: Number.parseFloat(x.BoundingBox.Height.toFixed(4)),
        l: Number.parseFloat(x.BoundingBox.Left.toFixed(4)),
        t: Number.parseFloat(x.BoundingBox.Top.toFixed(4)),
      }));
      /* case 2: if no bounding box, use label's score */
      if (!boxes.length) {
        boxes.push({
          c: Number.parseFloat(dataset.Label.Confidence.toFixed(2)),
        });
      }
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].splice(timestamps[dataset.Timestamp].length, 0, ...boxes);
    }
    if (!Object.keys(timestamps)) {
      return undefined;
    }
    return {
      label: name,
      desc,
      data: Object.keys(timestamps).map(x => ({
        x: Number.parseInt(x, 10),
        y: timestamps[x].length,
        details: timestamps[x],
      })),
    };
  }
}

module.exports = CreateLabelTrackIterator;
