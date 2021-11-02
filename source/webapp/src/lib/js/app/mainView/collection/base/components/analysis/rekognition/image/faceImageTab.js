// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import BaseRekognitionImageTab from './baseRekognitionImageTab.js';

export default class FaceImageTab extends BaseRekognitionImageTab {
  constructor(previewComponent, data, defaultTab = false) {
    super(AnalysisTypes.Rekognition.Face, previewComponent, data, defaultTab);
  }
}
