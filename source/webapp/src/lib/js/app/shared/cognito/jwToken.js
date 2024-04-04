// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Buffer,
} = window.Polyfill;

export default class JwtToken {
  constructor(token) {
    this.$token = token || '';
    this.$payload = JwtToken.decodePayload(token);
  }

  static decodePayload(token = '') {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(
        Buffer.from(payload, 'base64').toString()
      );
    } catch (e) {
      return {};
    }
  }

  get token() {
    return this.$token;
  }

  get payload() {
    return this.$payload;
  }

  get jwtToken() {
    return this.token;
  }

  get expiration() {
    return this.payload.exp;
  }

  get issueAt() {
    return this.payload.iat;
  }
}
