// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ChecksumError,
} = require('core-lib');

const CHUNK_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

class BaseLib {
  constructor(libName, stateData) {
    this.$libName = libName;
    this.$stateData = stateData;

    const checksum = this.stateData.data.checksum || {};
    this.$algorithm = checksum.algorithm || undefined;
    this.$fileSize = checksum.fileSize || undefined;
    this.$byteStart = Number.parseInt(checksum.nextByteStart || 0, 10);
    this.$chunkSize = Number.parseInt(checksum.chunkSize || CHUNK_SIZE, 10);
    this.$intermediateHash = checksum.intermediateHash || undefined;
    this.$computed = checksum.computed || undefined;
    this.$expected = checksum.expected || undefined;
    this.$storeChecksumOnTagging = !(checksum.storeChecksumOnTagging === false);
    this.$bytesRead = 0;
    this.$startTime = checksum.startTime || new Date().getTime();
  }

  get [Symbol.toStringTag]() {
    return this.libName;
  }

  get stateData() {
    return this.$stateData;
  }

  get libName() {
    return this.$libName;
  }

  get algorithm() {
    return this.$algorithm;
  }

  set algorithm(val) {
    this.$algorithm = val;
  }

  get fileSize() {
    return this.$fileSize;
  }

  set fileSize(val) {
    this.$fileSize = val;
  }

  get byteStart() {
    return this.$byteStart;
  }

  set byteStart(val) {
    this.$byteStart = Number.parseInt(val, 10);
  }

  get chunkSize() {
    return this.$chunkSize;
  }

  set chunkSize(val) {
    this.$chunkSize = Number.parseInt(val, 10);
  }

  get bytesRead() {
    return this.$bytesRead;
  }

  set bytesRead(val) {
    this.$bytesRead = Number.parseInt(val, 10);
  }

  get intermediateHash() {
    return this.$intermediateHash;
  }

  set intermediateHash(val) {
    this.$intermediateHash = val;
  }

  get computed() {
    return this.$computed;
  }

  set computed(val) {
    this.$computed = val;
  }

  get expected() {
    return this.$expected;
  }

  get storeChecksumOnTagging() {
    return this.$storeChecksumOnTagging;
  }

  get startTime() {
    return this.$startTime;
  }

  setChecksumCompleted() {
    this.stateData.setData('checksum', {
      algorithm: this.algorithm,
      fileSize: this.fileSize,
      computed: this.computed,
      expected: this.expected,
      storeChecksumOnTagging: this.storeChecksumOnTagging,
      startTime: this.startTime,
      endTime: new Date().getTime(),
    });
    this.stateData.setCompleted();
  }

  setChecksumInProgress() {
    this.stateData.setData('checksum', {
      algorithm: this.algorithm,
      fileSize: this.fileSize,
      chunkSize: this.chunkSize,
      bytesRead: this.bytesRead,
      nextByteStart: this.byteStart + this.bytesRead,
      intermediateHash: this.intermediateHash,
      computed: this.computed,
      expected: this.expected,
      storeChecksumOnTagging: this.storeChecksumOnTagging,
      startTime: this.startTime,
    });

    const progress = ((this.byteStart + this.bytesRead) / this.fileSize) * 100;
    this.stateData.setProgress(progress);
  }

  calculateByteRange() {
    return [
      this.byteStart,
      (this.byteStart + this.chunkSize) - 1,
    ];
  }

  async compute() {
    throw new ChecksumError('BaseLib.compute not impl');
  }
}

module.exports = BaseLib;
