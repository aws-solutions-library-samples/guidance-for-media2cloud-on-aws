// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const AWS = (() => {
  try {
    const AWSXRay = require("aws-xray-sdk");
    return AWSXRay.captureAWS(require("aws-sdk"));
  } catch (e) {
    return require("aws-sdk");
  }
})();
const path = require("node:path");
const PDF = require("pdfjs-dist/legacy/build/pdf");
const Canvas = require("canvas");

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;
const EXPECTED_BUCKET_OWNER = process.env.ENV_EXPECTED_BUCKET_OWNER;
const STANDARD_FONTDATA_URL = path.join(
  path.dirname(require.resolve("pdfjs-dist/package.json")),
  "standard_fonts/"
);

class NodeCanvasFactory {
  create(w, h) {
    if (!w || !h) {
      throw new Error("invalid canvas size");
    }
    const canvas = Canvas.createCanvas(w, h);
    return {
      canvas,
      context: canvas.getContext("2d"),
    };
  }
}

class PDFLib {
  static async downloadS3(bucket, key) {
    if (!bucket || !key) {
      throw new Error("bucket or key not specified");
    }
    const s3 = new AWS.S3({
      apiVersion: "2006-03-01",
      computeChecksums: true,
      signatureVersion: "v4",
      s3DisableBodySigning: false,
      customUserAgent: CUSTOM_USER_AGENT,
    });
    return s3
      .getObject({
        Bucket: bucket,
        Key: key,
        ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
      })
      .promise()
      .then((data) => data.Body)
      .catch((e) => {
        throw new Error(`${e.statusCode} ${e.code} ${bucket}/${key}`);
      });
  }

  static async parseDocument(bucket, key) {
    const buffer = await PDFLib.downloadS3(bucket, key);
    const rawData = new Uint8Array(buffer);
    return PDF.getDocument({
      data: rawData,
      standardFontDataUrl: STANDARD_FONTDATA_URL,
    }).promise;
  }

  static async toPNG(document, pageNum) {
    const page = await document.getPage(pageNum);

    const viewport = page.getViewport({
      scale: 1.0,
    });
    const factory = new NodeCanvasFactory();
    const data = factory.create(viewport.width, viewport.height);

    await page.render({
      canvasContext: data.context,
      viewport,
    }).promise;

    const chunks = [];
    const instream = data.canvas.createPNGStream();
    for await (const chunk of instream) {
      chunks.push(chunk);
    }
    page.cleanup();

    return {
      page: pageNum,
      width: viewport.width,
      height: viewport.height,
      buffer: Buffer.concat(chunks),
    };
  }
}

module.exports = PDFLib;
