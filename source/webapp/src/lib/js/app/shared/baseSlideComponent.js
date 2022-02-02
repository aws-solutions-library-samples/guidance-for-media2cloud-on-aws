// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from './localization.js';
import AppUtils from './appUtils.js';
import mxSpinner from '../mixins/mxSpinner.js';
import mxAlert from '../mixins/mxAlert.js';

export default class BaseSlideComponent extends mxAlert(mxSpinner(class {})) {
  constructor() {
    super();
    this.$ids = {
      slide: `slide-${AppUtils.randomHexstring()}`,
    };
    this.$slide = $('<div/>').addClass('container p-0 m-0 col-12')
      .append(this.createLoading());
    this.$initialized = false;
  }

  get ids() {
    return this.$ids;
  }

  get slideId() {
    return this.ids.slide;
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

  getSlide() {
    return this.slide;
  }

  async show() {
    this.initialized = true;
    return this.slide;
  }

  async hide() {
    this.slide.children().remove()
      .append(this.createLoading());
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
    return super.showMessage(this.slide, 'danger', Localization.Alerts.Oops, message, duration);
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
