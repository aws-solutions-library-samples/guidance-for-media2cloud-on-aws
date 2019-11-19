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

/**
 * @class SystemMessageArea
 * @description debug textarea to reroute console.log message to
 */
class SystemMessageArea {
  constructor(params = {}) {
    const {
      textarea = '#systemMessage',
    } = params;

    this.$logFn = console.log;
    this.$errorFn = console.error;

    this.$debugWindow = undefined;
    this.$textarea = $(textarea);

    this.domInit();
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'SystemMessageArea';
  }
  /* eslint-enable class-methods-use-this */

  get textarea() {
    return this.$textarea;
  }

  get debugWindow() {
    return this.$debugWindow;
  }

  get logFn() {
    return this.$logFn;
  }

  get errorFn() {
    return this.$errorFn;
  }

  /**
   * @function domInit
   * @description initialize text area
   */
  domInit() {
    const debugWindowId = 'debugWindowId';

    const element = $(`
    <label for="debugWindowId">System messages:</label>
    <textarea class="form-control" id="debugWindowId" rows="10" disabled></textarea>`);

    element.appendTo(this.textarea);

    this.$debugWindow = $(`#${debugWindowId}`);
  }

  /**
   * @function show
   * @description on show event, redirect console log messages
   */
  show() {
    this.redirect();
    this.textarea.collapse('show');
  }

  /**
   * @function hide
   */
  hide() {
    this.restore();
    this.textarea.collapse('hide');
  }

  /**
   * @function restore
   * @description restore console log
   */
  restore() {
    console.log = this.logFn;
    console.error = this.errorFn;
  }

  /**
   * @function redirect
   * @description redirect console logs to text area
   */
  redirect() {
    const baseFn = (fn, prefix, ...args) => {
      fn.apply(console.args);

      this.debugWindow.val((i, text) =>
        args.reduce((acc, cur) =>
          `${acc}\n[${prefix}]: ${cur}`, text));

      this.debugWindow.scrollTop(this.debugWindow[0].scrollHeight - this.debugWindow.height());
    };

    console.log = (...args) => { baseFn(this.logFn, 'IFO', args); };
    // console.error = (...args) => { baseFn(this.errorFn, 'ERR', args); }
  }
}
