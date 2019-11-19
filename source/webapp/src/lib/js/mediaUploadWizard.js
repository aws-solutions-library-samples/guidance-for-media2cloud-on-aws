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
class MediaUploadWizard extends mxReadable(BaseWizard) {
  constructor(parent, params) {
    const id = (params || {}).modalId || 'media-upload-modal-id';
    super(parent, id);
    this.$cardCollection = this.parent.parent;
    this.$inputFile = undefined;
    this.$bucket = undefined;
    this.$key = undefined;
    this.$uuid = undefined;
    this.$md5 = undefined;
    this.$metadata = undefined;
    this.$timer = undefined;
  }

  static get Constants() {
    const prefix = 'media-upload';
    return {
      Md5: {
        ChunkSize: 8 * 1024 * 1024,
      },
      Multipart: {
        PartSize: 8 * 1024 * 1024,
        MaxConcurrentUpload: 4,
      },
      Carousel: {
        Container: {
          Id: `${prefix}-carousel-id`,
        },
        Slide: {
          General: {
            Id: `${prefix}-slide-general`,
            Form: {
              FileSource: `${prefix}-form-src`,
              FileDestination: `${prefix}-form-src`,
            },
            Input: {
              Uuid: `${prefix}-uuid`,
              S3Bucket: `${prefix}-s3`,
              S3Key: `${prefix}-s3obj`,
              File: {
                Name: `${prefix}-fname`,
                Size: `${prefix}-fsize`,
                Type: `${prefix}-ftype`,
                LastModified: `${prefix}-flastmod`,
              },
            },
          },
          Metadata: {
            Id: `${prefix}-slide-mdat`,
            Form: {
              Metadata: `${prefix}-form-mdat`,
            },
            Input: {
              Metadata: `${prefix}-mdat`,
            },
            Action: {
              AddMetadataField: `${prefix}-add-mdat-field`,
              RemoveMetadataField: `${prefix}-remove-mdat-field`,
            },
          },
          Upload: {
            Id: `${prefix}-slide-upload`,
            List: {
              ValidateUuid: `${prefix}-ul-validate-uuid`,
              ComputeMd5: `${prefix}-ul-compute-md5`,
              Uploading: `${prefix}-ul-uploading`,
              Error: `${prefix}-ul-error`,
            },
            Action: {
              StartUpload: `${prefix}-start-upload`,
            },
          },
          Cancel: {
            Id: `${prefix}-slide-cancel`,
          },
        },
      },
    };
  }

  get cardCollection() {
    return this.$cardCollection;
  }

  get inputFile() {
    return this.$inputFile;
  }

  set inputFile(val) {
    this.$inputFile = val;
  }

  get metadata() {
    return this.$metadata;
  }

  set metadata(val) {
    this.$metadata = val;
  }

  get uuid() {
    return this.$uuid;
  }

  set uuid(val) {
    this.$uuid = val;
  }

  get md5() {
    return this.$md5;
  }

  set md5(val) {
    this.$md5 = val;
  }

  get bucket() {
    return this.$bucket;
  }

  set bucket(val) {
    this.$bucket = val;
  }

  get key() {
    return this.$key;
  }

  set key(val) {
    this.$key = val;
  }

  get timer() {
    return this.$timer;
  }

  set timer(val) {
    this.$timer = val;
  }

  resetAll() {
    this.inputFile = undefined;
    this.bucket = undefined;
    this.key = undefined;
    this.uuid = undefined;
    this.md5 = undefined;
    this.metadata = undefined;
    this.timer = undefined;
    this.parent.resetFileInput();
  }

  domInit() {
    const id = MediaUploadWizard.Constants.Carousel.Container.Id;
    const element = $(`
    <div class="modal-dialog modal-lg" role="document">
      <div class="modal-content">
        <div class="modal-body">
          <div
          id="${id}"
          class="carousel slide"
          data-ride="carousel"
          data-interval="false">
            <div class="carousel-inner">
            </div>
          </div>
        </div>
      </div>
    </div>`);

    /* append slides */
    const slides = element.find('div.carousel-inner');
    slides.append(this.createCarouselSlideGeneral('active'));
    slides.append(this.createCarouselSlideMetadata());
    slides.append(this.createCarouselSlideUpload());

    /* attach to modal */
    element.appendTo(this.modal);

    this.carousel = $(`#${id}`);

    this.registerEvents();
  }

  registerEvents() {
    this.carousel.off('slide.bs.carousel').on('slide.bs.carousel', async (event) => {
      const slides = this.carousel.children().children();
      const from = $(slides.get(event.from));
      const to = $(slides.get(event.to));
      const X = MediaUploadWizard.Constants.Carousel.Slide;
      switch (from.prop('id')) {
        case X.General.Id:
          this.updateUuidField(from.find(`#${X.General.Input.Uuid}`).val());
          break;
        default:
          break;
      }

      switch (to.prop('id')) {
        case X.Upload.Id:
          await this.onUploadChecklist();
          break;
        default:
          break;
      }
    });
    return super.registerEvents();
  }

  async show(file) {
    this.inputFile = file;
    return super.show();
  }

  createFormFileField(id, name, value, disabled = true, pattern = '') {
    return `
    <div style="display:flex;">
      <div class="col-sm-12 mb-1 px-0">
        <div class="input-group mb-0 mr-sm-2">
          <label
          for="${id}"
          class="col-sm-2 col-form-label form-control-sm px-0"
          >${name}
          </label>
          <input
          id=${id}
          type="text"
          class="form-control form-control-sm col-sm-9"
          value="${value}"
          pattern="${pattern}"
          required
          ${disabled ? 'readonly' : ''}
          >
          <div class="invalid-feedback text-center" style="font-size:60%">
            Must be ${pattern}
          </div>
        </div>
      </div>
    </div>`;
  }

  createFormFileSource() {
    const X = MediaUploadWizard.Constants.Carousel.Slide.General;
    const items = [];
    items.push(`<form
      class="needs-validation"
      id="${X.Form.FileSource}"
      novalidate
      >`);
    [{
      name: 'Name',
      value: this.inputFile.name,
      id: X.Input.File.Name,
    }, {
      name: 'Size',
      value: MediaUploadWizard.readableFileSize(this.inputFile.size),
      id: X.Input.File.Size,
    }, {
      name: 'Type',
      value: this.getMimeType(this.inputFile),
      id: X.Input.File.Type,
    }, {
      name: 'LastModified',
      value: new Date(this.inputFile.lastModified).toISOString(),
      id: X.Input.File.LastModified,
    }].forEach(x =>
      items.push(this.createFormFileField(x.id, x.name, x.value, true)));

    items.push('</form>');
    return items.join('\n');
  }

  createFormFileDestination() {
    const X = MediaUploadWizard.Constants.Carousel.Slide.General;
    const items = [];
    const name = this.inputFile.name; // eslint-disable-line
    const basename = name.substr(0, name.lastIndexOf('.'));
    const key = `${basename}/${name}`;

    items.push(`<form
      class="needs-validation"
      id="${X.Form.FileDestination}"
      novalidate
      >`);
    [{
      name: 'Bucket',
      id: X.Input.S3Bucket,
      value: SO0050.Ingest.Bucket,
      disabled: true,
      pattern: '^[a-zA-Z]+[a-zA-Z0-9-]{1,}$',
    }, {
      name: 'Key',
      id: X.Input.S3Key,
      value: key,
      disabled: false,
      pattern: '^[^<>()%:]{1,}$',
    }, {
      name: 'Uuid',
      id: X.Input.Uuid,
      value: AppUtils.uuid4(),
      disabled: false,
      pattern: '^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$',
    }].forEach(x =>
      items.push(this.createFormFileField(x.id, x.name, x.value, x.disabled, x.pattern)));

    items.push('</form>');
    return items.join('\n');
  }

  createKeyValueInput(idx, key, val, placeholder, suffix, plus = true, minus = true) {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Metadata;
    const id = `${X.Input.Metadata}-${suffix || idx}`;
    const kid = `${X.Input.Metadata}-key-${suffix || idx}`;
    const vid = `${X.Input.Metadata}-val-${suffix || idx}`;

    return `
    <div id="${id}" style="display:flex;">
      <div class="col-sm-10 mb-1">
        <div class="input-group mb-0 mr-sm-2">
          <input
          type="text"
          class="form-control form-control-sm col-sm-3"
          placeholder="Key"
          value="${key || ''}"
          pattern="^[a-zA-Z]+[a-zA-Z0-9-]{1,}$"
          required
          data-target="${kid}"
          ${!plus || !minus ? 'disabled' : ''}
          >
          <input
          type="text"
          class="form-control form-control-sm col-sm-9"
          placeholder="${placeholder || 'Value'}"
          value="${val || ''}"
          pattern="^[^<>()]{1,}$"
          required
          data-target="${vid}"
          ${!plus || !minus ? 'disabled' : ''}
          >
          <div class="invalid-feedback" style="font-size:60%">
            Key must be alphanumeric or '-' characters. Value must not contain '<', '>', '(', ')' characters.
          </div>
        </div>
      </div>
      <div class="col-sm-2 mb-1">
        <div class="btn-group mb-0 mr-sm-2" role="group" aria-label="add remove field">
          <button
          type="button"
          class="btn btn-sm btn-success"
          data-action="${X.Action.AddMetadataField}"
          data-target="${id}"
          ${!plus ? 'disabled' : ''}
          >
            <i class="fas fa-plus"></i>
          </button>

          <button
          type="button"
          class="btn btn-sm btn-success"
          data-action="${X.Action.RemoveMetadataField}"
          data-target="${id}"
          ${!minus ? 'disabled' : ''}
          >
            <i class="fas fa-minus"></i>
          </button>
        </div>
      </div>
    </div>
    `;
  }

  createFormMetadata() {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Metadata;
    const items = [];
    items.push(`<form
      class="needs-validation"
      id="${X.Form.Metadata}"
      novalidate
      >`);
    items.push('<div class="form-row">');
    [{
      key: 'uuid',
      val: undefined,
      placeholder: undefined,
      suffix: 'uuid',
      plus: false,
      minus: false,
    }, {
      key: 'md5',
      val: undefined,
      placeholder: 'to be computed',
      suffix: 'md5',
      plus: true,
      minus: false,
    }].forEach((x, idx) =>
      items.push(this.createKeyValueInput(
        idx,
        x.key,
        x.val,
        x.placeholder,
        x.suffix,
        x.plus,
        x.minus
      )));
    items.push('</div>');
    items.push('</form>');
    return items.join('\n');
  }

  createFormUpload() {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Upload;
    const items = [];
    items.push('<ul class="list-group list-group-flush">');
    [{
      text: 'checking uuid for collision...',
      id: X.List.ValidateUuid,
    }, {
      text: 'computing checksum...',
      id: X.List.ComputeMd5,
    }, {
      text: 'preparing for upload...',
      id: X.List.Uploading,
    }].forEach((x) => {
      items.push(`<li
        class="list-group-item px-0"
        id=${x.id}>
          <span class="succeeded collapse">
            <i class="far fa-check-circle" style="color:#28a745; font-size:1rem"></i>
          </span>
          <span class="failed collapse">
            <i class="far fa-times-circle" style="color:#ff0000; font-size:1rem"></i>
          </span>
          <span
          class="in-progress spinner-border spinner-grow-sm collapse"
          role="status"
          aria-hidden="true"
          style="font-size:0.1rem;"
          ></span>
          <div class="checklist-text" style="display:inline;">
            ${x.text}
          </div>
        </li>`);
    });

    items.push('</ul>');
    items.push(`<div class="mt-4">
        <span class="collapse"
        id=${X.List.Error}
        style="font-size:0.8rem; color:#ff0000;"
        >error message....
        </span>
      </div>`);
    return items.join('\n');
  }

  createCarouselSlideGeneral(active = '') {
    const X = MediaUploadWizard.Constants.Carousel.Slide;
    const element = `
    <div
    class="carousel-item ${active}"
    id="${X.General.Id}"
    style="height: 400px">
      <div
      class="container"
      style="height: 100%; width: 96%;">
        <div
        class="row d-flex justify-content-center align-items-center"
        style="height: 90%;">
          <!-- graphics -->
          <div class="col-sm-3 px-0 text-center">
            <i class="fas fa-cloud-upload-alt" style="color: #ccc; font-size: 6em"></i>
          </div>

          <!-- content -->
          <div class="col-sm-9 px-0" style="overflow-y:scroll; height:90%;">
            <div>
              <h5>File source</h5>
              ${this.createFormFileSource()}
            </div>

            <div class="mt-4">
              <h5>Destination</h5>
              ${this.createFormFileDestination()}
            </div>
          </div>
        </div>

        <!-- navigation -->
        <div class="row d-flex justify-content-end align-items-end">
          <!-- cancel -->
          <button
          type="button"
          class="btn btn-sm btn-light px-4 mx-1"
          data-action="${X.Cancel.Id}">
            Cancel
          </button>

          <!-- start upload -->
          <button
          type="button"
          class="btn btn-sm btn-primary px-4 mx-1"
          data-action="${X.Upload.Id}">
            Quick upload
          </button>

          <!-- next to add metadata(s) -->
          <button
          type="button"
          class="btn btn-sm btn-success px-4 mx-1"
          data-action="${X.Metadata.Id}">
            Next
          </button>
        </div>
      </div>
    </div>
    `;
    return element;
  }

  createCarouselSlideMetadata(active = '') {
    const X = MediaUploadWizard.Constants.Carousel.Slide;
    const element = `
    <div
    class="carousel-item ${active}"
    id="${X.Metadata.Id}"
    style="height: 400px">
      <div
      class="container"
      style="height: 100%; width: 96%;">
        <div
        class="row d-flex justify-content-center align-items-center"
        style="height: 90%;">
          <!-- graphics -->
          <div class="col-sm-3 px-0 text-center">
            <i class="fas fa-cloud-upload-alt" style="color: #ccc; font-size: 6em"></i>
          </div>

          <!-- content -->
          <div class="col-sm-9 px-0" style="overflow-y:scroll; height:90%;">
            <div>
              <h5>Add metadata</h5>
              <p class="mt-3" style="font-size:1rem; font-weight:300;">
                Attach additional metadata to the S3 object. The metadata will be indexed to Amazon Elasticsearch engine and be made available for searching.
              </p>
              <p class="mt-1" style="font-size:1rem; font-weight:300;">
                'uuid' and 'md5' are automatically attached to the object.
              </p>
              ${this.createFormMetadata()}
            </div>
          </div>
        </div>

        <div class="row d-flex justify-content-end align-items-end">
          <!-- cancel -->
          <button
          type="button"
          class="btn btn-sm btn-light px-4 mx-1"
          data-action="${X.Cancel.Id}">
            Cancel
          </button>

          <!-- back -->
          <button
          type="button"
          class="btn btn-sm btn-primary px-4 mx-1"
          data-action="${X.General.Id}">
            Back
          </button>

          <!-- start upload -->
          <button
          type="button"
          class="btn btn-sm btn-success px-4 mx-1"
          data-action="${X.Upload.Id}">
            Next
          </button>
        </div>
      </div>
    </div>
    `;
    return element;
  }

  createCarouselSlideUpload(active = '') {
    const X = MediaUploadWizard.Constants.Carousel.Slide;
    const element = `
    <div
    class="carousel-item ${active}"
    id="${X.Upload.Id}"
    style="height: 400px">
      <div
      class="container"
      style="height: 100%; width: 96%;">
        <div
        class="row d-flex justify-content-center align-items-center"
        style="height: 90%;">
          <!-- graphics -->
          <div class="col-sm-3 px-0 text-center">
            <i class="fas fa-cloud-upload-alt" style="color: #ccc; font-size: 6em"></i>
          </div>

          <!-- content -->
          <div class="col-sm-9 px-0">
            <h4>Almost done</h4>
            <p class="mt-3" style="font-size:1rem; font-weight:300;">
              Checking all the fields to make sure we are good to go.
            </p>
            ${this.createFormUpload()}
          </div>
        </div>

        <div class="row d-flex justify-content-end align-items-end">
          <!-- cancel -->
          <button
          type="button"
          class="btn btn-sm btn-light px-4 mx-1"
          data-action="${X.Cancel.Id}">
            Cancel
          </button>

          <!-- back -->
          <button
          type="button"
          class="btn btn-sm btn-primary px-4 mx-1"
          data-action="${X.Metadata.Id}">
            Back
          </button>

          <!-- start upload -->
          <button
          type="button"
          class="btn btn-sm btn-success px-4 mx-1"
          data-action="${X.Upload.Action.StartUpload}">
            Start upload
          </button>
        </div>
      </div>
    </div>
    `;
    return element;
  }

  async onAction(target) {
    const X = MediaUploadWizard.Constants.Carousel.Slide;
    switch ($(target).data('action')) {
      case X.Cancel.Id:
        return this.onCancel(target);
      case X.Metadata.Action.AddMetadataField:
        return this.onAddMetadataField(target);
      case X.Metadata.Action.RemoveMetadataField:
        return this.onRemoveMetadataField(target);
      case X.Upload.Action.StartUpload:
        return this.onUpload(target);
      default:
        return super.onAction(target);
    }
  }

  async onUpload(target) {
    const t0 = new Date();
    const X = MediaUploadWizard.Constants.Carousel.Slide;
    const item = this.carousel.find(`#${X.Upload.Id}`).find(`#${X.Upload.List.Uploading}`);
    try {
      this.setChecklistItemStatus(item, 'in-progress');

      await this.onChecklistSetNavigation({
        [X.Upload.Action.StartUpload]: false,
        [X.Cancel.Id]: false,
        [X.Metadata.Id]: false,
      });

      const request = this.requestMultipartUpload();
      request.on('httpUploadProgress', async (data) => {
        const percentage = Math.ceil((data.loaded / data.total) * 100);
        item.find('.checklist-text')
          .html(`uploading... <span style="font-size: 0.8rem;">${percentage}% (${data.loaded}/${data.total})</span>`);
      });

      await request.promise();

      this.cardCollection.createCard({
        uuid: this.uuid,
        type: this.getType(this.inputFile),
      });

      await ApiHelper.startIngestWorkflow({
        uuid: this.uuid,
        bucket: this.bucket,
        key: this.key,
      });

      const bitrate = ((this.inputFile.size * 8) / ((new Date() - t0) / 1000));
      item.find('.checklist-text')
        .html(`upload completed... (${MediaUploadWizard.readableFileSize(this.inputFile.size)} @ ${MediaUploadWizard.readableBitrate(bitrate)})`);
      this.setChecklistItemStatus(item, 'succeeded');

      await this.onCompleted(target);
      return true;
    } catch (e) {
      this.setChecklistItemStatus(item, 'failed');
      await this.onChecklistSetNavigation({
        [X.Cancel.Id]: true,
      });
      await this.onChecklistError(e);
      return false;
    }
  }

  async onCompleted(target) {
    setTimeout(async () => {
      await this.hide();
    }, 3 * 1000);
  }

  async onCancel(target) {
    await this.hide();
    return true;
  }

  async onAddMetadataField(target) {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Metadata.Form.Metadata;
    const action = $(target).data('action');
    const id = $(target).data('target');

    const form = this.carousel.find(`#${X}`);
    form.removeClass('was-validated');

    const rows = form.find('.form-row');
    let element = this.createKeyValueInput(rows.children().length);
    element = $(element).appendTo(rows);

    this.registerActionEvents(element);
    return true;
  }

  async onRemoveMetadataField(target) {
    const action = $(target).data('action');
    const id = $(target).data('target');

    this.carousel.find(`#${id}`).remove();
    return true;
  }

  async beforeCarouselSlide(target) {
    const X = MediaUploadWizard.Constants.Carousel.Slide;
    switch (this.carousel.find('.active').prop('id')) {
      case X.Metadata.Id:
        return this.validateFormData(target);
      case X.General.Id:
        return this.validateFormData(target);
      default:
        return true;
    }
  }

  async validateFormData(target) {
    const forms = this.carousel.find('.active').find('.needs-validation');
    const valids = [];
    forms.each((k, v, idx) => {
      valids.push(v.checkValidity());
      $(v).addClass('was-validated');
    });
    return valids.filter(x => x === false).length === 0;
  }

  async onChecklistBucket() {
    const X = MediaUploadWizard.Constants.Carousel.Slide.General;
    const slide = this.carousel.find(`#${X.Id}`);

    this.bucket = slide.find(`#${X.Input.S3Bucket}`).val();
    if (!this.bucket || !/^[a-zA-Z]+[a-zA-Z0-9-]{1,}$/.test(this.bucket)) {
      throw new Error('invalid bucket name');
    }

    this.key = slide.find(`#${X.Input.S3Key}`).val();
    if (!this.key || !/^[^<>()%:]{1,}$/.test(this.key)) {
      throw new Error('invalid object key name');
    }

    return true;
  }

  async onChecklistMetadata() {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Metadata;
    const slide = this.carousel.find(`#${X.Id}`);
    const keys = [];
    const vals = [];
    slide.find(`form#${X.Form.Metadata}`)
      .children()
      .find(':input[type="text"]')
      .each((k, v) => {
        const id = $(v).data('target');
        const val = $(v).val();
        return (id.indexOf('-key-') >= 0)
          ? keys.push({
            id,
            val,
          })
          : (id.indexOf('-val-') >= 0)
            ? vals.push({
              id,
              val,
            })
            : undefined;
      });

    const metadata = {};
    while (keys.length) {
      const key = keys.shift();
      const id = key.id.replace('-key-', '-val-');
      const idx = vals.findIndex(x => x.id === id);
      if (idx >= 0) {
        const val = vals.splice(idx, 1).shift();
        metadata[key.val] = val.val;
      }
    }
    this.metadata = metadata;
    return true;
  }

  async onChecklistUuid() {
    const X = MediaUploadWizard.Constants.Carousel.Slide;
    let slide = this.carousel.find(`#${X.General.Id}`);
    const uuid = slide.find(`#${X.General.Input.Uuid}`).val();
    if (!uuid || !/^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/.test(uuid)) {
      throw new Error('invalid uuid');
    }

    slide = this.carousel.find(`#${X.Upload.Id}`);
    const item = slide.find(`#${X.Upload.List.ValidateUuid}`);

    this.setChecklistItemStatus(item, 'in-progress');
    const data = await ApiHelper.getRecord(uuid)
      .catch(() => undefined);

    if ((data || {}).basename !== undefined) {
      this.setChecklistItemStatus(item, 'failed');
      throw new Error(`uuid '${encodeURIComponent(uuid)}' is already used by ${encodeURIComponent(data.basename)}`);
    }

    this.setChecklistItemStatus(item, 'succeeded');
    item.find('.checklist-text').html(`uuid looks good... (${uuid})`);
    this.uuid = this.updateUuidField(uuid);
    return true;
  }

  async onChecklistMd5() {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Upload;
    const slide = this.carousel.find(`#${X.Id}`);
    const item = slide.find(`#${X.List.ComputeMd5}`);

    if (this.md5) {
      this.setChecklistItemStatus(item, 'succeeded');
      return true;
    }

    this.setChecklistItemStatus(item, 'in-progress');

    const filesize = this.inputFile.size;
    const chunks = Math.ceil(filesize / MediaUploadWizard.Constants.Md5.ChunkSize);
    let response;
    for (let idx = 0; idx < chunks; idx++) {
      try {
        response = await this.computeFileChunk(this.inputFile, idx, response);
        const percentage = Math.ceil((response.end / filesize) * 100);
        item.find('.checklist-text')
          .html(`computing md5... <span style="font-size: 0.8rem;">${percentage}% (${response.end}/${filesize})</span>`);
      } catch (e) {
        this.setChecklistItemStatus(item, 'failed');
        throw e;
      }
    }

    /* now, we can get the MD5 of the entire file */
    const spark = new SparkMD5.ArrayBuffer();
    spark.setState(response.state);

    const md5 = spark.end();
    this.md5 = this.updateMd5Field(md5);
    this.setChecklistItemStatus(item, 'succeeded');
    item.find('.checklist-text').html(`md5 is ready... (${this.md5})`);

    return true;
  }

  async onChecklistError(e) {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Upload;
    const slide = this.carousel.find(`#${X.Id}`);
    slide.find(`#${X.List.Error}`)
      .removeClass('collapse')
      .html(encodeURIComponent(e.message));
  }

  async onChecklistSetNavigation(params) {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Upload;
    const slide = this.carousel.find(`#${X.Id}`);
    Object.keys(params).forEach(k =>
      ((params[k])
        ? slide.find(`[data-action="${k}"]`).removeAttr('disabled')
        : slide.find(`[data-action="${k}"]`).attr('disabled', 'disabled')));
  }

  async onChecklistResetItems() {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Upload;
    this.carousel.find(`#${X.Id}`).find('span').addClass('collapse');
  }

  async onUploadChecklist() {
    if (!this.timer) {
      this.timer = setTimeout(async () => {
        const X = MediaUploadWizard.Constants.Carousel.Slide;
        try {
          this.onChecklistResetItems();
          /* disable start upload button */
          await this.onChecklistSetNavigation({
            [X.Upload.Action.StartUpload]: false,
          });
          await this.onChecklistBucket();
          await this.onChecklistMetadata();
          await this.onChecklistUuid();
          await this.onChecklistMd5();
          this.setChecklistUploadingStatus('ready to upload...');
          /* enable start upload button */
          await this.onChecklistSetNavigation({
            [X.Upload.Action.StartUpload]: true,
          });
          return true;
        } catch (e) {
          await this.onChecklistSetNavigation({
            [X.Cancel.Id]: true,
          });
          await this.onChecklistError(e);
          return false;
        } finally {
          clearInterval(this.timer);
          this.timer = undefined;
        }
      }, 200);
    }
    return this.timer;
  }

  async computeFileChunk(file, chunkIdx, previous) {
    return new Promise((resolve, reject) => {
      const start = chunkIdx * MediaUploadWizard.Constants.Md5.ChunkSize;
      const end = Math.min(start + MediaUploadWizard.Constants.Md5.ChunkSize, file.size);

      const spark = new SparkMD5.ArrayBuffer();
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

      reader.onerror = e =>
        reject(e);

      reader.readAsArrayBuffer(file.slice(start, end));
    });
  }

  requestMultipartUpload() {
    const params = {
      Bucket: this.bucket,
      Key: this.key,
      ContentType: this.getMimeType(this.inputFile),
      Metadata: Object.assign({}, this.metadata, {
        uuid: this.uuid,
        md5: this.md5,
      }),
      Body: this.inputFile,
    };
    const options = {
      partSize: MediaUploadWizard.Constants.Multipart.PartSize,
      queueSize: MediaUploadWizard.Constants.Multipart.MaxConcurrentUpload,
    };

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
    });

    return s3.upload(params, options);
  }

  updateUuidField(uuid) {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Metadata;
    this.carousel.find(`#${X.Id}`)
      .find(`[data-target="${X.Input.Metadata}-val-uuid"]`).val(uuid);
    return uuid;
  }

  updateMd5Field(md5) {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Metadata;
    this.carousel.find(`#${X.Id}`)
      .find(`[data-target="${X.Input.Metadata}-val-md5"]`).val(md5);
    return md5;
  }

  setChecklistItemStatus(item, className) {
    item.find('span').addClass('collapse');
    item.find(`.${className}`).removeClass('collapse');
  }

  setChecklistUploadingStatus(message) {
    const X = MediaUploadWizard.Constants.Carousel.Slide.Upload;
    this.carousel
      .find(`#${X.Id}`)
      .find(`#${X.List.Uploading}`)
      .find('.checklist-text')
      .html(message);
  }
}
