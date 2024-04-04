// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import AnalysisTypes from '../../../shared/analysis/analysisTypes.js';
import Localization from '../../../shared/localization.js';
import MediaTypes from '../../../shared/media/mediaTypes.js';
import AppUtils from '../../../shared/appUtils.js';
import ApiHelper from '../../../shared/apiHelper.js';
import {
  GetMediaManager,
} from '../../../shared/media/mediaManager.js';
import {
  GetSettingStore,
} from '../../../shared/localCache/index.js';
import ObserverHelper from '../../../shared/observerHelper.js';
import KnowledgeGraph from '../base/components/analysis/base/knowledgeGraph.js';
import CategorySlideEvents from '../base/categorySlideComponentEvents.js';
import BaseSlideComponent from '../../../shared/baseSlideComponent.js';

const {
  GraphDefs: {
    Vertices,
  },
  Statuses,
} = SolutionManifest;

const {
  Messages: {
    CollectionTab: COLLECTION_TAB,
    SearchTab: SEARCH_TAB,
    VideoTab: VIDEO_TAB,
    PhotoTab: PHOTO_TAB,
    PodcastTab: PODCAST_TAB,
    DocumentTab: DOCUMENT_TAB,
    Search: MSG_SEARCH_PLACEHOLDER,
    SearchDesc: MSG_SEARCH_DESC,
    PageSize10: MSG_OPTION_PAGESIZE_10,
    PageSize30: MSG_OPTION_PAGESIZE_30,
    PageSize50: MSG_OPTION_PAGESIZE_50,
    SearchResultDesc: MSG_SEARCH_RESULT_DESC,
    NoData: MSG_NO_DATA,
    More: MSG_MORE,
    SearchExampleSyntax: MSG_SEARCH_EXAMPLE_SYNTAX,
    SearchExampleSyntaxDesc: MSG_SEARCH_EXAMPLE_SYNTAX_DESC,
    SearchExample1: MSG_SEARCH_EXAMPLE_1,
    SearchExample1Desc: MSG_SEARCH_EXAMPLE_1_DESC,
    SearchExample2: MSG_SEARCH_EXAMPLE_2,
    SearchExample2Desc: MSG_SEARCH_EXAMPLE_2_DESC,
    SearchExample3: MSG_SEARCH_EXAMPLE_3,
    SearchExample3Desc: MSG_SEARCH_EXAMPLE_3_DESC,
    SearchExample4: MSG_SEARCH_EXAMPLE_4,
    SearchExample4Desc: MSG_SEARCH_EXAMPLE_4_DESC,
    SearchExample5: MSG_SEARCH_EXAMPLE_5,
    SearchExample5Desc: MSG_SEARCH_EXAMPLE_5_DESC,
    Name: TH_NAME,
    KnownFaces: TH_KNOWN_FACES,
    LabelsModeration: TH_LABEL_MODERATION,
    TranscriptPhrasesEntities: TH_TRANSCRIPT_PHRASE_ENTITIES,
    VisualText: TH_VISUAL_TEXT,
    ContentAttributes: TH_CONTENT_ATTRIBS,
    Submit: BTN_SUBMIT,
    NoMoreData: BTN_NO_MORE,
    LoadMore: BTN_LOAD_MORE,
    KGViewConnections: MSG_VIEW_CONNECTIONS,
  },
  Alerts: {
    InvalidSearchTerm: ERR_INVALID_SEARCH_TERM,
  },
  RegularExpressions: {
    CharacterSetForSearch,
  },
} = Localization;

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

const RANDOM_ID = AppUtils.randomHexstring();
const ID_SEARCHRESULT_LIST = `results-list-${RANDOM_ID}`;
const ID_SEARCHRESULT_CONTAINER = `results-container-${RANDOM_ID}`;
const KEY_SEARCHOPTIONS = 'search-options';
const OPTKEY_QUERY = 'query';
const OPTKEY_PAGESIZE = 'pageSize';
const OPTVAL_PAGESIZE10 = 10;
const OPTVAL_PAGESIZE30 = 30;
const OPTVAL_PAGESIZE50 = 50;
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
const DEFAULT_OPTIONS = {
  [MediaTypes.Video]: true,
  [MediaTypes.Photo]: true,
  [MediaTypes.Podcast]: true,
  [MediaTypes.Document]: true,
  [OPTKEY_PAGESIZE]: OPTVAL_PAGESIZE10,
  [OPTKEY_QUERY]: undefined,
};
const DATA_UUID = 'data-uuid';
const NUM_SEARCH_ITEM_SHOW = 2;

export default class SearchCategorySlideComponent extends BaseSlideComponent {
  constructor() {
    super();
    this.$searchOptions = {};
    this.$mediaManager = GetMediaManager();
    this.$settingStore = GetSettingStore();
    this.$knowledgeGraph = undefined;
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

  get knowledgeGraph() {
    return this.$knowledgeGraph;
  }

  set knowledgeGraph(val) {
    this.$knowledgeGraph = val;
  }

  async show() {
    if (!this.initialized) {
      await this.loadSettings();

      const container = $('<div/>')
        .addClass('row no-gutters');
      this.slide.append(container);

      /* description */
      const descContainer = $('<div/>')
        .addClass('col-9 p-0 mx-auto mt-4');
      container.append(descContainer);

      const desc = this.createDescription();
      descContainer.append(desc);

      /* search examples */
      const exampleContainer = $('<div/>')
        .addClass('col-9 p-0 mx-auto mb-2');
      container.append(exampleContainer);

      const examples = this.createSearchExamples();
      exampleContainer.append(examples);

      /* search form */
      const formContainer = $('<div/>')
        .addClass('col-9 p-0 mx-auto');
      container.append(formContainer);

      const form = this.createCriteriaForm();
      formContainer.append(form);

      /* search result table */
      const resultContainer = $('<div/>')
        .addClass('col-12 p-0 mx-auto mt-4')
        .addClass('bg-light');
      container.append(resultContainer);

      const results = this.createSearchResults();
      resultContainer.append(results);

      /* knowledge graph */
      if (KnowledgeGraph.canSupport()) {
        const graphContainer = $('<div/>')
          .addClass('col-12 p-0 mx-auto mt-4')
          .addClass('bg-white');
        container.append(graphContainer);

        const graph = this.createGraph();
        graphContainer.append(graph);
      }

      container.ready(() => {
        const hashtag = [
          COLLECTION_TAB,
          SEARCH_TAB,
        ].join('/');

        ObserverHelper.setHashOnVisible(
          container,
          hashtag
        );
      });
    }

    return super.show();
  }

  createDescription() {
    return $('<p/>')
      .addClass('lead')
      .html(MSG_SEARCH_DESC);
  }

  createCriteriaForm() {
    const form = $('<form/>')
      .addClass('col-12 px-0 form-inline needs-validation')
      .attr('novalidate', 'novalidate')
      .attr('role', 'form');

    /* media types */
    const mediaGroup = $('<div/>')
      .addClass('form-group col-12 p-0 mt-2');
    form.append(mediaGroup);

    const mediaTypes = this.createMediaTypeCheckboxes();
    mediaGroup.append(mediaTypes);

    /* search input */
    const inputGroup = $('<div/>')
      .addClass('form-group col-12 p-0 mt-2');
    form.append(inputGroup);

    const input = this.createSearchInput(form);
    inputGroup.append(input);

    const submit = this.createSubmitButton(form);
    inputGroup.append(submit);

    const pageSize = this.createPageSizeSelection();
    inputGroup.append(pageSize);

    return form;
  }

  createMediaTypeCheckboxes() {
    return [
      [
        MediaTypes.Video,
        VIDEO_TAB,
      ],
      [
        MediaTypes.Photo,
        PHOTO_TAB,
      ],
      [
        MediaTypes.Podcast,
        PODCAST_TAB,
      ],
      [
        MediaTypes.Document,
        DOCUMENT_TAB,
      ],
    ].map((item) =>
      this.createCheckbox(...item));
  }

  createSearchInput(form) {
    const input = $('<input/>')
      .addClass('form-control mr-2 col-6')
      .attr('type', 'search')
      .attr('pattern', CharacterSetForSearch)
      .attr('placeholder', MSG_SEARCH_PLACEHOLDER);

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
    const submit = $('<button/>')
      .addClass('btn btn-outline-success my-2')
      .attr('type', 'submit')
      .append(BTN_SUBMIT);

    submit.on('click', async (event) => {
      event.preventDefault();
      if (!this.validateForm(event, form)) {
        this.shake(form);
        await this.showAlert(ERR_INVALID_SEARCH_TERM);
        const input = submit.siblings('input[type="search"]');
        input.focus();
        return false;
      }
      if (!this.searchOptions[OPTKEY_QUERY]) {
        return false;
      }

      this.resetSearchResults();
      this.resetGraphResults();

      await Promise.all([
        this.saveSettings(this.searchOptions),
        this.startSearch(this.searchOptions),
      ]);

      return false;
    });
    return submit;
  }

  createPageSizeSelection() {
    const id = `select-${AppUtils.randomHexstring()}`;
    const select = $('<select/>')
      .addClass('custom-select mx-2')
      .attr('id', id);

    select.on('change', (event) => {
      this.searchOptions[OPTKEY_PAGESIZE] = Number(select.val());
      return true;
    });

    const options = [
      [
        OPTVAL_PAGESIZE10,
        MSG_OPTION_PAGESIZE_10,
      ],
      [
        OPTVAL_PAGESIZE30,
        MSG_OPTION_PAGESIZE_30,
      ],
      [
        OPTVAL_PAGESIZE50,
        MSG_OPTION_PAGESIZE_50,
      ],
    ].map((x) => {
      const option = $('<option/>')
        .attr('value', x[0])
        .html(x[1]);
      if (x[0] === this.searchOptions[OPTKEY_PAGESIZE]) {
        option.attr('selected', 'selected');
      }
      return option;
    });
    select.append(options);

    return select;
  }

  createCheckbox(name, label) {
    const container = $('<div/>')
      .addClass('form-check form-check-inline mr-2');

    const options = Array.isArray(name)
      ? name
      : [name];

    const defaultChecked = options
      .reduce((a0, c0) =>
        (a0 || this.searchOptions[c0]), false);

    const id = `checkbox-${AppUtils.randomHexstring()}`;
    const input = $('<input/>')
      .addClass('form-check-input')
      .attr('type', 'checkbox')
      .attr('id', id)
      .attr('value', options.join(','))
      .prop('checked', defaultChecked);

    input.on('click', (event) => {
      const checked = input.is(':checked');
      options.forEach((x) =>
        this.searchOptions[x] = checked);
      return true;
    });
    container.append(input);

    const labelContainer = $('<label/>')
      .addClass('form-check-label mx-1')
      .attr('for', id);
    container.append(labelContainer);
    labelContainer.append(label);

    return container;
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
    const container = $('<div/>')
      .addClass('col-12 p-0 m-0 pb-4')
      .attr('id', ID_SEARCHRESULT_CONTAINER);

    /* description */
    const descSection = $('<div/>')
      .addClass('col-11 p-0 mx-auto mt-4');
    container.append(descSection);

    const desc = $('<p/>')
      .addClass('lead')
      .html(MSG_SEARCH_RESULT_DESC);
    descSection.append(desc);

    /* show no result message */
    const messageContainer = $('<div/>')
      .addClass('col-12');
    descSection.append(messageContainer);

    const message = $('<p/>')
      .addClass('lead text-center text-muted my-4')
      .addClass('search-result-warning')
      .addClass('collapse')
      .append(MSG_NO_DATA);
    messageContainer.append(message);

    /* search result table */
    const tableSection = $('<div/>')
      .addClass('col-11 p-0 mx-auto mt-4');
    container.append(tableSection);

    const table = $('<table/>')
      .addClass('table table-hover lead-xs');
    tableSection.append(table);

    const headers = this.makeSearchResultTableHeaders();
    table.append($('<thead/>')
      .append(headers));

    table.append($('<tbody/>')
      .attr('id', ID_SEARCHRESULT_LIST));

    /* controls */
    const controlsSection = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(controlsSection);

    const form = $('<form/>')
      .addClass('form-inline collapse');
    controlsSection.append(form);

    form.submit((event) =>
      event.preventDefault());

    const btnContainer = $('<div/>')
      .addClass('mx-auto');
    form.append(btnContainer);

    const moreBtn = $('<button/>')
      .addClass('btn btn-outline-dark')
      .addClass('scan-more-results')
      .data('hits', 0)
      .data('nexttoken', 0)
      .html(BTN_LOAD_MORE);
    btnContainer.append(moreBtn);

    moreBtn.on('click', async () =>
      this.scanMoreResults(moreBtn));

    return container;
  }

  makeSearchResultTableHeaders() {
    const tr = $('<tr/>');

    const headers = [
      '#',
      TH_NAME,
      TH_KNOWN_FACES,
      TH_LABEL_MODERATION,
      TH_TRANSCRIPT_PHRASE_ENTITIES,
      TH_VISUAL_TEXT,
      TH_CONTENT_ATTRIBS,
    ].map((x) =>
      $('<th/>')
        .addClass('align-middle text-center b-300')
        .attr('scope', 'col')
        .append(x));
    tr.append(headers);

    return tr;
  }

  searchResultContainer() {
    return this.slide.find(`#${ID_SEARCHRESULT_CONTAINER}`);
  }

  async refreshSearchResults(results) {
    const container = this.searchResultContainer();

    container.find('.search-result-warning')
      .addClass('collapse');

    const list = container.find(`#${ID_SEARCHRESULT_LIST}`);

    const hits = results.hits.length;

    for (let i = 0; i < hits; i += 1) {
      const hit = results.hits[i];
      const uuid = hit.id;

      let item = list.find(`tr[${DATA_UUID}="${uuid}"]`);
      if (item.length > 0) {
        continue;
      }

      let media = this.mediaManager.findMediaByUuid(uuid);
      if (!media) {
        media = await this.mediaManager.insertMedia({
          uuid,
        });
      }

      if (!media || media.overallStatus !== Statuses.Completed) {
        continue;
      }

      item = this.createMediaListItem(media, hit);
      list.append(item);
    }

    return this.refreshLoadButton(
      hits,
      results.totalHits,
      results.nextToken
    );
  }

  createMediaListItem(media, hit) {
    const container = $('<tr/>')
      .attr(DATA_UUID, media.uuid);

    const thumbnail = this.createThumbnail(media);
    container.append(thumbnail);

    const basename = AppUtils.shorten(media.basename, 24);
    const name = this.makeTableRowItem(basename);
    name.attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', media.basename)
      .tooltip({
        trigger: 'hover',
      });
    container.append(name);

    const knownFaces = this.makeTableRowItemByIndexTypes([
      Celeb,
      FaceMatch,
    ], hit.fields);
    container.append(knownFaces);

    const labels = this.makeTableRowItemByIndexTypes([
      Label,
      CustomLabel,
      Moderation,
    ], hit.fields);
    container.append(labels);

    const phrases = this.makeTableRowItemByIndexTypes([
      Transcribe,
      Keyphrase,
      Entity,
      CustomEntity,
    ], hit.fields);
    container.append(phrases);

    const texts = this.makeTableRowItemByIndexTypes([
      Text,
      Textract,
    ], hit.fields);
    container.append(texts);

    const contentMetadata = this.makeTableRowItemContentMetadata(hit.fields);
    container.append(contentMetadata);

    container.on('click', (event) => {
      event.preventDefault();

      return this.slide.trigger(CategorySlideEvents.Media.Selected, [media, hit]);
    });

    return container;
  }

  makeTableRowItemByIndexTypes(types, fields) {
    let highlights = types
      .map((type) =>
        (fields[type] || {}).highlights || [])
      .flat(1)
      .filter((x) =>
        x);

    highlights = [
      ...new Set(highlights),
    ];

    const badges = highlights
      .slice(0, NUM_SEARCH_ITEM_SHOW)
      .map((x) => {
        const badge = $('<span/>')
          .addClass('badge badge-pill badge-secondary mr-1 mb-1 lead-xxs p-2')
          .html(x);
        return badge;
      });

    const num = highlights.length - NUM_SEARCH_ITEM_SHOW;
    if (num > 0) {
      const more = $('<span/>')
        .addClass('badge badge-pill badge-light mr-1 mb-1 lead-xxs p-2')
        .append(`${num} ${MSG_MORE.toLowerCase()}`);

      const tooltips = highlights.slice(2)
        .join('<br/>');

      more.attr('data-toggle', 'tooltip')
        .attr('data-placement', 'bottom')
        .attr('data-html', 'true')
        .attr('title', tooltips)
        .tooltip({
          trigger: 'hover',
        });

      badges.push(more);
    }

    return this.makeTableRowItem(badges);
  }

  makeTableRowItem(name) {
    const td = $('<td/>')
      .addClass('w-96min align-middle text-center b-300');

    if (name && name.length) {
      td.append(name);
    } else {
      td.append('-');
    }

    return td;
  }

  makeTableRowItemContentMetadata(fields) {
    let highlights = Object.keys(fields)
      .map((field) => {
        if (ANALYSIS_FIELDS.includes(field)) {
          return [];
        }
        return fields[field].highlights || [];
      })
      .flat(1)
      .filter((x) =>
        x);

    highlights = [
      ...new Set(highlights),
    ];

    const badges = highlights
      .slice(0, NUM_SEARCH_ITEM_SHOW)
      .map((x) => {
        const badge = $('<span/>')
          .addClass('badge badge-pill badge-secondary mr-1 mb-1 lead-xxs p-2')
          .html(x);
        return badge;
      });

    const num = highlights.length - NUM_SEARCH_ITEM_SHOW;
    if (num > 0) {
      const more = $('<span/>')
        .addClass('badge badge-pill badge-light mr-1 mb-1 lead-xxs p-2')
        .append(`${num} ${MSG_MORE.toLowerCase()}`);

      const tooltips = highlights.slice(2)
        .join('<br/>');

      more.attr('data-toggle', 'tooltip')
        .attr('data-placement', 'bottom')
        .attr('data-html', 'true')
        .attr('title', tooltips)
        .tooltip({
          trigger: 'hover',
        });

      badges.push(more);
    }

    return this.makeTableRowItem(badges);
  }

  createThumbnail(media) {
    const container = $('<td/>')
      .addClass('align-middle text-center bg-light p-0 m-0');

    const overlayContainer = $('<div/>')
      .addClass('overlay-container');
    container.append(overlayContainer);

    const image = $('<img/>')
      .addClass('search-thumbnail');
    overlayContainer.append(image);

    let bgColor = 'bg-dark';
    if (media.type === MediaTypes.Video) {
      bgColor = 'bg-success';
    } else if (media.type === MediaTypes.Podcast) {
      bgColor = 'bg-primary';
    } else if (media.type === MediaTypes.Photo) {
      bgColor = 'bg-secondary';
    } else if (media.type === MediaTypes.Document) {
      bgColor = 'bg-warning';
    }

    const textContainer = $('<div/>')
      .addClass('abs justify-content-end');
    overlayContainer.append(textContainer);

    const text = $('<div/>')
      .addClass('lead-xxs text-white b-300 px-2')
      .addClass(bgColor)
      .append(media.type);
    textContainer.append(text);

    image.ready(async () => {
      const src = await media.getThumbnail();
      image.attr('src', src);
    });

    return container;
  }

  refreshLoadButton(
    hits,
    totalHits,
    nextToken
  ) {
    const container = this.searchResultContainer();
    const form = container.find('form');
    form.removeClass('collapse');

    const btn = form.find('button');
    btn.data('nexttoken', nextToken);

    const prev = btn.data('hits');
    btn.data('hits', prev + hits);

    if (nextToken === totalHits) {
      btn.addClass('disabled')
        .attr('disabled', 'disabled')
        .html(BTN_NO_MORE);
    } else {
      btn.removeClass('disabled')
        .removeAttr('disabled')
        .html(BTN_LOAD_MORE);
    }

    return btn;
  }

  resetSearchResults() {
    const container = this.searchResultContainer();

    container.find(`#${ID_SEARCHRESULT_LIST}`)
      .children()
      .remove();

    const form = container.find('form');
    form.addClass('collapse');

    const button = form.find('.scan-more-results');
    button.data('hits', 0);
    button.data('nexttoken', 0);

    return container;
  }

  async scanMoreResults(btn) {
    const token = btn.data('nexttoken');
    if (this.searchOptions[OPTKEY_QUERY] && token) {
      await this.startSearch({
        ...this.searchOptions,
        token: Number(token),
      });
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
    try {
      this.loading(true);
      /* base64 w/ encodeURIComponent to support unicode, parenthesis characters */
      const term = window.btoa(encodeURIComponent(options[OPTKEY_QUERY]));
      const response = await ApiHelper.search({
        ...options,
        [OPTKEY_QUERY]: term,
      });

      if (response.totalHits === 0) {
        this.displayNoResults();
        return;
      }

      if ((response.hits || []).length === 0) {
        return;
      }

      if (response.hits.length > 1) {
        response.hits
          .sort((a, b) =>
            b.score - a.score);
      }

      await Promise.all([
        this.refreshSearchResults(response),
        this.refreshGraphResults(response),
      ]);
    } catch (e) {
      console.error(e);
      this.displaySearchError(e);
    } finally {
      this.loading(false);
    }
  }

  displayNoResults() {
    const container = this.searchResultContainer();
    container.find('.search-result-warning')
      .removeClass('text-danger collapse')
      .addClass('text-muted')
      .text(MSG_NO_DATA);
    return undefined;
  }

  displaySearchError(e) {
    const container = this.searchResultContainer();
    container.find('.search-result-warning')
      .removeClass('text-muted collapse')
      .addClass('text-danger')
      .text(e.message);
    return undefined;
  }

  createSearchExamples() {
    const details = $('<details/>');

    const summary = $('<summary/>')
      .addClass('my-3');
    details.append(summary);

    const title = $('<span/>')
      .addClass('lead ml-2')
      .html(MSG_SEARCH_EXAMPLE_SYNTAX);
    summary.append(title);

    const desc = $('<p/>')
      .addClass('lead-s')
      .append(MSG_SEARCH_EXAMPLE_SYNTAX_DESC);
    details.append(desc);

    const examples = [
      [
        MSG_SEARCH_EXAMPLE_1,
        MSG_SEARCH_EXAMPLE_1_DESC,
      ],
      [
        MSG_SEARCH_EXAMPLE_2,
        MSG_SEARCH_EXAMPLE_2_DESC,
      ],
      [
        MSG_SEARCH_EXAMPLE_3,
        MSG_SEARCH_EXAMPLE_3_DESC,
      ],
      [
        MSG_SEARCH_EXAMPLE_4,
        MSG_SEARCH_EXAMPLE_4_DESC,
      ],
      [
        MSG_SEARCH_EXAMPLE_5,
        MSG_SEARCH_EXAMPLE_5_DESC,
      ],
    ].map((example) => {
      const exampleTitle = $('<p/>')
        .addClass('lead-s font-weight-bold my-2')
        .append(example[0]);
      const exampleDesc = $('<span/>')
        .addClass('lead-s font-italic d-block mb-4')
        .append(example[1]);
      return [
        exampleTitle,
        exampleDesc,
      ];
    }).flat(1);
    details.append(examples);

    return details;
  }

  createGraph() {
    const elements = [];

    const details = $('<details/>')
      .addClass('col-11 m-0 p-0 mt-4 mx-auto');
    elements.push(details);

    const summary = $('<summary/>')
      .addClass('my-3');
    details.append(summary);

    const graphTitle = $('<span/>')
      .addClass('lead')
      .html(MSG_VIEW_CONNECTIONS);
    summary.append(graphTitle);

    const graphContainer = $('<div/>')
      .addClass('col-11 m-0 p-0 mx-auto')
      .addClass('mt-4')
      .addClass('collapse');
    elements.push(graphContainer);

    graphContainer.ready(async () => {
      const w = Math.floor(graphContainer.width() / 2) * 2;
      let h = $(window).height() * 0.7;
      h = Math.floor(h / 2) * 2;
      h = Math.max(h, 600);
      console.log('graphContainer.ready', w, h);

      await this.renderKnowledgeGraph(graphContainer, w, h);
    });

    details.on('click', async () => {
      const wasOpen = details.prop('open');
      if (wasOpen) {
        graphContainer.addClass('collapse');
      } else {
        graphContainer.removeClass('collapse');
      }
    });

    return elements;
  }

  async renderKnowledgeGraph(graphContainer, w, h) {
    try {
      if (graphContainer.data('rendered') === true) {
        return;
      }

      this.loading(true);

      const container = this.searchResultContainer();
      const searchList = container.find(`#${ID_SEARCHRESULT_LIST}`);

      const uuids = [];
      searchList
        .find(`tr[${DATA_UUID}]`)
        .each((_, item) => {
          uuids.push($(item).data('uuid'));
        });

      let vertices = [];
      if (uuids.length > 0) {
        vertices = await KnowledgeGraph.queryVertices(uuids);
      }
      console.log('vertices', vertices);

      /* render graph */
      /*
      if (this.knowledgeGraph !== undefined) {
        this.knowledgeGraph.destroy();
      }
      */

      const options = {
        dataset: vertices,
        deselectLegends: [Vertices.Checksum],
        dimension: [w, h],
        dblclickFn: this.onGraphDoubleClickEvent.bind(this),
      };

      this.knowledgeGraph = new KnowledgeGraph(
        graphContainer,
        undefined,
        options
      );
    } catch (e) {
      console.error(e);
    } finally {
      graphContainer.data('rendered', true);
      this.loading(false);
    }
  }

  async refreshGraphResults(results) {
    if (!this.knowledgeGraph) {
      return;
    }

    const ids = results.hits
      .map((x) =>
        x.id);

    const graphOptions = this.knowledgeGraph.getGraphOption();
    const currentIds = graphOptions.series[0].data
      .filter((x) =>
        x.name === Vertices.Asset)
      .map((x) =>
        x.value[0].id);
    while (currentIds.length) {
      const currentId = currentIds.pop();
      const idx = ids.find((x) =>
        x === currentId);
      if (idx >= 0) {
        ids.splice(idx, 1);
      }
    }

    if (ids.length === 0) {
      return;
    }

    const dataset = await KnowledgeGraph.queryVertices(ids);
    await this.knowledgeGraph.updateGraph(dataset);
  }

  resetGraphResults() {
    if (!this.knowledgeGraph) {
      return;
    }
    this.knowledgeGraph.resetGraph();
  }

  async onGraphDoubleClickEvent(event) {
    const from = event.data.value[0];
    if (event.name !== Vertices.Asset || from.querypaths === true) {
      await this.knowledgeGraph.onGraphDoubleClickEvent(event);
      return;
    }

    try {
      /* signal to skip query paths */
      from.querypaths = true;

      this.loading(true);

      const to = [];

      const graphOptions = this.knowledgeGraph.getGraphOption();
      graphOptions.series[0].data
        .forEach((x) => {
          if (x.name === Vertices.Asset && x.value[0].id !== from.id) {
            to.push(x.value[0].id);
          }
        });

      if (!to.length) {
        return;
      }

      const dataset = await KnowledgeGraph.queryPaths(
        from.id,
        to
      );
      await this.knowledgeGraph.updateGraph(dataset);
    } catch (e) {
      console.error(e);
    } finally {
      this.loading(false);
    }
  }
}
