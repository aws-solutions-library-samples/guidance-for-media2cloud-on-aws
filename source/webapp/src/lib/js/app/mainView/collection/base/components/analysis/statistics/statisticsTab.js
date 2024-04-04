// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../../../../../../shared/localization.js';
import {
  GetS3Utils,
} from '../../../../../../shared/s3utils.js';
import MapData from '../../../../../../shared/analysis/mapData.js';
import MediaTypes from '../../../../../../shared/media/mediaTypes.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';
import {
  AWSConsoleTranscribe,
} from '../../../../../../shared/awsConsole.js';

const {
  AnalysisTypes: {
    AutoFaceIndexer,
    Scene,
  },
  FoundationModels = [],
} = SolutionManifest;
const {
  Messages: {
    StatisticsTab: TITLE,
    DownloadJson: MSG_DOWNLOAD_JSON,
    WorkflowHistory: MSG_WORKFLOW_HISTORY,
    Rekognition: MSG_REKOGNITION,
    Labels: MSG_LABELS,
    Transcribe: MSG_TRANSCRIBE,
    TranscriptionJob: MSG_TRANSCRIPTION_JOB,
    Comprehend: MSG_COMPREHEND,
    Textract: MSG_TEXTRACT,
    NoData: MSG_NO_DATA,
    DynamicFrameName: MSG_DYNAMIC_FRAME_NAME,
    DynamicFrameDesc: MSG_DYNAMIC_FRAME_DESC,
    AutoFaceIndexerStatsName: MSG_AUTO_FACE_INDEXER_NAME,
    AutoFaceIndexerStatsDesc: MSG_AUTO_FACE_INDEXER_DESC,
    ApiCountName: MSG_API_COUNT_NAME,
    ApiCountDesc: MSG_API_COUNT_DESC,
    More: MSG_MORE,
  },
  Tooltips: {
    DownloadFile: TOOLTIP_DOWNLOAD_FILE,
  },
} = Localization;

const {
  name: MODEL_NAME = '',
  value: MODEL_ID = '',
} = FoundationModels[0] || {};
const MODEL_PRICING = (MODEL_ID.indexOf('sonnet') > 0)
  ? {
    InputTokens: 0.00300,
    OutputTokens: 0.01500,
  }
  : {
    InputTokens: 0.00025,
    OutputTokens: 0.00125,
  };

const COL_TAB = 'col-11';
const FRAME_SEGMENTATION = 'framesegmentation';
const FRAME_HASH_JSON = 'frameHash.json';

export default class StatisticsTab extends BaseAnalysisTab {
  constructor(previewComponent) {
    super(TITLE, previewComponent);
  }

  async createWorkflowHistory(data) {
    const details = this.createGrouping(MSG_WORKFLOW_HISTORY);

    data.forEach((workflow) => {
      const group = this.createGrouping(workflow.type, 1);
      details.append(group);

      const dl = this.createTableList();
      group.append(dl);

      const names = Object.keys(workflow)
        .filter((x) =>
          typeof workflow[x] !== 'object' && !Array.isArray(workflow[x]));

      names.forEach((name) =>
        this.appendTableList(dl, name, this.readableValue(workflow, name)));
    });
    return details;
  }

  async createRekognition(data) {
    const details = this.createGrouping(MSG_REKOGNITION);

    let promises = [];
    Object.keys(data)
      .forEach((type) => {
        promises.push(this.iterateAndCreateRekognitionItemByType(data[type], type));
      });

    promises = await Promise.all(promises);
    promises = promises.flat(1);

    details.append(promises);

    return details;
  }

  async iterateAndCreateRekognitionItemByType(data, type) {
    const iterators = [].concat(data);

    return Promise.all(iterators
      .map((x) =>
        this.createRekognitionByType(x, type)));
  }

  async createRekognitionByType(data, type) {
    if (type === Scene) {
      return this.createSceneInfo(data, type);
    }
    if (type === FRAME_SEGMENTATION) {
      return this.createFrameSegmentationInfo(data, type);
    }

    if (type === AutoFaceIndexer) {
      return this.createAutoFaceIndexerInfo(data, type);
    }

    const bucket = this.media.getProxyBucket();
    const details = this.createGrouping(type, 1);

    const dl = this.createTableList();
    details.append(dl);

    /* common information */
    [
      'startTime',
      'endTime',
      'id',
      'customLabelModels',
    ].forEach((name) => {
      if (data[name]) {
        this.appendTableList(dl, name, this.readableValue(data, name));
      }
    });

    if (data.apiCount) {
      const name = MSG_API_COUNT_NAME;
      const desc = MSG_API_COUNT_DESC
        .replace('{{API_COUNT}}', data.apiCount);
      this.appendTableList(dl, name, desc);
    }

    /* render on details open */
    details.on('click', async () => {
      const wasOpen = details.prop('open');
      const rendered = details.data('rendered');

      if (!rendered && !wasOpen) {
        // not all detection has mapfile; ie., adbreak, shoppable
        if (data.output === undefined) {
          details.data('rendered', true);
          return;
        }

        const mapData = await MapData.load(
          bucket,
          data.output
        );

        /* collect all labels */
        const labels = mapData.labels
          .map((label) =>
            this.createBadge(label)
              .addClass('text-captialize'));

        // limit to 20 badges...
        if (labels.length > 20) {
          labels.splice(20);

          const more = this.createBadge(MSG_MORE)
            .removeClass('badge-secondary')
            .addClass('badge-light');
          labels.push(more);
        }

        this.appendTableList(dl, MSG_LABELS, labels);

        /* collect all raw JSON */
        const lastIdx = data.output.lastIndexOf('/');
        const basename = data.output.substring(lastIdx + 1);
        const prefix = data.output.substring(0, lastIdx);
        const names = [
          ...mapData.files,
          basename,
        ];

        const s3utils = GetS3Utils();

        const jsons = names.map((name) => {
          const key = `${prefix}/${name}`;

          const badge = this.createBadge(name, 'href', key);

          badge.ready(async () => {
            const signed = await s3utils.signUrl(
              bucket,
              key
            );
            badge.attr('href', signed);
          });

          return badge;
        });

        this.appendTableList(dl, MSG_DOWNLOAD_JSON, jsons);

        details.data('rendered', true);
      }
    });

    return details;
  }

  async createTranscribe(data) {
    const s3utils = GetS3Utils();
    const bucket = this.media.getProxyBucket();
    const dl = this.createTableList();
    const details = this.createGrouping(MSG_TRANSCRIBE)
      .append(dl);

    const job = $('<a/>').addClass('mr-1')
      .attr('href', AWSConsoleTranscribe.getJobLink(data.jobId))
      .attr('target', '_blank')
      .html(data.name);
    this.appendTableList(dl, MSG_TRANSCRIPTION_JOB, job);

    [
      'startTime',
      'endTime',
    ].forEach(name =>
      this.appendTableList(dl, name, this.readableValue(data, name)));

    [
      'output',
      'vtt',
      'conversations',
    ].forEach((x) => {
      if (data[x]) {
        const name = data[x].substring(
          data[x].lastIndexOf('/') + 1,
          data[x].length
        );

        const badge = this.createBadge(
          name,
          'placeholder',
          TOOLTIP_DOWNLOAD_FILE
        );

        badge.ready(async () => {
          const signed = await s3utils.signUrl(
            bucket,
            data[x]
          );
          badge.attr('href', signed);
        });

        this.appendTableList(dl, x, badge);
      }
    });

    details.on('click', async () => {
      const wasOpen = details.prop('open');
      const rendered = details.data('rendered');

      if (!rendered && !wasOpen) {
        try {
          let {
            conversations,
          } = data;
          if (!conversations) {
            return;
          }

          // download the conversations
          conversations = await s3utils.getObject(bucket, conversations)
            .then((res) =>
              res.Body.transformToString())
            .catch((e) => {
              console.error(
                'ERR:',
                'fail to download',
                data.key
              );
              return undefined;
            });

          if (conversations) {
            conversations = JSON.parse(await conversations);

            if (conversations.usage) {
              const {
                usage: {
                  inputTokens,
                  outputTokens,
                },
              } = conversations;

              const estimatedCost = ((
                (inputTokens * MODEL_PRICING.InputTokens) +
                (outputTokens * MODEL_PRICING.OutputTokens)
              ) / 1000).toFixed(4);
              const name = 'Amazon Bedrock';
              const desc = `Total of <code>${inputTokens}</code> input tokens and <code>${outputTokens}</code> output tokens using ${MODEL_NAME}. Estimated cost is <code>$${estimatedCost}</code>.`;

              this.appendTableList(dl, name, desc);
            }

            details.data('rendered', true);
          }
        } catch (e) {
          console.log(e);
        }
      }
    });

    return details;
  }

  async createComprehend(data) {
    const details = this.createGrouping(MSG_COMPREHEND);
    Object.keys(data).forEach(async (type) =>
      details.append(await this.createComprehendByType(data[type], type)));
    return details;
  }

  async createComprehendByType(data, type) {
    const s3utils = GetS3Utils();
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
        const name = data[x].substring(
          data[x].lastIndexOf('/') + 1,
          data[x].length
        );

        const badge = this.createBadge(
          name,
          'placeholder',
          TOOLTIP_DOWNLOAD_FILE
        );

        badge.ready(async () => {
          const signed = await s3utils.signUrl(
            bucket,
            data[x]
          );
          badge.attr('href', signed);
        });

        this.appendTableList(dl, x, badge);
      }
    });

    return details;
  }

  async createTextract(data) {
    const s3utils = GetS3Utils();
    const bucket = this.media.getProxyBucket();
    const dl = this.createTableList();
    const details = this.createGrouping(MSG_TEXTRACT)
      .append(dl);

    [
      'startTime',
      'endTime',
    ].forEach(name =>
      this.appendTableList(dl, name, this.readableValue(data, name)));

    [
      'output',
    ].forEach((x) => {
      const name = data[x].substring(
        data[x].lastIndexOf('/') + 1,
        data[x].length
      );

      const badge = this.createBadge(
        name,
        'placeholder',
        TOOLTIP_DOWNLOAD_FILE
      );

      badge.ready(async () => {
        const signed = await s3utils.signUrl(
          bucket,
          data[x]
        );
        badge.attr('href', signed);
      });

      this.appendTableList(dl, x, badge);
    });

    return details;
  }

  async createContent() {
    const col = $('<div/>').addClass(`${COL_TAB} my-4 max-h36r`);
    setTimeout(async () => {
      this.loading(true);
      const aimls = await this.media.getAnalysisResults();
      if (!aimls || !aimls.length) {
        col.html(MSG_NO_DATA);
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

  async createSceneInfo(data, type) {
    const bucket = this.media.getProxyBucket();
    const details = this.createGrouping(type, 1);

    const dl = this.createTableList();
    details.append(dl);

    ['startTime', 'endTime'].forEach((name) => {
      if (data[name]) {
        this.appendTableList(
          dl,
          name,
          this.readableValue(data, name)
        );
      }
    });

    const s3utils = GetS3Utils();

    const badges = ['embeddings', 'metadata', 'similarity']
      .map((name) => {
        if (data[name]) {
          const badge = this.createBadge(name, 'href', data[name]);

          badge.ready(async () => {
            const signed = await s3utils.signUrl(
              bucket,
              data[name]
            );
            badge.attr('href', signed);
          });
          return badge;
        }

        return undefined;
      });
    this.appendTableList(dl, MSG_DOWNLOAD_JSON, badges);

    // render on details open
    details.on('click', async () => {
      const wasOpen = details.prop('open');
      const rendered = details.data('rendered');

      if (!rendered && !wasOpen) {
        let scene = data.metadata;

        // download the scene metadata
        scene = await s3utils.getObject(bucket, data.metadata)
          .then((res) =>
            res.Body.transformToString())
          .catch((e) => {
            console.error(
              'ERR:',
              'fail to download',
              data.key
            );
            return undefined;
          });

        if (scene) {
          scene = JSON.parse(await scene);

          if (scene.stats) {
            const {
              apiCount,
              elapsed,
              // inferenceTime,
              inputTokens,
              outputTokens,
              stopReason,
            } = scene.stats;

            const estimatedCost = ((
              (inputTokens * MODEL_PRICING.InputTokens) +
              (outputTokens * MODEL_PRICING.OutputTokens)
            ) / 1000).toFixed(4);
            const name = 'Amazon Bedrock';
            let desc = `Total of <code>${inputTokens}</code> input tokens, <code>${outputTokens}</code> output tokens, and <code>${apiCount}</code> API invocations to Amazon Bedrock service (${MODEL_NAME}) with <code>${StatisticsTab.readableDuration(elapsed, true)}</code> processing time. Estimated cost is <code>$${estimatedCost}</code>.`;
            if (stopReason) {
              desc = `${desc} (Partially processed: due to a reason of ${stopReason})`;
            }

            this.appendTableList(dl, name, desc);
          }

          details.data('rendered', true);
        }
      }
    });

    return details;
  }

  async createFrameSegmentationInfo(data, type) {
    // key, framesExtracted, framesAnalyzed, startTime, endTime
    const bucket = this.media.getProxyBucket();
    const details = this.createGrouping(type, 1);

    const dl = this.createTableList();
    details.append(dl);

    ['startTime', 'endTime'].forEach((name) => {
      if (data[name]) {
        this.appendTableList(
          dl,
          name,
          this.readableValue(data, name)
        );
      }
    });

    // render on details open
    details.on('click', async () => {
      const wasOpen = details.prop('open');
      const rendered = details.data('rendered');

      if (!rendered && !wasOpen) {
        const s3utils = GetS3Utils();

        let framesAnalyzed = data.framesAnalyzed;
        let framesExtracted = data.framesExtracted;

        if (framesAnalyzed === undefined) {
          // download the frame selection json
          framesAnalyzed = await s3utils.getObject(bucket, data.key)
            .then((res) =>
              res.Body.transformToString())
            .catch((e) => {
              console.error(
                'ERR:',
                'fail to download',
                data.key
              );
              return undefined;
            });

          if (framesAnalyzed) {
            framesAnalyzed = JSON.parse(await framesAnalyzed).length;
          }
        }

        if (framesExtracted === undefined) {
          // download the frame hash json
          const lastIdx = data.key.lastIndexOf('/');
          const prefix = data.key.substring(0, lastIdx);
          const key = `${prefix}/${FRAME_HASH_JSON}`;

          framesExtracted = await s3utils.getObject(bucket, key)
            .then((res) =>
              res.Body.transformToString())
            .catch((e) => {
              console.error(
                'ERR:',
                'fail to download',
                data.key
              );
              return undefined;
            });

          if (framesExtracted) {
            framesExtracted = JSON.parse(await framesExtracted).length;
          }
        }

        let percentage = (framesExtracted - framesAnalyzed) / framesExtracted;
        percentage = Math.round(percentage * 100);

        const name = MSG_DYNAMIC_FRAME_NAME;
        const desc = MSG_DYNAMIC_FRAME_DESC
          .replace('{{EXTRACTED}}', framesExtracted)
          .replace('{{ANALYZED}}', framesAnalyzed)
          .replace('{{PERCENTAGE}}', percentage);

        this.appendTableList(dl, name, desc);

        details.data('rendered', true);
      }
    });

    return details;
  }

  async createAutoFaceIndexerInfo(data, type) {
    // startTime, endTime, facesIndexed, apiCount
    const bucket = this.media.getProxyBucket();
    const details = this.createGrouping(type, 1);

    const dl = this.createTableList();
    details.append(dl);

    ['startTime', 'endTime'].forEach((name) => {
      if (data[name]) {
        this.appendTableList(
          dl,
          name,
          this.readableValue(data, name)
        );
      }
    });

    const name = MSG_AUTO_FACE_INDEXER_NAME;
    const desc = MSG_AUTO_FACE_INDEXER_DESC
      .replace('{{FACES_INDEXED}}', data.facesIndexed)
      .replace('{{API_COUNT}}', data.apiCount)
      .replace('{{FACE_API_COUNT}}', data.faceApiCount || 0);
    this.appendTableList(dl, name, desc);

    return details;
  }
}
