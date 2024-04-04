// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import AppUtils from '../../shared/appUtils.js';
import mxReadable from '../../mixins/mxReadable.js';

const {
  MimeGetMime,
} = window.MimeWrapper;

class BaseFile extends mxReadable(class {}) {
  constructor(name, file, canSupport = true) {
    super();
    this.$displayName = name;
    this.$canSupport = !!canSupport;
    this.$file = file;
    this.$mime = MimeGetMime(file);
    this.$fileId = `file-${AppUtils.randomHexstring()}`;
  }

  static get Events() {
    return {
      File: {
        Remove: 'file:remove',
      },
    };
  }

  get file() {
    return this.$file;
  }

  get mime() {
    return this.$mime;
  }

  get displayName() {
    return this.$displayName;
  }

  get canSupport() {
    return this.$canSupport;
  }

  get fileId() {
    return this.$fileId;
  }

  async createItem() {
    const li = $('<li/>').addClass('list-group-item d-flex')
      .attr('data-file-id', this.fileId)
      .attr('data-display-name', this.displayName);

    const icon = $('<i/>').addClass(`${this.getIcon()} align-self-center`)
      .css('font-size', '3rem')
      .css('font-weight', 300)
      .css('color', '#888');

    const dl = $('<dl/>').addClass('row lead-xs ml-2 col-9 no-gutters')
      .append($('<dt/>').addClass('text-left col-sm-1')
        .append(Localization.Messages.FileName))
      .append($('<dd/>').addClass('col-sm-11 my-0')
        .append(this.displayName))
      .append($('<dt/>').addClass('text-left col-sm-1 my-0')
        .append(Localization.Messages.FileSize))
      .append($('<dd/>').addClass('col-sm-11 my-0')
        .append(BaseFile.readableFileSize(this.file.size)))
      .append($('<dt/>').addClass('text-left col-sm-1 my-0')
        .append(Localization.Messages.FileType))
      .append($('<dd/>').addClass('col-sm-11 my-0')
        .append(this.mime || '--'));

    const btnRemove = $('<button/>').addClass('btn btn-sm btn-secondary text-capitalize mb-1 ml-1')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.RemoveFromList)
      .append(Localization.Buttons.Remove)
      .tooltip({
        trigger: 'hover',
        boundary: 'window',
      });
    btnRemove.off('click').on('click', (event) => {
      // btnRemove.tooltip('hide');
      li.trigger(BaseFile.Events.File.Remove, [this]);
    });

    const info = $('<i/>').addClass('fas fa-exclamation-circle mr-2')
      .css('font-size', '1.2rem')
      .css('color', '#dc3545')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.UploadOnly)
      .tooltip({
        trigger: 'hover',
        boundary: 'window',
      });
    if (this.canSupport) {
      info.addClass('collapse');
    }

    const btnGrp = $('<div/>').addClass('ml-auto align-self-center')
      .append(info)
      .append(btnRemove);

    return li.append(icon)
      .append(dl)
      .append(btnGrp);
  }

  getIcon() {
    const [
      type,
      subtype,
    ] = (this.mime || '').split('/');

    return (type === 'video')
      ? 'far fa-file-video'
      : (type === 'audio')
        ? 'far fa-file-audio'
        : (type === 'image')
          ? 'far fa-file-image'
          : (subtype === 'pdf')
            ? 'far fa-file-pdf'
            : (subtype === 'msword' || subtype === 'vnd.openxmlformats-officedocument.wordprocessingml.document')
              ? 'far fa-file-word'
              : (subtype === 'vnd.ms-powerpoint' || subtype === 'vnd.openxmlformats-officedocument.presentationml.presentation')
                ? 'far fa-file-powerpoint'
                : (subtype === 'vnd.ms-excel' || subtype === 'vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                  ? 'far fa-file-excel'
                  : (subtype === 'zip' || subtype === 'x-7z-compressed' || subtype === 'vnd.rar' || subtype === 'gzip')
                    ? 'far fa-file-archive'
                    : (subtype === 'csv')
                      ? 'fas fa-file-csv'
                      : (subtype === 'json' || subtype === 'xml')
                        ? 'far fa-file-code'
                        : 'far fa-file-alt';
  }
}

export default class FileItem extends BaseFile {
  constructor(name, file, canSupport) {
    super(name, file, canSupport);
    this.$uuid = undefined;
    this.$checksum = undefined;
    this.$attributes = undefined;
    this.$analysis = undefined;
  }

  get uuid() {
    return this.$uuid;
  }

  get checksum() {
    return this.$checksum;
  }

  get attributes() {
    return this.$attributes;
  }

  get analysis() {
    return this.$analysis;
  }

  get group() {
    return (this.attributes || {}).group;
  }

  setUuid(uuid) {
    this.$uuid = uuid;
  }

  setChecksum(checksum) {
    this.$checksum = checksum;
  }

  setAttributes(attrs) {
    this.$attributes = {
      ...attrs,
    };
  }

  setAnalysis(analysis) {
    this.$analysis = {
      ...analysis,
    };
  }

  resolveKey() {
    const group = (this.attributes || {}).group;
    const name = this.displayName;
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
}
