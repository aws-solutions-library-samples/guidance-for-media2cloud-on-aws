// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import BaseRekognitionTab from './baseRekognitionTab.js';

export default class CustomLabelTab extends BaseRekognitionTab {
  constructor(previewComponent, data) {
    super(AnalysisTypes.Rekognition.CustomLabel, previewComponent, data);
    /* reset tab name to append model name */
    this.title = `${this.title} (${data.customLabelModels.substring(0, 6)}...)`;
  }
}
