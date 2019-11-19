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
/* eslint-disable implicit-arrow-linebreak */
class JsonUploadWizard extends mxReadable(BaseWizard) {
  constructor(parent, params) {
    const id = (params || {}).modalId || 'json-upload-modal-id';
    super(parent, id);

    this.$cardCollection = this.parent.parent;
    this.$inputFile = undefined;
    this.$jsonParser = undefined;
    this.$bucket = SO0050.Ingest.Bucket;
    this.$key = undefined;
    this.$uuid = undefined;
    this.$timer = undefined;
    this.$timerUpload = undefined;
  }

  static get Constants() {
    const prefix = 'json-upload';
    return {
      Carousel: {
        Container: {
          Id: `${prefix}-carousel-container`,
        },
        Slide: {
          FilePicker: {
            Id: `${prefix}-carousel-slide-file-picker`,
            Error: `${prefix}-ul-error`,
            List: {
              ParseJson: `${prefix}-ul-parse-json`,
            },
            Table: {
              Container: `${prefix}-table-container`,
            },
          },
          Upload: {
            Id: `${prefix}-carousel-slide-upload`,
            Error: `${prefix}-upload-error`,
            Filelist: `${prefix}-upload-list`,
            Action: {
              StartUpload: `${prefix}-start-upload`,
            },
          },
          Cancel: {
            Id: `${prefix}-carousel-slide-cancel`,
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

  get jsonParser() {
    return this.$jsonParser;
  }

  set jsonParser(val) {
    this.$jsonParser = val;
  }

  get bucket() {
    return this.$bucket;
  }

  get key() {
    return this.$key;
  }

  set key(val) {
    this.$key = val;
  }

  get uuid() {
    return this.$uuid;
  }

  set uuid(val) {
    this.$uuid = val;
  }

  get timer() {
    return this.$timer;
  }

  set timer(val) {
    this.$timer = val;
  }

  get timerUpload() {
    return this.$timerUpload;
  }

  set timerUpload(val) {
    this.$timerUpload = val;
  }

  resetAll() {
    this.inputFile = undefined;
    this.jsonParser = undefined;
    this.key = undefined;
    this.uuid = undefined;
    this.timer = undefined;
    this.parent.resetFileInput();
  }

  domInit() {
    const id = JsonUploadWizard.Constants.Carousel.Container.Id;
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
    slides.append(this.createCarouselSlideFilePicker('active'));
    slides.append(this.createCarouselSlideUpload());

    /* attach to modal */
    element.appendTo(this.modal);
    this.carousel = $(`#${id}`);
    this.registerEvents();
  }

  createCarouselSlideFilePicker(active = '') {
    const X = JsonUploadWizard.Constants.Carousel.Slide;
    const element = `
    <div
    class="carousel-item ${active}"
    id="${X.FilePicker.Id}"
    style="height: 400px">
      <div
      class="container"
      style="height: 100%; width: 96%;">
        <div
        class="row d-flex justify-content-center align-items-center"
        style="height: 90%;">
          <!-- graphics -->
          <div class="col-sm-3 px-0 text-center">
            <i class="fas fa-file-code" style="color: #ccc; font-size: 6em"></i>
          </div>

          <!-- content -->
          <div class="col-sm-9 px-0" style="overflow-y:scroll; height:90%;">
            <div>
              <h5>Choose file(s) to ingest</h5>
              ${this.createFormAnalyze()}
              ${this.createFormFilelist()}
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

          <!-- next to start upload -->
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

  registerEvents() {
    this.carousel.off('slide.bs.carousel').on('slide.bs.carousel', async (event) => {
      const X = JsonUploadWizard.Constants.Carousel.Slide;
      const slides = this.carousel.children().children();
      const to = $(slides.get(event.to));
      switch (to.prop('id')) {
        case X.FilePicker.Id:
          await this.onSlideFilePicker();
          break;
        case X.Upload.Id:
          await this.onSlideUpload();
          break;
        default:
          break;
      }
    });
    return super.registerEvents();
  }

  async show(file) {
    this.inputFile = file;
    await super.show();
    return this.onSlideFilePicker();
  }

  createCarouselSlideUpload(active = '') {
    const X = JsonUploadWizard.Constants.Carousel.Slide;
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
          <div class="col-sm-9 px-0" style="overflow-y:scroll; height:90%;">
            <h4>Almost done</h4>
            <p class="mt-3" style="font-size:1rem; font-weight:300;">
              Click 'Start process' to ingest the file(s).
            </p>
            <ul
            class="list-group list-group-flush"
            id="${X.Upload.Filelist}"
            >
            </ul>
            <div class="mt-4">
              <span class="collapse"
              id=${X.Upload.Error}
              style="font-size:0.8rem; color:#ff0000;"
              >error message....
              </span>
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
          data-action="${X.FilePicker.Id}">
            Back
          </button>

          <!-- start upload -->
          <button
          type="button"
          class="btn btn-sm btn-success px-4 mx-1"
          data-action="${X.Upload.Action.StartUpload}">
            Start process
          </button>
        </div>
      </div>
    </div>
    `;
    return element;
  }

  createFormAnalyze() {
    const X = JsonUploadWizard.Constants.Carousel.Slide.FilePicker;
    const items = [];
    items.push('<ul class="list-group list-group-flush">');
    [{
      text: 'parsing json file...',
      id: X.List.ParseJson,
    }].forEach((x) => {
      items.push(`<li
        class="list-group-item px-0"
        id=${x.id}
        style="border:none;">
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
        id=${X.Error}
        style="font-size:0.8rem; color:#ff0000;"
        >error message....
        </span>
      </div>`);
    return items.join('\n');
  }

  createFormFilelist() {
    const X = JsonUploadWizard.Constants.Carousel.Slide.FilePicker;
    const items = [];

    items.push(`<div
      class="mt-4 collapse"
      id="${X.Table.Container}">`);
    items.push('<p class="mt-1" style="font-size:1rem; font-weight:300;"></p>');
    items.push('<table class="table table-hover table-sm" style="font-size:0.8rem;">');
    items.push('<thead><tr>');
    items.push('<th scope="col" class="align-middle">#</th>');
    items.push('<th scope="col" class="align-middle px-0">File</th>');
    items.push('<th scope="col" class="align-middle px-0">Metadata</th>');
    items.push('</tr></thead>');
    items.push('<tbody>');
    items.push('</tbody>');
    items.push('</table>');
    items.push('</div>');

    items.push(`<div class="mt-4">
      <span class="collapse"
      id=${X.Error}
      style="font-size:0.8rem; color:#ff0000;"
      >error message....
      </span>
    </div>`);
    return items.join('\n');
  }

  async onAction(target) {
    const X = JsonUploadWizard.Constants.Carousel.Slide;
    switch ($(target).data('action')) {
      case X.Upload.Action.StartUpload:
        return this.onUpload(target);
      case X.Cancel.Id:
        return this.onCancel(target);
      default:
        break;
    }
    return super.onAction(target);
  }

  async onCancel(target) {
    await this.hide();
    return true;
  }

  async onSlideFilePicker(target) {
    if (!this.timer) {
      this.timer = setTimeout(async () => {
        try {
          const X = JsonUploadWizard.Constants.Carousel.Slide;
          const id = X.FilePicker.Id;
          /* disable start upload button */
          await this.onSlideSetNavigation(id, {
            [X.Cancel.Id]: false,
            [X.Upload.Id]: false,
          });
          await this.onAnalyzeJsonFile(target);
          /* enable start upload button */
          await this.onSlideSetNavigation(id, {
            [X.Cancel.Id]: true,
            [X.Upload.Id]: true,
          });
          return true;
        } catch (e) {
          await this.onFilePickerError(e);
          return false;
        } finally {
          clearInterval(this.timer);
          this.timer = undefined;
        }
      }, 500);
    }
    return this.timer;
  }

  async onSlideUpload(target) {
    if (!this.timerUpload) {
      this.timerUpload = setTimeout(async () => {
        const X = JsonUploadWizard.Constants.Carousel.Slide.Upload;
        try {
          /* disable start upload button */
          await this.onSlideSetNavigation(X.Id, {
            [X.Action.StartUpload]: false,
          });

          this.createFormUpload();

          await this.onSlideSetNavigation(X.Id, {
            [X.Action.StartUpload]: true,
          });
          return true;
        } catch (e) {
          await this.onUploadError(e);
          await this.onSlideSetNavigation(X.Id, {
            [JsonUploadWizard.Constants.Carousel.Slide.Cancel.Id]: true,
          });
          return false;
        } finally {
          clearInterval(this.timerUpload);
          this.timerUpload = undefined;
        }
      }, 200);
    }
    return this.timerUpload;
  }

  async onUploadError(e) {
    const X = JsonUploadWizard.Constants.Carousel.Slide.Upload;
    this.carousel.find(`#${X.Id}`).find(`#${X.Error}`)
      .removeClass('collapse')
      .html(encodeURIComponent(e.message));
  }

  async onSlideSetNavigation(id, params) {
    const slide = this.carousel.find(`#${id}`);
    Object.keys(params).forEach(k =>
      ((params[k])
        ? slide.find(`[data-action="${k}"]`).removeAttr('disabled')
        : slide.find(`[data-action="${k}"]`).attr('disabled', 'disabled')));
  }

  async onAnalyzeJsonFile(target) {
    const X = JsonUploadWizard.Constants.Carousel.Slide.FilePicker;
    const slide = this.carousel.find(`#${X.Id}`);
    const item = slide.find(`#${X.List.ParseJson}`);
    try {
      if (this.jsonParser) {
        this.setListItemStatus(item, 'succeeded');
        return true;
      }

      this.setListItemStatus(item, 'in-progress');
      this.jsonParser = await JsonParser.createInstance(this.inputFile);
      if (!this.jsonParser) {
        throw new Error(`fail to parse json file, ${this.inputFile.name}`);
      }

      item.find('.checklist-text').html('parsing file(s)...');
      await this.buildFilelist();

      this.setListItemStatus(item, 'succeeded');
      item.find('.checklist-text').html(`found ${this.jsonParser.files.length} file(s) in ${this.inputFile.name} document...`);
      return true;
    } catch (e) {
      this.setListItemStatus(item, 'failed');
      throw e;
    }
  }

  async onFilePickerError(e) {
    const X = JsonUploadWizard.Constants.Carousel.Slide.FilePicker;
    this.carousel.find(`#${X.Id}`).find(`#${X.Error}`)
      .removeClass('collapse')
      .html(encodeURIComponent(e.message));
  }

  async loadJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.readyState === 2) {
          resolve(JSON.parse(reader.result));
        }
      };
      reader.onerror = () =>
        reject(new Error(reader.error.code));
      reader.readAsText(file);
    });
  }

  async buildFileTableRow(file) {
    const type = this.getType(file.key);
    const supported = (type === 'image' || type === 'video')
      && (await this.checkFileExists(SO0050.Ingest.Bucket, file.key));

    const icon = (type === 'image')
      ? '<i class="far fa-image"></i>'
      : (type === 'audio')
        ? '<i class="fas fa-music"></i>'
        : (type === 'video')
          ? '<i class="fas fa-video"></i>'
          : '<i class="far fa-question-circle"></i>';

    return `<tr>
      <th scope="row" class="align-middle">
        <div class="form-check">
          <input
            type="checkbox"
            class="form-check-input position-static"
            data-uuid="${file.uuid}"
            ${supported ? 'checked' : 'disabled'}>
        </div>
      </th>
      <td class="align-middle px-0">
        <span
          class="${supported ? '' : 'text-muted'}">
          ${icon} ${JsonUploadWizard.shorten(file.key, 25)}
        </span>
      </td>
      <td class="align-middle px-0">
        <span
          class="${supported ? '' : 'text-muted'}">
          uuid: ${file.uuid || '--'}<br>
          md5: ${file.md5}
        </span>
      </td>
    </tr>`;
  }

  async buildFilelist() {
    const X = JsonUploadWizard.Constants.Carousel.Slide.FilePicker;
    const table = this.carousel.find(`#${X.Id}`).find(`#${X.Table.Container}`);
    const body = table.find('tbody');
    body.children().remove();

    const items = [];
    const files = this.jsonParser.files.slice(0);
    while (files.length) {
      const file = files.shift();
      const item = await this.buildFileTableRow(file);
      if (item) {
        items.push(item);
      }
    }
    $(items.join('\n')).appendTo(body);
    table.removeClass('collapse');
  }

  setListItemStatus(item, className) {
    item.find('span').addClass('collapse');
    item.find(`.${className}`).removeClass('collapse');
  }

  async checkFileExists(bucket, key) {
    try {
      if (!bucket || !key) {
        return false;
      }

      await (new AWS.S3({
        apiVersion: '2006-03-01',
        computeChecksums: true,
        signatureVersion: 'v4',
      })).headObject({
        Bucket: bucket,
        Key: key,
      }).promise();
      return true;
    } catch (e) {
      return false;
    }
  }

  createUploadListItem(uuid, key) {
    return `<li
    class="list-group-item px-0"
    data-uuid=${uuid}>
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
      style="font-size:0.1rem;">
      </span>
      <div class="checklist-text" style="display:inline;">
        file: ${key} ...
      </div>
    </li>`;
  }

  createFormUpload() {
    const X = JsonUploadWizard.Constants.Carousel.Slide;
    const items = [];
    const table = this.carousel
      .find(`#${X.FilePicker.Id}`)
      .find('tbody');
    table.find('input:checked').each((k0, v0) => {
      const file = this.jsonParser.files.find(x =>
        x.uuid === $(v0).data('uuid'));
      if (file) {
        items.push(this.createUploadListItem(file.uuid, file.key));
      }
    });
    /* build a list of files to be processed */
    const ul = this.carousel.find(`#${X.Upload.Id}`).find(`#${X.Upload.Filelist}`);
    ul.children().remove();
    $(items.join('\n')).appendTo(ul);
  }

  async uploadJson() {
    const key = [
      this.jsonParser.key.substr(0, this.jsonParser.key.lastIndexOf('.')),
      this.jsonParser.key,
    ].join('/');

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
    });

    return s3.putObject({
      Bucket: this.bucket,
      Key: key,
      ContentType: this.jsonParser.mime,
      Body: JSON.stringify(this.jsonParser.jsonData, null, 2),
    }).promise();
  }

  async onUpload(target) {
    const X = JsonUploadWizard.Constants.Carousel.Slide;
    const filelist = this.carousel
      .find(`#${X.Upload.Id}`)
      .find(`#${X.Upload.Filelist}`);

    try {
      await this.onSlideSetNavigation(X.Upload.Id, {
        [X.Cancel.Id]: false,
        [X.FilePicker.Id]: false,
        [X.Upload.Action.StartUpload]: false,
      });

      const list = filelist.find('li[data-uuid]');
      for (let i = 0; i < list.length; i++) {
        const elem = $(list[i]);
        this.setListItemStatus(elem, 'in-progress');

        const file = this.jsonParser.files.find(x =>
          x.uuid === elem.data('uuid'));
        if (!file) {
          continue;
        }

        const data = await ApiHelper.getRecord(file.uuid)
          .catch(() => undefined);

        if ((data || {}).basename !== undefined) {
          this.setListItemStatus(elem, 'failed');
          elem.find('.checklist-text')
            .html(`${file.key} (${file.uuid} is already occupied)...`);
          continue;
        }

        this.cardCollection.createCard({
          uuid: file.uuid,
          type: this.getType(file.key),
        });

        await ApiHelper.startIngestWorkflow({
          uuid: file.uuid,
          bucket: this.bucket,
          key: file.key,
          attributes: this.jsonParser.attributes,
        }).catch((e) => {
          this.setListItemStatus(elem, 'failed');
          throw e;
        });
        elem.find('.checklist-text').html(`${file.key} ingested ...`);
        this.setListItemStatus(elem, 'succeeded');
      }

      /* now upload the json file */
      await this.uploadJson();
      await this.onCompleted(target);
      return true;
    } catch (e) {
      await this.onSlideSetNavigation(X.Upload.Id, {
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
}
