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
/* eslint-disable no-plusplus */
/* eslint-disable no-alert */
/* eslint-disable no-nested-ternary */

/**
 * @mixins mxReadable
 * @description helper functions to convert number to readable string
 */
const mxReadable = Base => class extends Base {
  static readable(num, base, units) {
    const size = Number.parseInt(num || 0, 10);
    if (!size) {
      return `0 ${units[0]}`;
    }
    const i = Math.floor(Math.log(size) / Math.log(base));
    // eslint-disable-next-line
    return `${(size / Math.pow(base, i)).toFixed(2) * 1} ${units[i]}`;
  }

  static readableFileSize(size) {
    return BaseCard.readable(size, 1000, [
      'B', 'KB', 'MB', 'GB', 'TB',
    ]);
  }

  static readableBitrate(bitrate) {
    return BaseCard.readable(bitrate, 1000, [
      'bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps',
    ]);
  }

  static readableDuration(durationInMs) {
    const HH = Math.floor(durationInMs / 3600000);
    const MM = Math.floor((durationInMs % 3600000) / 60000);
    const SS = Math.floor((durationInMs % 60000) / 1000);
    const mmm = Math.ceil(durationInMs % 1000);
    return `${HH.toString().padStart(2, '0')}:${MM.toString().padStart(2, '0')}:${SS.toString().padStart(2, '0')}.${mmm.toString().padStart(3, '0')}`;
  }

  static capitalize(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  static shorten(data, len = 40) {
    switch (typeof data) {
      case 'number':
      case 'boolean':
      case 'symbol':
      case 'undefined':
        return data;
      default:
        break;
    }

    const s0 = Array.isArray(data) ? data.join(', ') : data.toString();
    const length = Math.max(len, 20);

    if (s0.length <= length) {
      return s0;
    }

    return `${s0.substring(0, length - 10)}...${s0.substring(s0.length - 7)}`;
  }
};
