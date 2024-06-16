// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  StateData,
  AnalysisTypes: {
    Textract,
  },
  AnalysisError,
  CommonUtils,
  Indexer,
} = require('core-lib');

const {
  Statuses: {
    Completed,
  },
} = StateData;

const MEDIA_TYPE = 'document';

class StateCollectAnalysisResults {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateCollectAnalysisResults';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    // unpack the parameters
    const stateExecution = this.stateData.event.stateExecution;
    const input = stateExecution.Input.input;

    const {
      bucket: proxyBucket,
    } = input.destination;

    const {
      prefix: imagePrefix,
    } = input.document;

    const {
      data: {
        [Textract]: {
          jobId,
          jsonPrefix,
        },
      },
      uuid,
    } = this.stateData;

    if (!uuid || !jobId || !jsonPrefix || !imagePrefix) {
      throw new AnalysisError('missing jobId or jsonPrefix');
    }

    // download and merge the JSON responses
    const prefix = PATH.join(jsonPrefix, jobId);
    const names = await this.getOutputNames(proxyBucket, prefix);

    const [
      outputs,
      searchDoc,
    ] = await this.parseJsonOutputs(
      proxyBucket,
      prefix,
      names,
      imagePrefix
    );

    let promises = [];

    // upload
    const name = `${String(0).padStart(8, '0')}.json`;
    promises.push(CommonUtils.uploadFile(
      proxyBucket,
      jsonPrefix,
      name,
      outputs
    ));

    // index document
    if (searchDoc && searchDoc[Textract] && searchDoc[Textract].length > 0) {
      const complete = searchDoc[Textract]
        .map((d) =>
          d.name)
        .join(' ');

      const doc = {
        type: MEDIA_TYPE,
        data: searchDoc[Textract],
        complete,
      };

      const indexer = new Indexer();
      promises.push(indexer.indexDocument(
        Textract,
        uuid,
        doc
      ));
    }

    promises = await Promise.all(promises);

    return this.setCompleted();
  }

  async getOutputNames(bucket, prefix) {
    const names = [];

    let nextToken;
    do {
      const params = {
        MaxKeys: 1000,
        ContinuationToken: nextToken,
      };

      const response = await CommonUtils.listObjects(
        bucket,
        prefix,
        params
      );

      response.Contents
        .forEach((x) => {
          const name = PATH.parse(x.Key).name;
          if (/^[0-9]+$/.test(name)) {
            // temporarily convert to number so we can sort
            names.push(Number(name));
          }
        });

      nextToken = response.NextContinuationToken;
    } while (nextToken);

    if (names.length > 1) {
      names.sort((a, b) =>
        a - b);
    }

    return names
      .map((name) =>
        String(name));
  }

  async parseJsonOutputs(
    bucket,
    prefix,
    names,
    imagePrefix
  ) {
    let metadata;
    let outputs = {};
    let searchDoc = [];

    for (let i = 0; i < names.length; i += 1) {
      const name = names[i];
      const key = PATH.join(prefix, name);

      const response = await CommonUtils.download(bucket, key)
        .then((res) =>
          JSON.parse(res));

      if (metadata === undefined) {
        metadata = {
          DetectDocumentTextModelVersion: response.DetectDocumentTextModelVersion,
          DocumentMetadata: response.DocumentMetadata,
          JobStatus: response.JobStatus,
          StatusMessage: response.StatusMessage || undefined,
          Warnings: response.StatusMessage || undefined,
        };
      }

      // group results by page
      response.Blocks.forEach((block) => {
        const pageNum = String(block.Page);

        if (outputs[pageNum] === undefined) {
          outputs[pageNum] = [];
        }
        outputs[pageNum].push(block);

        // also collect the text for indexing to opensearch
        if (block.BlockType === 'LINE') {
          const text = block.Text.trim();
          if (text.length > 0) {
            searchDoc.push({
              name: block.Text.trim(),
              page: block.Page - 1, // zero-based index
            });
          }
        }
      });
    }

    // added FileName, PageNum to the result
    outputs = Object.keys(outputs)
      .map((pageNum) => {
        const _pageNum = Number(pageNum) - 1;
        const name = `${String(_pageNum).padStart(8, '0')}.png`;
        const fileName = PATH.join(imagePrefix, name);

        return {
          PageNum: _pageNum,
          FileName: fileName,
          Blocks: outputs[pageNum],
        };
      });

    outputs = {
      Documents: outputs,
      ...metadata,
    };

    searchDoc = {
      [Textract]: searchDoc,
    };

    return [
      outputs,
      searchDoc,
    ];
  }

  setCompleted() {
    // push 'textract' data under 'document'
    // and add state machine execution info
    const {
      Id: executionArn,
      StartTime: startTime,
    } = this.stateData.event.stateExecution;

    let data = this.stateData.data[Textract];
    const output = PATH.join(data.jsonPrefix, '/');
    delete data.jsonPrefix;

    data = {
      [MEDIA_TYPE]: {
        status: Completed,
        executionArn,
        startTime: new Date(startTime).getTime(),
        endTime: Date.now(),
        [Textract]: {
          ...data,
          output,
          numOutputs: 1,
        },
      },
    };

    // reset everything
    this.stateData.data = undefined;
    this.stateData.data = data;

    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = StateCollectAnalysisResults;
