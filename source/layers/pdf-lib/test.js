const PDF = require('pdfjs-dist/legacy/build/pdf');
const Canvas = require('canvas');
const FS = require('fs');

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

(async () => {
  const file = process.argv[2];

  const buffer = new Uint8Array(FS.readFileSync(file));
  const doc = await PDF.getDocument(buffer).promise;
  console.log(
    'PDF.getDocument:',
    'numPages:',
    doc.numPages,
    'fingerprint:',
    doc.fingerprint
  );

  const pageNum = 1;
  const page = await doc.getPage(pageNum);

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

  const outFile = 'dummy.png';
  const instream = data.canvas.createPNGStream();

  const chunks = [];
  for await (const chunk of instream) {
    chunks.push(chunk);
  }
  page.cleanup();

  const buf = Buffer.concat(chunks);
  FS.writeFileSync(outFile, buf);

  const response = {
    page: pageNum,
    width: viewport.width,
    height: viewport.height,
    image: outFile,
  };

  console.log(
    'response',
    response
  );
})();
