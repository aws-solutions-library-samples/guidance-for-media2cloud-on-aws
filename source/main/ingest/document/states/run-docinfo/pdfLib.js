// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PDF = require("pdfjs-dist/legacy/build/pdf");
const Canvas = require("canvas");
const {
  CommonUtils: {
    download,
  },
} = require('core-lib');

const STANDARD_FONTDATA_URL = '/opt/nodejs/node_modules/pdfjs-dist/standard_fonts/';

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
  static async parseDocument(bucket, key) {
    const buffer = await download(bucket, key, false)
      .then((res) =>
        res.Body)
      .catch((e) => {
        throw new Error(`${e.statusCode} ${e.code} ${bucket}/${key}`);
      });

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
