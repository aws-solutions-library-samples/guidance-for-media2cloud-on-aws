// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import MediaTypes from '../../shared/media/mediaTypes.js';
import AppUtils from '../../shared/appUtils.js';
import mxDropzone from './mxDropzone.js';
import FileItem from './fileItem.js';
import BaseUploadSlideComponent from './baseUploadSlideComponent.js';

export default class DropzoneSlideComponent extends mxDropzone(BaseUploadSlideComponent) {
  constructor() {
    super();
    this.$ids = {
      ...this.$ids,
      uploadList: 'upload-list',
    };
    this.$fileList = [];
  }

  static get Events() {
    return {
      Dropzone: {
        Item: {
          Added: 'dropzone:file:added',
          Empty: 'dropzone:file:empty',
        },
      },
    };
  }

  get fileList() {
    return this.$fileList;
  }

  // override mxDropzone
  canSupport(file) {
    const kindOf = AppUtils.Mime.getKind(file);
    return kindOf === MediaTypes.Video
      || kindOf === MediaTypes.Audio
      || kindOf === MediaTypes.Image
      || kindOf === MediaTypes.Document;
  }

  // override mxDropzone
  async processDropEvent(event) {
    const files = await super.processDropEvent(event);
    if (files) {
      this.fileList.splice(this.fileList.length, 0, ...files);
      this.slide.trigger(DropzoneSlideComponent.Events.Dropzone.Item.Added);
    }
    return files;
  }

  // override mxDropzone
  async processEachFileItem(file) {
    const item = await file.createItem();
    item.on(FileItem.Events.File.Remove, () =>
      this.onFileRemove(item));
    this.slide.find(`.${this.ids.uploadList}`)
      .find('.list-group').append(item);
    return file;
  }

  // override BaseUploadSlideComponent
  async clearData() {
    this.slide.find(`.${this.ids.uploadList}`)
      .find('.list-group')
      .children()
      .remove();
    this.fileList.length = 0;
    this.slide.trigger(DropzoneSlideComponent.Events.Dropzone.Item.Empty);
    return this;
  }

  // override BaseUploadSlideComponent
  async getData() {
    return this.fileList;
  }

  // override BaseUploadSlideComponent
  async createSlide() {
    const description = this.createDescription();
    const dropzone = this.createDropzone(Localization.Messages.DropFileHere);
    const uploadList = this.createUploadList();
    const controls = this.createControls();

    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-12 p-0 m-0')
        .append(description))
      .append($('<div/>').addClass('col-12 p-0 m-0 mt-4')
        .append(dropzone))
      .append($('<div/>').addClass('col-12 p-0 m-0 mt-4')
        .append(uploadList))
      .append($('<div/>').addClass('col-12 p-0 m-0 mt-4')
        .append(controls));
    this.slide.append(row);
    return super.createSlide();
  }

  createDescription() {
    return $('<p/>').addClass('lead')
      .html(Localization.Messages.DropzoneDesc);
  }

  createControls() {
    // manual browse input
    const input = $('<input/>')
      .attr('type', 'file')
      .attr('multiple', 'multiple')
      .attr('accept', '*')
      .css('display', 'none');
    const browse = $('<button/>').addClass('btn btn-secondary')
      .html(Localization.Buttons.BrowseFiles);
    const manual = $('<div/>').addClass('mr-auto')
      .append(browse)
      .append(input);

    // carousel slide controls
    const startover = $('<button/>').addClass('btn btn-light ml-1')
      .html(Localization.Buttons.Startover);
    const quickupload = $('<button/>').addClass('btn btn-success ml-1')
      .attr('disabled', 'disabled')
      .html(Localization.Buttons.QuickUpload);
    const next = $('<button/>').addClass('btn btn-primary ml-1')
      .attr('disabled', 'disabled')
      .html(Localization.Buttons.Next);

    this.slide.on(DropzoneSlideComponent.Events.Dropzone.Item.Empty, () => {
      quickupload.attr('disabled', 'disabled');
      next.attr('disabled', 'disabled');
    });

    this.slide.on(DropzoneSlideComponent.Events.Dropzone.Item.Added, () => {
      this.slide.find(`.${this.ids.uploadList}`).attr('open', '');
      quickupload.removeAttr('disabled');
      next.removeAttr('disabled');
    });

    browse.off('click').on('click', () =>
      input.click());

    input.off('change').on('change', async () => {
      await this.processInputEvent(event.currentTarget);
      input.val('');
    });

    startover.off('click').on('click', async (event) =>
      this.slide.trigger(DropzoneSlideComponent.Controls.StartOver));

    quickupload.off('click').on('click', async (event) =>
      this.slide.trigger(DropzoneSlideComponent.Controls.QuickUpload, [this.fileList]));

    next.off('click').on('click', async (event) =>
      this.slide.trigger(DropzoneSlideComponent.Controls.Next, [this.fileList]));

    const controls = $('<form/>').addClass('form-inline')
      .append(manual)
      .append($('<div/>').addClass('ml-auto')
        .append(startover)
        .append(quickupload)
        .append(next));

    controls.submit(event =>
      event.preventDefault());

    return controls;
  }

  async processInputEvent(data) {
    try {
      this.loading(true);
      let files = await this.useFileReader(data);
      files = await Promise.all((files || []).map(x =>
        this.processEachFileItem(x)));
      if (files.length > 0) {
        this.fileList.splice(this.fileList.length, 0, ...files);
        this.slide.trigger(DropzoneSlideComponent.Events.Dropzone.Item.Added);
      }
      return files;
    } catch (e) {
      return undefined;
    } finally {
      this.loading(false);
    }
  }

  createUploadList() {
    const details = $('<details/>').addClass(`my-2 ${this.ids.uploadList}`)
      .append($('<summary/>').addClass('mb-2')
        .append(Localization.Messages.FileToBeProcessed));
    const ul = $('<ul/>').addClass('list-group');
    return details.append(ul);
  }

  onFileRemove(item) {
    const fileId = item.data('file-id');
    const idx = this.fileList.findIndex(x => x.fileId === fileId);
    if (idx >= 0) {
      this.fileList.splice(idx, 1);
    }
    if (!this.fileList.length) {
      this.slide.trigger(DropzoneSlideComponent.Events.Dropzone.Item.Empty);
    }
    setTimeout(() =>
      item.remove(), 300);
  }
}
