// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import mxAnalysisSettings from '../../mixins/mxAnalysisSettings.js';
import BaseUploadSlideComponent from './baseUploadSlideComponent.js';

const DATATYPE_SLIDE_CONTROLS = 'slide-controls';

const {
  Messages,
  Buttons,
} = Localization;

export default class AnalysisSlideComponent extends mxAnalysisSettings(BaseUploadSlideComponent) {
  /* override mxAnalysisSettings */
  get parentContainer() {
    return this.slide;
  }

  /* override mxAnalysisSettings */
  createDescription() {
    return $('<p/>')
      .addClass('lead')
      .html(Messages.ReviewAnalysisSettings);
  }

  /* override mxAnalysisSettings */
  createControls() {
    const form = $('<form/>')
      .addClass('form-inline')
      .attr('data-type', DATATYPE_SLIDE_CONTROLS);

    const formGroup = $('<div/>')
      .addClass('ml-auto');
    form.append(formGroup);

    const back = $('<button/>')
      .addClass('btn btn-light ml-1')
      .html(Buttons.Back);
    formGroup.append(back);

    const next = $('<button/>')
      .addClass('btn btn-primary ml-1')
      .html(Buttons.Next);
    formGroup.append(next);

    // event handling
    form.submit((event) =>
      event.preventDefault());

    back.on('click', async (event) =>
      this.slide.trigger(AnalysisSlideComponent.Controls.Back));

    next.on('click', async (event) => {
      // force it to save aioptions to local storage
      await this.saveAIOptions();
      return this.slide.trigger(AnalysisSlideComponent.Controls.Next);
    });

    return form;
  }

  /* override BaseUploadSlideComponent */
  async createSlide() {
    await this.show();

    this.slide.find('form.col-9')
      .removeClass('col-9')
      .addClass('col-12');

    this.slide.find(`form[data-type=${DATATYPE_SLIDE_CONTROLS}]`)
      .parent()
      .removeClass('col-9')
      .addClass('col-12');

    return super.createSlide();
  }

  /* override BaseUploadSlideComponent */
  async getData() {
    return this.loadLocalSettings();
  }
}
