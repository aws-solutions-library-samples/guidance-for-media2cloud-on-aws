// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const PDF = require('pdfjs-dist');
const Canvas = require('canvas');

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;
const EXPECTED_BUCKET_OWNER = process.env.ENV_EXPECTED_BUCKET_OWNER;

class NodeCanvasFactory {
  create(w, h) {
    if (!w || !h) {
      throw new Error('invalid canvas size');
    }
    const canvas = Canvas.createCanvas(w, h);
    return {
      canvas,
      context: canvas.getContext('2d'),
    };
  }

  reset(data, w, h) {
    if (!data.canvas) {
      throw new Error('canvas not specified');
    }
    if (!data.canvas.width || !data.canvas.height) {
      throw new Error('invalid canvas size');
    }
    data.canvas.width = w;
    data.canvas.height = h;
  }

  destroy(data) {
    if (data.canvas) {
      data.canvas.width = 0;
      data.canvas.height = 0;
      data.canvas = undefined;
      data.context = undefined;
    }
  }
}

class PDFLib {
  static async downloadS3(bucket, key) {
    if (!bucket || !key) {
      throw new Error('bucket or key not specified');
    }
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: CUSTOM_USER_AGENT,
    });
    return s3.getObject({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    }).promise().then(data => data.Body).catch((e) => {
      throw new Error(`${e.statusCode} ${e.code} ${bucket}/${key}`);
    });
  }

  static async parseDocument(bucket, key) {
    const buffer = await PDFLib.downloadS3(bucket, key);
    const rawData = new Uint8Array(buffer);
    return PDF.getDocument(rawData).promise;
  }

  static async toPNG(document, pageNum) {
    return new Promise((resolve, reject) => {
      document.getPage(pageNum).then((page) => {
        const viewport = page.getViewport({
          scale: 1.0,
        });
        const factory = new NodeCanvasFactory();
        const data = factory.create(viewport.width, viewport.height);
        page.render({
          canvasFactory: factory,
          canvasContext: data.context,
          viewport,
        }).promise.then(() => resolve({
          page: pageNum,
          width: viewport.width,
          height: viewport.height,
          buffer: data.canvas.toBuffer(),
        })).catch(e => reject(e));
      }).catch(e => reject(e));
    });
  }
}

module.exports = PDFLib;
