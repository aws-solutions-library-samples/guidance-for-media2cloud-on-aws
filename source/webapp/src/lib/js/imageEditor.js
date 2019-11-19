/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* eslint-disable no-alert */
/* eslint-disable class-methods-use-this */

const TAG_MANUAL = 'manual';
const TAG_GROUNDTRUTH = 'groundtruth';

/**
 * @class ImageEditor
 * @description simple image editor to crop and index face
 */
class ImageEditor {
  constructor(parent, params = {}) {
    const {
      modalId = 'image-editor-modal-id',
    } = params;

    this.$cropper = undefined;
    this.$element = undefined;

    this.$modal = $(`#${modalId}`);
    this.$parent = parent;

    const rnd = new Uint32Array(1);
    window.crypto.getRandomValues(rnd);
    this.$suffix = rnd[0].toString(16);

    this.domInit();
  }

  static get Constants() {
    return {
      Id: {
        InputName: 'who-is-this-person',
        Image: 'snapshot-image-id',
        AlertMessage: 'cropper-alert-id',
        Loading: 'image-loading-icon',
      },
    };
  }

  get parent() {
    return this.$parent;
  }

  get modal() {
    return this.$modal;
  }

  get cropper() {
    return this.$cropper;
  }

  set cropper(val) {
    if (this.$cropper) {
      this.$cropper.destroy();
    }
    this.$cropper = val;
  }

  get element() {
    return this.$element;
  }

  set element(val) {
    this.$element = val;
  }

  get suffix() {
    return this.$suffix;
  }

  /**
   * @function domInit
   * @description initialize DOM element and install triggers.
   */
  domInit() {
    const imageId = `${ImageEditor.Constants.Id.Image}-${this.suffix}`;
    const loadId = `${ImageEditor.Constants.Id.Loading}-${this.suffix}`;
    const input = `${ImageEditor.Constants.Id.InputName}-${this.suffix}`;
    const alert = `${ImageEditor.Constants.Id.AlertMessage}-${this.suffix}`;

    this.element = $(`
    <div class="modal-dialog modal-xl" role="document">
      <div class="modal-content">
        <div class = "container">
          <div class="row p-0">
            <!-- image -->
            <div class="col-sm p-1 m-auto">
              <div style="max-width: 100%">
                <img id="${imageId}" src="./images/image.png" alt="snapshot">
              </div>
            </div>

            <!-- controls -->
            <div class="col-sm p-0 m-auto">
              <div class="modal-body">
                <div class="container mt-2">
                  <!-- loading icon -->
                  <div
                    id="${loadId}"
                    class="spinner-grow text-secondary loading collapse"
                    style="height: 3em; width: 3em;"
                    role="status">
                    <span class="sr-only">Loading...</span>
                  </div>

                  <!-- description  -->
                  <ul>
                    <li>Move and resize the crop box to center the face</li>
                    <li>Make sure the crop area covers the entire face</li>
                    <li>Name the face and click on <strong>Index now</strong></li>
                    <li>OR leave the name blank and click on <strong>Queue for later</strong> to send it Amazon SageMaker Ground Truth later</li>
                  </ul>

                  <!-- actions -->
                  <div class="row">
                    <div class="col-12">
                      <div class="input-group input-group-sm mb-3">
                        <div class="input-group-prepend">
                          <label class="input-group-text" for="${input}">Who is this person?</label>
                        </div>
                        <input
                          type="text"
                          class="form-control"
                          id="${input}"
                          placeholder="Optional for GroundTruth">
                      </div>
                    </div>

                    <div class="col-12 mt-auto mb-auto">
                      <div class="form-group mb-3 float-right">
                        <button
                          type="button"
                          class="btn btn-success btn-sm mb-2"
                          data-action="index">
                          Index now
                        </button>

                        <button
                          type="button"
                          class="btn btn-primary btn-sm mb-2"
                          data-action="queue">
                          Queue for later
                        </button>

                        <button
                          type="button"
                          class="btn btn-light btn-sm mb-2"
                          data-action="cancel">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                  <!-- alert message -->
                  <div class="row">
                    <div class="col">
                      <span
                        id="${alert}"
                        class="collapse text-danger">
                        no message...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`);

    /* attach to preview modal */
    this.$element.appendTo(this.modal);

    this.registerEvents();
  }

  /**
   * @function registerEvents
   * @description register events
   */
  registerEvents() {
    const imageId = `${ImageEditor.Constants.Id.Image}-${this.suffix}`;
    const loadId = `${ImageEditor.Constants.Id.Loading}-${this.suffix}`;
    const input = `${ImageEditor.Constants.Id.InputName}-${this.suffix}`;
    const alert = `${ImageEditor.Constants.Id.AlertMessage}-${this.suffix}`;

    this.modal.off('shown.bs.modal').on('shown.bs.modal', async () => {
      const image = $(`#${imageId}`, this.element);
      this.cropper = new Cropper(image[0], {
        aspectRatio: 1,
        autoCropArea: 0.5,
      });
    });

    this.modal.off('hidden.bs.modal').on('hidden.bs.modal', async () => {
      this.cropper = undefined;
      $(`#${alert}`, this.element)
        .html('<small>no message...</small>')
        .collapse('hide');
      $(`#${input}`, this.element).val('');
    });

    this.modal.find('[data-action]').each((key, val) => {
      $(val).off('click').on('click', async (event) => {
        event.preventDefault();

        const action = $(event.currentTarget).data('action');

        AppUtils.loading(loadId, true);

        try {
          if (action === 'index') {
            await this.onIndexFace(event);
          } else if (action === 'queue') {
            await this.onQueueFace(event);
          } else if (action !== 'cancel') {
            console.error(`action (${action}) not supported`);
          }
          this.hide();
        } catch (e) {
          $(`#${alert}`, this.element)
            .html(`<small>${AppUtils.sanitize(e.message)}</small>`)
            .collapse('show');
        } finally {
          AppUtils.loading(loadId, false);
        }
      });
    });
  }

  /**
   * @function show
   * @description show image editor modal
   * @param {Blob} blob - base64 image blob
   * @param {number} width - image width
   * @param {number} heigth - image height
   * @param {number} timecode - image timecode
   */
  async show(blob, width, height, timecode) {
    const imageId = `${ImageEditor.Constants.Id.Image}-${this.suffix}`;
    $('.modal-title', this.modal)
      .html(`Snapshot @ ${timecode}ms`);

    const image = $(`#${imageId}`, this.element);

    image.width(width);
    image.height(height);
    image.attr('src', blob);
    /* store timecode as well */
    image.attr('data-timecode', timecode);

    this.modal.modal('show');
  }

  /**
   * @function hide
   * @description hide image editor modal
   */
  async hide() {
    this.modal.modal('hide');
  }

  /**
   * @function onIndexFace
   * @description send request to the backend to process the face indexing.
   * @param {object} event - on 'Index now' click event
   */
  async onIndexFace(event) {
    const cropped = await this.getCroppedImage();

    if (!cropped.name) {
      throw new Error('\'Index now\' requires \'name\'');
    }

    /* send the request to backend to index it */
    await this.parent.indexFace(cropped);
  }

  /**
   * @function onQueueFace
   * @description send request to backend to trigger GroundTruth cloud sourcing logic.
   * @param {*} event - on 'Send to GroundTruth' click event
   */
  async onQueueFace(event) {
    const cropped = await this.getCroppedImage();
    /* send the request to backend to index it */
    await this.parent.queueFace(cropped);
  }

  /**
   * @function makeThumbnail
   * @description make thumbnail image
   * @param {string} blob - original image data url
   * @param {string} [format] - image/jpeg, image/png
   * @param {number} [w] - scaled width
   * @param {number} [h] - scaled height
   * @returns {string} base64 data url of the thumbnail
   */
  async makeThumbnail(blob, format = 'image/jpeg', w = 96, h = 96) {
    return new Promise((resolve) => {
      const image = new Image();

      image.onload = (e) => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(image, 0, 0, w, h);

        return resolve(canvas.toDataURL(format));
      };
      image.src = blob;
    });
  }

  /**
   * @function getCroppedImage
   * @description grab cropped image from Cropper
   */
  async getCroppedImage() {
    const blob = this.cropper.getCroppedCanvas().toDataURL();
    const dataUrl = await this.makeThumbnail(blob);

    const imageId = `${ImageEditor.Constants.Id.Image}-${this.suffix}`;
    const input = `${ImageEditor.Constants.Id.InputName}-${this.suffix}`;
    return {
      name: $(`#${input}`, this.element).val(),
      blob,
      dataUrl,
      coord: this.cropper.getCropBoxData(),
      timecode: $(`#${imageId}`, this.element).attr('data-timecode'),
      submitted: new Date().getTime(),
    };
  }
}
