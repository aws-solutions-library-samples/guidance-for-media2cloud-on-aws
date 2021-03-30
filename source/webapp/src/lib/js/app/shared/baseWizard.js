/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

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
      : (file || {}).type
        ? file.type
        : (file || {}).mime
          ? file.mime
          : (file || {}).name
            ? window.AWSomeNamespace.Mime.getType(file.name)
            : (file || {}).key
              ? window.AWSomeNamespace.Mime.getType(file.key)
              : undefined;
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
      : (subtype === 'mxf' || subtype === 'gxf')
        ? 'video'
        : (subtype === 'pdf')
          ? 'document'
          : subtype;
  }

  static createButton(data = {}) {
    const button = $('<button/>').attr('type', 'button');
    Object.keys(data.attr || {}).forEach(x =>
      data.attr[x] !== undefined && button.attr(x, data.attr[x]));
    Object.keys(data.css || {}).forEach(x =>
      data.css[x] !== undefined && button.css(x, data.css[x]));
    if (data.class) {
      button.addClass(data.class);
    }
    if (data.html) {
      button.html(data.html);
    }
    return button;
  }

  static createButtonBack(id) {
    return JsonUploadWizard.createButton({
      class: 'btn btn-sm btn-primary px-4 mx-1',
      attr: {
        'data-action': id,
      },
      html: 'Back',
    });
  }

  static createButtonNext(id) {
    return JsonUploadWizard.createButton({
      class: 'btn btn-sm btn-success px-4 mx-1',
      attr: {
        'data-action': id,
      },
      html: 'Next',
    });
  }

  static createButtonAction(id, text, btnStyle = 'btn-success') {
    return JsonUploadWizard.createButton({
      class: `btn-sm px-4 mx-1 ${btnStyle}`,
      attr: {
        'data-action': id,
      },
      html: text,
    });
  }

  static createButtonCancel(id) {
    return JsonUploadWizard.createButton({
      class: 'btn btn-sm btn-light px-4 mx-1',
      attr: {
        'data-action': id,
      },
      html: 'Cancel',
    });
  }

  static createMessageDiv(id, text = 'error message...') {
    return $('<div/>').addClass('mt-4')
      .append($('<span/>').addClass('collapse')
        .attr('id', id)
        .css('font-size', '0.8rem')
        .css('color', '#ff0000')
        .html(text));
  }

  static createTableRowData(data = {}) {
    const content = $('<span/>').html(data.html);

    const keys = Object.keys(data.class || {});
    while (keys.length) {
      const key = keys.shift();
      content.addClass(key, data.class[key]);
    }

    return $('<td/>').addClass('align-middle px-0')
      .append(content);
  }

  static createTableRowCheckbox(data = {}) {
    const input = $('<input/>').addClass('form-check-input position-static')
      .attr('type', 'checkbox');

    const keys = Object.keys(data.attr || {});
    while (keys.length) {
      const key = keys.shift();
      input.attr(key, data.attr[key]);
    }

    return $('<th/>').addClass('align-middle')
      .attr('scope', 'row')
      .append($('<div/>').addClass('form-check')
        .append(input));
  }

  static createFormListItem(data = {}) {
    const li = $('<li/>').addClass('list-group-item px-0')
      .css('border', 'none')
      .append($('<span/>').addClass('succeeded collapse')
        .append($('<i/>').addClass('far fa-check-circle')
          .css('color', '#28a745')
          .css('font-size', '1rem')))
      .append($('<span/>').addClass('failed collapse')
        .append($('<i/>').addClass('far fa-times-circle')
          .css('color', '#ff0000')
          .css('font-size', '1rem')))
      .append($('<span/>').addClass('in-progress spinner-border spinner-grow-sm collapse')
        .attr('role', 'status')
        .attr('aria-hidden', 'true')
        .css('font-size', '0.1rem'))
      .append($('<div/>').addClass('checklist-text ml-1')
        .css('display', 'inline')
        .html(data.html));

    const keys = Object.keys(data.attr || {});
    while (keys.length) {
      const key = keys.shift();
      li.attr(key, data.attr[key]);
    }

    return li;
  }

  static createSlideLayout() {
    return $('<div/>').addClass('container')
      .css('height', '100%')
      .css('width', '96%');
  }

  static createSlideGraphic(icon) {
    return $('<div/>').addClass('col-sm-3 px-0 text-center')
      .append($('<i/>').addClass(icon)
        .css('color', '#ccc')
        .css('font-size', '6rem'));
  }

  static createSlide(id, graphic, content, navButtons) {
    const nav = $('<div/>').addClass('row d-flex justify-content-end align-items-end');
    while (navButtons.length) {
      nav.append(navButtons.shift());
    }

    const container = $('<div/>').addClass('carousel-item')
      .css('height', '400px')
      .attr('id', id);

    container.append($('<div/>').addClass('container')
      .css('height', '100%')
      .css('width', '96%')
      .append($('<div/>').addClass('row d-flex justify-content-center align-items-center')
        .css('height', '90%')
        .append(graphic)
        .append(content))
      .append(nav));

    return container;
  }

  static createFormInputItem(data = {}) {
    const input = $('<input/>');
    if (data.class) {
      input.addClass(data.class);
    }
    Object.keys(data.attr || {}).forEach(x =>
      data.attr[x] !== undefined && input.attr(x, data.attr[x]));
    return input;
  }
}
