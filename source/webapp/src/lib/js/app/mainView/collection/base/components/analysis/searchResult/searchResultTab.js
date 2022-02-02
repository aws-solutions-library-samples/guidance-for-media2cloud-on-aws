// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../shared/localization.js';
import AppUtils from '../../../../../../shared/appUtils.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';
import AnalysisTypes from '../../../../../../shared/analysis/analysisTypes.js';
import ApiHelper from '../../../../../../shared/apiHelper.js';

const COL_TAB = 'col-11';
const INDEX_INGEST = 'ingest';

export default class SearchResultTab extends BaseAnalysisTab {
  constructor(previewComponent, defaultTab = false) {
    super(Localization.Messages.SearchResultTab, previewComponent, defaultTab);
  }

  async createContent() {
    const col = $('<div/>').addClass(`${COL_TAB} my-4 max-h36r`);
    setTimeout(async () => {
      this.loading(true);
      await this.refreshSearchResults(col);
      return this.loading(false);
    }, 10);
    return col;
  }

  async refreshSearchResults(container) {
    container.children().remove();
    const searchResults = this.previewComponent.searchResults;
    if ((searchResults || {}.indices || []).length === 0) {
      return container.append($('<span/>').addClass('lead')
        .append(Localization.Messages.NoData));
    }
    const table = $('<table/>').addClass('table lead-xs');
    const headers = [
      Localization.Messages.Category,
      Localization.Messages.SearchResultDesc,
    ].map((x) =>
      $('<th/>').addClass('align-middle text-left b-300')
        .attr('scope', 'col')
        .append(x));
    headers[0].addClass('col-2');
    table.append($('<thead/>')
      .append($('<tr/>').append(headers)));
    const tbody = $('<tbody/>');
    table.append(tbody);

    /* search in document */
    const indices = searchResults.indices.filter((x) =>
      x !== INDEX_INGEST)
      .reduce((a0, c0) => ({
        ...a0,
        [c0]: true,
      }), {});
    const uuid = this.previewComponent.media.uuid;
    const results = await ApiHelper.searchInDocument(uuid, {
      ...indices,
      query: searchResults.query,
      exact: searchResults.exact,
    }).then((res) => res.indices)
      .catch((e) => undefined);
    if (!results) {
      return container.append($('<span/>').addClass('lead')
        .append(Localization.Messages.SearchQueryFailed));
    }

    /* known faces */
    const knownFaces = this.makeTableRowItem([
      AnalysisTypes.Rekognition.Celeb,
      AnalysisTypes.Rekognition.FaceMatch,
    ], results, Localization.Messages.KnownFaces);
    tbody.append(knownFaces);
    /* labels / moderation */
    const labelModerations = this.makeTableRowItem([
      AnalysisTypes.Rekognition.Label,
      AnalysisTypes.Rekognition.CustomLabel,
      AnalysisTypes.Rekognition.Moderation,
    ], results, Localization.Messages.LabelsModeration);
    tbody.append(labelModerations);
    /* transcribe / phrases / entities */
    const phrases = this.makeTableRowItemSpeechText([
      AnalysisTypes.Transcribe,
      AnalysisTypes.Comprehend.Keyphrase,
      AnalysisTypes.Comprehend.Entity,
      AnalysisTypes.Comprehend.CustomEntity,
    ], results, Localization.Messages.TranscriptPhrasesEntities);
    tbody.append(phrases);
    /* visual text */
    const texts = this.makeTableRowItem([
      AnalysisTypes.Rekognition.Text,
    ], results, Localization.Messages.VisualText);
    tbody.append(texts);
    /* textract */
    const textract = this.makeTableRowItemTextract(
      results[AnalysisTypes.Textract],
      Localization.Messages.VisualText
    );
    tbody.append(textract);
    /* content attribute */
    if (searchResults.indices.indexOf(INDEX_INGEST) >= 0) {
      const data = {
        basename: this.previewComponent.media.basename,
        ...this.previewComponent.media.attributes,
      };
      const attributes = this.makeTableRowItemContentMetadata(
        data,
        Localization.Messages.ContentAttributes
      );
      tbody.append(attributes);
    }

    container.append(table);
    return container;
  }

  makeTableRowItem(categories, searchResults, title) {
    const merged = this.mergeResults(categories, searchResults);
    if (!merged.results.length) {
      return undefined;
    }
    if (!merged.timecodeBased) {
      return this.makeTableRowItemNoTimecode(merged, title);
    }
    const content = merged.results.map((x) => {
      const track = this.registerTimecodeTrack(x);
      const section = $('<section/>')
        .addClass('mb-2');
      const toggle = this.makeTrackToggle(track.label);
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

  makeTrackToggle(name) {
    const id = `toggle-${AppUtils.randomHexstring()}`;
    const input = $('<input/>').addClass('custom-control-input')
      .attr('type', 'checkbox')
      .attr('id', id);
    const label = $('<label/>').addClass('custom-control-label lead-xs b-300')
      .attr('for', id)
      .append(name);
    const toggle = $('<div/>').addClass('custom-control custom-switch mr-2 mb-2')
      .append(input)
      .append(label);
    input.off('click').on('click', async () => {
      const checked = input.prop('checked');
      this.previewComponent.trackToggle(name, checked);
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

  mergeResults(categories, searchResults) {
    const matched = {};
    let containTimecodes = false;
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const keys = Object.keys(searchResults[category] || {});
      while (keys.length) {
        const key = keys.shift();
        if (!matched[key]) {
          matched[key] = {};
        }
        const timecodes = searchResults[category][key].timecodes;
        if (timecodes) {
          matched[key].timecodes = [
            ...(matched[key].timecodes || []),
            ...timecodes,
          ];
          containTimecodes = true;
        }
      }
    }
    return {
      timecodeBased: containTimecodes,
      results: Object.keys(matched).map((x) => ({
        name: x,
        timecodes: this.mergeTimecodes(matched[x].timecodes),
      })),
    };
  }

  mergeTimecodes(timecodes) {
    if (!timecodes) {
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

  makeTableRowItemContentMetadata(data, title) {
    const table = $('<table/>').addClass('lead-xs')
      .attr('cellspacing', 0)
      .attr('cellpadding', 0);
    const tbody = $('<tbody/>');
    table.append(tbody);
    const attrs = Object.keys(data).map((x) => {
      const name = AppUtils.capitalize(x);
      const text = data[x];
      return $('<tr/>')
        .append($('<td/>').addClass('h-100 align-center text-left b-300 no-border')
          .append(name))
        .append($('<td/>').addClass('h-100 align-middle text-left no-border')
          .append(text));
    });
    tbody.append(attrs);
    const tr = $('<tr/>')
      .append($('<td/>').addClass('h-100 align-center text-left lead-s')
        .append(title))
      .append($('<td/>').addClass('h-100 align-middle text-left')
        .append(table));
    return tr;
  }

  makeTableRowItemTextract(data, title) {
    if (!data) {
      return undefined;
    }
    const keys = Object.keys(data);
    let merged = [];
    while (keys.length) {
      const key = keys.shift();
      while (data[key].pages.length) {
        const page = data[key].pages.shift();
        merged.push({
          name: key,
          page,
        });
      }
    }
    merged = merged.sort((a, b) =>
      a.page - b.page);
    const btns = merged.map((x) => {
      const pageNum = x.page;
      const name = `${x.name} (Pg. ${pageNum})`;
      const btn = $('<button/>').addClass('btn btn-sm btn-primary mb-1 ml-1')
        .attr('type', 'button')
        .attr('data-toggle', 'button')
        .attr('aria-pressed', false)
        .attr('autocomplete', 'off')
        .append(name)
        .tooltip({
          trigger: 'hover',
        });
      btn.off('click').on('click', async (event) => {
        event.stopPropagation();
        await this.previewComponent.slideTo(pageNum);
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
}
