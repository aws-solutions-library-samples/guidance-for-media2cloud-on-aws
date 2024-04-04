// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  Rekognition: {
    Celeb: 'celeb',
    Face: 'face',
    FaceMatch: 'facematch',
    Label: 'label',
    Moderation: 'moderation',
    // Person: 'person',
    Text: 'text',
    Segment: 'segment',
    CustomLabel: 'customlabel',
    ImageProperty: 'imageprop',
  },
  Transcribe: 'transcribe',
  Comprehend: {
    Keyphrase: 'keyphrase',
    Entity: 'entity',
    Sentiment: 'sentiment',
    // Topic: 'topic',
    // Classification: 'classification',
    CustomEntity: 'customentity',
  },
  // textract
  Textract: 'textract',

  //
  // Advanced features below:
  //
  // Ad break feature: generated breaks from scenes
  AdBreak: 'adbreak',
  // Auto face indexer: auto index unrecognized faces
  AutoFaceIndexer: 'autofaceindexer',
  // Zero shot object detection / image classification: open source ML models
  ZeroshotLabels: 'zeroshotlabels',
  // Shoppable metadata feature: require zeroshot object detection / zeroshot image classification
  Shoppable: 'shoppable',
  // Scene detection: combination segment, zeroshot image classification model, and faiss
  Scene: 'scene',
  // Toxicity features, applied to both Transcribe and Comprehend
  Toxicity: 'toxicity',
  // Transcode features
  Transcode: 'transcode',
};
