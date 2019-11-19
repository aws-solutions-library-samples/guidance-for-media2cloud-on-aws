/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-console */
/* eslint-disable no-nested-ternary */
const {
  CommonUtils,
  StateData,
  RestoreError,
} = require('m2c-core-lib');

class S3Restore {
  constructor(stateData) {
    this.$stateData = stateData;
  }

  static get Constants() {
    return {
      Restore: {
        Days: 1,
        Tier: 'Standard',
      },
      Key: {
        ExpiryDate: 'expiry-date',
        OngoingRequest: 'ongoing-request',
      },
      RetrivalTime: {
        GLACIER: 3 * 60 * 60 * 1000,
        DEEP_ARCHIVE: 12 * 60 * 60 * 1000,
      },
    };
  }

  get [Symbol.toStringTag]() {
    return 'S3Restore';
  }

  get stateData() {
    return this.$stateData;
  }

  async checkRestoreStatus() {
    const src = (this.stateData.input || {}).src || {};
    if (!src.bucket || !src.key) {
      throw new RestoreError('mising src.bucket or key');
    }

    const response = await CommonUtils.headObject(src.bucket, src.key);
    const restoreData = S3Restore.parseKeyValuePair(response.Restore);

    /* "Restore": "ongoing-request=\"true\"" */
    const expiredAt = restoreData[S3Restore.Constants.Key.ExpiryDate]
      ? new Date(restoreData[S3Restore.Constants.Key.ExpiryDate]).getTime()
      : undefined;

    const storageClass = response.StorageClass;

    const startTime
      = ((this.stateData.input || {}).restore || {}).startTime || new Date().getTime();

    if (storageClass !== 'GLACIER' && storageClass !== 'DEEP_ARCHIVE') {
      this.stateData.setCompleted();
    } else if (restoreData[S3Restore.Constants.Key.OngoingRequest] === 'false') {
      this.stateData.setCompleted();
    } else if (!response.Restore) {
      await this.startRestore();
      this.stateData.setStarted();
    } else {
      this.stateData.setProgress(this.computeRetrivalProgress(startTime, storageClass));
    }

    const endTime = (this.stateData.status === StateData.Statuses.Completed)
      ? new Date().getTime()
      : undefined;

    this.stateData.setData('restore', {
      storageClass,
      expiredAt,
      startTime,
      endTime,
    });

    return this.stateData.toJSON();
  }

  async startRestore() {
    const src = this.stateData.input.src || {};
    console.log(`start restore process, s3://${src.bucket}/${src.key}`);

    return CommonUtils.restoreObject(src.bucket, src.key, {
      RestoreRequest: {
        Days: S3Restore.Constants.Restore.Days,
        GlacierJobParameters: {
          Tier: S3Restore.Constants.Restore.Tier,
        },
      },
    });
  }

  static parseKeyValuePair(str) {
    const pair = {};
    let current = str;
    while (current) {
      const result = S3Restore.reverseLookup(current);
      if (result) {
        pair[result.key] = result.value;
        current = result.next;
      } else {
        current = undefined;
      }
    }
    return pair;
  }

  static reverseLookup(s) {
    try {
      const token = s.substr(-1) === ',' ? s.slice(0, -1) : s;
      let idx = token.lastIndexOf('=');
      if (idx < 0) {
        throw new RangeError(`no more '=' token, ${token}`);
      }

      const value = token.substring(idx + 1).replace(/["']/g, '');
      let next = token.substring(0, idx);
      idx = next.lastIndexOf(' ');

      const key = next.substring(idx + 1);
      next = (idx < 0) ? undefined : token.substring(0, idx);

      return {
        key,
        value,
        next,
      };
    } catch (e) {
      return undefined;
    }
  }

  computeRetrivalProgress(t0, storageClass) {
    const tdiff = new Date().getTime() - t0;
    return (tdiff / (S3Restore.Constants.RetrivalTime[storageClass] || 1000)) * 100;
  }
}

module.exports = {
  S3Restore,
};
