// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../../../../../../shared/localization.js';
import S3Utils from '../../../../../../shared/s3utils.js';
import BaseMedia from '../../../../../../shared/media/baseMedia.js';
import MediaTypes from '../../../../../../shared/media/mediaTypes.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';
import {
  AWSConsoleTranscribe,
} from '../../../../../../shared/awsConsole.js';

const COL_TAB = 'col-11';

export default class StatisticsTab extends BaseAnalysisTab {
  constructor(previewComponent, defaultTab = false) {
    super(Localization.Messages.StatisticsTab, previewComponent, defaultTab);
  }

  async createWorkflowHistory(data) {
    const details = this.createGrouping(Localization.Messages.WorkflowHistory);

    data.forEach((workflow) => {
      const dl = this.createTableList();
      const names = Object.keys(workflow).filter(x =>
        typeof workflow[x] !== 'object' && !Array.isArray(workflow[x]));
      names.forEach(name =>
        this.appendTableList(dl, name, this.readableValue(workflow, name)));
      details.append(this.createGrouping(workflow.type, 1)
        .append(dl));
    });
    return details;
  }

  async createRekognition(data) {
    const details = this.createGrouping(Localization.Messages.Rekognition);
    Object.keys(data).forEach(async (type) =>
      details.append(await this.iterateAndCreateRekognitionItemByType(data[type], type)));
    return details;
  }

  async iterateAndCreateRekognitionItemByType(data, type) {
    const iterators = [].concat(data);
    return Promise.all(iterators.map(x =>
      this.createRekognitionByType(x, type)));
  }

  async createRekognitionByType(data, type) {
    const bucket = this.media.getProxyBucket();
    const dl = this.createTableList();
    const details = this.createGrouping(type, 1).append(dl);

    [
      'startTime',
      'endTime',
      'id',
      'customLabelModels',
    ].forEach(name =>
      data[name] && this.appendTableList(dl, name, this.readableValue(data, name)));

    if (((data.trackBasenames || {}).metadata || []).length > 0) {
      let values = data.trackBasenames.metadata.map(x => x.replace(/_/g, ' '));
      values = values.map(x => this.createBadge(x)
        .addClass('text-capitalize'));
      this.appendTableList(dl, Localization.Messages.Labels, values);
    }

    const prefix = (data.output[data.output.length - 1] === '/')
      ? data.output
      : data.output.substring(0, data.output.lastIndexOf('/'));
    const objects = await S3Utils.listObjects(bucket, prefix);
    const values = objects.map((x) => {
      const name = x.Key.substring(x.Key.lastIndexOf('/') + 1, x.Key.length);
      const href = S3Utils.signUrl(bucket, x.Key);
      const tooltip = `${Localization.Messages.FileSize}: ${BaseMedia.readableFileSize(x.Size)}`;
      return this.createBadge(name, href, tooltip);
    });
    this.appendTableList(dl, Localization.Messages.DownlaodJson, values);
    return details;
  }

  async createTranscribe(data) {
    const bucket = this.media.getProxyBucket();
    const dl = this.createTableList();
    const details = this.createGrouping(Localization.Messages.Transcribe)
      .append(dl);

    const job = $('<a/>').addClass('mr-1')
      .attr('href', AWSConsoleTranscribe.getJobLink(data.jobId))
      .attr('target', '_blank')
      .html(data.name);
    this.appendTableList(dl, Localization.Messages.TranscriptionJob, job);

    [
      'startTime',
      'endTime',
    ].forEach(name =>
      this.appendTableList(dl, name, this.readableValue(data, name)));

    [
      'output',
      'vtt',
    ].forEach((x) => {
      if (data[x]) {
        const name = data[x].substring(data[x].lastIndexOf('/') + 1, data[x].length);
        const href = S3Utils.signUrl(bucket, data[x]);
        const tooltip = Localization.Tooltips.DownloadFile;
        this.appendTableList(dl, x, this.createBadge(name, href, tooltip));
      }
    });
    return details;
  }

  async createComprehend(data) {
    const details = this.createGrouping(Localization.Messages.Comprehend);
    Object.keys(data).forEach(async (type) =>
      details.append(await this.createComprehendByType(data[type], type)));
    return details;
  }

  async createComprehendByType(data, type) {
    const bucket = this.media.getProxyBucket();
    const dl = this.createTableList();
    const details = this.createGrouping(type, 1)
      .append(dl);

    [
      'startTime',
      'endTime',
    ].forEach(name =>
      this.appendTableList(dl, name, this.readableValue(data, name)));

    [
      'output',
      'metadata',
    ].forEach((x) => {
      if (data[x]) {
        const name = data[x].substring(data[x].lastIndexOf('/') + 1, data[x].length);
        const href = S3Utils.signUrl(bucket, data[x]);
        const tooltip = Localization.Tooltips.DownloadFile;
        this.appendTableList(dl, x, this.createBadge(name, href, tooltip));
      }
    });
    return details;
  }

  async createTextract(data) {
    const bucket = this.media.getProxyBucket();
    const dl = this.createTableList();
    const details = this.createGrouping(Localization.Messages.Textract)
      .append(dl);

    [
      'startTime',
      'endTime',
    ].forEach(name =>
      this.appendTableList(dl, name, this.readableValue(data, name)));

    [
      'output',
    ].forEach((x) => {
      const name = data[x].substring(data[x].lastIndexOf('/') + 1, data[x].length);
      const href = S3Utils.signUrl(bucket, data[x]);
      const tooltip = Localization.Tooltips.DownloadFile;
      this.appendTableList(dl, x, this.createBadge(name, href, tooltip));
    });
    return details;
  }

  async createContent() {
    const col = $('<div/>').addClass(`${COL_TAB} my-4 max-h36r`);
    setTimeout(async () => {
      this.loading(true);
      const aimls = await this.media.getAnalysisResults();
      if (!aimls || !aimls.length) {
        col.html(Localization.Messages.NoData);
        return this.loading(false);
      }
      col.append(await this.createWorkflowHistory(aimls));
      aimls.forEach(async (aiml) => {
        if (aiml.type === MediaTypes.Video && aiml.rekognition) {
          col.append(await this.createRekognition(aiml.rekognition));
        } else if (aiml.type === MediaTypes.Audio) {
          if (aiml.transcribe) {
            col.append(await this.createTranscribe(aiml.transcribe));
          }
          if (aiml.comprehend) {
            col.append(await this.createComprehend(aiml.comprehend));
          }
        } else if (aiml.type === MediaTypes.Image) {
          col.append(await this.createRekognition(aiml['rekog-image']));
        } else if (aiml.type === MediaTypes.Document) {
          col.append(await this.createTextract(aiml.textract));
        }
      });
      return this.loading(false);
    }, 10);
    return col;
  }
}
