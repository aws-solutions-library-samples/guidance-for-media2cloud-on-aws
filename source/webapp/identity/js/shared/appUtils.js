// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export default class AppUtils {
  static randomHexstring() {
    const rnd = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(rnd);
    return rnd[0].toString(16);
  }

  static capitalize(name) {
    return name.replace(/_/g, ' ')
      .replace(/\b\w/g, (c) =>
        c.toUpperCase());
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

    const s0 = Array.isArray(data)
      ? data.join(', ')
      : data.toString();

    const length = Math.max(len, 10);
    if (s0.length <= length) {
      return s0;
    }
    const start = Math.floor((length / 2) - 1);
    const end = s0.length - Math.floor((length / 2) - 1);

    return `${s0.substring(0, start)}..${s0.substring(end)}`;
  }
}
