// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export default class CropUtils {
  constructor() {
    this.$cropper = undefined;
    this.$canvas = undefined;
  }

  get cropper() {
    return this.$cropper;
  }

  set cropper(val) {
    this.$cropper = val;
  }

  get canvas() {
    return this.$canvas;
  }

  set canvas(val) {
    this.$canvas = val;
  }

  async load(target) {
    await this.unload();
    if (target.is('video')) {
      this.canvas = this.createCanvas(target);
      target.before(this.canvas);
    }
    const target0 = this.canvas || target;
    this.cropper = new Cropper(target0[0], {
      aspectRatio: 1,
      autoCropArea: 0.5,
      zoomOnWheel: false,
    });
    return this;
  }

  async unload() {
    if (this.canvas) {
      this.canvas.remove();
    }
    this.canvas = undefined;
    if (this.cropper) {
      this.cropper.destroy();
    }
    this.cropper = undefined;
    return this;
  }

  createCanvas(target) {
    let {
      width: w,
      height: h,
    } = target[0].getBoundingClientRect();
    w = Math.floor(w + 0.5);
    h = Math.floor(h + 0.5);
    const canvas = $('<canvas/>').addClass('collapse')
      .attr('width', w)
      .attr('height', h)
      .css('position', 'absolute')
      .css('top', 0)
      .css('left', 0);
    canvas[0].getContext('2d').drawImage(target[0], 0, 0, canvas[0].width, canvas[0].height);
    return canvas;
  }

  async snapshot() {
    if (!this.cropper) {
      throw new Error('cropper not loaded');
    }
    const cropped = this.cropper.getCroppedCanvas().toDataURL('image/jpeg', 1.0);
    return cropped;
  }
}
