// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../shared/localization.js';
import AnalysisTypes from '../../../../../../shared/analysis/analysisTypes.js';
import AppUtils from '../../../../../../shared/appUtils.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';

const {
  Messages: {
    SearchResultTab: TITLE,
    SearchResultDesc: MSG_SEARCH_RESULT_DESC,
    KnownFaces: MSG_KNOWN_FACES,
    LabelsModeration: MSG_LABEL_MODERATION,
    TranscriptPhrasesEntities: MSG_TRANSCRIPT_PHRASE_ENTITIES,
    VisualText: MSG_VISUAL_TEXT,
    ContentAttributes: MSG_CONTENT_ATTRIBUTES,
    NoData: MSG_NO_DATA,
    Category: MSG_CATEGORY,
  },
} = Localization;

const COL_TAB = 'col-11';

const {
  Rekognition: {
    Celeb,
    FaceMatch,
    Label,
    CustomLabel,
    Moderation,
    Text,
  },
  Comprehend: {
    Keyphrase,
    Entity,
    CustomEntity,
  },
  Transcribe,
  Textract,
} = AnalysisTypes;

const ANALYSIS_FIELDS = [
  Celeb,
  FaceMatch,
  Label,
  CustomLabel,
  Moderation,
  Text,
  Textract,
  Transcribe,
  Keyphrase,
  Entity,
  CustomEntity,
];

export default class SearchResultTab extends BaseAnalysisTab {
  constructor(previewComponent) {
    super(TITLE, previewComponent);
  }

  async createContent() {
    const container = $('<div/>')
      .addClass(COL_TAB)
      .addClass('my-4 max-h36r');

    container.ready(async () => {
      this.loading(true);
      await this.refreshSearchResults(container);
      return this.loading(false);
    });
    return container;
  }

  async refreshSearchResults(container) {
    container.children().remove();

    const fields = (this.previewComponent.searchResults || {}).fields || {};

    if (fields.length === 0) {
      const message = $('<span/>')
        .addClass('lead')
        .append(MSG_NO_DATA);
      container.append(message);

      return container;
    }

    const table = $('<table/>')
      .addClass('table lead-xs');
    container.append(table);

    const headers = [
      MSG_CATEGORY,
      MSG_SEARCH_RESULT_DESC,
    ].map((x) =>
      $('<th/>')
        .addClass('align-middle text-left b-300')
        .attr('scope', 'col')
        .append(x));
    headers[0].addClass('col-2');

    table.append($('<thead/>')
      .append($('<tr/>')
        .append(headers)));

    const tbody = $('<tbody/>');
    table.append(tbody);

    /* known faces */
    const knownFaces = this.makeTableRowItem([
      Celeb,
      FaceMatch,
    ], fields, MSG_KNOWN_FACES);
    tbody.append(knownFaces);

    /* labels / moderation */
    const labelModerations = this.makeTableRowItem([
      AnalysisTypes.Rekognition.Label,
      AnalysisTypes.Rekognition.CustomLabel,
      AnalysisTypes.Rekognition.Moderation,
    ], fields, MSG_LABEL_MODERATION);
    tbody.append(labelModerations);

    /* transcribe / phrases / entities */
    const phrases = this.makeTableRowItemSpeechText([
      AnalysisTypes.Transcribe,
      AnalysisTypes.Comprehend.Keyphrase,
      AnalysisTypes.Comprehend.Entity,
      AnalysisTypes.Comprehend.CustomEntity,
    ], fields, MSG_TRANSCRIPT_PHRASE_ENTITIES);
    tbody.append(phrases);

    /* visual text */
    const texts = this.makeTableRowItem([
      Text,
    ], fields, MSG_VISUAL_TEXT);
    tbody.append(texts);

    /* textract */
    const textract = this.makeTableRowItemTextract(
      fields[Textract],
      MSG_VISUAL_TEXT
    );
    tbody.append(textract);

    /* content attribute */
    const metadataFields = Object.keys(fields)
      .filter((x) =>
        !ANALYSIS_FIELDS.includes(x));

    if (metadataFields.length > 0) {
      const metadata = this.makeTableRowItemContentMetadata(
        metadataFields,
        fields,
        MSG_CONTENT_ATTRIBUTES
      );

      tbody.append(metadata);
    }
    /*
    if (indices.indexOf(INDEX_INGEST) >= 0) {
      const data = {
        basename: this.previewComponent.media.basename,
        ...this.previewComponent.media.attributes,
      };
      const attributes = this.makeTableRowItemContentMetadata(
        data,
        MSG_CONTENT_ATTRIBUTES
      );
      tbody.append(attributes);
    }
    */

    return container;
  }

  makeTableRowItem(categories, fields, title) {
    const merged = this.mergeResults(categories, fields);
    if (!merged.results.length) {
      return undefined;
    }
    if (!merged.timecodeBased) {
      return this.makeTableRowItemNoTimecode(merged, title);
    }
    const content = merged.results.map((x) => {
      const section = $('<section/>')
        .addClass('mb-2');

      const toggle = this.makeTrackToggle(x);
      const btns = x.timecodes.map((timecode) =>
        this.makeTimecodeBtn(timecode));
      return section.append(toggle)
        .append(btns);
    });
    const tr = $('<tr/>')
      .append($('<td/>').addClass('h-100 align-center text-left lead-s')
        .append(title))
      .append($('<td/>').addClass('h-100 align-middle text-left')
        .append(content));
    return tr;
  }

  makeTrackToggle(item) {
    const id = `toggle-${AppUtils.randomHexstring()}`;
    const input = $('<input/>').addClass('custom-control-input')
      .attr('type', 'checkbox')
      .attr('id', id)
      .data('registered', false);
    const label = $('<label/>').addClass('custom-control-label lead-xs b-300')
      .attr('for', id)
      .append(item.name);
    const toggle = $('<div/>').addClass('custom-control custom-switch mr-2 mb-2')
      .append(input)
      .append(label);
    input.off('click').on('click', async () => {
      const checked = input.prop('checked');
      const registered = input.data('registered');
      if (!registered && checked) {
        this.registerTimecodeTrack(item);
      }
      this.previewComponent.trackToggle(item.name, checked);
    });
    return toggle;
  }

  registerTimecodeTrack(result) {
    const cues = result.timecodes.map((timecode) => {
      const cue = new window.vttjs.VTTCue(timecode.begin / 1000, timecode.end / 1000, result.name);
      cue.line = 0;
      cue.position = 100;
      cue.align = 'start';
      cue.size = 50;
      return cue;
    });

    return this.previewComponent.createTrackFromCues(result.name, cues);
  }

  makeTimecodeBtn(timecode) {
    const begin = AppUtils.readableDuration(timecode.begin, true);
    const end = AppUtils.readableDuration(timecode.end, true);
    const tooltip = `${begin} / ${end}`;
    const btn = $('<button/>').addClass('btn btn-sm btn-primary mb-1 ml-1')
      .attr('type', 'button')
      .attr('data-toggle', 'button')
      .attr('aria-pressed', false)
      .attr('autocomplete', 'off')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', tooltip)
      .append(begin)
      .tooltip({
        trigger: 'hover',
      });
    btn.off('click').on('click', async (event) => {
      event.stopPropagation();
      await this.previewComponent.seek(timecode.begin / 1000);
    });
    return btn;
  }

  mergeResults(types, fields) {
    const matched = {};
    let timecodeBased = false;

    types.forEach((type) => {
      const hits = (fields[type] || {}).hits;
      if (hits === undefined || hits.length === 0) {
        return;
      }

      /* timecode based */
      if (hits[0].timecodes) {
        timecodeBased = true;
      }

      hits.forEach((hit) => {
        if (matched[hit.name] === undefined) {
          matched[hit.name] = {};
          if (timecodeBased) {
            matched[hit.name].timecodes = [];
          }
        }
        if (hit.timecodes !== undefined) {
          matched[hit.name].timecodes = matched[hit.name].timecodes
            .concat(hit.timecodes);
        }
      });
    });

    return {
      timecodeBased,
      results: Object.keys(matched)
        .map((x) => ({
          name: x,
          timecodes: this.mergeTimecodes(matched[x].timecodes),
        })),
    };
  }

  mergeTimecodes(timecodes) {
    if (!timecodes || timecodes.length === 0) {
      return undefined;
    }
    const sorted = timecodes.map((x) => ({
      begin: Math.round(x.begin / 1000) * 1000,
      end: Math.round(x.end / 1000) * 1000,
    })).sort((a, b) =>
      a.begin - b.begin);
    /* merge timecodes */
    const stack = [];
    stack.push(sorted.shift());
    while (sorted.length) {
      const prev = stack[stack.length - 1];
      const cur = sorted.shift();
      if (prev.begin === cur.begin) {
        if (cur.end > prev.end) {
          prev.end = cur.end;
        }
        continue;
      }
      if (cur.begin > prev.begin && cur.begin < prev.end) {
        prev.end = Math.max(cur.end, prev.end);
        continue;
      }
      if (cur.begin === prev.end) {
        prev.end = Math.max(cur.end, prev.end);
        continue;
      }
      stack.push(cur);
    }
    return stack;
  }

  makeTableRowItemNoTimecode(metadata, title) {
    const btns = metadata.results.map((x) => {
      const tagId = `tag-${AppUtils.randomHexstring()}`;
      const btn = $('<button/>').addClass('btn btn-sm btn-primary text-capitalize mb-1 ml-1')
        .attr('type', 'button')
        .attr('data-toggle', 'button')
        .attr('data-tag', tagId)
        .attr('aria-pressed', false)
        .attr('autocomplete', 'off')
        .append(x.name);
      btn.off('click').on('click', async (event) => {
        const enableNow = btn.attr('aria-pressed') === 'false';
        const view = this.previewComponent.getView();
        if (view) {
          const parent = view.parent();
          let layer = parent.children('div.search-layer');
          if (!layer.length) {
            layer = $('<div/>').addClass('search-layer');
            parent.append(layer);
          }
          if (enableNow) {
            layer.append($('<span/>')
              .addClass('badge badge-pill badge-secondary mr-1 mb-1 lead-xxs p-2 d-block')
              .attr('data-tag', tagId)
              .append(x.name));
          } else {
            layer.children(`[data-tag="${tagId}"]`).remove();
            if (!layer.children().length) {
              layer.remove();
            }
          }
        }
        return true;
      });
      return btn;
    });
    const tr = $('<tr/>')
      .append($('<td/>').addClass('h-100 align-center text-left lead-s')
        .append(title))
      .append($('<td/>').addClass('h-100 align-middle text-left')
        .append(btns));
    return tr;
  }

  makeTableRowItemSpeechText(categories, searchResults, title) {
    const merged = this.mergeResults(categories, searchResults);
    if (!merged.results.length) {
      return undefined;
    }
    if (!merged.timecodeBased) {
      return this.makeTableRowItemNoTimecode(merged, title);
    }
    const content = merged.results.map((x) => {
      const btns = x.timecodes.map((timecode) => {
        const btn = this.makeTimecodeBtn(timecode);
        const timestamp = AppUtils.readableDuration(timecode.begin, true);
        return btn.html(`${x.name} (${timestamp})`);
      });
      return btns;
    }).flat();
    const tr = $('<tr/>')
      .append($('<td/>').addClass('h-100 align-center text-left lead-s')
        .append(title))
      .append($('<td/>').addClass('h-100 align-middle text-left')
        .append(content));
    return tr;
  }

  makeTableRowItemContentMetadata(types, fields, title) {
    const container = $('<tr/>');

    const tdTitle = $('<td/>')
      .addClass('h-100 align-center text-left lead-s')
      .append(title);
    container.append(tdTitle);

    const tdTable = $('<td/>')
      .addClass('h-100 align-middle text-left');
    container.append(tdTable);

    const innerTable = $('<table/>')
      .addClass('lead-xs')
      .attr('cellspacing', 0)
      .attr('cellpadding', 0);
    tdTable.append(innerTable);

    const tbody = $('<tbody/>');
    innerTable.append(tbody);

    types.forEach((type) => {
      if (((fields[type] || {}).hits || []).length > 0) {
        if (typeof fields[type].hits[0] === 'string') {
          /* fields such as basename, md5, uuid */
          const tr = $('<tr/>');
          tbody.append(tr);

          const key = $('<td/>')
            .addClass('h-100 align-center text-left b-300 no-border')
            .append(type);
          tr.append(key);

          const value = $('<td/>')
            .addClass('h-100 align-middle text-left no-border')
            .append(fields[type].hits.join(', '));

          tr.append(value);
        } else if (typeof fields[type].hits[0] === 'object') {
          /* nested fields such as attributes */
          const attrs = fields[type].hits.reduce((a0, c0) => ({
            ...a0,
            ...c0,
          }), {});

          Object.keys(attrs)
            .forEach((attr) => {
              const tr = $('<tr/>');
              tbody.append(tr);

              const key = $('<td/>')
                .addClass('h-100 align-center text-left b-300 no-border')
                .append(`${type}.${attr}`);
              tr.append(key);

              const value = $('<td/>')
                .addClass('h-100 align-middle text-left no-border')
                .append(attrs[attr]);

              tr.append(value);
            });
        }
      }
    });

    return container;
  }

  makeTableRowItemTextract(data, title) {
    if (!data || !data.hits || data.hits.length === 0) {
      return undefined;
    }

    const hits = data.hits;
    if (hits.length > 1) {
      hits.sort((a, b) =>
        a.page - b.page);
    }

    const container = $('<tr/>');

    const tdTitle = $('<td/>')
      .addClass('h-100 align-center text-left lead-s')
      .append(title);
    container.append(tdTitle);

    const tdPages = $('<td/>')
      .addClass('h-100 align-middle text-left');
    container.append(tdPages);

    const pages = hits.map((x) => {
      const pageNum = x.page;
      const name = `${x.name} (Pg. ${pageNum})`;

      const page = $('<button/>')
        .addClass('btn btn-sm btn-primary mb-1 ml-1')
        .attr('type', 'button')
        .attr('data-toggle', 'button')
        .attr('aria-pressed', false)
        .attr('autocomplete', 'off')
        .append(name)
        .tooltip({
          trigger: 'hover',
        });

      page.on('click', async (event) => {
        event.stopPropagation();
        await this.previewComponent.slideTo(pageNum);
      });

      return page;
    });
    tdPages.append(pages);

    return container;
  }
}
