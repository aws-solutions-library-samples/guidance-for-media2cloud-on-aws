// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../../shared/localization.js';
import AppUtils from '../../shared/appUtils.js';
import ApiHelper from '../../shared/apiHelper.js';
import {
  GetS3Utils,
} from '../../shared/s3utils.js';
import BaseUploadSlideComponent from './baseUploadSlideComponent.js';
import {
  AWSConsoleS3,
} from '../../shared/awsConsole.js';

const {
  MimeGetMime,
} = window.MimeWrapper;

const MSG_STATUS_NOT_STARTED = Localization.Statuses.NotStarted;
const MSG_STATUS_WAITING = Localization.Statuses.Waiting;
const MSG_STATUS_PROCESSING = Localization.Statuses.Processing;
const MSG_STATUS_COMPLETED = Localization.Statuses.Completed;
const MSG_STATUS_ERROR = Localization.Statuses.Error;
const MSG_STATUS_TOTAL = Localization.Statuses.Total;

const MSG_VALIDATE_UUID = Localization.Messages.ValidateUuid;
const MSG_COMPUTE_CHECKSUM = Localization.Messages.ComputeChecksum;
const MSG_UPLOAD_STATUS = Localization.Messages.UploadStatus;
const MSG_UPLOAD_S3 = Localization.Messages.UploadS3;
const MSG_FINALIZE_UPLOAD_DESC = Localization.Messages.FinalizeUploadDesc;

const MSG_SUMMARY = Localization.Messages.Summary;
const PROPKEY_SOURCE = Localization.Messages.Source;
const PROPKEY_FILENAME = Localization.Messages.FileName;
const PROPKEY_FILESIZE = Localization.Messages.FileSize;
const PROPKEY_FILETYPE = Localization.Messages.FileType;
const PROPKEY_LASTMODIFIED = Localization.Messages.LastModified;
const PROPKEY_DESTINATION = Localization.Messages.Destination;
const PROPKEY_BUCKET = Localization.Messages.Bucket;
const PROPKEY_KEY = Localization.Messages.Key;
const PROPKEY_ATTRIBUTES = Localization.Messages.Attributes;

const BTN_CANCEL = Localization.Buttons.Cancel;
const BTN_START_NOW = Localization.Buttons.StartNow;
const BTN_DONE = Localization.Buttons.Done;
const BTN_DOWNLOAD_SUMMARY = Localization.Buttons.DownloadSummary;

const ERR_UPLOAD_S3 = Localization.Alerts.UploadS3Error;
const ERR_CREATE_UUID = Localization.Alerts.CreateUuidError;
const ERR_COMPUTE_CHECKSUM = Localization.Alerts.ComputeChecksumError;
const ERR_START_WORKFLOW = Localization.Alerts.StartWorkflowError;

const MD5_CHUNK_SIZE = 8 * 1024 * 1024;

export default class FinalizeSlideComponent extends BaseUploadSlideComponent {
  constructor() {
    super();
    this.$ids = {
      ...this.$ids,
      tablist: `finalize-${AppUtils.randomHexstring()}`,
      tabcontent: `finalize-${AppUtils.randomHexstring()}`,
    };
    this.$report = [];
    this.$fileList = [];
    this.$bucket = SolutionManifest.Ingest.Bucket;
  }

  static get Events() {
    return {
      Overall: {
        Started: 'finalize:overall:started',
        Progress: 'finalize:overall:progress',
        Completed: 'finalize:overall:completed',
      },
      Process: {
        Uuid: 'finalize:process:uuid',
        Checksum: 'finalize:process:checksum',
        UploadS3: 'finalize:process:uploads3',
        Statuses: {
          Started: 'finalize:process:started',
          Completed: 'finalize:process:completed',
          Error: 'finalize:process:error',
        },
      },
    };
  }

  get bucket() {
    return this.$bucket;
  }

  get fileList() {
    return this.$fileList;
  }

  set fileList(val) {
    this.$fileList = val;
  }

  get report() {
    return this.$report;
  }

  set report(val) {
    this.$report = val;
  }

  // override BaseUploadSlideComponent
  async getData() {
    const {
      elapsed,
      bytes,
    } = this.report.reduce((a0, c0) => ({
      elapsed: a0.elapsed + c0.elapsed,
      bytes: a0.bytes + c0.src.bytes,
    }), {
      elapsed: 0,
      bytes: 0,
    });
    const errors = this.report.filter(x => x.error);
    return {
      completed: this.report.length - errors.length,
      errors: errors.length,
      elapsed,
      bytes,
      items: this.report,
    };
  }

  // override BaseUploadSlideComponent
  async clearData() {
    this.report.length = 0;
    this.slide.find(`#${this.ids.tablist}`).children().remove();
    this.slide.find(`#${this.ids.tabcontent}`).children().remove();
    this.fileList.length = 0;
  }

  // override BaseUploadSlideComponent
  async createSlide() {
    const description = this.createDescription();
    const controls = this.createControls();
    const content = this.createFinalizedList();
    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-12 p-0 m-0 mt-4')
        .append(description))
      .append($('<div/>').addClass('col-12 p-0 m-0 mt-4')
        .append(content))
      .append($('<div/>').addClass('col-12 p-0 m-0 mt-4')
        .append(controls));
    this.slide.append(row);
    return super.createSlide();
  }

  createDescription() {
    const anchor = $('<a/>')
      .attr('href', AWSConsoleS3.getLink(this.bucket))
      .attr('target', '_blank')
      .html(this.bucket);
    const desc = MSG_FINALIZE_UPLOAD_DESC
      .replace('{{BUCKET}}', anchor.prop('outerHTML'));
    return $('<p/>').addClass('lead')
      .html(desc);
  }

  createControls() {
    const cancel = $('<button/>').addClass('btn btn-light ml-1')
      .html(BTN_CANCEL);
    const startnow = $('<button/>').addClass('btn btn-success ml-1')
      .html(BTN_START_NOW);
    const done = $('<button/>').addClass('btn btn-success ml-1 collapse')
      .html(BTN_DONE);
    const overall = $('<span/>').addClass('lead collapse')
      .html(MSG_STATUS_NOT_STARTED);
    const download = $('<a/>').addClass('btn btn-light ml-1 collapse')
      .attr('role', 'button')
      .attr('href', '')
      .attr('download', '')
      .attr('target', '_blank')
      .html(BTN_DOWNLOAD_SUMMARY);

    // local reset controls funciton
    const resetControls = () => {
      download.addClass('collapse');
      done.addClass('collapse');
      startnow.removeClass('collapse');
      cancel.removeClass('collapse');
      overall.addClass('collapse').removeClass('text-success text-danger')
        .html(MSG_STATUS_NOT_STARTED);
    };

    cancel.off('click').on('click', async (event) => {
      resetControls();
      this.slide.trigger(FinalizeSlideComponent.Controls.Cancel);
    });

    startnow.off('click').on('click', async (event) =>
      this.startNow());

    done.off('click').on('click', async (event) => {
      resetControls();
      this.slide.trigger(FinalizeSlideComponent.Controls.Done);
    });

    // handle internal upload progress events
    let totalFiles;
    this.slide.on(FinalizeSlideComponent.Events.Overall.Started, async (event, total) => {
      totalFiles = total;
      startnow.attr('disabled', 'disabled');
      cancel.attr('disabled', 'disabled');
    });

    this.slide.on(FinalizeSlideComponent.Events.Overall.Progress, async (event, index) => {
      overall.removeClass('collapse').html(`${MSG_STATUS_PROCESSING} (${index + 1} / ${totalFiles})...`);
    });

    this.slide.on(FinalizeSlideComponent.Events.Overall.Completed, async (event, metrics) => {
      const blob = URL.createObjectURL(new Blob([
        JSON.stringify(metrics, null, 2),
      ], {
        type: 'application/json',
      }));
      download.prop('href', blob).prop('download', 'summary.json');
      startnow.addClass('collapse').removeAttr('disabled');
      cancel.addClass('collapse').removeAttr('disabled');
      download.removeClass('collapse');
      done.removeClass('collapse');
      const status = `${MSG_STATUS_COMPLETED} / ${MSG_STATUS_ERROR} / ${MSG_STATUS_TOTAL}: (${metrics.completed} / ${metrics.errors} / ${totalFiles})`;
      overall.addClass('text-dark').html(status);
    });

    const controls = $('<form/>').addClass('form-inline')
      .append($('<div/>').addClass('ml-auto')
        .append(overall))
      .append($('<div/>').addClass('ml-auto')
        .append(cancel)
        .append(startnow)
        .append(download)
        .append(done));

    controls.submit(event =>
      event.preventDefault());

    return controls;
  }

  createFinalizedList() {
    const list = $('<div/>').addClass('col-4 px-0 mx-0 overflow-auto h-96')
      .append($('<div/>').addClass('list-group')
        .attr('role', 'tablist')
        .attr('id', this.ids.tablist));
    const content = $('<div/>').addClass('col-8 px-0 mx-2 overflow-auto my-auto h-96')
      .append($('<div/>').addClass('tab-content ml-2')
        .attr('id', this.ids.tabcontent));
    return $('<div/>').addClass('finalize-contaniner')
      .append(list)
      .append(content);
  }

  addList(fileList) {
    const tabList = this.slide.find(`#${this.ids.tablist}`).first();
    const tabContent = this.slide.find(`#${this.ids.tabcontent}`).first();
    fileList.forEach((x) => {
      const id = `tab-${x.fileId}`;
      tabList.append(this.createItemTab(id, x.file.name, MSG_STATUS_NOT_STARTED));
      tabContent.append(this.createItemContent(id, x));
    });
    this.fileList = fileList;
  }

  createItemTab(id, name, status) {
    const item = $('<a/>').addClass('list-group-item list-group-item-action')
      .attr('data-toggle', 'list')
      .attr('role', 'tab')
      .attr('href', `#${id}`)
      .append($('<div/>').addClass('marquee')
        .append($('<span/>').addClass('marquee-target')
          .append(name)))
      .append(($('<span/>').addClass('badge badge-light badge-custom')
        .attr('data-status', status)
        .html(status)));
    return item;
  }

  createItemContent(id, file) {
    const container = $('<div/>').addClass('tab-pane fade')
      .attr('id', id)
      .attr('role', 'tabpanel');

    const content = $('<div/>').addClass('mx-auto');
    const summary = this.createContentSummary(id, file);
    const uploadStatus = this.createContentStatus(id, file);

    content.append(summary).append(uploadStatus);
    return container.append(content);
  }

  createContentSummary(id, file) {
    const summary = $('<div/>')
      .attr('data-type', 'summary');

    const status = $('<span/>')
      .addClass('d-block p-2 text-black bg-light lead my-2')
      .html(MSG_SUMMARY);
    summary.append(status);

    const key = file.resolveKey();
    const data = {
      [PROPKEY_SOURCE]: {
        [PROPKEY_FILENAME]: file.displayName,
        [PROPKEY_FILESIZE]: `${AppUtils.readableFileSize(file.file.size)} (${file.file.size} bytes)`,
        [PROPKEY_FILETYPE]: file.file.type,
        [PROPKEY_LASTMODIFIED]: new Date(file.file.lastModified).toISOString(),
      },
      [PROPKEY_DESTINATION]: {
        [PROPKEY_BUCKET]: this.bucket,
        [PROPKEY_KEY]: key,
      },
      [PROPKEY_ATTRIBUTES]: file.attributes,
    };

    Object.keys(data).forEach((cat) => {
      const details = $('<details/>').addClass('p-2 my-1')
        .append($('<summary/>')
          .append($('<span/>').addClass('lead')
            .html(cat)));

      const form = $('<form/>').addClass('form-inline mt-2');
      Object.keys(data[cat]).forEach((k0) => {
        form
          .append($('<label/>').addClass('col-3 justify-content-start')
            .html(k0))
          .append($('<input/>').addClass('form-control form-control-sm col-9')
            .attr('type', 'text')
            .attr('disabled', 'disabled')
            .attr('value', data[cat][k0]));
      });
      summary.append(details.append(form));
    });
    return summary;
  }

  createContentStatus(id, file) {
    const container = $('<div/>').addClass('p-2 my-1')
      .attr('data-file-id', file.fileId);

    const status = $('<div/>').addClass('d-block p-2 text-black bg-light lead my-2')
      .append($('<span/>').addClass('d-inline-flex mr-1')
        .html(MSG_UPLOAD_STATUS))
      .append($('<span/>').addClass('badge badge-light badge-custom')
        .attr('data-status', MSG_STATUS_NOT_STARTED)
        .html(`${MSG_STATUS_NOT_STARTED}`));

    const uuidFlow = this.createUuidFlow(container, file.fileId);
    const checksumFlow = this.createChecksumFlow(container, file.fileId);
    const uploadS3Flow = this.createUploadS3Flow(container, file.fileId);

    return container
      .append(status)
      .append(uuidFlow)
      .append(checksumFlow)
      .append(uploadS3Flow);
  }

  createUuidFlow(container, fileId) {
    const process = this.createFlow('uuid', MSG_VALIDATE_UUID);

    const eUuid = `${FinalizeSlideComponent.Events.Process.Uuid}:${fileId}`;
    container.on(eUuid, async (event, file) => {
      const report = {
        fileId: file.fileId,
        elapsed: 0,
        src: {
          name: file.displayName,
          bytes: file.file.size,
          type: MimeGetMime(file),
          lastModified: new Date(file.file.lastModified).getTime(),
        },
        metrics: {
          uuid: {
            startTime: new Date().getTime(),
          },
        },
      };

      const eStarted = `${FinalizeSlideComponent.Events.Process.Statuses.Started}:${file.fileId}`;
      const eError = `${FinalizeSlideComponent.Events.Process.Statuses.Error}:${file.fileId}`;
      /* let processFile know we are starting */
      this.slide.trigger(eStarted, [file.fileId]);

      report.uuid = await this.createValidUuid(process);
      report.metrics.uuid.endTime = new Date().getTime();
      report.elapsed += report.metrics.uuid.endTime - report.metrics.uuid.startTime;
      if (!report.uuid) {
        report.error = ERR_CREATE_UUID;
        return this.slide.trigger(eError, [file.fileId, report.error, report]);
      }
      file.setUuid(report.uuid);
      /* start checksum process */
      const eChecksum = `${FinalizeSlideComponent.Events.Process.Checksum}:${fileId}`;
      return container.trigger(eChecksum, [file, report]);
    });

    return process;
  }

  createChecksumFlow(container, fileId) {
    const process = this.createFlow('checksum', MSG_COMPUTE_CHECKSUM);

    const eChecksum = `${FinalizeSlideComponent.Events.Process.Checksum}:${fileId}`;
    container.on(eChecksum, async (event, file, previous) => {
      const report = {
        ...previous,
        metrics: {
          ...previous.metrics,
          checksum: {
            type: 'md5',
            startTime: new Date().getTime(),
          },
        },
      };
      report.checksum = await this.computeChecksum(process, file);
      report.metrics.checksum.endTime = new Date().getTime();
      report.elapsed += report.metrics.checksum.endTime - report.metrics.checksum.startTime;
      if (!report.checksum) {
        report.error = ERR_COMPUTE_CHECKSUM;
        const eError = `${FinalizeSlideComponent.Events.Process.Statuses.Error}:${file.fileId}`;
        return this.slide.trigger(eError, [file.fileId, report.error, report]);
      }
      file.setChecksum(report.checksum);
      /* start s3 upload process */
      const eUploadS3 = `${FinalizeSlideComponent.Events.Process.UploadS3}:${fileId}`;
      return container.trigger(eUploadS3, [file, report]);
    });
    return process;
  }

  createUploadS3Flow(container, fileId) {
    const process = this.createFlow('uploads3', MSG_UPLOAD_S3);

    const eUploadS3 = `${FinalizeSlideComponent.Events.Process.UploadS3}:${fileId}`;
    container.on(eUploadS3, async (event, file, previous) => {
      const report = {
        ...previous,
        dst: {
          bucket: this.bucket,
          key: file.resolveKey(),
          attrs: file.attributes,
        },
        metrics: {
          ...previous.metrics,
          uploads3: {
            startTime: new Date().getTime(),
          },
        },
      };

      let response = await this.uploadS3(process, file, report.dst.bucket, report.dst.key);
      report.metrics.uploads3.endTime = new Date().getTime();
      report.elapsed += report.metrics.uploads3.endTime - report.metrics.uploads3.startTime;
      if (!response) {
        report.error = ERR_UPLOAD_S3;
        const eError = `${FinalizeSlideComponent.Events.Process.Statuses.Error}:${file.fileId}`;
        return this.slide.trigger(eError, [file.fileId, report.error, report]);
      }

      // starting workflow if file type is supported
      if (file.canSupport) {
        response = await this.startWorkflow(file);
        if (!response) {
          report.error = ERR_START_WORKFLOW;
          const eError = `${FinalizeSlideComponent.Events.Process.Statuses.Error}:${file.fileId}`;
          return this.slide.trigger(eError, [file.fileId, report.error, report]);
        }
      }

      const eCompleted = `${FinalizeSlideComponent.Events.Process.Statuses.Completed}:${file.fileId}`;
      return this.slide.trigger(eCompleted, [file.fileId, report]);
    });
    return process;
  }

  createFlow(process, label) {
    return $('<div/>').addClass('col-12 px-0 d-flex')
      .append($('<div/>').addClass('col-3 justify-content-start my-2')
        .html(label))
      .append($('<div/>').addClass('col-9 p-0 m-0 d-flex')
        .attr('data-process', process)
        .append($('<div/>').addClass('col-12 justify-content-start px-0 my-2 collapse')
          .attr('data-field', 'result')
          .html('result goes here'))
        .append(this.createUploadProgressBar())
        .append($('<div/>').addClass('col-2 align-self-center')
          .attr('data-field', 'progress')
          .append(this.createUploadProgressInput())));
  }

  createUploadProgressBar() {
    return $('<div/>').addClass('col-10 progress px-0 align-self-center')
      .attr('data-field', 'progress')
      .css('height', '3px')
      .append($('<div/>').addClass('progress-bar bg-success')
        .attr('role', 'progressbar')
        .attr('aria-valuemin', 0)
        .attr('aria-valuemax', 100)
        .attr('aria-valuenow', 0)
        .css('width', '0%'));
  }

  createUploadProgressInput() {
    return $('<input/>').addClass('col-12 px-0 text-center text-muted ml-1')
      .attr('type', 'text')
      .attr('value', '0%')
      .attr('disabled', 'disabled');
  }

  async createValidUuid(process) {
    const progressbar = process.find('[role="progressbar"]');
    const progressInput = process.find('input');
    const result = process.find('[data-field="result"]');
    let percentage = 10;
    let uuid;
    let record;
    const maxTries = 4;
    let tries = 0;

    this.updateProgress(progressbar, progressInput, percentage);
    do {
      uuid = AppUtils.uuid4();
      record = await ApiHelper.getRecord(uuid).catch(() => ({}));
      percentage += 10;
      this.updateProgress(progressbar, progressInput, percentage);
    } while (record.uuid && tries++ < maxTries);

    /* error: can't create an unique uuid */
    if (record.uuid) {
      this.showResult(progressbar, progressInput, result, 'danger', ERR_CREATE_UUID);
      return undefined;
    }
    this.updateProgress(progressbar, progressInput, 100);
    this.showResult(progressbar, progressInput, result, 'success', uuid);
    return uuid;
  }

  async computeChecksum(process, file) {
    const progressbar = process.find('[role="progressbar"]');
    const progressInput = process.find('input');
    const result = process.find('[data-field="result"]');
    let percentage = 1;

    this.updateProgress(progressbar, progressInput, percentage);

    const chunks = this.getChunkSize(file.file.size);
    let response;
    for (let idx = 0; idx < chunks; idx++) {
      response = await this.computeChunkChecksum(file.file, idx, response).catch(e => e);
      /* error: failed to compute checksum */
      if (response instanceof Error) {
        this.showResult(progressbar, progressInput, result, 'danger', response.message);
        return undefined;
      }
      percentage = Math.ceil((response.end / file.file.size) * 100);
      this.updateProgress(progressbar, progressInput, percentage);
    }

    /* now, we can get the MD5 of the entire file */
    const checksum = this.finalizeChecksum(response);
    this.showResult(progressbar, progressInput, result, 'success', checksum);
    return checksum;
  }

  getChunkSize(filesize) {
    return Math.ceil(filesize / MD5_CHUNK_SIZE);
  }

  computeChunkChecksum(file, chunkIdx, previous) {
    return new Promise((resolve, reject) => {
      const start = chunkIdx * MD5_CHUNK_SIZE;
      const end = Math.min(start + MD5_CHUNK_SIZE, file.size);
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

  finalizeChecksum(status) {
    const spark = new SparkMD5.ArrayBuffer();
    spark.setState(status.state);
    return spark.end();
  }

  resolvePath(group, name) {
    const key = (name.charAt(0) === '/') ? name.slice(1) : name;
    if (group) {
      return `${group}/${key}`;
    }
    if (key.indexOf('/') > 0) {
      return key;
    }
    const lastIdx = key.lastIndexOf('.');
    const basename = key.substring(0, (lastIdx < 0) ? key.length : lastIdx);
    return `${basename}/${key}`;
  }

  async uploadS3(process, file, bucket, key) {
    const progressbar = process.find('[role="progressbar"]');
    const progressInput = process.find('input');
    const result = process.find('[data-field="result"]');

    const percentage = 1;
    this.updateProgress(progressbar, progressInput, percentage);

    const bindFn = this.updateProgress.bind(
      this,
      progressbar,
      progressInput
    );

    let uploads3 = await this.requestMultipartUpload(
      bucket,
      key,
      file,
      bindFn
    ).catch((e) => {
      console.error(
        'ERR:',
        'requestMultipartUpload:',
        key,
        e.message
      );

      this.showResult(
        progressbar,
        progressInput,
        result,
        'danger',
        ERR_UPLOAD_S3
      );

      return undefined;
    });

    /* error: failed to upload to s3 */
    if (uploads3 === undefined) {
      return undefined;
    }

    uploads3 = $('<a/>')
      .attr('href', `https://s3.console.aws.amazon.com/s3/object/${bucket}/${key}?region=${SolutionManifest.Region}`)
      .attr('target', '_blank')
      .html(`s3://${bucket}/${key}`)
      .prop('outerHTML');

    this.showResult(
      progressbar,
      progressInput,
      result,
      'success',
      uploads3
    );

    return uploads3;
  }

  requestMultipartUpload(
    bucket,
    key,
    file,
    progressFn
  ) {
    const s3utils = GetS3Utils();
    const params = {
      Bucket: bucket,
      Key: key,
      Body: file.file,
      ContentType: file.mime,
      Metadata: {
        ...file.attributes,
        uuid: file.uuid,
        md5: file.checksum,
        webupload: new Date().toISOString(),
      },
    };

    return s3utils.upload(
      params,
      progressFn
    );
  }

  updateProgress(progressbar, progressInput, percentage) {
    let percentage_ = percentage;

    /* from multipart upload */
    if (typeof percentage_ === 'object'
    && percentage_.loaded !== undefined) {
      percentage_ = Math.ceil(
        (percentage_.loaded / percentage_.total) * 100
      );
    }

    progressbar
      .css('width', `${percentage_}%`)
      .attr('aria-valuenow', percentage_);

    progressInput
      .val(`${percentage_}%`);
  }

  async startWorkflow(file) {
    return ApiHelper.startWorkflow({
      input: {
        bucket: this.bucket,
        key: file.resolveKey(),
        uuid: file.uuid,
        group: file.group,
        aiOptions: file.analysis,
        attributes: file.attributes,
        destination: {
          bucket: SolutionManifest.Proxy.Bucket,
        },
      },
    });
  }

  showResult(progressbar, progressInput, result, type, text) {
    const cssText = `text-${type}`;

    const desc = $('<span/>')
      .addClass(cssText)
      .html(text);

    result
      .html('')
      .append(desc);

    progressbar.parent()
      .addClass('collapse');

    progressInput.parent()
      .addClass('collapse');

    result.removeClass('collapse');
  }

  async startNow() {
    let i = 0;
    const files = this.fileList;
    this.slide.trigger(FinalizeSlideComponent.Events.Overall.Started, [files.length]);
    while (files.length) {
      this.slide.trigger(FinalizeSlideComponent.Events.Overall.Progress, [i++]);
      await this.processFile(files.shift());
    }
    const data = await this.getData();
    this.slide.trigger(FinalizeSlideComponent.Events.Overall.Completed, [data]);
  }

  async processFile(file) {
    return new Promise((resolve, reject) => {
      const eStarted = `${FinalizeSlideComponent.Events.Process.Statuses.Started}:${file.fileId}`;
      const eCompleted = `${FinalizeSlideComponent.Events.Process.Statuses.Completed}:${file.fileId}`;
      const eError = `${FinalizeSlideComponent.Events.Process.Statuses.Error}:${file.fileId}`;

      this.slide.on(eStarted, async (event, fileId) => {
        this.updateBadge(MSG_STATUS_PROCESSING, fileId);
        const anchor = this.slide.find(`a[href="#tab-${fileId}"]`);
        /* TODO: auto-scroll to focus the processing item
        const tablist = this.slide.children().first();
        const top = anchor.position().top;
        const viewBottom = tablist.innerHeight();
        const visible = top < viewBottom;
        console.log(`tab.visible: ${top},${viewBottom},${visible}`);
        */
        anchor.tab('show');
        this.slide.off(eStarted);
      });

      this.slide.on(eCompleted, async (event, fileId, report) => {
        this.report.push(report);
        this.updateBadge(MSG_STATUS_COMPLETED, fileId);
        this.slide.off(eCompleted);
        resolve(fileId);
      });

      this.slide.on(eError, async (event, fileId, error, report) => {
        this.report.push(report);
        this.slide.off(eError);
        this.updateBadge(MSG_STATUS_ERROR, fileId);
        resolve(fileId);
      });

      const container = this.slide.find(`[data-file-id="${file.fileId}"]`);
      const eUuid = `${FinalizeSlideComponent.Events.Process.Uuid}:${file.fileId}`;
      container.trigger(eUuid, [file]);
    });
  }

  updateBadge(status, fileId) {
    let items;
    let contents;

    if (fileId) {
      items = this.slide.find(`a[href="#tab-${fileId}"]`)
        .find('[data-status]');
      contents = this.slide.find(`#tab-${fileId}`)
        .find('[data-status]');
    } else {
      items = this.slide.find(`#${this.ids.tablist}`)
        .find('[data-status]');
      contents = this.slide.find(`#${this.ids.tabcontent}`)
        .find('[data-status]');
    }

    const badges = 'badge-primary badge-secondary badge-success badge-danger badge-light';
    switch (status) {
      case MSG_STATUS_NOT_STARTED:
        items.removeClass(badges).addClass('badge-light').html(status);
        contents.removeClass(badges).addClass('badge-light').html(status);
        break;
      case MSG_STATUS_WAITING:
        items.removeClass(badges).addClass('badge-secondary').html(status);
        contents.removeClass(badges).addClass('badge-secondary').html(status);
        break;
      case MSG_STATUS_PROCESSING:
        items.removeClass(badges).addClass('badge-primary').html(status);
        contents.removeClass(badges).addClass('badge-primary').html(status);
        break;
      case MSG_STATUS_COMPLETED:
        items.removeClass(badges).addClass('badge-success').html(status);
        contents.removeClass(badges).addClass('badge-success').html(status);
        break;
      case MSG_STATUS_ERROR:
        items.removeClass(badges).addClass('badge-danger').html(status);
        contents.removeClass(badges).addClass('badge-danger').html(status);
        break;
      default:
        break;
    }
  }
}
