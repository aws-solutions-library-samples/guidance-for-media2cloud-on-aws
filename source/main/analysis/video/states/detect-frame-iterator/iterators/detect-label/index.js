// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('node:path');
const {
  DetectLabelsCommand,
} = require('@aws-sdk/client-rekognition');
const {
  CommonUtils,
  AnalysisTypes,
  WhitelistLabels,
} = require('core-lib');
const BaseDetectFrameIterator = require('../shared/baseDetectFrameIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Label;
const FEATURE_IMAGEPROP = AnalysisTypes.Rekognition.ImageProperty;
const NAMED_KEY = 'Labels';
const IMAGEPROP_FILENAME = 'imageprop.json';
const SKIP_FRAME_ANALYSIS = [
  'ColorBars',
  'BlackFrames',
  // 'StudioLogo',
  // 'Slate',
  // 'EndCredits',
  // 'OpeningCredits',
  // 'Content',
  // 'undefined',
];

class DetectLabelIterator extends BaseDetectFrameIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    this.$paramOptions = {
      MinConfidence: stateData.data[SUBCATEGORY].minConfidence,
      Features: [
        'GENERAL_LABELS',
      ],
      /*
      Settings: {
        GeneralLabels: {
          LabelInclusionFilters: labelIncludsionFilters,
        },
      },
      */
    };
    if (stateData.data[SUBCATEGORY][FEATURE_IMAGEPROP]) {
      this.$paramOptions.Features.push('IMAGE_PROPERTIES');
      this.$paramOptions.Settings = {
        ...this.$paramOptions.Settings,
        ImageProperties: {
          MaxDominantColors: 4,
        },
      };
    }

    this.$imagePropEnabled = stateData.data[SUBCATEGORY][FEATURE_IMAGEPROP];
    this.$imageProperties = [];
  }

  get [Symbol.toStringTag]() {
    return 'DetectLabelIterator';
  }

  get imageProperties() {
    return this.$imageProperties;
  }

  set imageProperties(val) {
    this.$imageProperties = val;
  }

  get imagePropEnabled() {
    return this.$imagePropEnabled;
  }

  async detectFrame(bucket, key, frameNo, timestamp) {
    const params = this.makeParams(bucket, key, this.paramOptions);
    const command = new DetectLabelsCommand(params);

    return this.detectFn(command)
      .then((res) =>
        this.parseLabelResult(
          res,
          frameNo,
          timestamp
        ));
  }

  parseLabelResult(
    data,
    frameNo,
    timestamp
  ) {
    if (this.imagePropEnabled) {
      const imageprop = this.parseImageProperties(
        data,
        frameNo,
        timestamp
      );
      this.imageProperties.push(imageprop);
    }

    if (!data || !data.Labels || !data.Labels.length) {
      return undefined;
    }

    if (!this.modelMetadata) {
      this.modelMetadata = {
        LabelModelVersion: data.LabelModelVersion,
      };
    }

    const minConfidence = this.minConfidence;
    const filtered = data.Labels
      .filter((x) =>
        x.Confidence >= minConfidence);
      /* Uncomment it to whitelist labels
      .filter((x) =>
        WhitelistLabels[x.Name] !== undefined)
      */

    return filtered
      .map(x => ({
        Timestamp: timestamp,
        FrameNumber: frameNo,
        Label: x,
      }));
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) =>
          x.Label.Name)),
    ];
  }

  parseImageProperties(
    data,
    frameNo,
    timestamp
  ) {
    /* reduce the payload size */
    const imageprop = data.ImageProperties;
    [
      imageprop,
      imageprop.Foreground || {},
      imageprop.Background || {},
    ].forEach((item) => {
      Object.keys(item.Quality || {})
        .forEach((x) => {
          item.Quality[x] = Number(item.Quality[x].toFixed(2));
        });
      (item.DominantColors || [])
        .forEach((x) => {
          x.PixelPercent = Number(x.PixelPercent.toFixed(2));
        });
    });

    return {
      Timestamp: timestamp,
      FrameNumber: frameNo,
      ImageProperty: imageprop,
    };
  }

  async updateOutputs(bucket, prefix) {
    if (this.imagePropEnabled) {
      await this.updateImagePropFile(
        bucket,
        prefix,
        IMAGEPROP_FILENAME,
        this.imageProperties
      );
    }
    return super.updateOutputs(bucket, prefix);
  }

  async updateImagePropFile(
    bucket,
    prefix,
    name,
    dataset
  ) {
    /* download and merge dataset */
    const key = PATH.join(prefix, name);
    let merged = await CommonUtils.download(
      bucket,
      key
    ).then((x) =>
      JSON.parse(x))
      .catch(() => ({
        ImageProperties: [],
      }));

    merged = {
      ...this.modelMetadata,
      ImageProperties: merged.ImageProperties
        .concat(dataset),
    };

    return CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      merged
    ).catch((e) =>
      console.error(e));
  }

  skipFrame(frame) {
    return SKIP_FRAME_ANALYSIS
      .includes((frame || {}).technicalCueType);
  }
}

module.exports = DetectLabelIterator;
