// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const PATH = require('path');
const {
  AnalysisTypes,
  CommonUtils,
  TarStreamHelper,
  Indexer,
} = require('core-lib');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const CATEGORY = 'comprehend';
const SUB_CATEGORY = AnalysisTypes.Comprehend.CustomEntity;
const DOC_BASENAME = 'document';
const ENTITY_OUTPUT = 'output';
const INDEX_TRANSCRIBE = 'transcribe';
const DOCUMENTS_PER_BATCH = 25;
const OUTPUT_JSON = 'output.json';

class StateCreateCustomEntityTrack extends BaseStateStartComprehend {
  constructor(stateData) {
    super(stateData, {
      subCategory: SUB_CATEGORY,
      func: () => {},
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateCreateCustomEntityTrack';
  }

  async process() {
    const data = this.stateData.data[CATEGORY][SUB_CATEGORY];
    const bucket = this.stateData.input.destination.bucket;
    const key = data.output;
    if (!key) {
      return this.dataLessThenThreshold();
    }
    const results = await TarStreamHelper.extract(bucket, key);
    if (!results[ENTITY_OUTPUT]) {
      return this.dataLessThenThreshold();
    }
    const datasets = await this.downloadTranscribeData();
    if (!datasets) {
      return this.dataLessThenThreshold();
    }
    const re = new RegExp(`${DOC_BASENAME}-([0-9]+).txt`);
    const detections = results[ENTITY_OUTPUT].toString()
      .split('\n').filter((x) => x)
      .map((x) => {
        const parsed = JSON.parse(x);
        const docId = Number(parsed.File.match(re)[1]);
        return {
          ...parsed,
          DocumentId: docId,
        };
      });
    const metadata = [];
    while (detections.length) {
      const detection = detections.shift();
      if (!detection.Entities.length) {
        continue;
      }
      const idx = detection.Line + (detection.DocumentId * DOCUMENTS_PER_BATCH);
      const timecode = datasets.data[idx].timecodes[0];
      while (detection.Entities.length) {
        const entity = detection.Entities.shift();
        metadata.push({
          type: entity.Type,
          text: entity.Text,
          confidence: Number(Number(entity.Score * 100).toFixed(2)),
          begin: timecode.begin,
          end: timecode.end,
        });
      }
    }
    /* ensure there is metadata */
    if (!metadata.length) {
      return this.dataLessThenThreshold();
    }
    /* upload metadata */
    const metadataPrefix = this.makeMetadataPrefix();
    await CommonUtils.uploadFile(bucket, metadataPrefix, OUTPUT_JSON, metadata);
    return this.setCompleted({
      metadata: PATH.join(metadataPrefix, OUTPUT_JSON),
    });
  }

  dataLessThenThreshold() {
    this.stateData.setNoData();
    return this.stateData.toJSON();
  }

  setCompleted(output) {
    const data = {
      ...(this.stateData.data[CATEGORY] || {})[this.subCategory],
      endTime: new Date().getTime(),
      ...output,
    };
    this.stateData.setData(CATEGORY, {
      [this.subCategory]: data,
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async downloadTranscribeData() {
    const indexer = new Indexer();
    const doc = await indexer.getDocument(INDEX_TRANSCRIBE, this.stateData.uuid)
      .catch((e) =>
        console.error(`[ERR]: indexer.getDocument: ${this.stateData.uuid} ${JSON.stringify(e.body, null, 2)}`));
    if (!doc || doc.data.length === 0) {
      return undefined;
    }
    return doc;
  }
}

module.exports = StateCreateCustomEntityTrack;
