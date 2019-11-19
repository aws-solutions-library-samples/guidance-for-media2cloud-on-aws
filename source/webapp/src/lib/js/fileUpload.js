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
/* eslint-disable class-methods-use-this */
/* eslint-disable no-alert */
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-continue */

/**
 * @class FileUpload
 * @description manage file upload request and UI
 */
const DEFAULT_CHUNKSIZE_MB = 0;
const CHUNKSIZE = 0;
const MAX_CONCURRENT_UPLOADS = 0;
class FileUpload {
  /**
   * @function constructor
   * @param {CardCollection} parent - reference to CardCollection instance
   * @param {object} params
   * @param {string} params.fileUploadModalId - uploader modal, defined in demo.html
   */
  constructor(parent, params = {}) {
    try {
      if (!parent) {
        throw new Error('missing params, parent');
      }

      const {
        modalId = 'file-upload-modal-id',
      } = params;

      this.$parent = parent;
      this.$modal = $(`#${modalId}`);
      this.$mediaWizard = undefined;
      this.$jsonWizard = undefined;

      this.domInit();
    } catch (e) {
      e.message = `FileUpload.constructor: ${e.message}`;
      console.error(encodeURIComponent(e.message));
      throw e;
    }
  }

  static get Constants() {
    return {
      SupportedVideoExtensions: [
        '.mxf',
        '.ts',
      ],
      SupportedAudioExtensions: [
      ],
      SupportedImageExtensions: [
        '.dng',
        '.cr2',
        '.crw',
        '.erf',
        '.raf',
        '.dcr',
        '.k25',
        '.kdc',
        '.mrw',
        '.nef',
        '.orf',
        '.raw',
        '.pef',
        '.arw',
        '.sr2',
        '.srf',
        '.x3f',
      ],
      SupportedMimeTypes: [
        'image/*',
        'video/*',
        'application/json',
      ],
      Id: {
        UploadCard: 'upload-card-id',
      },
      Action: {
        StartUpload: 'start-upload',
        ComputeMd5: 'compute-md5',
        GenerateUuid: 'generate-uuid',
      },
    };
  }

  get [Symbol.toStringTag]() {
    return 'FileUpload';
  }

  get parent() {
    return this.$parent;
  }

  get card() {
    return this.$card;
  }

  get modal() {
    return this.$modal;
  }

  get mediaWizard() {
    if (!this.$mediaWizard) {
      this.$mediaWizard = new MediaUploadWizard(this);
    }
    return this.$mediaWizard;
  }

  get jsonWizard() {
    if (!this.$jsonWizard) {
      this.$jsonWizard = new JsonUploadWizard(this);
    }
    return this.$jsonWizard;
  }

  domInit() {
    const supported = FileUpload.Constants.SupportedMimeTypes
      .concat(FileUpload.Constants.SupportedImageExtensions)
      .concat(FileUpload.Constants.SupportedAudioExtensions)
      .concat(FileUpload.Constants.SupportedVideoExtensions);

    const element = $(`
    <div class="col-sm-4 mt-4">
      <div class="card" id="${FileUpload.Constants.Id.UploadCard}" style="border: none;">
        <div class="overlay-container" style="border: dashed 10px rgba(0,0,0,.125)">
          <img class="card-img-top opacity" src="./images/upload-file.png" alt="Upload a file" width="80%">
          <div class="overlay-hover">
              <div class="overlay-text">
                <div class="row align-items-center">
                  <div class="col align-self-center">
                    <div class="overlay-action">
                      <i class="fa fa-plus fa-3x" data-action="upload"></i>
                      <p class="center text-thin small">Upload to Glacier</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          <div class="image-upload">
            <input type="file" accept="${supported.join(',')}"/>
          </div>
        </div>
      </div>
    </div>`);

    /* attach to cardCollection dom */
    element.appendTo(this.parent.element);

    this.$card = $(`#${FileUpload.Constants.Id.UploadCard}`);

    this.registerEvents();
  }

  /**
   * @function registerEvent
   * @description listen to 'upload' button event
   */
  registerEvents() {
    const overlay = this.card.find('[data-action="upload"]').first();
    const input = this.card.find('input[type="file"]').first();

    /* re-route the event to input */
    overlay.off('click').click((event) => {
      event.preventDefault();
      input.click();
    });

    /* on input change, show modal */
    input.off('change').change(async (event) => {
      event.preventDefault();
      await this.showWizard(event.currentTarget.files[0]);
    });

    /* on modal close event, reset <input> value */
    this.modal.off('hide.bs.modal').on('hide.bs.modal', () => {
      this.resetFileInput();
    });
    return this;
  }

  async showWizard(file) {
    const isJsonFile
      = file.name.substr(file.name.lastIndexOf('.')).toLowerCase() === '.json';

    return (isJsonFile)
      ? this.jsonWizard.show(file)
      : this.mediaWizard.show(file);
  }

  resetFileInput() {
    this.card.find('input[type="file"]').first().val('');
  }
}
