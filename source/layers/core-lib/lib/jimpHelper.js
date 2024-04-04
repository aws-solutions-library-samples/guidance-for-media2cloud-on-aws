// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const LaplacianKernel = [
  [0, 1, 0],
  [1, -4, 1],
  [0, 1, 0],
];

class JimpHelper {
  static async computeHash(image) {
    const hash = image.hash();

    return hash;
  }

  static async computeLaplacianVariance(image) {
    return new Promise((resolve) => {
      const singleChannel = [];
      let sum = 0;

      const tmp = image
        .clone()
        .convolute(LaplacianKernel);

      tmp.scan(0, 0, tmp.bitmap.width, tmp.bitmap.height, (px, py, idx) => {
        const rgba = tmp.bitmap.data;
        const r = rgba[idx + 0];
        const g = rgba[idx + 1];
        const b = rgba[idx + 2];

        const weighted = (r * 0.299) + (g * 0.587) + (b * 0.114);
        singleChannel.push(weighted);
        sum += weighted;
      });

      const mean = sum / singleChannel.length;

      let variance = (singleChannel
        .reduce((a, c) =>
          a + (c - mean) ** 2, 0));

      variance /= (singleChannel.length - 1);

      resolve(Math.round(variance));
    });
  }
}

module.exports = JimpHelper;
