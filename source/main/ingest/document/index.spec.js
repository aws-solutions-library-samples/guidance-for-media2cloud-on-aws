/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/
let { Environment, StateData, CommonUtils, DB } = require("core-lib");
let StateRunDocInfo = require("./states/run-docinfo");
let PDFLib = require("./states/run-docinfo/pdfLib");
let AWSMock = require("aws-sdk-mock");
const fs = require("fs");
const PDF = require("pdfjs-dist");

const lambda = require("./index.js");
let AWS = require("aws-sdk");
AWSMock.setSDKInstance(AWS);

const path = require("node:path");
const STANDARD_FONTDATA_URL = path.join(
  path.dirname(require.resolve("pdfjs-dist/package.json")),
  "standard_fonts/"
);

const document = Buffer.from(fs.readFileSync("example.pdf"));
const rawData = new Uint8Array(document);
const parsedDocument = PDF.getDocument({
  data: rawData,
  standardFontDataUrl: STANDARD_FONTDATA_URL,
}).promise;

const event_StateRunDocInfo = {
  operation: "run-docinfo",
  input: {
    bucket: "m2c-unit-test-pdf",
    key: "example.pdf",
    uuid: "cf9a0540-4efb-c826-c03d-3c969e4015ab",
    aiOptions: {
      celeb: true,
      face: true,
      facematch: true,
      label: true,
      moderation: true,
      person: true,
      text: true,
      segment: true,
      customlabel: false,
      minConfidence: 80,
      customLabelModels: [],
      frameCaptureMode: 1003,
      textROI: [true, true, true, true, true, true, true, true, true],
      framebased: true,
      transcribe: true,
      keyphrase: true,
      entity: true,
      sentiment: true,
      customentity: false,
      textract: true,
      languageCode: "en-US",
    },
    attributes: {},
    destination: {
      bucket: "m2c-unit-test-pdf",
      prefix: "cf9a0540-4efb-c826-c03d-3c969e4015ab/example/",
    },
    type: "document",
  },
  data: {
    restore: {
      tier: "Bulk",
      startTime: 1675386493721,
      endTime: 1675386493721,
    },
    checksum: {
      algorithm: "md5",
      fileSize: 780806,
      computed: "86814cf7dcc707d6b1598d5309d42e20",
      storeChecksumOnTagging: true,
      startTime: 1675386493942,
      endTime: 1675386494082,
      comparedWith: "object-metadata",
      comparedResult: "MATCHED",
      tagUpdated: true,
    },
  },
  progress: 0,
  uuid: "cf9a0540-4efb-c826-c03d-3c969e4015ab",
  status: "NOT_STARTED",
};

const context = {
  invokedFunctionArn: "arn:partition:service:region:account-id:resource-id",
  getRemainingTimeInMillis: 1000,
};

describe("#Main/Analysis/Main::", () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache

    jest.spyOn(DB, "constructor").mockImplementationOnce(() => {
      return {
        async update(primaryValue, sortValue, attributes, merge = true) {
          return "done";
        },
      };
    });
    jest.spyOn(DB.prototype, "update").mockImplementation(() => {});
    jest.spyOn(PDFLib, "parseDocument").mockImplementation(() => {
      return parsedDocument;
    });
    jest.spyOn(CommonUtils, "uploadFile").mockImplementation(() => {
      return "done";
    });

    process.env = {};
  });

  test("Test the lambda handler ingest state", async () => {
    process.env.ENV_SOLUTION_ID = "so050";
    process.env.ENV_RESOURCE_PREFIX = "/new-prefix/";
    process.env.ENV_IOT_HOST = "https://test.com/";
    process.env.ENV_IOT_TOPIC = "7080";
    process.env.ENV_INGEST_BUCKET = "test";
    process.env.ENV_PROXY_BUCKET = "test";

    const data = lambda.handler(event_StateRunDocInfo, context);

    expect(data).toBeDefined();
  });

  test("Test the lambda handler fail state", async () => {
    expect(() => lambda.handler(event_StateRunDocInfo, context).toThrowError());
  });

  test("Test the StateRunDocInfo ingest state", async () => {
    const stateData = new StateData(
      Environment.StateMachines.DocumentIngest,
      event_StateRunDocInfo,
      context
    );

    let instance = new StateRunDocInfo(stateData);

    await instance.process();

    expect(instance).toBeDefined();
  });

  test("Test the StateRunDocInfo s3 error", async () => {
    expect(() => PDFLib.downloadS3().toThrowError());
  });

  test("Test the StateRunDocInfo s3 success", async () => {
    const stream = "hello";

    AWSMock.mock("S3", "getObject", { Body: stream });

    const theReturn = await PDFLib.downloadS3("bucket", "key");
    expect(theReturn).toBe(stream);
  });
});
