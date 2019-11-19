/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-nested-ternary */
/* eslint-disable class-methods-use-this */
const {
  CommonUtils,
} = require('m2c-core-lib');

class Validation {
  constructor(stateData) {
    this.$stateData = stateData;

    const checksum = this.stateData.input.checksum || {};

    this.$computed = checksum.computed;
    this.$algorithm = checksum.algorithm || undefined;
    this.$expected = checksum.expected || undefined;
    this.$storeChecksumOnTagging = !(checksum.storeChecksumOnTagging === false);
    this.$comparedWith = checksum.expected
      ? Validation.Constants.ComparedType.Api
      : Validation.Constants.ComparedType.None;
    this.$comparedResult = Validation.Constants.CompareResult.Skipped;
    this.$tagUpdated = false;
  }

  get [Symbol.toStringTag]() {
    return 'Validation';
  }

  get stateData() {
    return this.$stateData;
  }

  static get Constants() {
    return {
      Tag: {
        LastModifiedSuffix: '-last-modified',
        ComputedChecksumPrefix: 'computed-',
      },
      ComparedType: {
        Api: 'api',
        None: 'none',
        ObjectTagging: 'object-tagging',
        ObjectMetadata: 'object-metadata',
        ObjectETag: 'object-etag',
      },
      CompareResult: {
        Skipped: 'SKIPPED',
        Matched: 'MATCHED',
        NotMatched: 'NOTMATCHED',
      },
    };
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

  async validate() {
    this.tags = await this.getTags();

    /* #1: compared checksum result */
    const refChecksum = this.expected || await this.bestGuessChecksum();
    this.comparedResult = (!refChecksum)
      ? Validation.Constants.CompareResult.Skipped
      : (refChecksum.toLowerCase() === this.computed.toLowerCase())
        ? Validation.Constants.CompareResult.Matched
        : Validation.Constants.CompareResult.NotMatched;

    /* #2: store checksum to tagging if MATCHED or SKIPPED */
    if (this.storeChecksumOnTagging
      && this.comparedResult !== Validation.Constants.CompareResult.NotMatched) {
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

  async getTags() {
    const src = this.stateData.input.src;
    const response = await CommonUtils.getTags(src.bucket, src.key);
    return response.TagSet;
  }

  getChecksumTagName() {
    return [
      Validation.Constants.Tag.ComputedChecksumPrefix,
      this.algorithm,
    ].join('');
  }

  getLastModifiedTagName() {
    return [
      Validation.Constants.Tag.ComputedChecksumPrefix,
      this.algorithm,
      Validation.Constants.Tag.LastModifiedSuffix,
    ].join('');
  }

  async createTags() {
    const src = this.stateData.input.src;
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

  /**
   * @function bestGuessChecksum
   * @description best effort to extract MD5 or SHA1 checksum
   */
  async bestGuessChecksum() {
    return this.algorithm === 'sha1'
      ? this.bestGuessSHA1()
      : this.bestGuessMD5();
  }

  /**
   * @function bestGuessMD5
   * @description best effort to extract MD5 from
   *   * x-computed-md5 tag
   *   * x-amz-meta-md5 metadata field
   *   * ETag (only if SSE is not KMS and only if it is not multipart upload)
   */
  async bestGuessMD5() {
    const src = this.stateData.input.src;

    /* #1: try object tag first */
    const chksum = this.tags.find(x =>
      x.Key === this.getChecksumTagName());

    if (chksum && chksum.Value.match(/^([0-9a-fA-F]{32})$/)) {
      this.comparedWith = Validation.Constants.ComparedType.ObjectTagging;
      return chksum.Value;
    }

    /* #2: try object metadata */
    const response = await CommonUtils.headObject(src.bucket, src.key);
    if (response.Metadata.md5) {
      this.comparedWith = Validation.Constants.ComparedType.ObjectMetadata;
      return response.Metadata.md5;
    }

    /* #3: last resort, try ETag iff it is NOT multipart upload and SSE is disable or AES256 */
    if (!response.ServerSideEncryption
      || response.ServerSideEncryption.toLowerCase() === 'aes256') {
      /* the regex screens any multipart upload ETag */
      const matched = response.ETag.match(/^"([0-9a-fA-F]{32})"$/);
      if (matched) {
        this.comparedWith = Validation.Constants.ComparedType.ObjectETag;
        return matched[1];
      }
    }
    return undefined;
  }

  /**
   * @function bestGuessSHA1
   * @description best effort to extract SHA1 from
   *   * x-computed-sha1 tag
   *   * x-amz-meta-sha1 metadata field
   */
  async bestGuessSHA1() {
    const src = this.stateData.input.src;

    /* #1: try object tag first */
    const chksum = this.tags.find(x =>
      x.Key === this.getChecksumTagName());

    if (chksum && chksum.Value.match(/^([0-9a-fA-F]{40})$/)) {
      this.comparedWith = Validation.Constants.ComparedType.ObjectTagging;
      return chksum.Value;
    }

    /* #2: try object metadata */
    const response = await CommonUtils.headObject(src.bucket, src.key);
    if (response.Metadata.sha1) {
      this.comparedWith = Validation.Constants.ComparedType.ObjectMetadata;
      return response.Metadata.sha1;
    }

    return undefined;
  }
}

module.exports = {
  Validation,
};
