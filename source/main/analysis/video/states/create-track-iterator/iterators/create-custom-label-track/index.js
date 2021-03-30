/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const PATH = require('path');
const {
  SQL,
  AnalysisTypes,
  CommonUtils,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.CustomLabel;
const CUSTOMLABEL_MODELS = 'customLabelModels';

class CreateCustomLabelTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreateCustomLabelTrackIterator';
  }

  async downloadSelected(bucket, key, name) {
    const query = `SELECT * FROM S3Object[*].CustomLabels[*] s WHERE s.CustomLabel.Name = '${SQL.escape(name)}';`;
    return CommonUtils.selectS3Content(bucket, key, query).catch(() =>
      this.downloadJson(bucket, key, name));
  }

  async downloadJson(bucket, key, name) {
    return CommonUtils.download(bucket, key)
      .then(data =>
        JSON.parse(data).CustomLabels.filter(x =>
          x.CustomLabel.Name === name));
  }

  createTimeseriesData(name, datasets) {
    const timestamps = {};
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      const box = ((dataset.CustomLabel.Geometry || {}).BoundingBox)
        ? {
          w: Number.parseFloat(dataset.CustomLabel.Geometry.BoundingBox.Width.toFixed(4)),
          h: Number.parseFloat(dataset.CustomLabel.Geometry.BoundingBox.Height.toFixed(4)),
          l: Number.parseFloat(dataset.CustomLabel.Geometry.BoundingBox.Left.toFixed(4)),
          t: Number.parseFloat(dataset.CustomLabel.Geometry.BoundingBox.Top.toFixed(4)),
        }
        : undefined;
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: Number.parseFloat(dataset.CustomLabel.Confidence.toFixed(2)),
        ...box,
      });
    }
    if (!Object.keys(timestamps)) {
      return undefined;
    }
    return {
      label: name,
      data: Object.keys(timestamps).map(x => ({
        x: Number.parseInt(x, 10),
        y: timestamps[x].length,
        details: timestamps[x],
      })),
    };
  }

  makeRawDataPrefix(subCategory) {
    const data = this.stateData.data[subCategory];
    return PATH.join(
      super.makeRawDataPrefix(subCategory),
      data[CUSTOMLABEL_MODELS],
      '/'
    );
  }

  makeNamedPrefix(subCategory, name) {
    const data = this.stateData.data[subCategory];
    return PATH.join(
      super.makeNamedPrefix(subCategory, name),
      data[CUSTOMLABEL_MODELS],
      '/'
    );
  }

  setCompleted(params) {
    const data = this.stateData.data[SUBCATEGORY];
    const model = data[CUSTOMLABEL_MODELS];
    return super.setCompleted({
      [CUSTOMLABEL_MODELS]: model,
    });
  }
}

module.exports = CreateCustomLabelTrackIterator;
