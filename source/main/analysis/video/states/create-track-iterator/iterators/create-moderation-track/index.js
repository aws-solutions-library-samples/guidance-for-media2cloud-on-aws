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

const SUBCATEGORY = AnalysisTypes.Rekognition.Moderation;

class CreateModerationTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreateModerationTrackIterator';
  }

  async downloadSelected(bucket, key, name) {
    const query = `SELECT * FROM S3Object[*].ModerationLabels[*] s WHERE s.ModerationLabel.ParentName = '${SQL.escape(name)}';`;
    return CommonUtils.selectS3Content(bucket, key, query).catch(() =>
      this.downloadJson(bucket, key, name));
  }

  async downloadJson(bucket, key, name) {
    const data = await CommonUtils.download(bucket, key)
      .then(x => JSON.parse(x));
    return ((data || {}).ModerationLabels || []).filter(x =>
      ((x.ModerationLabel || {}).ParentName === name));
  }

  createTimeseriesData(name, datasets) {
    let desc;
    const timestamps = {};
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      if (!desc && dataset.ModerationLabel.Name) {
        desc = dataset.ModerationLabel.Name;
      }
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: Number.parseFloat(dataset.ModerationLabel.Confidence.toFixed(2)),
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

module.exports = CreateModerationTrackIterator;
