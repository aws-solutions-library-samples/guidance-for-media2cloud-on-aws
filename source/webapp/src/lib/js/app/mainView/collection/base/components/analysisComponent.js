// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import AnalysisTypes from '../../../../shared/analysis/analysisTypes.js';
/* analysis summary */
import StatisticsTab from './analysis/statistics/statisticsTab.js';
/* rekog video */
import CelebTab from './analysis/rekognition/video/celebTab.js';
import LabelTab from './analysis/rekognition/video/labelTab.js';
import FaceMatchTab from './analysis/rekognition/video/faceMatchTab.js';
import FaceTab from './analysis/rekognition/video/faceTab.js';
import ModerationTab from './analysis/rekognition/video/moderationTab.js';
import PersonTab from './analysis/rekognition/video/personTab.js';
import SegmentTab from './analysis/rekognition/video/segmentTab.js';
import TextTab from './analysis/rekognition/video/textTab.js';
/* rekog image */
import CelebImageTab from './analysis/rekognition/image/celebImageTab.js';
import LabelImageTab from './analysis/rekognition/image/labelImageTab.js';
import FaceMatchImageTab from './analysis/rekognition/image/faceMatchImageTab.js';
import FaceImageTab from './analysis/rekognition/image/faceImageTab.js';
import ModerationImageTab from './analysis/rekognition/image/moderationImageTab.js';
import TextImageTab from './analysis/rekognition/image/textImageTab.js';
/* transcribe */
import TranscribeTab from './analysis/transcribe/transcribeTab.js';
/* comprehend */
import KeyphraseTab from './analysis/comprehend/keyphraseTab.js';
import EntityTab from './analysis/comprehend/entityTab.js';
import SentimentTab from './analysis/comprehend/sentimentTab.js';
/* textract */
import TextractTab from './analysis/textract/textractTab.js';
/* custom labels */
import CustomLabelTab from './analysis/rekognition/video/customLabelTab.js';
/* search result */
import SearchResultTab from './analysis/searchResult/searchResultTab.js';
/* ReAnalyze */
import ReAnalyzeTab from './analysis/reAnalyze/reAnalzeTab.js';

export default class AnalysisComponent {
  constructor(previewComponent) {
    this.$tabControllers = [];
    if (previewComponent.searchResults) {
      this.$tabControllers.push(new SearchResultTab(previewComponent, true));
    } else {
      this.$tabControllers.push(new StatisticsTab(previewComponent, true));
      if (previewComponent.media.getTranscribeResults()) {
        this.$tabControllers.push(new TranscribeTab(previewComponent));
      }
      const rekog = previewComponent.media.getRekognitionResults();
      let types = Object.keys(rekog || {});
      types.forEach((type) => {
        const datas = [].concat(rekog[type]);
        datas.forEach((data) => {
          const controller = type === AnalysisTypes.Rekognition.Celeb
            ? new CelebTab(previewComponent, data)
            : type === AnalysisTypes.Rekognition.Label
              ? new LabelTab(previewComponent, data)
              : type === AnalysisTypes.Rekognition.FaceMatch
                ? new FaceMatchTab(previewComponent, data)
                : type === AnalysisTypes.Rekognition.Face
                  ? new FaceTab(previewComponent, data)
                  : type === AnalysisTypes.Rekognition.Person
                    ? new PersonTab(previewComponent, data)
                    : type === AnalysisTypes.Rekognition.Moderation
                      ? new ModerationTab(previewComponent, data)
                      : type === AnalysisTypes.Rekognition.Segment
                        ? new SegmentTab(previewComponent, data)
                        : type === AnalysisTypes.Rekognition.CustomLabel
                          ? new CustomLabelTab(previewComponent, data)
                          : type === AnalysisTypes.Rekognition.Text
                            ? new TextTab(previewComponent, data)
                            : undefined;
          if (controller) {
            this.$tabControllers.push(controller);
          }
        });
      });
      const rekogImage = previewComponent.media.getRekognitionImageResults();
      types = Object.keys(rekogImage || {});
      types.forEach((type) => {
        const datas = [].concat(rekogImage[type]);
        datas.forEach((data) => {
          const controller = type === AnalysisTypes.Rekognition.Celeb
            ? new CelebImageTab(previewComponent, data)
            : type === AnalysisTypes.Rekognition.Label
              ? new LabelImageTab(previewComponent, data)
              : type === AnalysisTypes.Rekognition.FaceMatch
                ? new FaceMatchImageTab(previewComponent, data)
                : type === AnalysisTypes.Rekognition.Face
                  ? new FaceImageTab(previewComponent, data)
                  : type === AnalysisTypes.Rekognition.Text
                    ? new TextImageTab(previewComponent, data)
                    : type === AnalysisTypes.Rekognition.Moderation
                      ? new ModerationImageTab(previewComponent, data)
                      : undefined;
          if (controller) {
            this.$tabControllers.push(controller);
          }
        });
      });
      const comprehend = previewComponent.media.getComprehendResults();
      Object.keys(comprehend || {}).forEach((type) => {
        const controller = type === AnalysisTypes.Comprehend.Keyphrase
          ? new KeyphraseTab(previewComponent)
          : type === AnalysisTypes.Comprehend.Entity
            ? new EntityTab(previewComponent)
            : type === AnalysisTypes.Comprehend.Sentiment
              ? new SentimentTab(previewComponent)
              : undefined;
        if (controller) {
          this.$tabControllers.push(controller);
        }
      });
      const textract = previewComponent.media.getTextractResults();
      if (textract) {
        this.$tabControllers.push(new TextractTab(previewComponent));
      }
      this.$tabControllers.push(new ReAnalyzeTab(previewComponent));
    }
  }

  get previewComponent() {
    return this.$previewComponent;
  }

  get media() {
    return (this.$previewComponent || {}).media;
  }

  get tabControllers() {
    return this.$tabControllers;
  }

  set tabControllers(val) {
    this.$tabControllers = val;
  }

  async show() {
    const activeController = this.tabControllers.find(controller =>
      controller.tabContent.hasClass('active'));
    if (activeController) {
      return activeController.show();
    }
    return this;
  }

  async hide() {
    return Promise.all(this.tabControllers.map(x => x.hide()));
  }

  createTabsAndContents() {
    const ul = $('<ul/>').addClass('nav flex-column ml-2 my-4')
      .attr('role', 'tablist');
    this.tabControllers.forEach(controller =>
      ul.append(controller.tabLink));
    const contents = this.tabControllers.map(controller =>
      controller.tabContent);
    return [
      ul,
      contents,
    ];
  }

  createContents() {
    const [
      tabs,
      contents,
    ] = this.createTabsAndContents();
    const menu = $('<nav/>').addClass('col-2 d-none d-md-block sidebar')
      .css('min-height', 300)
      .append(tabs);
    const tabContents = $('<div/>').addClass('tab-content')
      .addClass('col-10 p-0 m-0')
      .append(contents);
    const container = $('<div/>').addClass('col-12 p-0 m-0')
      .append($('<div/>').addClass('row no-gutters')
        .append(menu)
        .append(tabContents));
    return container;
  }
}
