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

class BaseWizard {
  constructor(parent, modalId) {
    this.$modal = $(`#${modalId}`);
    this.$parent = parent;
    this.$carousel = undefined;
  }

  static randomHexString() {
    const rnd = new Uint32Array(1);
    window.crypto.getRandomValues(rnd);
    this.$suffix = rnd[0].toString(16);
  }

  get modal() {
    return this.$modal;
  }

  get parent() {
    return this.$parent;
  }

  get carousel() {
    return this.$carousel;
  }

  set carousel(val) {
    this.$carousel = val;
  }

  domInit() {
    throw new Error('pure function, domInit');
  }

  async show(file) {
    this.domInit();
    this.modal.modal('show');
  }

  async hide() {
    this.resetAll();
    this.modal.modal('hide');
  }

  resetAll() {
    return undefined;
  }

  registerActionEvents(element) {
    $(element).find('[data-action]').each((key, val) => {
      $(val).off('click').on('click', async (event) => {
        event.preventDefault();
        if (!(await this.onAction(event.currentTarget))) {
          event.stopPropagation();
        }
      });
    });
  }

  registerInputChangeEvents(element) {
    $(element).find('input').each((key, val) => {
      $(val).off('change').change(async (event) => {
        event.preventDefault();
        if (!(await this.onInputChange(event.currentTarget))) {
          event.stopPropagation();
        }
      });
    });
  }

  registerEvents() {
    this.modal.off('hidden.bs.modal').on('hidden.bs.modal', async () => {
      this.modal.children().remove();
    });
    this.registerActionEvents(this.carousel);
    this.registerInputChangeEvents(this.carousel);
  }

  async onAction(target) {
    return this.onCarouselSlide(target);
  }

  async onInputChange(target) {
    return true;
  }

  async onCarouselSlide(target) {
    if (!(await this.beforeCarouselSlide(target))) {
      return false;
    }
    const action = $(target).data('action');
    const idx = this.carousel.children().children().index($(`#${action}`));
    if (idx >= 0) {
      this.carousel.carousel(idx);
    } else {
      console.error(`onAction.${action} failed`);
    }
    return true;
  }

  async beforeCarouselSlide(target) {
    return true;
  }

  getMimeType(file) {
    return (typeof file === 'string')
      ? window.AWSomeNamespace.Mime.getType(file)
      : (!(file || {}).type)
        ? window.AWSomeNamespace.Mime.getType(file.name)
        : file.type;
  }

  getType(file) {
    const [
      type,
      subtype,
    ] = (this.getMimeType(file) || '')
      .split('/')
      .filter(x => x)
      .map(x => x.toLowerCase());
    return (type === 'video' || type === 'audio' || type === 'image')
      ? type
      : (subtype === 'mxf')
        ? 'video'
        : subtype;
  }
}
