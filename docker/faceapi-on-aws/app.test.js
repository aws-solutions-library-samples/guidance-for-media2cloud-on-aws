const {
  spawn,
} = require('node:child_process');

async function canLoadTensorflow() {
  let promise = new Promise((resolve) => {
    const library = '@tensorflow/tfjs-node';
    const child = spawn('node', ['-e', `require('${library}')`]);

    child.on('exit', (code, signal) => {
      if (signal === 'SIGILL') {
        console.error(`🔥 Caught Illegal Instruction when require('${library}'). Likely running on x64 emulator... SKIPPING test code`);
        resolve(false);
      } else {
        console.log("Library loaded successfully.");
        resolve(true);
      }
    });
  });

  return await promise;
}


(async () => {
  let faces = [];

  const runTest = await canLoadTensorflow();
  if (runTest) {
    let localFile = process.argv[2];

    if (!localFile) {
      localFile = 'demo.jpg';
    }

    // test local image
    const event = {
      localFile,
    };

    // lambda function event
    // const event = {
    //   bucket: [BUCKET],
    //   prefix: [PREFIX],
    //   output: '[{ key: image.jpg },...]', // list of images to be processed
    // };

    const context = {};

    const { handler } = require('./app');
    faces = await handler(event, context);
    console.log(JSON.stringify(faces, null, 2));
  }

  return faces;
})();
