import AppUtils from '../appUtils.js';
import Localization from '../localization.js';

class CropItem {
  constructor(image, thumbnail) {
    this.$image = image;
    this.$thumbnail = thumbnail;
    this.$id = AppUtils.randomHexstring();
    this.$timestamp = 0;
  }

  get id() {
    return this.$id;
  }

  get image() {
    return this.$image;
  }

  get thumbnail() {
    return this.$thumbnail;
  }

  get timestamp() {
    return this.$timestamp;
  }

  set timestamp(val) {
    this.$timestamp = val;
  }

  setTimestamp(val) {
    this.timestamp = val;
  }

  createItem() {
    const container = $('<div/>').addClass('p-0 m-0 mr-1 mb-1 d-inline-flex snapshot');
    const title = `${this.id} (${AppUtils.readableDuration(this.timestamp)})`;
    const image = $('<img/>').addClass('img-contain img-w100')
      .attr('src', this.thumbnail)
      .attr('alt', title)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', title)
      .tooltip();

    const btn = $('<button/>').addClass('btn btn-sm btn-link lead-sm')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.DeleteImage)
      .append($('<i/>').addClass('far fa-times-circle text-white'))
      .tooltip();
    btn.off('click').on('click', (event) => {
      console.log(`close clicked: ${title}`);
      event.preventDefault();
    });
    const overlay = $('<div/>').addClass('overlay-offset-2p collapse')
      .append(btn);

    container.append(image).append(overlay);
    container.hover(() =>
      overlay.removeClass('collapse'), () =>
      overlay.addClass('collapse'));

    return container;
  }
}

export default class CropUtils {
  constructor() {
    this.$cropper = undefined;
    this.$canvas = undefined;
  }

  static get Constants() {
    return {
      Thumbnail: {
        Width: 96,
        Height: 96,
      },
    };
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
    const cropped = this.cropper.getCroppedCanvas().toDataURL();
    const thumbnail = await new Promise((resolve) => {
      const img = new Image();
      img.onload = (e) => {
        const canvas = document.createElement('canvas');
        canvas.width = CropUtils.Constants.Thumbnail.Width;
        canvas.height = CropUtils.Constants.Thumbnail.Height;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.src = cropped;
    });
    return new CropItem(cropped, thumbnail);
  }
}
