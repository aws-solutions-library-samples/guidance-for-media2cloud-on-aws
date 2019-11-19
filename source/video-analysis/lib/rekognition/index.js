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
  Celeb,
} = require('./celeb');

const {
  Face,
} = require('./face');

const {
  FaceMatch,
} = require('./faceMatch');

const {
  Label,
} = require('./label');

const {
  Moderation,
} = require('./moderation');

const {
  Person,
} = require('./person');


/**
 * @class Rekognition
 */
class Rekognition {
  constructor(stateData) {
    this.$stateData = stateData;

    this.$celeb = undefined;
    this.$face = undefined;
    this.$faceMatch = undefined;
    this.$label = undefined;
    this.$moderation = undefined;
    this.$person = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'Rekognition';
  }

  get stateData() {
    return this.$stateData;
  }

  get celeb() {
    if (!this.$celeb) {
      this.$celeb = new Celeb(this.stateData);
    }
    return this.$celeb;
  }

  get face() {
    if (!this.$face) {
      this.$face = new Face(this.stateData);
    }
    return this.$face;
  }

  get faceMatch() {
    if (!this.$faceMatch) {
      this.$faceMatch = new FaceMatch(this.stateData);
    }
    return this.$faceMatch;
  }

  get label() {
    if (!this.$label) {
      this.$label = new Label(this.stateData);
    }
    return this.$label;
  }

  get moderation() {
    if (!this.$moderation) {
      this.$moderation = new Moderation(this.stateData);
    }
    return this.$moderation;
  }

  get person() {
    if (!this.$person) {
      this.$person = new Person(this.stateData);
    }
    return this.$person;
  }
}

module.exports = {
  Rekognition,
};
