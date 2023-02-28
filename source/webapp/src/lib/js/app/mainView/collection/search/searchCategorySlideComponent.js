// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AnalysisTypes from '../../../shared/analysis/analysisTypes.js';
import Localization from '../../../shared/localization.js';
import MediaTypes from '../../../shared/media/mediaTypes.js';
import AppUtils from '../../../shared/appUtils.js';
import ApiHelper from '../../../shared/apiHelper.js';
import MediaManager from '../../../shared/media/mediaManager.js';
import SettingStore from '../../../shared/localCache/settingStore.js';
import CategorySlideEvents from '../base/categorySlideComponentEvents.js';
import BaseSlideComponent from '../../../shared/baseSlideComponent.js';

const ID_SEARCHRESULT_LIST = `results-list-${AppUtils.randomHexstring()}`;
const ID_SEARCHRESULT_CONTAINER = `results-container-${AppUtils.randomHexstring()}`;
const KEY_SEARCHOPTIONS = 'search-options';
const OPTKEY_EXACT = 'exact';
const OPTKEY_QUERY = 'query';
const OPTKEY_PAGESIZE = 'pageSize';
const OPTVAL_PAGESIZE10 = 10;
const OPTVAL_PAGESIZE30 = 30;
const OPTVAL_PAGESIZE50 = 50;
const INDEX_INGEST = 'ingest';
const DEFAULT_OPTIONS = {
  [MediaTypes.Video]: true,
  [MediaTypes.Photo]: true,
  [MediaTypes.Podcast]: true,
  [MediaTypes.Document]: true,
  [OPTKEY_EXACT]: false,
  [OPTKEY_PAGESIZE]: OPTVAL_PAGESIZE10,
  [OPTKEY_QUERY]: undefined,
  [AnalysisTypes.Transcribe]: true,
  [AnalysisTypes.Rekognition.Celeb]: true,
  [AnalysisTypes.Rekognition.FaceMatch]: true,
  [AnalysisTypes.Rekognition.Label]: true,
  [AnalysisTypes.Rekognition.CustomLabel]: true,
  [AnalysisTypes.Rekognition.Moderation]: true,
  [AnalysisTypes.Rekognition.Text]: true,
  [AnalysisTypes.Textract]: true,
  [AnalysisTypes.Comprehend.Keyphrase]: true,
  [AnalysisTypes.Comprehend.Entity]: true,
  [AnalysisTypes.Comprehend.CustomEntity]: true,
  [INDEX_INGEST]: true,
};
const DATA_UUID = 'data-uuid';
const DATA_SEARCHTOKEN = 'data-token';
/* Reference: https://www.fileformat.info/info/unicode/category/Lu/list.htm */
const UNICODE_CHARACTER_SETS = '[0-9A-Za-z\u0041-\u005A\u0061-\u007A\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC ,.\'’-]{1,}';
const NUM_SEARCH_ITEM_SHOW = 2;

export default class SearchCategorySlideComponent extends BaseSlideComponent {
  constructor() {
    super();
    this.$searchOptions = {};
    this.$mediaManager = MediaManager.getSingleton();
    this.$settingStore = SettingStore.getSingleton();
  }

  get searchOptions() {
    return this.$searchOptions;
  }

  set searchOptions(val) {
    this.$searchOptions = val;
  }

  get mediaManager() {
    return this.$mediaManager;
  }

  get settingStore() {
    return this.$settingStore;
  }

  async show() {
    if (!this.initialized) {
      await this.loadSettings();
      const description = this.createDescription();
      const criteriaForm = this.createCriteriaForm();
      const searchResults = this.createSearchResults();
      const row = $('<div/>').addClass('row no-gutters')
        .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
          .append(description))
        .append($('<div/>').addClass('col-9 p-0 mx-auto')
          .append(criteriaForm))
        .append($('<div/>').addClass('col-12 p-0 mx-auto mt-4 bg-light')
          .append(searchResults))
        .append(this.createLoading());
      this.slide.append(row);
    }
    return super.show();
  }

  createDescription() {
    return $('<p/>').addClass('lead')
      .html(Localization.Messages.SearchDesc);
  }

  createCriteriaForm() {
    const form = $('<form/>').addClass('col-12 px-0 form-inline needs-validation')
      .attr('novalidate', 'novalidate')
      .attr('role', 'form');
    const input = this.createSearchInput(form);
    const submit = this.createSubmitButton(form);
    const pageSize = this.createPageSizeSelection();
    const inputGroup = $('<div/>').addClass('form-group col-12 p-0 mt-2')
      .append(input)
      .append(submit)
      .append(pageSize);
    const mediaTypes = this.createMediaTypeCheckboxes();
    const exact = this.createExactOption();
    const mediaGroup = $('<div/>').addClass('form-group col-12 p-0 mt-2')
      .append(mediaTypes)
      .append(exact);
    const aiOptions = this.createAIOptionCheckboxes();
    const aiGroup = $('<div/>').addClass('form-group col-12 p-0 mt-2')
      .append(aiOptions);
    return form.append(mediaGroup)
      .append(aiGroup)
      .append(inputGroup);
  }

  createMediaTypeCheckboxes() {
    return [
      [
        MediaTypes.Video,
        Localization.Messages.VideoTab,
      ],
      [
        MediaTypes.Photo,
        Localization.Messages.PhotoTab,
      ],
      [
        MediaTypes.Podcast,
        Localization.Messages.PodcastTab,
      ],
      [
        MediaTypes.Document,
        Localization.Messages.DocumentTab,
      ],
    ].map(item => this.createCheckbox(...item));
  }

  createAIOptionCheckboxes() {
    return [
      [
        [
          AnalysisTypes.Rekognition.Celeb,
          AnalysisTypes.Rekognition.FaceMatch,
        ],
        Localization.Messages.KnownFaces,
      ],
      [
        [
          AnalysisTypes.Rekognition.Label,
          AnalysisTypes.Rekognition.CustomLabel,
        ],
        Localization.Messages.Labels,
      ],
      [
        AnalysisTypes.Rekognition.Moderation,
        Localization.Messages.ModerationTab,
      ],
      [
        [
          AnalysisTypes.Rekognition.Text,
          AnalysisTypes.Textract,
        ],
        Localization.Messages.VisualText,
      ],
      [
        AnalysisTypes.Transcribe,
        Localization.Messages.Transcript,
      ],
      [
        AnalysisTypes.Comprehend.Keyphrase,
        Localization.Messages.Keyphrases,
      ],
      [
        [
          AnalysisTypes.Comprehend.Entity,
          AnalysisTypes.Comprehend.CustomEntity,
        ],
        Localization.Messages.Entities,
      ],
      [
        INDEX_INGEST,
        Localization.Messages.ContentAttributes,
      ],
    ].map(item => this.createCheckbox(...item));
  }

  createSearchInput(form) {
    const input = $('<input/>').addClass('form-control mr-2 col-6')
      .attr('type', 'search')
      .attr('pattern', UNICODE_CHARACTER_SETS)
      .attr('placeholder', Localization.Messages.Search);
    input.focusout(async (event) => {
      this.searchOptions[OPTKEY_QUERY] = input.val() || undefined;
      return true;
    });
    input.keypress(async (event) => {
      if (event.which === 13) {
        event.preventDefault();
        this.searchOptions[OPTKEY_QUERY] = input.val() || undefined;
        const btn = input.siblings('button[type="submit"]');
        return btn.trigger('click');
      }
      return true;
    });
    return input;
  }

  createSubmitButton(form) {
    const submit = $('<button/>').addClass('btn btn-outline-success my-2')
      .attr('type', 'submit')
      .append(Localization.Messages.Submit);

    submit.off('click').on('click', async (event) => {
      event.preventDefault();
      if (!this.validateForm(event, form)) {
        this.shake(form);
        await this.showAlert(Localization.Alerts.InvalidGroupName);
        const input = submit.siblings('input[type="search"]');
        input.focus();
        return false;
      }
      if (!this.searchOptions[OPTKEY_QUERY]) {
        return false;
      }
      this.loading(true);
      this.resetSearchResults();
      await this.saveSettings(this.searchOptions);
      await this.startSearch(this.searchOptions);
      this.loading(false);
      return false;
      /* do search here */
    });
    return submit;
  }

  createExactOption() {
    const checkbox = this.createCheckbox(
      OPTKEY_EXACT,
      Localization.Messages.ExactMatch
    );
    checkbox.find('input').addClass('ml-4');
    checkbox.removeClass('mr-4').addClass('mx-2 search-border-l');
    return checkbox;
  }

  createPageSizeSelection() {
    const options = [
      [
        OPTVAL_PAGESIZE10,
        Localization.Messages.PageSize10,
      ],
      [
        OPTVAL_PAGESIZE30,
        Localization.Messages.PageSize30,
      ],
      [
        OPTVAL_PAGESIZE50,
        Localization.Messages.PageSize50,
      ],
    ].map((x) => {
      const option = $('<option/>').attr('value', x[0]).html(x[1]);
      if (x[0] === this.searchOptions[OPTKEY_PAGESIZE]) {
        option.attr('selected', 'selected');
      }
      return option;
    });
    const id = `select-${AppUtils.randomHexstring()}`;
    const select = $('<select/>').addClass('custom-select mx-2')
      .attr('id', id)
      .append(options);
    select.off('change').on('change', (event) => {
      this.searchOptions[OPTKEY_PAGESIZE] = Number.parseInt(select.val(), 10);
      return true;
    });
    return select;
  }

  createCheckbox(name, label) {
    const options = Array.isArray(name)
      ? name
      : [name];
    const defaultChecked = options.reduce((a0, c0) =>
      (a0 || this.searchOptions[c0]), false);
    const id = `checkbox-${AppUtils.randomHexstring()}`;
    const input = $('<input/>').addClass('form-check-input')
      .attr('type', 'checkbox')
      .attr('id', id)
      .attr('value', options.join(','))
      .prop('checked', defaultChecked);
    input.off('click').on('click', (event) => {
      const checked = input.is(':checked');
      options.forEach((x) =>
        this.searchOptions[x] = checked);
      return true;
    });
    return $('<div/>').addClass('form-check form-check-inline mr-2')
      .append(input)
      .append($('<label/>').addClass('form-check-label mx-1')
        .attr('for', id)
        .append(label));
  }

  validateForm(event, form) {
    event.preventDefault();
    if (form[0].checkValidity() === false) {
      event.stopPropagation();
      return false;
    }
    return true;
  }

  createSearchResults() {
    const desc = $('<p/>').addClass('lead')
      .html(Localization.Messages.SearchResultDesc);

    const headers = this.makeSearchResultTableHeaders();
    const table = $('<table/>').addClass('table table-hover lead-xs');
    table.append($('<thead/>')
      .append(headers));
    table.append($('<tbody/>')
      .attr('id', ID_SEARCHRESULT_LIST));

    const moreBtn = $('<button/>').addClass('btn btn-outline-dark')
      .html(Localization.Messages.LoadMore);
    moreBtn.off('click').on('click', async () =>
      this.scanMoreResults(moreBtn));

    const controls = $('<form/>').addClass('form-inline collapse')
      .append($('<div/>').addClass('mx-auto')
        .append(moreBtn));
    controls.submit(event =>
      event.preventDefault());

    return $('<div/>').addClass('col-12 p-0 m-0 pb-4')
      .attr('id', ID_SEARCHRESULT_CONTAINER)
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(desc))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(table))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(controls));
  }

  makeSearchResultTableHeaders() {
    const rows = [
      '#',
      Localization.Messages.FileType,
      Localization.Messages.Name,
      Localization.Messages.KnownFaces,
      Localization.Messages.LabelsModeration,
      Localization.Messages.TranscriptPhrasesEntities,
      Localization.Messages.VisualText,
      Localization.Messages.ContentAttributes,
    ].map((x) =>
      $('<th/>').addClass('align-middle text-center b-300')
        .attr('scope', 'col')
        .append(x));
    return $('<tr/>')
      .append(rows);
  }

  searchResultContainer() {
    return this.slide.find(`#${ID_SEARCHRESULT_CONTAINER}`);
  }

  async refreshSearchResults(results) {
    const container = this.searchResultContainer();
    const list = container.find(`#${ID_SEARCHRESULT_LIST}`);
    if (results && results.hits) {
      while (results.hits.length) {
        const hit = results.hits.shift();
        const uuid = hit.uuid;
        let item = list.find(`tr[${DATA_UUID}="${uuid}"]`);
        if (item.length > 0) {
          continue;
        }
        const media = this.mediaManager.findMediaByUuid(uuid)
          || await this.mediaManager.insertMedia({
            uuid,
          });
        if (!media) {
          continue;
        }
        item = await this.createMediaListItem(media, hit);
        list.append(item);
      }
    }
    return this.refreshLoadButton(results.nextToken);
  }

  async createMediaListItem(media, hit) {
    const tr = $('<tr/>')
      .attr(DATA_UUID, media.uuid);
    tr.off('click').on('click', (event) => {
      event.preventDefault();
      const data = {
        indices: Object.keys(hit.indices),
        query: this.searchOptions[OPTKEY_QUERY],
        exact: this.searchOptions[OPTKEY_EXACT],
      };
      return this.slide.trigger(CategorySlideEvents.Media.Selected, [media, data]);
    });
    const imagePromise = this.createThumbnail(media);
    const type = this.makeTableRowItemByMediaType(media.type);
    const name = this.makeTableRowItem(AppUtils.shorten(media.basename, 34));
    const knownFaces = this.makeTableRowItemByIndexTypes([
      AnalysisTypes.Rekognition.Celeb,
      AnalysisTypes.Rekognition.FaceMatch,
    ], hit.indices);
    const labels = this.makeTableRowItemByIndexTypes([
      AnalysisTypes.Rekognition.Label,
      AnalysisTypes.Rekognition.CustomLabel,
      AnalysisTypes.Rekognition.Moderation,
    ], hit.indices);
    const phrases = this.makeTableRowItemByIndexTypes([
      AnalysisTypes.Transcribe,
      AnalysisTypes.Comprehend.Keyphrase,
      AnalysisTypes.Comprehend.Entity,
      AnalysisTypes.Comprehend.CustomEntity,
    ], hit.indices);
    const texts = this.makeTableRowItemByIndexTypes([
      AnalysisTypes.Rekognition.Text,
      AnalysisTypes.Textract,
    ], hit.indices);
    const metadata = this.makeTableRowItemContentMetadata(hit.indices.ingest);

    return tr
      .append(await imagePromise)
      .append(type)
      .append(name)
      .append(knownFaces)
      .append(labels)
      .append(phrases)
      .append(texts)
      .append(metadata);
  }

  makeTableRowItemByIndexTypes(types, indices) {
    let names = types.map((x) =>
      Object.keys(indices[x] || {})).flat();
    names = [
      ...new Set(names),
    ];
    const badges = names.slice(0, NUM_SEARCH_ITEM_SHOW).map((x) =>
      $('<span/>').addClass('badge badge-pill badge-secondary mr-1 mb-1 lead-xxs p-2 b-300')
        .append(x));
    if (names.length > NUM_SEARCH_ITEM_SHOW) {
      badges.push($('<span/>')
        .addClass('badge badge-pill badge-light mr-1 mb-1 lead-xxs p-2 b-300')
        .append(Localization.Messages.More));
    }
    return this.makeTableRowItem(badges);
  }

  makeTableRowItem(name) {
    const td = $('<td/>')
      .addClass('w-96min align-middle text-center b-300');
    if (name && name.length) {
      return td.append(name);
    }
    const notFound = $('<i/>').addClass('far fa-times-circle lead text-secondary');
    return td.append(notFound);
  }

  makeTableRowItemByMediaType(type) {
    let bkgdColor;
    switch (type) {
      case MediaTypes.Video:
        bkgdColor = 'bg-success';
        break;
      case MediaTypes.Podcast:
        bkgdColor = 'bg-primary';
        break;
      case MediaTypes.Photo:
        bkgdColor = 'bg-secondary';
        break;
      case MediaTypes.Document:
        bkgdColor = 'bg-warning';
        break;
      default:
        bkgdColor = undefined;
    }
    return this.makeTableRowItem(type)
      .addClass(bkgdColor)
      .addClass('text-white');
  }

  makeTableRowItemContentMetadata(metadata) {
    const terms = this.searchOptions[OPTKEY_QUERY].split(' ')
      .map((x) =>
        x.toLowerCase());
    if (!metadata) {
      return this.makeTableRowItem();
    }
    const matched = [
      metadata.basename,
      ...Object.values(metadata.attributes || {}),
    ].filter((x) => {
      for (let term of terms) {
        if (String(x).toLowerCase().indexOf(term) >= 0) {
          return true;
        }
      }
      return false;
    });

    const container = $('<p/>')
      .addClass('p-overflow')
      .append(matched);
    return this.makeTableRowItem(container);
  }

  async createThumbnail(media) {
    const proxy = await media.getThumbnail();
    const td = $('<td/>').addClass('align-middle text-center bg-light p-0 m-0');
    return td.append($('<img/>').addClass('search-thumbnail')
      .attr('src', proxy));
  }

  refreshLoadButton(nextToken) {
    const container = this.searchResultContainer();
    const form = container.find('form');
    form.removeClass('collapse');
    const btn = form.find('button');
    btn.prop(DATA_SEARCHTOKEN, nextToken);
    if (nextToken === undefined) {
      btn.addClass('disabled')
        .attr('disabled', 'disabled')
        .html(Localization.Messages.NoMoreData);
    } else {
      btn.removeClass('disabled')
        .removeAttr('disabled')
        .html(Localization.Messages.LoadMore);
    }
    return btn;
  }

  resetSearchResults() {
    const container = this.searchResultContainer();
    container.find(`#${ID_SEARCHRESULT_LIST}`).children().remove();
    return container.find('form').addClass('collapse');
  }

  async scanMoreResults(btn) {
    const token = btn.prop(DATA_SEARCHTOKEN);
    if (this.searchOptions[OPTKEY_QUERY] && token) {
      this.loading(true);
      await this.startSearch({
        ...this.searchOptions,
        token: Number.parseInt(token, 10),
      });
      this.loading(false);
    }
  }

  async loadSettings() {
    this.searchOptions = (await this.settingStore.getItem(KEY_SEARCHOPTIONS))
      || DEFAULT_OPTIONS;
    return this.searchOptions;
  }

  async saveSettings(searchOptions) {
    const options = {
      ...searchOptions,
    };
    delete options[OPTKEY_QUERY];
    return this.settingStore.putItem(KEY_SEARCHOPTIONS, options);
  }

  async startSearch(options) {
    const response = await ApiHelper.search(options);
    return this.refreshSearchResults(response);
  }
}
