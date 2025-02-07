// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  S3Client,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const PDF = require('pdfjs-dist/legacy/build/pdf');
const Canvas = require('canvas');

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;
const EXPECTED_BUCKET_OWNER = process.env.ENV_EXPECTED_BUCKET_OWNER;
const STARDARD_FONTDATA_URL = '/opt/nodejs/node_modules/pdfjs-dist/standard_fonts/';

class NodeCanvasFactory {
  create(w, h) {
    if (!w || !h) {
      throw new M2CException('invalid canvas size');
    }
    const canvas = Canvas.createCanvas(w, h);
    return {
      canvas,
      context: canvas.getContext('2d'),
    };
  }

  reset(data, w, h) {
    if (!data.canvas) {
      throw new M2CException('canvas not specified');
    }
    if (!data.canvas.width || !data.canvas.height) {
      throw new M2CException('invalid canvas size');
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
  static async parseDocument(bucket, key) {
    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    });

    let buffer = await s3Client.send(command);
    buffer = await buffer.Body.transformToByteArray();

    const params = {
      data: buffer,
      standardFontDataUrl: STARDARD_FONTDATA_URL,
    };
    return PDF.getDocument(params).promise;
  }

  static async toPNG(document, pageNum) {
    const page = await document.getPage(pageNum);

    const viewport = page.getViewport({
      scale: 1.0,
    });
    const factory = new NodeCanvasFactory();
    const data = factory.create(
      viewport.width,
      viewport.height
    );

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
