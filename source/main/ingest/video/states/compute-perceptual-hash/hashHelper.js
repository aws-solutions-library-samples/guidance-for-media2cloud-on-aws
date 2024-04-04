const {
  CommonUtils,
  JimpHelper,
} = require('core-lib');
const JIMP = require('jimp');

class HashHelper extends JimpHelper {
  static async loadImage(bucket, key) {
    const signed = await CommonUtils.getSignedUrl({
      Bucket: bucket,
      Key: key,
    });

    return new Promise((resolve, reject) => {
      JIMP.read(signed, (e, img) => {
        if (e) {
          console.error(e);
          reject(e);
          return;
        }
        resolve(img);
      });
    });
  }
}

module.exports = HashHelper;
