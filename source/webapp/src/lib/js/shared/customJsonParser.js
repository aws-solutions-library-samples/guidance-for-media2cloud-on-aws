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
class CustomJsonParser {
  constructor(data, reader) {
    this.$jsonData = data;
    this.parse();
  }

  get jsonData() {
    return this.$jsonData;
  }

  parse() {
    return this.jsonData();
  }
}
