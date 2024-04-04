// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../shared/localization.js';
import KnowledgeGraph from '../base/knowledgeGraph.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';

const {
  Messages: {
    KnowledgeGraphTab: TITLE,
    KnowledgeGraphTabDesc: DESC,
    NoData: NO_DATA,
  },
} = Localization;
const COL_TAB = 'col-11';

export default class KnowledgeGraphTab extends BaseAnalysisTab {
  constructor(previewComponent) {
    super(TITLE, previewComponent);
  }

  static canSupport() {
    return KnowledgeGraph.canSupport();
  }

  async createContent() {
    const container = $('<div/>').addClass(`${COL_TAB} my-4 max-h56r`);
    this.delayContentLoad(container);
    return container;
  }

  delayContentLoad(container) {
    container.ready(async () => {
      let section;
      try {
        this.loading(true);

        const descContainer = $('<section/>')
          .addClass('col-9 mx-auto');
        container.append(descContainer);

        const desc = $('<p/>')
          .addClass('lead-sm')
          .append(DESC);
        descContainer.append(desc);

        section = $('<section/>')
          .addClass('mt-4');
        container.append(section);

        const knowledgeGraph = await this.createKnowledgeGraph(section);
        if (!knowledgeGraph) {
          section.append(NO_DATA);
          return;
        }
      } catch (e) {
        console.error(e);
        if (section) {
          section.append(e.message);
        }
      } finally {
        this.loading(false);
      }
    });
  }

  async createKnowledgeGraph(container) {
    return new KnowledgeGraph(container, this.media);
  }
}
