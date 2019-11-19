/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */


/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const AIML = {
  /* video */
  celeb: false,
  face: false,
  faceMatch: false,
  label: false,
  moderation: false,
  person: false,
  text: false, // rekog-image only
  /* audio */
  transcript: false,
  classification: false,
  entity: false,
  keyphrase: false,
  sentiment: false,
  topic: false,
  /* document */
  document: false,
  /* misc. settings */
  languageCode: 'en-US',
  customVocabulary: undefined,
  vocabularies: undefined,
  faceCollectionId: undefined,
  minConfidence: 80,
};

module.exports = {
  AIML,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    AIML,
  });
