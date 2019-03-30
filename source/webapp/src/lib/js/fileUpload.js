/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */

const CHUNKSIZE = 8;
const DEFAULT_CHUNKSIZE_MB = 8 * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 4;

/**
 * @class FileUpload
 * @description manage file upload request and UI
 */
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
        fileUploadModalId = '#fileUploadModalId',
      } = params;

      this.$parent = parent;
      this.$modal = $(fileUploadModalId);

      this.domInit();
    } catch (e) {
      e.message = `FileUpload.constructor: ${e.message}`;
      console.error(e);
      throw e;
    }
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'FileUpload';
  }
  /* eslint-enable class-methods-use-this */

  get parent() {
    return this.$parent;
  }

  get card() {
    return this.$card;
  }

  get modal() {
    return this.$modal;
  }

  domInit() {
    const cardId = 'fileUploadCardId';

    const element = $(`
    <div class="col-sm-4 mt-4">
      <div class="card" id="${cardId}" style="border: none;">
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
            <input type="file" accept="video/*, application/mxf, application/json"/>
          </div>
        </div>
      </div>
    </div>`);

    /* attach to cardCollection dom */
    element.appendTo(this.parent.element);

    this.$card = $(`#${cardId}`);

    this.registerEvents();
  }

  /**
   * @function loadJsonDocument
   * @description if uploading file is a JSON definition file, load it.
   * Caution! Uploading a JSON definition file 'assumes' that your asssets
   * defined in the JSON file already exists in the S3 bucket!
   * @param {FileReader} file
   */
  static async loadJsonDocument(file) {
    const promise = new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();

        reader.onload = () => {
          if (reader.readyState === 2) {
            resolve(JSON.parse(reader.result));
          }
        };

        reader.onerror = () =>
          reject(new Error(reader.error.code));

        reader.readAsText(file);
      } catch (e) {
        /* eslint-disable no-alert */
        alert(`failed processing ${file.name}, ${e.message}`);
        /* eslint-enable no-alert */
        throw e;
      }
    });

    return promise;
  }

  /**
   * @function domRefreshModalContent
   * @description refresh file upload modal
   * @param {FileReader} file
   */
  async domRefreshModalContent(file) {
    this.modal.children().remove();

    const {
      AWSomeNamespace: {
        BaseAttributes,
        VideoAsset,
      },
    } = window;

    const {
      size,
      name,
      type,
    } = file;

    const basename = name.substr(0, name.lastIndexOf('.'));

    const isJsonFile = name.substr(name.lastIndexOf('.')).toLowerCase() === '.json';

    const bucket = this.parent.dbConfig.glacierBucket;
    const [
      key,
      uuid,
    ] = await (async () => {
      if (!isJsonFile) {
        return [
          `${basename}/${name}`,
          undefined,
        ];
      }

      const json = await FileUpload.loadJsonDocument(file);

      return [
        name,
        json.collectionUuid || json.legacyArchiveObjectUuid,
      ];
    })();

    const dom = `
    <div class="modal-dialog" role="document" data-bucket="${bucket}" data-key="${key}" data-basename="${basename}">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title text-truncate">${basename}</h5>
          <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body small">
          <div class="container">
            <div class="input-group input-group-sm mb-2">
              <div class="input-group-prepend">
                <span class="input-group-text" id="input-uuid">UUID</span>
              </div>
              <input
                type="text"
                class="form-control"
                placeholder="${VideoAsset.zeroUUID()}"
                aria-label="UUID"
                aria-describedby="input-uuid"
                value="${uuid || ''}">
              <div class="input-group-append">
                <button
                  class="btn btn-sm btn-primary"
                  type="button"
                  data-action="generateUUID"
                  ${(uuid) ? 'disabled' : ''}>Generate</button>
              </div>
            </div>

            <div class="input-group input-group-sm mb-2">
              <div class="input-group-prepend">
                <span class="input-group-text" id="input-md5">&nbsp;MD5</span>
              </div>

              <input type="text" class="form-control" placeholder="${VideoAsset.zeroMD5()}" aria-label="MD5" aria-describedby="input-md5">
              <div class="input-group-append">
                <button class="btn btn-primary" type="button" data-action="computeMD5">Compute</button>
              </div>
            </div>

            <dl class="row">
              <dt class="col-sm-3 text-truncate">File</dt>
              <dd class="col-sm-9 text-truncate">${name}</dd>
              <dt class="col-sm-3 text-truncate">ContentType</dt>
              <dd class="col-sm-9 text-truncate">${type}</dd>
              <dt class="col-sm-3 text-truncate">Size</dt>
              <dd class="col-sm-9 text-truncate">${BaseAttributes.readableFileSize(size)}</dd>
              <dt class="col-sm-3 text-truncate">Destination</dt>
              <dd class="col-sm-9 text-truncate">s3://${bucket}/${key}</dd>
            </dl>
            <div class="progress" style="height: 2px;">
              <div class="progress-bar bg-success" role="progressbar" style="width: 1%" aria-valuenow="1" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
            <p class="text-right" data-action="uploadStatus">Initializing...</p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm btn-success" data-action="startUpload">Start upload</button>
        </div>
      </div>
    </div>
    `;

    $(dom).appendTo(this.modal);

    await this.domRegisterActions();
  }

  /**
   * @function domRegisterActions
   * @description manage file upload modal UI events
   */
  async domRegisterActions() {
    /* register events */
    this.modal.find('button[data-action]').each((key, val) => {
      $(val).click(async (event) => {
        event.preventDefault();

        const action = $(val).attr('data-action');

        if (action === 'startUpload') {
          await this.onStartUpload();
        } else if (action === 'computeMD5') {
          const inputField = this.card.find('input[type="file"]').first();
          const file = inputField[0].files[0];

          await this.onComputeIncrementMD5(file);
        } else if (action === 'generateUUID') {
          await this.onGenerateUUID();
        }
      });
    });
  }

  /**
   * @function computeFileChunk
   * @description compute MD5 on file chunk.
   * Initialize spark with previous state's hash value.
   * @param {FileReader} file
   * @param {Number} chunkIdx
   * @param {Object} previous
   */
  static async computeFileChunk(file, chunkIdx, previous) {
    const promise = new Promise((resolve, reject) => {
      const start = chunkIdx * DEFAULT_CHUNKSIZE_MB;
      const end = Math.min(start + DEFAULT_CHUNKSIZE_MB, file.size);

      const spark = new SparkMD5.ArrayBuffer();

      /* resume from previous state */
      if (previous) {
        spark.setState(previous.state);
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        spark.append(event.target.result);

        const accumlated = spark.getState();

        resolve({
          state: accumlated,
          start,
          end,
        });
      };

      reader.onerror = (e) => {
        reject(e);
      };

      reader.readAsArrayBuffer(file.slice(start, end));
    });

    return promise;
  }

  /**
   * @function onComputeIncrementMD5
   * @description compute MD5 incrementally.
   * Load file chunk (8MB default) at a time.
   * @param {FileReader} file
   */
  async onComputeIncrementMD5(file) {
    const promise = new Promise(async (resolve, reject) => {
      const progressbar = this.modal.find('[role="progressbar"]').first();
      const statusText = this.modal.find('[data-action="uploadStatus"]').first();

      try {
        const chunks = Math.ceil(file.size / DEFAULT_CHUNKSIZE_MB);

        /* eslint-disable no-await-in-loop */
        let response;
        for (let i = 0; i < chunks; i += 1) {
          response = await FileUpload.computeFileChunk(file, i, response);

          const percentage = Math.ceil((response.end / file.size) * 100);

          progressbar.css('width', `${percentage}%`).attr('aria-valuenow', percentage);
          statusText.html(`MD5: ${response.end}/${file.size} [loaded/total]`);
        }
        /* eslint-enable no-await-in-loop */

        /* now, we can get the MD5 of the entire file */
        const spark = new SparkMD5.ArrayBuffer();

        spark.setState(response.state);

        const md5 = spark.end();

        this.modal.find('input[aria-label="MD5"]').first().val(md5);

        statusText.html('MD5 computed');

        resolve(md5);
      } catch (e) {
        if (statusText) {
          statusText.addClass('text-danger').html(`${e.message}`);
        }
        console.error(e);
        reject(e);
      }
    });
    return promise;
  }

  /**
   * @function onGenerateUUID
   * @description simply generate an unique UUID for the file
   */
  async onGenerateUUID() {
    const {
      AWSomeNamespace: {
        VideoAsset,
      },
    } = window;

    const uuid = VideoAsset.uuid4();

    this.modal.find('input[aria-label="UUID"]').first().val(uuid);

    return uuid;
  }

  /**
   * @function onStartUpload
   * @description before we start uploading, auto-generate uuid and md5 if not present.
   */
  async onStartUpload() {
    const progressbar = this.modal.find('[role="progressbar"]').first();
    const statusText = this.modal.find('[data-action="uploadStatus"]').first();

    try {
      const inputField = this.card.find('input[type="file"]').first();
      const file = inputField[0].files[0];

      let uuid = this.modal.find('input[aria-label="UUID"]').first().val();

      if (!uuid) {
        uuid = await this.onGenerateUUID();
      }

      /* validate uuid */
      if (!uuid.match(/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/)) {
        this.modal.find('input[aria-label="UUID"]').focus();
        throw new Error('invalid UUID format');
      }

      let md5 = this.modal.find('input[aria-label="MD5"]').first().val();

      if (!md5) {
        md5 = await this.onComputeIncrementMD5(file);
      }

      /* validate md5 */
      if (!md5.match(/^[a-fA-F0-9]{32}$/)) {
        this.modal.find('input[aria-label="MD5"]').focus();
        throw new Error('invalid MD5 format');
      }

      progressbar.css('width', '0%').attr('aria-valuenow', 0);

      await this.managedUpload(file, uuid, md5);
    } catch (e) {
      if (statusText) {
        statusText.addClass('text-danger').html(`${e.message}`);
      }
    }

    return undefined;
  }

  /**
   * @function managedUpload
   * @description uses S3 ManagedUpload to do multipart upload.
   * Set 'computeChecksums' to true to force data integrity check on parts.
   * @param {FileReader} file
   * @param {String} uuid - UUID of the file
   * @param {String} md5 - MD5 hex string
   */
  async managedUpload(file, uuid, md5) {
    const progressbar = this.modal.find('[role="progressbar"]').first();
    const statusText = this.modal.find('[data-action="uploadStatus"]').first();

    statusText.removeClass('text-danger');

    try {
      const dialog = this.modal.find('div.modal-dialog').first();
      const Bucket = dialog.attr('data-bucket');
      const Key = dialog.attr('data-key');

      /* initialize multipart upload  */
      const params = {
        Bucket,
        Key,
        ContentType: file.type,
        Metadata: {
          uuid,
          md5,
          'web-upload': 'true',
        },
        Body: file,
      };

      const options = {
        partSize: CHUNKSIZE * 1024 * 1024,
        queueSize: MAX_CONCURRENT_UPLOADS,
      };

      const t1 = new Date();

      const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        computeChecksums: true,
      });

      const request = s3.upload(params, options);

      request.on('httpUploadProgress', async (progress, _) => {
        const {
          loaded,
          total,
        } = progress;

        const percentage = Math.ceil((loaded / total) * 100);

        progressbar.css('width', `${percentage}%`).attr('aria-valuenow', percentage);
        statusText.html(`uploading ${loaded}/${total} [uploaded/total]`);
      });

      await request.promise();

      /* check to see if we are uploading JSON file or video */
      const extension = Key.substr(Key.lastIndexOf('.'));

      if (extension.toLowerCase() !== '.json') {
        /* once the video file is uploaded, we would need to take care of the Json file */
        statusText.html('Processing Json sidecar');

        await this.uploadJsonDocumentFromVideoFile(params);
      }

      const bitrate = ((file.size * 8) / (1024 * 1024)) / ((new Date() - t1) / 1000);

      statusText.html(`Upload completed: ${Number.parseFloat(bitrate).toFixed(2)} Mbps`);

      setTimeout((modal) => { modal.modal('hide'); }, 5000, this.modal);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * @function uploadJsonDocumentFromVideoFile
   * @description for each video file uploaded, we automatically generate
   * a Json definition file.
   * @param {Object} params
   */
  /* eslint-disable class-methods-use-this */
  async uploadJsonDocumentFromVideoFile(params) {
    const {
      AWSomeNamespace: {
        VideoAsset,
      },
    } = window;

    /* now, we can create a mock Json sidecar and upload it alongside with the video */
    const json = await VideoAsset.createJsonDocument(params);

    /* grab the UUID of the Json definition file */
    const {
      collectionUuid: uuid,
    } = json;

    /* run checksum on the Json document */
    const Body = JSON.stringify(json, null, 2);

    const md5 = SparkMD5.hash(Body);

    /* key name */
    const {
      Bucket,
      Key,
    } = params;

    const key = `${Key.substr(0, Key.lastIndexOf('.'))}.json`;

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const promise = s3.putObject({
      Bucket,
      Key: key,
      ContentType: 'application/json',
      ContentMD5: VideoAsset.toMD5String(md5, 'base64'),
      Metadata: {
        uuid,
        md5: VideoAsset.toMD5String(md5, 'base64'),
        'web-upload': 'true',
      },
      Body,
    }).promise();

    return promise;
  }
  /* eslint-enable class-methods-use-this */

  /**
   * @function registerEvent
   * @description listen to 'upload' button event
   */
  registerEvents() {
    const overlay = this.card.find('[data-action="upload"]').first();
    const input = this.card.find('input[type="file"]').first();

    /* re-route the event to input */
    overlay.off('click').click(async (event) => {
      event.preventDefault();
      input.click();
    });

    /* on input change, show modal */
    input.change(async (event) => {
      event.preventDefault();
      const file = event.currentTarget.files[0];

      await this.domRefreshModalContent(file);

      this.modal.modal('show');
    });

    /* on modal close event, reset <input> value */
    this.modal.on('hide.bs.modal', async () => {
      const inputField = this.card.find('input[type="file"]').first();
      inputField.val('');
    });
    return this;
  }
}
