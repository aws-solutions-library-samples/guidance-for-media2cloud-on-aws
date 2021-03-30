/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
import AppUtils from './appUtils.js';

const PREFIX = 'm2c';
const REKOGNITION = [
  'celeb',
  'face',
  'facematch',
  'label',
  'moderation',
  'person',
  'text',
  'segment',
  'customlabel',
];
const TRANSCRIBE = [
  'transcribe',
];
const COMPREHEND = [
  'entity',
  'keyphrase',
  'sentiment',
  'topic',
];
const TEXTRACT = [
  'textract',
];
const BOOLEAN_KEYWORDS = [
  ...REKOGNITION,
  ...TRANSCRIBE,
  ...COMPREHEND,
  ...TEXTRACT,
  'debug_window',
];
const STRING_KEYWORDS = [
  'faceCollectionId',
  'customLabelModels',
  'languageCode',
  'customLanguageModel',
  'customEntityRecognizer',
  'textROI',
];
const NUMBER_KEYWORDS = [
  'minConfidence',
  'pageSize',
  'frameCaptureMode',
];
const OTHERS_KEYWORDS = [
  'mapApiKey',
];
const SUPPORTED_KEYWORDS = [
  ...BOOLEAN_KEYWORDS,
  ...STRING_KEYWORDS,
  ...NUMBER_KEYWORDS,
  ...OTHERS_KEYWORDS,
];
const SUPPORTED_LANGUAGE_CODES = [
  {
    name: 'Arabic (U.A.E.)',
    value: 'ar-AE',
  },
  {
    name: 'Arabic (Saudi Arabia)',
    value: 'ar-SA',
  },
  {
    name: 'German (Switzerland)',
    value: 'de-CH',
  },
  {
    name: 'German (Germany)',
    value: 'de-DE',
  },
  {
    name: 'English (Scottish)',
    value: 'en-AB',
  },
  {
    name: 'English (Australia)',
    value: 'en-AU',
  },
  {
    name: 'English (United Kingdom)',
    value: 'en-GB',
  },
  {
    name: 'English (Ireland)',
    value: 'en-IE',
  },
  {
    name: 'English (Indian)',
    value: 'en-IN',
  },
  {
    name: 'English (United States)',
    value: 'en-US',
  },
  {
    name: 'English (Welsh)',
    value: 'en-WL',
  },
  {
    name: 'Spanish (Spain)',
    value: 'es-ES',
  },
  {
    name: 'Spanish (United States)',
    value: 'es-US',
  },
  {
    name: 'Farsi (Iran)',
    value: 'fa-IR',
  },
  {
    name: 'French (Canada)',
    value: 'fr-CA',
  },
  {
    name: 'French (France)',
    value: 'fr-FR',
  },
  {
    name: 'Hebrew (Israel)',
    value: 'he-IL',
  },
  {
    name: 'Hindi (India)',
    value: 'hi-IN',
  },
  {
    name: 'Indonesian (Indonesia)',
    value: 'id-ID',
  },
  {
    name: 'Italian (Italy)',
    value: 'it-IT',
  },
  {
    name: 'Japanese (Japan)',
    value: 'ja-JP',
  },
  {
    name: 'Korean (Korea)',
    value: 'ko-KR',
  },
  {
    name: 'Malay (Malaysia)',
    value: 'ms-MY',
  },
  {
    name: 'Dutch (Netherlands)',
    value: 'nl-NL',
  },
  {
    name: 'Portuguese (Brazil)',
    value: 'pt-BR',
  },
  {
    name: 'Portuguese (Portugal)',
    value: 'pt-PT',
  },
  {
    name: 'Russian (Russia)',
    value: 'ru-RU',
  },
  {
    name: 'Tamil (India)',
    value: 'ta-IN',
  },
  {
    name: 'Telugu (India)',
    value: 'te-IN',
  },
  {
    name: 'Turkish (Turkey)',
    value: 'tr-TR',
  },
  {
    name: 'Chinese (PRC)',
    value: 'zh-CN',
  },
];

/**
 * @class Storage
 * @description store parameters to localStorage
 */
export default class Storage {
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
  static getOption(keyword, defaultTo) {
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
          : (option === 'undefined')
            ? undefined
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
    if (val === undefined) {
      localStorage.removeItem(`${PREFIX}-${sanitized}`);
    } else {
      localStorage.setItem(`${PREFIX}-${sanitized}`, val.toString());
    }
  }

  static removeOption(keyword) {
    const sanitized = AppUtils.sanitize(`${PREFIX}-${keyword}`);
    localStorage.removeItem(sanitized);
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

  static getSupportedLanguageCodes() {
    return SUPPORTED_LANGUAGE_CODES;
  }
}
