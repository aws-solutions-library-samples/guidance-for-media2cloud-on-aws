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
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
const {
  Classification,
} = require('./classification');

const {
  Entity,
} = require('./entity');

const {
  Keyphrase,
} = require('./keyphrase');

const {
  Sentiment,
} = require('./sentiment');

const {
  Topic,
} = require('./topic');

/**
 * @class Comprehend
 */
class Comprehend {
  constructor(stateData) {
    this.$stateData = stateData;

    this.$classification = undefined;
    this.$entity = undefined;
    this.$keyphrase = undefined;
    this.$sentiment = undefined;
    this.$topic = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'Comprehend';
  }

  get stateData() {
    return this.$stateData;
  }

  get classification() {
    if (!this.$classification) {
      this.$classification = new Classification(this.stateData);
    }
    return this.$classification;
  }

  get entity() {
    if (!this.$entity) {
      this.$entity = new Entity(this.stateData);
    }
    return this.$entity;
  }

  get keyphrase() {
    if (!this.$keyphrase) {
      this.$keyphrase = new Keyphrase(this.stateData);
    }
    return this.$keyphrase;
  }

  get sentiment() {
    if (!this.$sentiment) {
      this.$sentiment = new Sentiment(this.stateData);
    }
    return this.$sentiment;
  }

  get topic() {
    if (!this.$topic) {
      this.$topic = new Topic(this.stateData);
    }
    return this.$topic;
  }
}

module.exports = {
  Comprehend,
};
