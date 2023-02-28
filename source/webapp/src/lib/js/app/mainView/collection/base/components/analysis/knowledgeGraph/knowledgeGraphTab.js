// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../../../../../../shared/localization.js';
import KnowledgeGraph from '../base/knowledgeGraph.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';

const TITLE = 'Knowledge Graph';
const DESC = 'Demonstrates a graph representation of the content and how it is related to other contents in your archive library';
const NO_DATA = Localization.Messages.NoData;
const COL_TAB = 'col-11';

export default class KnowledgeGraphTab extends BaseAnalysisTab {
  constructor(previewComponent, defaultTab = false) {
    super(TITLE, previewComponent, defaultTab);
  }

  static canSupport() {
    return (
      SolutionManifest.KnowledgeGraph &&
      SolutionManifest.KnowledgeGraph.Endpoint &&
      SolutionManifest.KnowledgeGraph.ApiKey
    );
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
    return new KnowledgeGraph(container, this.media, this);
  }

  async graphApi(query) {
    const url = new URL(SolutionManifest.KnowledgeGraph.Endpoint);
    Object.keys(query)
      .forEach((x) => {
        if (query[x] !== undefined) {
          url.searchParams.append(x, query[x]);
        }
      });

    return fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SolutionManifest.KnowledgeGraph.ApiKey,
      },
    }).then((res) => {
      if (!res.ok) {
        return undefined;
      }
      return res.json();
    });
  }
}
