// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SQL,
  AnalysisTypes,
  CommonUtils,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Person;

class CreatePersonTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreatePersonTrackIterator';
  }

  async downloadSelected(bucket, key, name) {
    const query = `SELECT * FROM S3Object[*].Persons[*] s WHERE s.Person.Index = ${SQL.escape(name)};`;
    return CommonUtils.selectS3Content(bucket, key, query).catch(() =>
      this.downloadJson(bucket, key, name));
  }

  async downloadJson(bucket, key, name) {
    const data = await CommonUtils.download(bucket, key)
      .then(x => JSON.parse(x));
    return ((data || {}).Persons || []).filter(x =>
      ((x.Person || {}).Index.toString() === name));
  }

  createTimeseriesData(name, datasets) {
    const timestamps = {};
    let desc;
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      const details = dataset.Person;
      if (!details.BoundingBox) {
        continue;
      }
      if (!desc) {
        desc = `Index ${details.Index}`;
      }
      const xy = ((details.Face || {}).BoundingBox)
        ? {
          c: Number.parseFloat(details.Face.Confidence.toFixed(2)),
          w: Number.parseFloat(details.Face.BoundingBox.Width.toFixed(4)),
          h: Number.parseFloat(details.Face.BoundingBox.Height.toFixed(4)),
          l: Number.parseFloat(details.Face.BoundingBox.Left.toFixed(4)),
          t: Number.parseFloat(details.Face.BoundingBox.Top.toFixed(4)),
        }
        : undefined;
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: Number.parseFloat((details.Confidence || 0).toFixed(2)),
        w: Number.parseFloat(details.BoundingBox.Width.toFixed(4)),
        h: Number.parseFloat(details.BoundingBox.Height.toFixed(4)),
        l: Number.parseFloat(details.BoundingBox.Left.toFixed(4)),
        t: Number.parseFloat(details.BoundingBox.Top.toFixed(4)),
        xy,
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

module.exports = CreatePersonTrackIterator;
