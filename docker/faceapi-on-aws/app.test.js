const {
  handler,
} = require('./app');

(async () => {
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

  const faces = await handler(event, context);

  console.log(JSON.stringify(faces, null, 2));

  return faces;
})();
