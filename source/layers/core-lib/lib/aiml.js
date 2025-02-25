// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Rekognition: {
    Celeb,
    Face,
    FaceMatch,
    Label,
    Moderation,
    Text,
    Segment,
    CustomLabel,
    ImageProperty,
  },
  Transcribe,
  Comprehend: {
    Keyphrase,
    Entity,
    Sentiment,
    CustomEntity,
  },
  Textract,
  AutoFaceIndexer,
  Scene,
  AdBreak,
  ZeroshotLabels,
  Shoppable,
  Toxicity,
} = require('./analysisTypes');

const DEFAULT_MINCONFIDENCE = 80;
const DEFAULT_TEXTROI = Array(9).fill(false);

const REKOGNITION_OPTIONS = {
  [Celeb]: false,
  [Face]: false,
  [FaceMatch]: false,
  [Label]: false,
  [Moderation]: false,
  [Text]: false,
  [Segment]: false,
  [CustomLabel]: false,
  [ImageProperty]: false,
  minConfidence: DEFAULT_MINCONFIDENCE,
  faceCollectionId: undefined,
  framebased: false,
  frameCaptureMode: 0,
  textROI: DEFAULT_TEXTROI,
  customLabelModels: [],
};

const COMPREHEND_OPTIONS = {
  [Keyphrase]: false,
  [Entity]: false,
  [Sentiment]: false,
  [CustomEntity]: false,
  customEntityRecognizer: undefined,
};

const TRANSCRIBE_OPTIONS = {
  [Transcribe]: false,
  languageCode: undefined,
  customVocabulary: undefined,
  customLanguageModel: undefined,
};

const TEXTRACT_OPTIONS = {
  [Textract]: false,
};

const ADVANCED_FEATURES = {
  [AutoFaceIndexer]: false,
  [Scene]: false,
  [AdBreak]: false,
  [ZeroshotLabels]: [],
  [Shoppable]: false,
  [Toxicity]: false,
  // filters - fine tune analysis settings
  filters: {
    // segment: {
    //   maxPixelThreshold,
    //   minCoveragePercentage,
    //   enableTechnicalCue, // default to true
    // },
    // autofaceindexer: {
    //   minFaceW,
    //   minFaceH,
    //   maxPitch,
    //   maxRoll,
    //   maxYaw,
    //   minBrightness,
    //   minSharpness,
    //   minCelebConfidence,
    // },
    // adbreak: {
    //   breakInterval,
    //   breakOffset,
    // },
    // scene: {
    //   enhanceWithTranscript,
    //   enhanceWithLLM,
    //   minFrameSimilarity,
    //   maxTimeDistance,
    // },
    // ...
  },
};

const AIML = {
  ...REKOGNITION_OPTIONS,
  ...TRANSCRIBE_OPTIONS,
  ...COMPREHEND_OPTIONS,
  ...TEXTRACT_OPTIONS,
  ...ADVANCED_FEATURES,
};

const V4_PRESET_DEFAULT = 'v4.default';
const V4_PRESET_ALL = 'v4.all';

// legacy defaultAIOptions settings
function _v3Presets(detections = []) {
  const features = {
    ...AIML,
  };

  detections.forEach((name) => {
    features[name] = true;
  });

  return features;
}

function _v4Presets(preset = V4_PRESET_DEFAULT) {
  const features = {
    ...AIML,
    [Celeb]: true,
    [FaceMatch]: true,
    [Label]: true,
    [Segment]: true,
    [Transcribe]: true,
    [Entity]: true,
    [Keyphrase]: true,
    [Textract]: true,
    [AutoFaceIndexer]: true,
    [Scene]: true,
    [AdBreak]: true,
    faceCollectionId: AutoFaceIndexer,
    framebased: true,
    frameCaptureMode: 9999,
  };

  // if (preset === V4_PRESET_DEFAULT) {
  //   return features;
  // }

  if (preset === V4_PRESET_ALL) {
    Object.keys(features)
      .forEach((name) => {
        if (typeof features[name] === 'boolean') {
          features[name] = true;
        }
      });
  }

  return features;
}

function aimlGetPresets(defaultPresets = '') {
  let presets;

  try {
    let detections = defaultPresets;

    if (typeof detections === 'string') {
      detections = detections
        .split(',')
        .map((x) =>
          x.trim())
        .filter((x) =>
          x !== undefined && x.length > 0);
    }

    if (detections.length === 0) {
      presets = _v4Presets();
    } else if (detections.length === 1 && detections[0].startsWith('v4')) {
      presets = _v4Presets(detections[0]);
    } else {
      presets = _v3Presets(detections);
    }

    console.log(`aimlGetPresets = ${JSON.stringify(presets, null, 2)}`);

    return presets;
  } catch (e) {
    console.log(`[ERR]: aimlGetPresets: ${defaultPresets}, ${e.message}`);
    throw e;
  }
}

module.exports = {
  AIML,
  aimlGetPresets,
};
