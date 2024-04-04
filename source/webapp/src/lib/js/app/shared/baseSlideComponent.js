// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from './localization.js';
import AppUtils from './appUtils.js';
import Spinner from './spinner.js';
import mxAlert from '../mixins/mxAlert.js';

const {
  Alerts: {
    Oops: OOPS,
  },
} = Localization;

export default class BaseSlideComponent extends mxAlert(class {}) {
  constructor() {
    super();
    this.$id = AppUtils.randomHexstring();
    this.$ids = {
      slide: `slide-${this.id}`,
    };
    this.$slide = $('<div/>')
      .addClass('container p-0 m-0 col-12');
    this.$initialized = false;
    Spinner.useSpinner();
  }

  get id() {
    return this.$id;
  }

  get ids() {
    return this.$ids;
  }

  get slideId() {
    return `slide-${this.id}`;
  }

  get slide() {
    return this.$slide;
  }

  set slide(val) {
    this.$slide = val;
  }

  get initialized() {
    return this.$initialized;
  }

  set initialized(val) {
    this.$initialized = val;
  }

  loading(enabled) {
    return Spinner.loading(enabled);
  }

  getSlide() {
    return this.slide;
  }

  async show() {
    this.initialized = true;
    return this.slide;
  }

  async hide() {
    this.slide.children().remove();
    this.initialized = false;
  }

  async saveData() {
    return this;
  }

  async clearData() {
    return this;
  }

  async getData() {
    return this;
  }

  async showAlert(message, duration) {
    return super.showMessage(
      this.slide,
      'danger',
      OOPS,
      message,
      duration
    );
  }

  async createSlide() {
    return this.slide;
  }

  on(event, fn) {
    return this.slide.on(event, fn);
  }

  off(event) {
    return this.slide.off(event);
  }
}
