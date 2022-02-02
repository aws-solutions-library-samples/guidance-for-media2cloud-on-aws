// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  ServiceAvailability,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

/**
 * @class Vocabulary
 * @description set S3 notification. Currently supports Lambda Notification only.
 */
class Vocabulary extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);
    /* sanity check */
    const data = event.ResourceProperties.Data;
    this.sanityCheck(data);
    this.$data = data;

    this.$instance = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
  }

  sanityCheck(data) {
    const missing = [
      'LanguageCode',
      'Prefix',
    ].filter(x => data[x] === undefined);
    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }
  }

  get data() {
    return this.$data;
  }

  static get DefaultPhrase() {
    return {
      'en-US': 'Welcome',
      'en-GB': 'Welcome',
      'en-AU': 'Welcome',
      'en-IN': 'Welcome',
      'es-US': 'bienvenidas',
      'es-ES': 'bienvenidas',
      'fr-CA': 'Bienvenue',
      'fr-FR': 'Bienvenue',
      'de-DE': 'herzlich willkommen',
      'pt-BR': 'bem vinda',
      'it-IT': 'benvenuta',
      'ko-KR': '어서 오십시오',
      'hi-IN': 'स्वागत हे',
      'ar-SA': 'أهلا بك',
      'ru-RU': 'приветствовать',
      'zh-CN': '欢迎',
    };
  }

  static get SupportedLanguageCode() {
    return Object.keys(Vocabulary.DefaultPhrase);
  }

  get languageCode() {
    return this.data.LanguageCode;
  }

  get prefix() {
    return this.data.Prefix;
  }

  get instance() {
    return this.$instance;
  }

  /**
   * @static
   * @function pause - execution for specified duration
   * @param {number} duration - in milliseconds
   */
  static async pause(duration = 0) {
    return new Promise((resolve) => {
      setTimeout(() =>
        resolve(), duration);
    });
  }

  /**
   * @function createVocabulary
   * @description create vocabulary. Vocabulary name is based on the language code specified
   * @returns {string} name
   */
  async createVocabulary() {
    const name = `${this.prefix}${this.languageCode}`;
    try {
      const response = await this.instance.createVocabulary({
        LanguageCode: this.languageCode,
        VocabularyName: name,
        Phrases: [
          Vocabulary.DefaultPhrase[this.languageCode],
        ],
      }).promise();
      return response.VocabularyName;
    } catch (e) {
      if (e.code !== 'ConflictException') {
        throw e;
      }
      return name;
    }
  }

  /**
   * @function waitForVocabulary
   * @description wait for vocabulary to be READY
   * @param {string} name - vocabulary name
   */
  async waitForVocabulary(name) {
    let response;
    let tries = 0;
    const maxTries = 15;

    do {
      await Vocabulary.pause(tries * 2 * 1000);
      response = await this.instance.getVocabulary({
        VocabularyName: name,
      }).promise().catch((e) => {
        console.log(`waitForVocabulary: ${e.message}`);
      });
    } while (tries++ < maxTries && ((response || {}).VocabularyState !== 'READY'));

    if ((response || {}).VocabularyState !== 'READY') {
      console.log(`fail to create vocabulary, status = ${(response || {}).VocabularyState}`);
    }
  }

  /**
   * @function batchDeleteVocabularies
   * @description remove all possible vocabularies created by Media2Cloud
   * The vocabularies are suffixed with each language code
   */
  async batchDeleteVocabularies() {
    const suffixes = Vocabulary.SupportedLanguageCode.slice(0);
    while (suffixes.length > 0) {
      const name = `${this.prefix}${suffixes.shift()}`;
      await this.instance.deleteVocabulary({
        VocabularyName: name,
      }).promise().catch((e) => {
        console.log(`batchDeleteVocabularies: ${name}: ${e.message}`);
      });
    }
  }

  /**
   * @function create
   * @description create custom vocabulary and wait for it to complete.
   */
  async create() {
    if (!(await this.checkService())) {
      return this.responseData;
    }

    const name = await this.createVocabulary();
    this.storeResponseData('Name', name);

    await this.waitForVocabulary(name);
    this.storeResponseData('Status', 'SUCCESS');

    return this.responseData;
  }

  /**
   * @function purge
   * @description batch delete all possible vocabularies created by Media2Cloud solution
   */
  async purge() {
    if (!(await this.checkService())) {
      return this.responseData;
    }

    await this.batchDeleteVocabularies();
    this.storeResponseData('Status', 'SUCCESS');

    return this.responseData;
  }

  async checkService() {
    const supported = await ServiceAvailability.probe('transcribe').catch(() => false);
    if (!supported) {
      this.storeResponseData('Name', '');
      this.storeResponseData('Status', 'SKIPPED');
      this.storeResponseData('Reason', `transcribe not available in ${process.env.AWS_REGION} region`);
    }
    return supported;
  }
}

module.exports = Vocabulary;
