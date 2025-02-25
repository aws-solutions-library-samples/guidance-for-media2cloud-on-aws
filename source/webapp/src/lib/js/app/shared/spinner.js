// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AppUtils from './appUtils.js';

const { randomHexstring } = AppUtils;

const SPINNER_ID = `spinner-${randomHexstring()}`;

export default class Spinner {
  static loading(enabled = true, spinnerId = SPINNER_ID) {
    if (enabled) {
      return _enable(spinnerId);
    }
    return _disable(spinnerId);
  }

  static useSpinner(spinnerId = SPINNER_ID) {
    let spinner = $(`#${spinnerId}`);
    if (spinner.length > 0) {
      return spinner;
    }

    spinner = _makeSpinner(spinnerId);

    const body = $('body');
    body.append(spinner);

    return spinner;
  }

  static makeSpinner(id) {
    return _makeSpinner(id);
  }

  static enable(spinner) {
    return _enable(spinner);
  }

  static disable(spinner) {
    return _disable(spinner);
  }
}

function _makeSpinner(id) {
  const spinner = $('<div/>')
    .addClass('spinner-grow')
    .addClass('text-secondary loading-4')
    .addClass('collapse')
    .attr('id', id)

  const text = $('<span/>')
    .addClass('lead-sm sr-only')
    .append('Loading...');
  spinner.append(text);

  return spinner;
}

function _enable(spinner) {
  if (typeof spinner === 'object') {
    return spinner.removeClass('collapse');
  }

  if (typeof spinner === 'string') {
    return $(`#${spinner}`).removeClass('collapse');
  }

  return spinner;
}

function _disable(spinner) {
  if (typeof spinner === 'object') {
    return spinner.addClass('collapse');
  }

  if (typeof spinner === 'string') {
    return $(`#${spinner}`).addClass('collapse');
  }

  return spinner;
}
