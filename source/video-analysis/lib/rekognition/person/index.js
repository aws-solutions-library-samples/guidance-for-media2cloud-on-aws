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
  CommonUtils,
} = require('m2c-core-lib');

const {
  BaseRekognition,
} = require('../base');

/**
 * @class Person
 */
class Person extends BaseRekognition {
  constructor(stateData) {
    super('person', stateData);
  }

  get [Symbol.toStringTag]() {
    return 'Person';
  }

  get propList() {
    return 'Persons';
  }

  get propName() {
    return 'Person';
  }

  get propKey() {
    return 'Index';
  }

  async startJob() {
    const fn = this.instance.startPersonTracking.bind(this.instance);
    return super.startJob(fn);
  }

  async checkJobStatus() {
    const fn = this.instance.getPersonTracking.bind(this.instance);
    return super.checkJobStatus(fn);
  }

  async collectJobResults(...args) {
    const fn = this.instance.getPersonTracking.bind(this.instance);
    return super.collectJobResults(fn);
  }

  storeUniqueMappings(response, filename) {
    let keys = (response.Persons || []).map(x =>
      (x.Person || {}).Index).filter(x => x !== undefined).map(x => String(x));
    keys = [...new Set(keys)]; // make sure keys are unique
    keys.forEach((key) => {
      this.collection[key] = this.collection[key] || [];
      this.collection[key].push(filename);
    });
  }

  async downloadSelected(bucket, key, name) {
    const query = `SELECT * FROM S3Object[*].Persons[*] s WHERE s.Person.Index = ${name};`;
    return CommonUtils.selectS3Content(bucket, key, query).catch(() =>
      this.downloadJson(bucket, key, name));
  }

  async downloadJson(bucket, key, name) {
    const response = await super.downloadJson(bucket, key);
    return ((response || {}).Persons || []).filter(x =>
      ((x.Person || {}).Index.toString() === name));
  }

  cueText(name, item) {
    return `<c.${this.keyword}>Person ${name}</c>`;
  }
}

module.exports = {
  Person,
};
