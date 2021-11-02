// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../../shared/localization.js';
import AppUtils from '../../shared/appUtils.js';
import ApiHelper from '../../shared/apiHelper.js';
import S3Utils from '../../shared/s3utils.js';
import BaseUploadSlideComponent from './baseUploadSlideComponent.js';
import {
  AWSConsoleS3,
} from '../../shared/awsConsole.js';

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

  static get Constants() {
    return {
      Md5: {
        ChunkSize: 8 * 1024 * 1024,
      },
      Multipart: {
        PartSize: 8 * 1024 * 1024,
        MaxConcurrentUpload: 4,
      },
    };
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
    const desc = Localization.Messages.FinalizeUploadDesc.replace('{{BUCKET}}', anchor.prop('outerHTML'));
    return $('<p/>').addClass('lead')
      .html(desc);
  }

  createControls() {
    const cancel = $('<button/>').addClass('btn btn-light ml-1')
      .html(Localization.Buttons.Cancel);
    const startnow = $('<button/>').addClass('btn btn-success ml-1')
      .html(Localization.Buttons.StartNow);
    const done = $('<button/>').addClass('btn btn-success ml-1 collapse')
      .html(Localization.Buttons.Done);
    const overall = $('<span/>').addClass('lead collapse')
      .html(Localization.Statuses.NotStarted);
    const download = $('<a/>').addClass('btn btn-light ml-1 collapse')
      .attr('role', 'button')
      .attr('href', '')
      .attr('download', '')
      .attr('target', '_blank')
      .html(Localization.Buttons.DownloadSummary);

    // local reset controls funciton
    const resetControls = () => {
      download.addClass('collapse');
      done.addClass('collapse');
      startnow.removeClass('collapse');
      cancel.removeClass('collapse');
      overall.addClass('collapse').removeClass('text-success text-danger')
        .html(Localization.Statuses.NotStarted);
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
      overall.removeClass('collapse').html(`${Localization.Statuses.Processing} (${index + 1} / ${totalFiles})...`);
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
      const status = `${Localization.Statuses.Completed} / ${Localization.Statuses.Error} / ${Localization.Statuses.Total}: (${metrics.completed} / ${metrics.errors} / ${totalFiles})`;
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
      tabList.append(this.createItemTab(id, x.file.name, Localization.Statuses.NotStarted));
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
    const MSG = Localization.Messages;
    const summary = $('<div/>')
      .attr('data-type', 'summary');

    const status = $('<span/>').addClass('d-block p-2 text-black bg-light lead my-2')
      .html(MSG.Summary);
    summary.append(status);

    const key = file.resolveKey();
    const data = {
      [MSG.Source]: {
        [MSG.FileName]: file.displayName,
        [MSG.FileSize]: `${AppUtils.readableFileSize(file.file.size)} (${file.file.size} bytes)`,
        [MSG.FileType]: file.file.type,
        [MSG.LastModified]: new Date(file.file.lastModified).toISOString(),
      },
      [MSG.Destination]: {
        [MSG.Bucket]: this.bucket,
        [MSG.Key]: key,
      },
      [MSG.Attributes]: file.attributes,
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
        .html(Localization.Messages.UploadStatus))
      .append($('<span/>').addClass('badge badge-light badge-custom')
        .attr('data-status', Localization.Statuses.NotStarted)
        .html(`${Localization.Statuses.NotStarted}`));

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
    const process = this.createFlow('uuid', Localization.Messages.ValidateUuid);

    const eUuid = `${FinalizeSlideComponent.Events.Process.Uuid}:${fileId}`;
    container.on(eUuid, async (event, file) => {
      const report = {
        fileId: file.fileId,
        elapsed: 0,
        src: {
          name: file.displayName,
          bytes: file.file.size,
          type: AppUtils.Mime.getMime(file),
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
        report.error = Localization.Alerts.CreateUuidError;
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
    const process = this.createFlow('checksum', Localization.Messages.ComputeChecksum);

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
        report.error = Localization.Alerts.ComputeChecksumError;
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
    const process = this.createFlow('uploads3', Localization.Messages.UploadS3);

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
        report.error = Localization.Alerts.UploadS3Error;
        const eError = `${FinalizeSlideComponent.Events.Process.Statuses.Error}:${file.fileId}`;
        return this.slide.trigger(eError, [file.fileId, report.error, report]);
      }

      // starting workflow if file type is supported
      if (file.canSupport) {
        response = await this.startWorkflow(file);
        if (!response) {
          report.error = Localization.Alerts.StartWorkflowError;
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
      this.showResult(progressbar, progressInput, result, 'danger', Localization.Alerts.CreateUuidError);
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
    return Math.ceil(filesize / FinalizeSlideComponent.Constants.Md5.ChunkSize);
  }

  computeChunkChecksum(file, chunkIdx, previous) {
    return new Promise((resolve, reject) => {
      const start = chunkIdx * FinalizeSlideComponent.Constants.Md5.ChunkSize;
      const end = Math.min(start + FinalizeSlideComponent.Constants.Md5.ChunkSize, file.size);
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

    let percentage = 1;
    this.updateProgress(progressbar, progressInput, percentage);

    const request = this.requestMultipartUpload(bucket, key, file);
    request.on('httpUploadProgress', (data) => {
      percentage = Math.ceil((data.loaded / data.total) * 100);
      this.updateProgress(progressbar, progressInput, percentage);
    });

    let uploads3 = await request.promise().catch(e => e);
    /* error: failed to compute checksum */
    if (uploads3 instanceof Error) {
      this.showResult(progressbar, progressInput, result, 'danger', Localization.Alerts.UploadS3Error);
      return undefined;
    }
    uploads3 = $('<a/>')
      .attr('href', `https://s3.console.aws.amazon.com/s3/object/${bucket}/${key}?region=${SolutionManifest.Region}`)
      .attr('target', '_blank')
      .html(`s3://${bucket}/${key}`)
      .prop('outerHTML');
    this.showResult(progressbar, progressInput, result, 'success', uploads3);
    return uploads3;
  }

  requestMultipartUpload(bucket, key, file) {
    const s3 = S3Utils.getInstance();
    return s3.upload({
      Bucket: bucket,
      Key: key,
      ContentType: file.mime,
      Metadata: {
        ...file.attributes,
        uuid: file.uuid,
        md5: file.checksum,
        webupload: new Date().toISOString(),
      },
      Body: file.file,
      ExpectedBucketOwner: SolutionManifest.S3.ExpectedBucketOwner,
    }, {
      partSize: FinalizeSlideComponent.Constants.Multipart.PartSize,
      queueSize: FinalizeSlideComponent.Constants.Multipart.MaxConcurrentUpload,
    });
  }

  updateProgress(progressbar, progressInput, percentage) {
    progressbar.css('width', `${percentage}%`).attr('aria-valuenow', percentage);
    progressInput.val(`${percentage}%`);
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
    result.html('').append($('<span/>').addClass(`text-${type}`)
      .html(text));
    progressbar.parent().addClass('collapse');
    progressInput.parent().addClass('collapse');
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
        this.updateBadge(Localization.Statuses.Processing, fileId);
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
        this.updateBadge(Localization.Statuses.Completed, fileId);
        this.slide.off(eCompleted);
        resolve(fileId);
      });

      this.slide.on(eError, async (event, fileId, error, report) => {
        this.report.push(report);
        this.slide.off(eError);
        this.updateBadge(Localization.Statuses.Error, fileId);
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
      case Localization.Statuses.NotStarting:
        items.removeClass(badges).addClass('badge-light').html(status);
        contents.removeClass(badges).addClass('badge-light').html(status);
        break;
      case Localization.Statuses.Waiting:
        items.removeClass(badges).addClass('badge-secondary').html(status);
        contents.removeClass(badges).addClass('badge-secondary').html(status);
        break;
      case Localization.Statuses.Processing:
        items.removeClass(badges).addClass('badge-primary').html(status);
        contents.removeClass(badges).addClass('badge-primary').html(status);
        break;
      case Localization.Statuses.Completed:
        items.removeClass(badges).addClass('badge-success').html(status);
        contents.removeClass(badges).addClass('badge-success').html(status);
        break;
      case Localization.Statuses.Error:
        items.removeClass(badges).addClass('badge-danger').html(status);
        contents.removeClass(badges).addClass('badge-danger').html(status);
        break;
      default:
        break;
    }
  }
}
