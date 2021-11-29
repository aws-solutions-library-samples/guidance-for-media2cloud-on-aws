// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const AnalysisTypes = require('./analysisTypes');

const REKOGNITION_OPTIONS = Object.values(AnalysisTypes.Rekognition)
  .reduce((a0, c0) => ({
    ...a0,
    [c0]: false,
  }), undefined);
const COMPREHEND_OPTIONS = Object.values(AnalysisTypes.Comprehend)
  .reduce((a0, c0) => ({
    ...a0,
    [c0]: false,
  }), undefined);
const TRANSCRIBE_OPTIONS = {
  [AnalysisTypes.Transcribe]: false,
};
const TEXTRACT_OPTIONS = {
  [AnalysisTypes.Textract]: false,
};
const DEFAULT_MINCONFIDENCE = 80;
const DEFAULT_TEXTROI = [
  false, false, false,
  false, false, false,
  false, false, false,
];

module.exports = {
  ...REKOGNITION_OPTIONS,
  /* rekognition customization */
  minConfidence: DEFAULT_MINCONFIDENCE,
  faceCollectionId: undefined,
  customLabelModels: [],
  frameCaptureMode: 0,
  textROI: DEFAULT_TEXTROI,
  framebased: false,
  ...TRANSCRIBE_OPTIONS,
  /* transcribe customization */
  languageCode: undefined,
  customVocabulary: undefined,
  customLanguageModel: undefined,
  ...COMPREHEND_OPTIONS,
  /* comprehend customization */
  customEntityRecognizer: undefined,
  ...TEXTRACT_OPTIONS,
};
