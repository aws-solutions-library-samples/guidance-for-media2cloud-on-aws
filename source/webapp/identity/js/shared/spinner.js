// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AppUtils from './appUtils.js';

const SPINNER_ID = `spinner-${AppUtils.randomHexstring()}`;

export default class Spinner {
  static loading(enabled = true) {
    const spinner = $(`#${SPINNER_ID}`);
    if (enabled) {
      return spinner.removeClass('collapse');
    }
    return spinner.addClass('collapse');
  }

  static createLoading() {
    const spinner = $(`#${SPINNER_ID}`);
    if (spinner.length > 0) {
      return;
    }

    const body = $('body');
    const loading = $('<div/>')
      .attr('id', SPINNER_ID)
      .addClass('spinner-grow text-secondary loading-4 collapse')
      .append($('<span/>')
        .addClass('lead-sm sr-only')
        .html('Loading...'));
    body.append(loading);
  }
}
