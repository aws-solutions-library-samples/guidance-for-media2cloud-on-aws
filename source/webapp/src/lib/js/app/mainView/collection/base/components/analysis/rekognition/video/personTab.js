// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import BaseRekognitionTab from './baseRekognitionTab.js';

const NAMED_PREFIX = 'Person';

export default class PersonTab extends BaseRekognitionTab {
  constructor(previewComponent, data, defaultTab = false) {
    super(AnalysisTypes.Rekognition.Person, previewComponent, data, defaultTab);
  }

  createBadges(datapoint, idx, namedPrefix) {
    return super.createBadges(datapoint, idx, NAMED_PREFIX);
  }
}
