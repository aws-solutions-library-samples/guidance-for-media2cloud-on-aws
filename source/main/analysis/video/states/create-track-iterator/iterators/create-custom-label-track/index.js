// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  AnalysisTypes,
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

  filterBy(name, data) {
    if (!data || !data.CustomLabels || !data.CustomLabels.length) {
      return [];
    }
    return data.CustomLabels
      .filter((x) =>
        (x.CustomLabel || {}).Name === name);
  }

  createTimeseriesData(name, datasets) {
    const timestamps = {};
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      const box = ((dataset.CustomLabel.Geometry || {}).BoundingBox)
        ? {
          w: Number(dataset.CustomLabel.Geometry.BoundingBox.Width.toFixed(4)),
          h: Number(dataset.CustomLabel.Geometry.BoundingBox.Height.toFixed(4)),
          l: Number(dataset.CustomLabel.Geometry.BoundingBox.Left.toFixed(4)),
          t: Number(dataset.CustomLabel.Geometry.BoundingBox.Top.toFixed(4)),
        }
        : undefined;
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: Number(dataset.CustomLabel.Confidence.toFixed(2)),
        ...box,
      });
    }
    if (!Object.keys(timestamps)) {
      return undefined;
    }
    return {
      label: name,
      data: Object.keys(timestamps)
        .map((x) => ({
          x: Number(x),
          y: timestamps[x].length,
          details: timestamps[x],
        })),
    };
  }

  makeRawDataPrefix(subCategory) {
    const data = this.stateData.data[subCategory];
    const prefix = super.makeRawDataPrefix(subCategory);
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(prefix, data[CUSTOMLABEL_MODELS], '/');
  }

  makeNamedPrefix(subCategory, name) {
    const data = this.stateData.data[subCategory];
    const prefix = super.makeNamedPrefix(subCategory, name);
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(prefix, data[CUSTOMLABEL_MODELS], '/');
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
