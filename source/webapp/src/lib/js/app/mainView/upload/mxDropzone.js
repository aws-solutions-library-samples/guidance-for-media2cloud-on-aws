// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import FileItem from './fileItem.js';

export default Base => class extends Base {
  fileEntrySupported() {
    return (typeof DataTransferItem.prototype.webkitGetAsEntry === 'function');
  }

  canSupport(file) {
    return true;
  }

  createDropzone(message) {
    const background = $('<div/>').addClass('d-flex justify-content-center dropzone-bg')
      .append($('<span/>').addClass('align-self-center')
        .html(message));

    const dropzone = $('<div/>').addClass('dropzone')
      .append($('<p>').addClass('lead m-auto')
        .append(background));

    [
      'dragenter',
      'dragover',
      'dragleave',
      'drop',
    ].forEach((x) => {
      dropzone.off(x).on(x, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });

    dropzone.on('dragenter', async (event) => {
    });

    dropzone.on('dragleave', async (event) => {
    });

    dropzone.on('drop', async (event) =>
      this.processDropEvent(event));
    return dropzone;
  }

  async processDropEvent(event) {
    try {
      if (typeof this.loading === 'function') {
        this.loading(true);
      }
      const files = await this.processDropItems(event.originalEvent.dataTransfer);
      return Promise.all(files.map(x =>
        this.processEachFileItem(x)));
    } catch (e) {
      return undefined;
    } finally {
      if (typeof this.loading === 'function') {
        this.loading(false);
      }
    }
  }

  async processDropItems(data) {
    return this.fileEntrySupported()
      ? this.useGetAsEntry(data)
      : this.useFileReader(data);
  }

  async useGetAsEntry(data) {
    const promiseFiles = [];
    const promiseDirs = [];
    for (let i = 0; i < data.items.length; i++) {
      const entry = data.items[i].webkitGetAsEntry();
      if (entry.isFile) {
        promiseFiles.push(this.readFileEntry(entry));
      } else {
        promiseDirs.push(this.readDirectoryEntry(entry));
      }
    }
    const files = await Promise.all(promiseFiles);
    const dirs = await Promise.all(promiseDirs);
    const all = dirs.reduce((acc, cur) =>
      acc.concat(cur), files).filter(x => x);
    return all;
  }

  async readFileEntry(entry) {
    return new Promise((resolve, reject) => {
      entry.file(
        (file) =>
          resolve(new FileItem(entry.fullPath, file, this.canSupport(file))),
        () =>
          resolve(undefined)
      );
    });
  }

  async readEntries(reader) {
    return new Promise((resolve) => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          return resolve(undefined);
        }
        const promiseFiles = [];
        const promiseDirs = [];
        while (entries.length) {
          const entry = entries.shift();
          if (entry.isFile) {
            promiseFiles.push(this.readFileEntry(entry));
          } else {
            promiseDirs.push(this.readDirectoryEntry(entry));
          }
        }
        return resolve({
          files: promiseFiles,
          dirs: promiseDirs,
        });
      });
    });
  }

  async readDirectoryEntry(dir) {
    const reader = dir.createReader();
    const promiseFiles = [];
    const promiseDirs = [];
    let items;
    do {
      items = await this.readEntries(reader);
      if (items) {
        promiseFiles.splice(promiseFiles.length, 0, ...items.files);
        promiseDirs.splice(promiseDirs.length, 0, ...items.dirs);
      }
    } while (items !== undefined);
    const files = await Promise.all(promiseFiles);
    const dirs = await Promise.all(promiseDirs);
    return dirs.reduce((acc, cur) => acc.concat(cur), files);
  }

  async useFileReader(data) {
    const promises = [];
    for (let i = 0; i < data.files.length; i++) {
      promises.push(this.readFile(data.files[i]));
    }
    const files = await Promise.all(promises);
    return files;
  }

  async readFile(file) {
    return new FileItem(file.name, file, this.canSupport(file));
  }

  async processEachFileItem(file) {
    throw new Error('subclass to implement');
  }
};
