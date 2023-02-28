// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import BaseMediaTab from './base/baseMediaTab.js';
import RecommendCategorySlideComponent from './recommend/recommendCategorySlideComponent.js';
import RecommendPreviewSlideComponent from './recommend/recommendPreviewSlideComponent.js';

const TABNAME = 'Search Knowledge Graph';

export default class RecommendTab extends BaseMediaTab {
  constructor(defaultTab, plugins) {
    super(defaultTab, TABNAME, plugins);
    this.$categorySlideComponent = new RecommendCategorySlideComponent();
    this.$previewSlideComponent = new RecommendPreviewSlideComponent();
    this.$tabLink.addClass('ml-2');
    this.$tabLink.find('a')
      .addClass('search-border bg-dark text-white');
  }

  static canSupport() {
    return (
      SolutionManifest.KnowledgeGraph &&
      SolutionManifest.KnowledgeGraph.Endpoint &&
      SolutionManifest.KnowledgeGraph.ApiKey
    );
  }
}
