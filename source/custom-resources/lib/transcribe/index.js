// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * @function CreateCustomVocabulary
 * @param {object} event
 * @param {object} context
 */
exports.CreateCustomVocabulary = async (event, context) => {
  try {
    const Vocabulary = require('./vocabulary');
    const vocabulary = new Vocabulary(event, context);
    return (vocabulary.isRequestType('delete'))
      ? vocabulary.purge()
      : vocabulary.create();
  } catch (e) {
    e.message = `Vocabulary: ${e.message}`;
    throw e;
  }
};
