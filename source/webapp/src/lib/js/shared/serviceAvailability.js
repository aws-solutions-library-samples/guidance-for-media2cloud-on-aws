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
/* eslint-disable class-methods-use-this */

class ServiceAvailability {
  constructor() {
    this.$region = undefined;
    this.$rekognition = false;
    this.$comprehend = false;
    this.$transcribe = false;
    this.$textract = false;
  }

  /**
   * @static
   * @function createInstance
   * @description ServiceAvailability singleton
   */
  static createInstance() {
    if (!window.AWSomeNamespace.serviceInstance) {
      window.AWSomeNamespace.serviceInstance = new ServiceAvailability();
    }
    return window.AWSomeNamespace.serviceInstance;
  }

  get region() {
    return this.$region;
  }

  set region(val) {
    this.$region = val;
  }

  get rekognition() {
    return this.$rekognition;
  }

  set rekognition(val) {
    this.$rekognition = !!val;
  }

  get comprehend() {
    return this.$comprehend;
  }

  set comprehend(val) {
    this.$comprehend = !!val;
  }

  get transcribe() {
    return this.$transcribe;
  }

  set transcribe(val) {
    this.$transcribe = !!val;
  }

  get textract() {
    return this.$textract;
  }

  set textract(val) {
    this.$textract = !!val;
  }

  /**
   * @async
   * @function detectServices
   * @description detect AIML service availability of the region
   */
  async detectServices(region = SO0050.Region) {
    this.region = region;

    const results = await Promise.all([
      'rekognition',
      'comprehend',
      'transcribe',
      'textract',
    ].map(x => this.probe(x).catch(() => false)));

    this.rekognition = results.shift();
    this.comprehend = results.shift();
    this.transcribe = results.shift();
    this.textract = results.shift();
  }

  /**
   * @async
   * @function probe
   * @description simple http request to check if service is available in this region.
   */
  async probe(service) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();

      request.open('HEAD', `https://${service}.${this.region}.amazonaws.com`, true);

      /* if is onerror, it means the service is unavailable in this region. */
      request.onerror = () => resolve(false);

      request.onabort = e => reject(e);

      /* if the request goes through, the service is available regardless of the status */
      request.onreadystatechange = () => {
        if (request.readyState === XMLHttpRequest.DONE && request.status !== 0) {
          resolve(true);
        }
      };
      return request.send();
    });
  }
}
