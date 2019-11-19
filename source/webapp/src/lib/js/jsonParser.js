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
/* eslint-disable no-alert */
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-nested-ternary */
class JsonParser {
  static async createInstance(file) {
    const jsonData = await JsonParser.loadJson(file);
    return (jsonData.collectionUuid)
      ? new DefaultJsonParser(jsonData, file)
      : (jsonData.legacyArchiveObject)
        ? new CustomJsonParser(jsonData, file)
        : undefined;
  }

  static async loadJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.readyState === 2) {
          resolve(JSON.parse(reader.result));
        }
      };
      reader.onerror = () =>
        reject(new Error(reader.error.code));
      reader.readAsText(file);
    });
  }
}
