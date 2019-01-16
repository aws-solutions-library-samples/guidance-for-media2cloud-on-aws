/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
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
