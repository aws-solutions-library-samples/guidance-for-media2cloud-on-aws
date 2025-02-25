// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../shared/localization.js';
import {
  GetS3Utils,
} from '../../../../../../shared/s3utils.js';
import Spinner from '../../../../../../shared/spinner.js';
import BaseMedia from '../../../../../../shared/media/baseMedia.js';
import mxReadable from '../../../../../../mixins/mxReadable.js';
import BaseTab from '../../../../../../shared/baseTab.js';
import {
  AWSConsoleS3,
  AWSConsoleStepFunctions,
} from '../../../../../../shared/awsConsole.js';
import {
  GetUserSession,
} from '../../../../../../shared/cognito/userSession.js';

const {
  Tooltips: {
    ViewOnAWSConsole: TOOLTIP_VIEW_ON_CONSOLE,
    DownloadFile: TOOLTIP_DOWNLOAD_FILE,
  },
} = Localization;

const COL_TAB = 'col-11';

export default class BaseAnalysisTab extends mxReadable(BaseTab) {
  constructor(title, previewComponent) {
    super(title, {
      fontSize: '1rem',
    });

    this.$previewComponent = previewComponent;
    this.$css = {
      dl: {
        dt: 'col-sm-2',
        dd: 'col-sm-10',
      },
    };
    Spinner.useSpinner();
  }

  get ids() {
    return this.$ids;
  }

  get css() {
    return this.$css;
  }

  get previewComponent() {
    return this.$previewComponent;
  }

  get media() {
    return (this.$previewComponent || {}).media;
  }

  // permission based on user role
  get canRead() {
    const session = GetUserSession();
    return session.canRead();
  }

  get canWrite() {
    const session = GetUserSession();
    return session.canWrite();
  }

  get canModify() {
    const session = GetUserSession();
    return session.canModify();
  }

  loading(enabled) {
    return Spinner.loading(enabled);
  }

  async show() {
    if (!this.initialized) {
      const container = $('<div/>')
        .addClass('row no-gutters justify-content-md-center min-h24r');
      this.tabContent.append(container);

      const backgroundTitle = this.createBackgroundTitle();
      container.append(backgroundTitle);

      const content = await this.createContent();
      container.append(content);
    }

    return super.show();
  }

  async download(key) {
    if (!key) {
      return undefined;
    }

    const s3utils = GetS3Utils();
    return s3utils.getObject(
      this.media.getProxyBucket(),
      key
    ).catch((e) => {
      console.error(
        'ERR:',
        'fail to download',
        key,
        e.message
      );
      return undefined;
    });
  }

  createBackgroundTitle() {
    return $('<div/>')
      .addClass(`${COL_TAB} d-flex justify-content-center custom-bg min-h24r`)
      .append($('<span/>')
        .addClass('align-self-center text-uppercase')
        .html(this.title));
  }

  async createContent() {
    return $('<div/>')
      .addClass(`${COL_TAB} my-4 max-h36r`)
      .html(Localization.Messages.NoData);
  }

  readableValue(data, name) {
    if (name === 'key' && data.bucket) {
      const container = $('<div/>');

      const consoleLink = $('<a/>')
        .addClass('mr-1')
        .addClass('badge badge-pill badge-primary mr-1 mb-1 lead-xs')
        .attr('href', AWSConsoleS3.getLink(data.bucket, data.key))
        .attr('target', '_blank')
        .html(TOOLTIP_VIEW_ON_CONSOLE);
      container.append(consoleLink);

      const downloadLink = $('<a/>')
        .addClass('mr-1')
        .attr('download', '')
        .attr('target', '_blank')
        .attr('data-toggle', 'tooltip')
        .attr('data-placement', 'bottom')
        .attr('title', TOOLTIP_DOWNLOAD_FILE)
        .append(data.key)
        .tooltip({
          trigger: 'hover',
        });
      container.append(downloadLink);

      container.ready(async () => {
        const s3utils = GetS3Utils();
        const signed = await s3utils.signUrl(
          data.bucket,
          data.key
        );

        downloadLink.attr(
          'href',
          signed
        );
      });

      return container;
    }

    if (name === 'fileSize') {
      return BaseMedia.readableFileSize(data.fileSize);
    }
    if (name === 'timestamp' || name === 'lastModified' || name === 'startTime' || name === 'endTime') {
      return BaseMedia.isoDateTime(data[name]);
    }
    if (name === 'executionArn') {
      return $('<a/>').addClass('badge badge-pill badge-primary mr-1 mb-1 lead-xs')
        .attr('href', AWSConsoleStepFunctions.getExecutionLink(data[name]))
        .attr('target', '_blank')
        .attr('data-toggle', 'tooltip')
        .attr('data-placement', 'bottom')
        .attr('title', TOOLTIP_VIEW_ON_CONSOLE)
        .html(data[name].split(':').pop())
        .tooltip({
          trigger: 'hover',
        });
    }
    if (Array.isArray(data[name])) {
      return data[name].join(', ');
    }
    return data[name];
  }

  createGrouping(name, indent = 0) {
    const css = (!indent)
      ? {
        margin: '',
        lead: 'lead-sm',
      }
      : (indent === 1)
        ? {
          margin: 'ml-2',
          lead: 'lead-xs',
        }
        : {
          margin: 'ml-4',
          lead: 'lead-xxs',
        };
    const details = $('<details/>')
      .addClass(css.margin)
      .data('rendered', false);

    const summary = $('<summary/>')
      .addClass('my-2');
    details.append(summary);

    const title = $('<span/>')
      .addClass('text-capitalize')
      .addClass(css.lead)
      .append(name);
    summary.append(title);

    return details;
  }

  createTableList() {
    return $('<dl/>').addClass('row text-left lead-xs ml-2 mb-2');
  }

  createListTitle(title) {
    return $('<dt/>').addClass(this.css.dl.dt)
      .addClass('text-capitalize text-truncate').append(title);
  }

  createListData(data) {
    const dd = $('<dd/>').addClass(this.css.dl.dd);
    if (!Array.isArray(data)) {
      return dd.append(data);
    }
    data.forEach(x => dd.append(x));
    return dd;
  }

  createBadge(name, href, tooltip) {
    const badge = (!href)
      ? $('<span/>').addClass('badge-secondary')
      : $('<a/>').addClass('badge-primary')
        .attr('href', href);
    badge.addClass('badge badge-pill mr-1 mb-1 lead-xs')
      .append(name);
    if (tooltip) {
      badge.attr('data-toggle', 'tooltip')
        .attr('data-placement', 'bottom')
        .attr('title', tooltip)
        .tooltip({
          trigger: 'hover',
        });
    }
    return badge;
  }

  appendTableList(dl, name, value) {
    return dl.append(this.createListTitle(name))
      .append(this.createListData(value));
  }

  createButton(name, prefix) {
    const displayName = (prefix ? `${prefix} ${name}` : name).replace(/_/g, ' ');
    const btn = $('<button/>').addClass('btn btn-sm btn-primary text-capitalize mb-1 ml-1')
      .attr('type', 'button')
      .attr('data-toggle', 'button')
      .attr('aria-pressed', false)
      .attr('autocomplete', 'off')
      .attr('data-track-name', name)
      .append(displayName);
    btn.off('click').on('click', async (event) => {
      const enableNow = btn.attr('aria-pressed') === 'false';
      return this.previewComponent.trackToggle(name, enableNow);
    });
    return btn;
  }

  createEnableAll(btns) {
    const input = $('<input/>').attr('type', 'checkbox');
    input.off('click').on('click', async (event) => {
      const enableAll = input.prop('checked');
      btns.forEach((btn) => {
        const enableNow = btn.attr('aria-pressed') === 'false';
        if (enableNow === enableAll) {
          btn.click();
        }
      });
    });
    const toggle = $('<div/>').addClass('form-group px-0 mt-2 mb-2')
      .append($('<div/>').addClass('input-group')
        .append($('<label/>').addClass('xs-switch')
          .append(input)
          .append($('<span/>').addClass('xs-slider round')))
        .append($('<span/>').addClass('lead ml-2')
          .html(Localization.Messages.EnableAll)));
    return toggle;
  }
}
