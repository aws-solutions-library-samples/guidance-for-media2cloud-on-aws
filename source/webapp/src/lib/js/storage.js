/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* eslint-disable no-bitwise */

const PREFIX = 'm2c';

const REKOGNITION = [
  'celeb',
  'face',
  'faceMatch',
  'label',
  'moderation',
  'person',
  'text',
];

const TRANSCRIBE = [
  'transcript',
];

const COMPREHEND = [
  'entity',
  'keyphrase',
  'sentiment',
  'topic',
  'classification',
];

const TEXTRACT = [
  'document',
];

const BOOLEAN_KEYWORDS = [
  ...REKOGNITION,
  ...TRANSCRIBE,
  ...COMPREHEND,
  ...TEXTRACT,
  'debug_window',
];

const STRING_KEYWORDS = [
  'languageCode',
  'customVocabulary',
  'vocabularies',
  'faceCollectionId',
  'mapApiKey',
];

const NUMBER_KEYWORDS = [
  'minConfidence',
  'pageSize',
];

const SUPPORTED_KEYWORDS = [
  ...BOOLEAN_KEYWORDS,
  ...STRING_KEYWORDS,
  ...NUMBER_KEYWORDS,
];

const SUPPORTED_LANGUAGE_CODES = {
  'ar-AE': 'Arabic (U.A.E.)',
  'ar-SA': 'Arabic (Saudi Arabia)',
  'de-CH': 'German (Switzerland)',
  'de-DE': 'German (Germany)',
  'en-AB': 'English (Scottish)',
  'en-AU': 'English (Australia)',
  'en-GB': 'English (United Kingdom)',
  'en-IE': 'English (Ireland)',
  'en-IN': 'English (Indian)',
  'en-US': 'English (United States)',
  'en-WL': 'English (Welsh)',
  'es-ES': 'Spanish (Spain)',
  'es-US': 'Spanish (United States)',
  'fa-IR': 'Farsi (Iran)',
  'fr-CA': 'French (Canada)',
  'fr-FR': 'French (France)',
  'he-IL': 'Hebrew (Israel)',
  'hi-IN': 'Hindi (India)',
  'id-ID': 'Indonesian (Indonesia)',
  'it-IT': 'Italian (Italy)',
  'ja-JP': 'Japanese (Japan)',
  'ko-KR': 'Korean (Korea)',
  'ms-MY': 'Malay (Malaysia)',
  'nl-NL': 'Dutch (Netherlands)',
  'pt-BR': 'Portuguese (Brazil)',
  'pt-PT': 'Portuguese (Portugal)',
  'ru-RU': 'Russian (Russia)',
  'ta-IN': 'Tamil (India)',
  'te-IN': 'Telugu (India)',
  'tr-TR': 'Turkish (Turkey)',
  'zh-CN': 'Chinese (PRC)',
};

const COMPREHEND_SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ar',
  'hi',
  'ja',
  'ko',
  'zh',
];

/**
 * @class Storage
 * @description store parameters to localStorage
 */
class Storage {
  /**
   * @function getSupportedLanguageCodes
   * @description get supported language code map
   */
  static getSupportedLanguageCodes() {
    return Object.keys(SUPPORTED_LANGUAGE_CODES).reduce((a0, c0) => ({
      ...a0,
      [c0]: (COMPREHEND_SUPPORTED_LANGUAGES.indexOf(c0.slice(0, 2)) < 0)
        ? `${SUPPORTED_LANGUAGE_CODES[c0]} **`
        : SUPPORTED_LANGUAGE_CODES[c0],
    }), {});
  }

  /**
   * @function isKeywordSupported
   * @description check to see if keyword is supported
   * @param {string} keyword
   */
  static isKeywordSupported(keyword) {
    return SUPPORTED_KEYWORDS.findIndex((x) => x === keyword) >= 0;
  }

  /**
   * @function hasOption
   * @description does option exist?
   * @param {string} keyword
   */
  static hasOption(keyword) {
    const sanitized = AppUtils.sanitize(keyword);

    if (!Storage.isKeywordSupported(sanitized)) {
      throw new Error(`keyword '${sanitized}' not supported`);
    }

    /* local storage always stores 'string' type */
    return typeof localStorage.getItem(`${PREFIX}-${sanitized}`) === 'string';
  }

  /* eslint-enable no-underscore-dangle */
  /* eslint-disable no-nested-ternary */

  /**
   * @function getOption
   * @description get option from local storage
   * @param {string} keyword
   * @param {*} [defaultTo] - default value if key doesn't exist
   */
  static getOption(keyword, defaultTo = true) {
    const sanitized = AppUtils.sanitize(keyword);

    if (!Storage.isKeywordSupported(sanitized)) {
      console.error(`keyword '${sanitized}' not supported`);
      return undefined;
    }

    const option = localStorage.getItem(`${PREFIX}-${sanitized}`);

    if (NUMBER_KEYWORDS.indexOf(keyword) >= 0) {
      return Number.parseInt(option || defaultTo, 10);
    }

    return (!option)
      ? defaultTo
      : (option === 'true')
        ? true
        : (option === 'false')
          ? false
          : option;
  }

  /**
   * @function setOption
   * @description set option from local storage
   * @param {string} keyword
   * @param {*} val
   */
  static setOption(keyword, val) {
    const sanitized = AppUtils.sanitize(keyword);

    if (!Storage.isKeywordSupported(sanitized)) {
      throw new Error(`keyword '${sanitized}' not supported`);
    }

    if (sanitized === 'languageCode') {
      if (Object.keys(SUPPORTED_LANGUAGE_CODES).findIndex((x) => x === val) >= 0) {
        localStorage.setItem(`${PREFIX}-${sanitized}`, val);
      }
    } else if (sanitized === 'vocabularies' && val !== undefined) {
      localStorage.setItem(`${PREFIX}-${sanitized}`, JSON.stringify(val));
    } else {
      localStorage.setItem(`${PREFIX}-${sanitized}`, val.toString());
    }
  }

  static getRekognitionOptions() {
    return REKOGNITION;
  }

  static getTranscribeOptions() {
    return TRANSCRIBE;
  }

  static getComprehendOptions() {
    return COMPREHEND;
  }

  static getTextractOptions() {
    return TEXTRACT;
  }

  static getComprehendSupportedLanguages() {
    return COMPREHEND_SUPPORTED_LANGUAGES;
  }
}
