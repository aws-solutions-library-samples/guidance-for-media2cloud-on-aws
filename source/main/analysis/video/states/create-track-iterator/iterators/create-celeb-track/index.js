/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  SQL,
  AnalysisTypes,
  CommonUtils,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Celeb;

class CreateCelebTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreateCelebTrackIterator';
  }

  async downloadSelected(bucket, key, name) {
    const query = `SELECT * FROM S3Object[*].Celebrities[*] s WHERE s.Celebrity.Name = '${SQL.escape(name)}';`;
    return CommonUtils.selectS3Content(bucket, key, query).catch(() =>
      this.downloadJson(bucket, key, name));
  }

  async downloadJson(bucket, key, name) {
    const data = await CommonUtils.download(bucket, key)
      .then(x => JSON.parse(x));
    return ((data || {}).Celebrities || []).filter(x =>
      ((x.Celebrity || {}).Name === name));
  }

  createTimeseriesData(name, datasets) {
    let desc;
    const timestamps = {};
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      const box = dataset.Celebrity.BoundingBox || (dataset.Celebrity.Face || {}).BoundingBox;
      if (!box) {
        continue;
      }
      if (!desc && (dataset.Celebrity.Urls || []).length > 0) {
        desc = dataset.Celebrity.Urls[0];
      }
      const confidence = dataset.Celebrity.Confidence || (dataset.Celebrity.Face || {}).Confidence;
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: Number.parseFloat(confidence.toFixed(2)),
        w: Number.parseFloat(box.Width.toFixed(4)),
        h: Number.parseFloat(box.Height.toFixed(4)),
        l: Number.parseFloat(box.Left.toFixed(4)),
        t: Number.parseFloat(box.Top.toFixed(4)),
      });
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

module.exports = CreateCelebTrackIterator;
