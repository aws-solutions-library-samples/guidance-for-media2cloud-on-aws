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
/* eslint-disable no-plusplus */
/* eslint-disable no-alert */

/**
 * @mixins mxPreview
 * @description helper functions for preview modal dialog
 */
class BasePreview extends mxReadable(class {}) {
  constructor(parent, modalId) {
    super();
    this.$element = undefined;
    this.$parent = parent;
    this.$modal = $(`#${modalId}`);
  }

  static get States() {
    return window.AWSomeNamespace.States;
  }

  static get Statuses() {
    return window.AWSomeNamespace.Statuses;
  }

  get parent() {
    return this.$parent;
  }

  get modal() {
    return this.$modal;
  }

  get element() {
    return this.$element;
  }

  set element(val) {
    this.$element = val;
  }

  get current() {
    return this.$current;
  }

  set current(val) {
    this.$current = val;
  }

  get carousel() {
    return this.$carousel;
  }

  set carousel(val) {
    this.$carousel = val;
  }

  static createSvgImage(name, options = {}) {
    const {
      width: w = 800,
      height: h = 800,
      foreground: fg = '#e4e4e4',
      background: bg = '#ffffff',
      font = '40pt',
    } = options;

    const tag = `anchor_${name.toLowerCase().replace(/[^a-zA-Z0-9\-_.]/g, '_')}`;

    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <style type="text/css">
          #${tag} text {
            fill:${fg};font-weight:normal;font-family:Helvetica,monospace;font-size:${font}
          }
        </style>
      </defs>
      <g id="${tag}">
        <rect width="${w}" height="${h}" fill="${bg}">
        </rect>
        <g>
        <text x="50%" y="50%" alignment-baseline="middle" text-anchor="middle">${name.toUpperCase()}</text>
        </g>
      </g>
    </svg>`;

    const data = 'data:image/svg+xml;charset=UTF-8';

    return `${data},${encodeURIComponent(svg)}`;
  }

  static carouselLead(text, trkGroup = undefined) {
    if (!trkGroup) {
      return `<span class="lead mt-2 mb-2 d-block">${text}</span>`;
    }

    return `<div class="row">
      <div class="col">
        <span class="lead mt-2 mb-2 d-block">${text}</span>
      </div>
      <div class="col mt-auto mb-auto">
        <!-- switch -->
        <div class="input-group float-right">
          <label class="xs-switch ml-auto">
            <input type="checkbox" data-track-group-toggle="${trkGroup}">
            <span class="xs-slider round"></span>
          </label>
          <span class="ml-2">Display all</span>
        </div>
      </div>
    </div>`;
  }

  static carouselEditableLead(text, trkGroup = undefined) {
    const lock = `
    <a href="#" class="overlay-action">
      <i class="fas fa-lock ml-1"
        style="color: #333;font-size:0.85em"
        alt="Lock/unlock labels for edit"
        data-action="unlock-labels"
        data-toggle="tooltip"
        data-placement="bottom"
        data-lock-state="locked"
        title="Lock/unlock labels for edit">
      </i>
    </a>`;

    if (!trkGroup) {
      return `<span class="lead mt-2 mb-2 d-block">${text}${lock}</span>`;
    }

    return `<div class="row">
      <div class="col">
        <span class="lead mt-2 mb-2 d-block">${text}${lock}</span>
      </div>
      <div class="col mt-auto mb-auto">
        <!-- switch -->
        <div class="input-group float-right">
          <label class="xs-switch ml-auto">
            <input type="checkbox" data-track-group-toggle="${trkGroup}">
            <span class="xs-slider round"></span>
          </label>
          <span class="ml-2">Display all</span>
        </div>
      </div>
    </div>`;
  }


  static carouselButton(trackId, text, enabled = false, trkGroup = undefined) {
    const trackGroup = trkGroup ? `data-track-group="${trkGroup}"` : '';
    return `
    <button
      type="button"
      class="btn btn-primary btn-sm mb-2"
      data-toggle="button"
      aria-pressed="false"
      autocomplete="off"
      data-track="${trackId}"
      ${trackGroup}
      data-default-enabled="${enabled}"
      style="font-size: .75rem;"
    >${BasePreview.shorten(BasePreview.capitalize(text), 46)}</button>`;
  }

  static carouselEditableButton(trackId, text, enabled = false, trkGroup = undefined) {
    const trackGroup = trkGroup ? `data-track-group="${trkGroup}"` : '';
    return `
    <button
      type="button"
      class="btn btn-primary btn-sm mb-2"
      data-toggle="button"
      aria-pressed="false"
      autocomplete="off"
      data-track="${trackId}"
      ${trackGroup}
      data-default-enabled="${enabled}"
      style="font-size: .75rem;"
    >${BasePreview.shorten(BasePreview.capitalize(text), 46)}
      <a href="#">
        <i class="far fa-times-circle ml-1 collapse"
          style="color: #fff;"
          alt="Edit this label"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Edit this label">
        </i>
      </a>
    </button>`;
  }

  static carouselStaticButton(text) {
    return `
    <button
      type="button"
      class="btn btn-primary btn-sm mb-2"
      autocomplete="off"
      disabled
    >${BasePreview.capitalize(text)}</button>`;
  }

  static carouselTimeButton(data) {
    return `
    <button
      type="button"
      class="btn btn-primary btn-sm mb-2"
      data-toggle="tooltip"
      data-placement="top"
      title="${BasePreview.readableDuration(data.begin)} / ${BasePreview.readableDuration(data.end)}"
      data-mark-in="${data.begin}"
      data-mark-out="${data.end}"
    >${data.text} (${data.confidence})</button>`;
  }
}
