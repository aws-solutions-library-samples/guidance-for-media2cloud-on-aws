/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  CommonUtils,
  StateData,
  ChecksumError,
} = require('core-lib');

// ComparedWith flag
const TYPE_API = 'api';
const TYPE_NONE = 'none';
const TYPE_OBJECT_TAGGING = 'object-tagging';
const TYPE_OBJECT_METADATA = 'object-metadata';
const TYPE_ETAG = 'object-etag';
// ComparedResult flag
const RESULT_SKIPPED = 'SKIPPED';
const RESULT_MATCHED = 'MATCHED';
const RESULT_NOTMATCHED = 'NOTMATCHED';
// Tag related
const TAG_COMPUTED_CHECKSUM_PREFIX = 'computed-';
const TAG_LAST_MODIFIED_SUFFIX = '-last-modified';

class StateValidateChecksum {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new ChecksumError('stateData not StateData object');
    }
    this.$stateData = stateData;
    const checksum = this.stateData.data.checksum || {};
    this.$computed = checksum.computed;
    this.$algorithm = checksum.algorithm || undefined;
    this.$expected = checksum.expected || undefined;
    this.$storeChecksumOnTagging = !(checksum.storeChecksumOnTagging === false);
    this.$comparedWith = checksum.expected ? TYPE_API : TYPE_NONE;
    this.$comparedResult = RESULT_SKIPPED;
    this.$tagUpdated = false;
  }

  get [Symbol.toStringTag]() {
    return 'StateValidateChecksum';
  }

  get stateData() {
    return this.$stateData;
  }

  get computed() {
    return this.$computed;
  }

  get algorithm() {
    return this.$algorithm;
  }

  get storeChecksumOnTagging() {
    return this.$storeChecksumOnTagging;
  }

  get expected() {
    return this.$expected;
  }

  set expected(val) {
    this.$expected = val;
  }

  get comparedWith() {
    return this.$comparedWith;
  }

  set comparedWith(val) {
    this.$comparedWith = val;
  }

  get comparedResult() {
    return this.$comparedResult;
  }

  set comparedResult(val) {
    this.$comparedResult = val;
  }

  get tagUpdated() {
    return this.$tagUpdated;
  }

  set tagUpdated(val) {
    this.$tagUpdated = !!val;
  }

  async process() {
    this.tags = await this.getTags();
    /* #1: compared checksum result */
    const refChecksum = this.expected || await this.bestGuessChecksum();
    this.comparedResult = (!refChecksum)
      ? RESULT_SKIPPED
      : (refChecksum.toLowerCase() === this.computed.toLowerCase())
        ? RESULT_MATCHED
        : RESULT_NOTMATCHED;
    /* #2: store checksum to tagging if MATCHED or SKIPPED */
    if (this.storeChecksumOnTagging
      && this.comparedResult !== RESULT_NOTMATCHED) {
      await this.createTags();
    }
    this.stateData.setData('checksum', {
      algorithm: this.algorithm,
      computed: this.computed,
      expected: this.expected,
      comparedWith: this.comparedWith,
      comparedResult: this.comparedResult,
      storeChecksumOnTagging: this.storeChecksumOnTagging,
      tagUpdated: this.tagUpdated,
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async bestGuessChecksum() {
    return this.algorithm === 'sha1'
      ? this.bestGuessSHA1()
      : this.bestGuessMD5();
  }

  async bestGuessSHA1() {
    const src = this.stateData.input;
    /* #1: try object tag first */
    const chksum = this.tags.find(x =>
      x.Key === this.getChecksumTagName());
    if (chksum && chksum.Value.match(/^([0-9a-fA-F]{40})$/)) {
      this.comparedWith = TYPE_OBJECT_TAGGING;
      return chksum.Value;
    }
    /* #2: try object metadata */
    const response = await CommonUtils.headObject(src.bucket, src.key);
    if (response.Metadata.sha1) {
      this.comparedWith = TYPE_OBJECT_METADATA;
      return response.Metadata.sha1;
    }
    return undefined;
  }

  async bestGuessMD5() {
    const src = this.stateData.input;
    /* #1: try object tag first */
    const chksum = this.tags.find(x =>
      x.Key === this.getChecksumTagName());
    if (chksum && chksum.Value.match(/^([0-9a-fA-F]{32})$/)) {
      this.comparedWith = TYPE_OBJECT_TAGGING;
      return chksum.Value;
    }
    /* #2: try object metadata */
    const response = await CommonUtils.headObject(src.bucket, src.key);
    if (response.Metadata.md5) {
      this.comparedWith = TYPE_OBJECT_METADATA;
      return response.Metadata.md5;
    }
    /* #3: last resort, try ETag iff it is NOT multipart upload and SSE is disable or AES256 */
    if (!response.ServerSideEncryption
      || response.ServerSideEncryption.toLowerCase() === 'aes256') {
      /* the regex screens any multipart upload ETag */
      const matched = response.ETag.match(/^"([0-9a-fA-F]{32})"$/);
      if (matched) {
        this.comparedWith = TYPE_ETAG;
        return matched[1];
      }
    }
    return undefined;
  }

  async getTags() {
    const src = this.stateData.input;
    const response = await CommonUtils.getTags(src.bucket, src.key);
    return response.TagSet;
  }

  async createTags() {
    const src = this.stateData.input;
    const tagChksum = this.getChecksumTagName();
    const tagModified = this.getLastModifiedTagName();
    const response = await CommonUtils.tagObject(src.bucket, src.key, [{
      Key: tagChksum,
      Value: this.computed,
    }, {
      Key: tagModified,
      Value: (new Date()).getTime().toString(),
    }]);
    this.tagUpdated = response !== undefined;
  }

  getChecksumTagName() {
    return [
      TAG_COMPUTED_CHECKSUM_PREFIX,
      this.algorithm,
    ].join('');
  }

  getLastModifiedTagName() {
    return [
      TAG_COMPUTED_CHECKSUM_PREFIX,
      this.algorithm,
      TAG_LAST_MODIFIED_SUFFIX,
    ].join('');
  }
}

module.exports = StateValidateChecksum;
