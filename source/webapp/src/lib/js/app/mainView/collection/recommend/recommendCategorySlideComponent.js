// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import AnalysisTypes from '../../../shared/analysis/analysisTypes.js';
import Localization from '../../../shared/localization.js';
import MediaTypes from '../../../shared/media/mediaTypes.js';
import AppUtils from '../../../shared/appUtils.js';
import MediaManager from '../../../shared/media/mediaManager.js';
import SettingStore from '../../../shared/localCache/settingStore.js';
import ImageStore from '../../../shared/localCache/imageStore.js';
import CategorySlideEvents from '../base/categorySlideComponentEvents.js';
import BaseSlideComponent from '../../../shared/baseSlideComponent.js';

const DESC = [
  'Search similar items using Amazon Neptune and <a href="https://aws.amazon.com/neptune/machine-learning/" target="_blank">Amazon Neptune ML</a> that creates embeddings from the graph database. The embeddings are then indexed into an Amazon OpenSearch Service along with the K-nearest neighbors (KNN) plugin.',
  'Or, traverse the knowledge graph to find items based on genre, category, keyword, topic, and so forth.',
].map((x) =>
  `<p>${x}</p>`);
const ID_SIMILARITY_LIST = `similarity-list-${AppUtils.randomHexstring()}`;
const ID_GRAPH = `graph-${AppUtils.randomHexstring()}`;
const ID_RELEVANT_ITEMS = `relevant-items-${AppUtils.randomHexstring()}`;
const ID_LESS_RELEVANT_ITEMS = `less-relevant-items-${AppUtils.randomHexstring()}`;
const GRAPH_NODE_TYPES = 'graph-node-types';
const NODE_VIDEO = 'Video';
const NODE_CELEBRITY = 'celebrity';
const NODE_INDUSTRY = 'industry';
const NODE_PRODUCTS = 'products';
const NODE_SERVICES = 'services';
const NODE_EVENT_TYPE = 'event_type';
const NODESIZE_BY_TYPE = {
  [NODE_EVENT_TYPE]: 50,
  [NODE_VIDEO]: 45,
  [NODE_INDUSTRY]: 40,
  [NODE_CELEBRITY]: 35,
  [NODE_PRODUCTS]: 30,
  [NODE_SERVICES]: 25,
};

const PAGESIZE = 10;
const SIMILARITY_SIZE = 5;

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

export default class RecommendCategorySlideComponent extends BaseSlideComponent {
  constructor() {
    super();
    this.$mediaManager = MediaManager.getSingleton();
    this.$settingStore = SettingStore.getSingleton();
    this.$imageStore = ImageStore.getSingleton();
    this.$graph = undefined;
    this.$graphMapping = undefined;
  }

  get mediaManager() {
    return this.$mediaManager;
  }

  get settingStore() {
    return this.$settingStore;
  }

  get imageStore() {
    return this.$imageStore;
  }

  get graph() {
    return this.$graph;
  }

  set graph(val) {
    this.$graph = val;
  }

  get graphMapping() {
    return this.$graphMapping;
  }

  set graphMapping(val) {
    this.$graphMapping = val;
  }

  async show() {
    if (!this.initialized) {
      const container = $('<div/>')
        .addClass('row no-gutters');
      this.slide.append(container);

      const desc = this.createDescription();
      container.append(desc);

      const searchSimilarityForm = this.createSimilaritySearchForm();
      container.append(searchSimilarityForm);

      const interactiveGraphSearch = this.createInteractiveGraphSearch();
      container.append(interactiveGraphSearch);

      const loading = this.createLoading();
      container.append(loading);
    }
    return super.show();
  }

  createDescription() {
    const container = $('<section/>')
      .addClass('col-9 p-0 mx-auto mt-4');

    const desc = $('<p/>')
      .addClass('lead')
      .html(DESC);
    container.append(desc);

    return container;
  }

  createSimilaritySearchForm() {
    const section = $('<section/>')
      .addClass('col-12 bg-light');

    const container = $('<div/>')
      .addClass('col-9 p-0 mx-auto my-4');
    section.append(container);

    const title = $('<p/>')
      .addClass('lead-m')
      .append('Search similar items (Amazon Neptune ML embeddings)');
    container.append(title);

    const formContainer = $('<form/>')
      .addClass('px-0 form-inline needs-validation')
      .attr('novalidate', 'novalidate')
      .attr('role', 'form');
    container.append(formContainer);

    const searchInput = this.createSearchInput(formContainer);
    formContainer.append(searchInput);

    const submitBtn = this.createSubmitButton(formContainer);
    formContainer.append(submitBtn);

    const resultContainer = $('<section/>')
      .attr('id', ID_SIMILARITY_LIST);
    container.append(resultContainer);

    return section;
  }

  createSearchInput(form) {
    const input = $('<input/>')
      .addClass('form-control mr-2 col-4')
      .attr('type', 'search')
      .attr('pattern', UNICODE_CHARACTER_SETS)
      .attr('placeholder', Localization.Messages.Search);

    input.keypress(async (event) => {
      if (event.which === 13) {
        event.preventDefault();
        const btn = input.siblings('button[type="submit"]');
        return btn.trigger('click');
      }
      return true;
    });
    return input;
  }

  createSubmitButton(form) {
    const btn = $('<button/>')
      .addClass('btn btn-outline-success my-2')
      .attr('type', 'submit')
      .append(Localization.Messages.Submit);

    btn.on('click', async (event) => {
      event.preventDefault();
      const container = this.slide.find(`section#${ID_SIMILARITY_LIST}`);
      const input = form.find('input').val();
      if (!input) {
        container.children().remove();
      } else {
        await this.searchSimilarity(container, input);
      }
    });
    return btn;
  }

  async searchSimilarity(container, term, size = SIMILARITY_SIZE) {
    try {
      this.loading(true);

      const items = await this.graphApi({
        op: 'opensearch',
        term,
        size,
      });

      await this.refreshSimilaritySearchResult(container, term, items);
    } catch (e) {
      console.error(e);
    } finally {
      this.loading(false);
    }
  }

  async refreshSimilaritySearchResult(container, term, items) {
    container.children().remove();

    /* most relevant contents */
    let id = ID_RELEVANT_ITEMS;
    const medias = await Promise.all(items.map((x) =>
      this.mediaManager.lazyGetByUuid(x.id)));

    let title = $('<span/>')
      .addClass('lead-s')
      .html(`Most relevant contents related to <strong>${term}</strong> (${medias.length})`);

    let details = await this.createSearchResultDetails(title, id, medias, true);
    container.append(details);

    /* other contents */
    id = ID_LESS_RELEVANT_ITEMS;
    while (items.length) {
      const item = items.shift();
      if (!item.similarItems || item.similarItems.length <= 0) {
        continue;
      }

      const media = medias.find((x) =>
        x.uuid === item.id);
      if (!media) {
        continue;
      }

      const similarItems = await Promise.all(item.similarItems.map((x) =>
        this.mediaManager.lazyGetByUuid(x.id)));

      title = $('<span/>')
        .addClass('lead-s')
        .html(`Contents similar to <strong>${AppUtils.shorten(media.basename, 96)}</strong> (${similarItems.length})`);
      details = await this.createSearchResultDetails(title, id, similarItems, false);

      container.append(details);
    }
  }

  async createSearchResultDetails(title, id, medias, open = false) {
    const details = $('<details/>');
    if (open) {
      details.attr('open', true);
    }

    const summary = $('<summary/>')
      .addClass('my-2');
    details.append(summary);

    summary.append(title);

    const listContainer = $('<div/>')
      .addClass('row no-gutters mt-4')
      .attr('id', id);
    details.append(listContainer);

    await Promise.all(medias.map((media) =>
      this.createMediaListItem(media, listContainer)));

    return details;
  }

  async createMediaListItem(media, container) {
    const itemContainer = $('<div/>')
      .addClass('col-2 p-0 m-0')
      .attr('data-uuid', media.uuid);
    container.append(itemContainer);

    const table = $('<table/>')
      .addClass('table table-sm lead-xxs text-center no-border');
    itemContainer.append(table);

    const tbody = $('<tbody/>');
    table.append(tbody);

    const thumbnail = await this.makeItemThumbnail(media);
    thumbnail.on('click', async (event) => {
      event.preventDefault();
      let actual = this.mediaManager.findMediaByUuid(media.uuid);
      if (actual === undefined) {
        actual = await this.mediaManager.insertMedia({
          uuid: media.uuid,
        });
        this.mediaManager.addMediaToCollection(actual);
      }
      if (actual) {
        this.slide.trigger(CategorySlideEvents.Media.Selected, [actual]);
      }
    });
    tbody.append(thumbnail);

    const caption = this.makeItemCaption(media.basename);
    tbody.append(caption);
  }

  async makeItemThumbnail(media) {
    const src = await media.getThumbnail();
    const tr = $('<tr/>');
    const td = $('<td/>');
    tr.append(td);

    const container = $('<div/>')
      .addClass('image-container');
    td.append(container);

    const overlay = $('<div/>')
      .addClass('overlay');
    container.append(overlay);

    const icon = $('<i/>')
      .addClass('far fa-image lead-xxl text-white');
    overlay.append(icon);

    const img = $('<img/>')
      .addClass('w-100')
      .css('background-color', '#aaa');
    container.append(img);

    if (src !== undefined) {
      img.attr('src', src);
      overlay.addClass('collapse');
    }

    const preview = $('<div/>')
      .addClass('preview');
    container.append(preview);

    const play = $('<i/>')
      .addClass('far fa-play-circle center lead-xxl text-white');
    preview.append(play);

    return tr;
  }

  makeItemCaption(title) {
    const tr = $('<tr/>');
    const td = $('<td/>')
      .addClass('lead-xxs');
    tr.append(td);

    const desc = $('<span/>')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', title)
      .html(AppUtils.shorten(title, 32))
      .tooltip({
        trigger: 'hover',
      });
    td.append(desc);

    return tr;
  }

  createInteractiveGraphSearch() {
    const section = $('<section/>')
      .addClass('col-12');

    const container = $('<div/>')
      .addClass('col-9 p-0 mx-auto my-4');
    section.append(container);

    const title = $('<p/>')
      .addClass('lead-m')
      .append('Traverse knowledge graph (Amazon Neptune) interactively');
    container.append(title);

    const formContainer = $('<form/>')
      .addClass('px-0 form-inline needs-validation')
      .attr('novalidate', 'novalidate')
      .attr('role', 'form');
    container.append(formContainer);

    const nodeSelection = this.createSelectOptions(formContainer);
    formContainer.append(nodeSelection);

    const loadMoreBtn = this.createLoadMoreButton(formContainer);
    formContainer.append(loadMoreBtn);

    const graphContainer = $('<section/>')
      .addClass('mt-4')
      .addClass('knowledge-graph')
      .attr('id', ID_GRAPH);
    container.append(graphContainer);

    return section;
  }

  createSelectOptions(form) {
    const select = $('<select/>')
      .addClass('custom-select col-4 mr-2');

    select.ready(async () => {
      try {
        this.loading(true);
        select.prop('disabled', 'disabled');
        select.children().remove();
        const option = $('<option/>')
          .attr('value', 'undefined')
          .append('Choose a node type to start...');
        select.append(option);

        const nodes = await this.getNodeTypes();
        const names = Object.keys(nodes);
        /* create mapping to store node attributes */
        this.graphMapping = names.reduce((a0, c0, idx) => ({
          ...a0,
          [c0]: {
            categoryId: idx,
            nodes: {},
          },
        }), {});

        const options = names.map((x) => {
          const text = `${x} (${nodes[x]})`;
          return $('<option/>')
            .attr('value', x)
            .data('items', nodes[x])
            .data('next-token', 0)
            .append(text);
        });
        select.append(options);
      } catch (e) {
        console.error(e);
      } finally {
        select.prop('disabled', false);
        this.loading(false);
      }
    });

    select.on('change', async () => {
      try {
        this.loading(true);
        const val = select.val();
        if (val === 'undefined') {
          console.log('EmptyGraph()');
          if (this.graph) {
            const series = this.graph.getOption().series[0];
            series.data = [];
            series.links = [];
            /* update graph */
            this.graph.setOption({
              series: [series],
            });
          }
        } else {
          console.log(`RenderGraph(${val})`);
          const graphContainer = this.slide.find(`section#${ID_GRAPH}`);
          const option = select.children('option:selected').first();
          let token = option.data('next-token');
          let names;
          if (val === NODE_CELEBRITY) {
            names = [
              'Andy Jassy',
              'Werner Vogels',
              'Jeff Bezos',
            ].join(',');
          }
          const dataset = await this.queryNodesBy(val, token, names);
          token += dataset.length;
          option.data('next-token', token);

          await this.buildGraph(graphContainer, dataset);

          /* reset the token for others */
          const others = select.children('option:not(:selected)');
          others.data('next-token', 0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        this.loading(false);
      }
    });

    return select;
  }

  async graphApi(query) {
    const url = new URL(SolutionManifest.KnowledgeGraph.Endpoint);
    Object.keys(query)
      .forEach((x) => {
        if (query[x] !== undefined) {
          url.searchParams.append(x, query[x]);
        }
      });
    const options = {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SolutionManifest.KnowledgeGraph.ApiKey,
      },
    };
    let tries = 4;
    while (tries--) {
      const response = fetch(url, options)
        .then((res) => {
          if (!res.ok) {
            return new Error();
          }
          return res.json();
        });
      if (!(response instanceof Error)) {
        return response;
      }
    }
    return undefined;
  }

  async getNodeTypes() {
    let nodeTypes = await this.settingStore.getItem(GRAPH_NODE_TYPES);
    if (nodeTypes === undefined) {
      nodeTypes = await this.graphApi({
        op: 'vertices',
      }).then((res) =>
        res[0]);
      await this.settingStore.putItem(GRAPH_NODE_TYPES, nodeTypes);
    }
    return nodeTypes;
  }

  async queryNodesBy(label, token, names) {
    return this.graphApi({
      op: 'query',
      type: 'vertice',
      label,
      token,
      names,
      pagesize: PAGESIZE,
    }).then((res) =>
      res.map((x) =>
        Object.keys(x)
          .reduce((a0, c0) => {
            const meshed = (typeof x[c0] === 'object')
              ? x[c0]
              : {
                [c0]: x[c0],
              };
            return {
              ...a0,
              ...meshed,
            };
          }, {})));
  }

  async getConnectedNodes(label, id, token = 0) {
    return this.graphApi({
      op: 'query',
      type: 'vertice',
      label,
      id,
      token,
      pagesize: PAGESIZE,
    }).then((res) => {
      if (!res) {
        return undefined;
      }

      const edges = [];
      while (res.length) {
        const items = res.shift();
        const idx = items.findIndex((x) =>
          x.IN !== undefined);
        if (idx < 0) {
          continue;
        }
        const found = items.splice(idx, 1).shift();
        let name = (items.find((x) =>
          x.id === found.IN.id) || {}).name;
        found.IN.name = name;

        name = (items.find((x) =>
          x.id === found.OUT.id) || {}).name;
        found.OUT.name = name;
        edges.push(found);
      }
      return edges;
    });
  }

  async buildGraph(graphContainer, dataset) {
    const height = Math.max(Math.round(graphContainer.height()), 800);
    const width = Math.max(Math.round(graphContainer.width()), 800);

    const graph = this.graph || echarts.init(graphContainer[0], null, {
      renderer: 'canvas',
      useDirtyRect: false,
      width,
      height,
    });

    /* dblclick always receives a single click event */
    /* delay processing single click event by 300ms */
    let timer;
    graph.on('click', ((event) => {
      if (event.event.event.detail === 1) {
        timer = setTimeout(async () => {
          const parsed = event.data.value[0];
          console.log('click', event, parsed);
          if (event.data.name !== NODE_VIDEO) {
            return;
          }
          if (parsed.id !== undefined) {
            let media = this.mediaManager.findMediaByUuid(parsed.id);
            if (media === undefined) {
              media = await this.mediaManager.insertMedia({
                uuid: parsed.id,
              });
              this.mediaManager.addMediaToCollection(media);
              this.slide.trigger(CategorySlideEvents.Media.Selected, [media]);
            }
          }
        }, 300);
      }
    }));

    graph.on('dblclick', (async (event) => {
      if (event.event.event.detail === 2) {
        clearTimeout(timer);
        try {
          this.loading(true);
          const type = event.name;
          const data = event.data;
          const parsed = data.value[0];

          console.log('dblclick', event, parsed);
          if (parsed.traversed !== true) {
            const connectedNodes = await this.getConnectedNodes(type, parsed.id, parsed.token);
            if (connectedNodes === undefined) {
              return;
            }
            if (connectedNodes.length === 0) {
              parsed.traversed = true;
            } else {
              parsed.traversed = false;
              parsed.token = (parsed.token || 0) + connectedNodes.length;
            }

            const graphSeries = this.graph.getOption().series[event.seriesIndex];
            while (connectedNodes.length) {
              const connected = connectedNodes.shift();
              let from;
              let to;
              if (connected.IN.id === parsed.id) {
                from = data;
                to = await this.createAdjacentNode(connected.OUT, graphSeries);
              } else if (connected.OUT.id === parsed.id) {
                to = data;
                from = await this.createAdjacentNode(connected.IN, graphSeries);
              }
              if (from !== undefined && to !== undefined) {
                this.createRelationship(from, to, connected, graphSeries);
              }
            }
            /* update graph */
            this.graph.setOption({
              series: [graphSeries],
            });
          }
        } catch (e) {
          console.error(e);
        } finally {
          this.loading(false);
        }
      }
    }));

    const nodes = await Promise.all(dataset.map((x, idx) =>
      this.createNode(x, idx)));

    const options = this.makeGraphOptions({
      nodes,
      links: [],
      categories: Object.keys(this.graphMapping)
        .map((x) => ({
          name: x,
        })),
    });
    graph.setOption(options);
    this.graph = graph;

    return graph;
  }

  async createNode(data, idx) {
    let image;
    let name = data.name;

    if (data.label === NODE_VIDEO) {
      const media = await this.mediaManager.lazyGetByUuid(data.id);
      if (media !== undefined) {
        image = await media.getThumbnail();
        name = media.basename;
      }
    } else {
      const prefix = data.label
        .trim()
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-{2,}/g, '-')
        .toLowerCase();
      const basename = data.name.split('-')[0]
        .trim()
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-{2,}/g, '-')
        .toLowerCase();
      const extension = (data.label === NODE_CELEBRITY)
        ? '.png'
        : '.svg';
      image = await this.imageStore
        .getBlob(`./images/kg/${prefix}/${basename}${extension}`);
    }

    return this.parseNode({
      ...data,
      name,
      image,
    }, idx);
  }

  async createAdjacentNode(data, series) {
    let idx = series.data.findIndex((x) =>
      x.value[0].id === data.id);
    if (idx >= 0) {
      return series.data[idx];
    }

    idx = series.data.length;
    const node = await this.createNode(data, idx);
    series.data.push(node);
    return node;
  }

  createRelationship(from, to, connection, series) {
    const idx = series.links.findIndex((x) =>
      x.value[0].id === connection.id);
    if (idx >= 0) {
      return series.links[idx];
    }

    const link = {
      source: from.id,
      target: to.id,
      value: [
        {
          id: connection.id,
          desc: `${AppUtils.shorten(from.value[0].name, 32)} > ${AppUtils.shorten(to.value[0].name, 32)}`,
        },
      ],
    };
    series.links.push(link);
    return link;
  }

  makeGraphOptions(dataset) {
    const title = {};
    const tooltip = {
      show: true,
      trigger: 'item',
      enterable: true,
      alwaysShowContent: false,
      padding: 0,
      extraCssText: 'border-radius: 0',
      formatter: ((x) => {
        if (x.dataType === 'edge') {
          const container = $('<div/>')
            .addClass('my-2');
          const desc = $('<p/>')
            .addClass('text-truncate')
            .append(x.value[0].desc || x.name);
          container.append(desc);
          return container.prop('outerHTML');
        }
        if (x.dataType === 'node') {
          const parsed = x.value[0];
          const container = $('<div/>');
          if (x.name === NODE_VIDEO) {
            container.addClass('graph-tooltip');
            const img = $('<img/>')
              .attr('src', parsed.image);
            container.append(img);

            const desc = $('<p/>')
              .addClass('mx-2 my-2 text-truncate')
              .append(parsed.name);
            container.append(desc);

            return container.prop('outerHTML');
          }
          container.addClass('row no-gutters');
          let avatar = $('<i/>')
            .addClass('ml-2 my-2')
            .addClass('far fa-question-circle')
            .addClass('graph-avatar');
          if (parsed.image) {
            avatar = $('<img/>')
              .addClass('mx-2 my-auto')
              .addClass('graph-avatar')
              .attr('src', parsed.image);
          }
          container.append(avatar);

          const desc = $('<p/>')
            .addClass('my-auto mr-2 text-truncate')
            .append(parsed.name);
          container.append(desc);
          return container.prop('outerHTML');
        }
        return x.value;
      }),
    };
    const legend = [
      {
        data: dataset.categories
          .map((x) =>
            x.name),
      },
    ];
    const animationDuration = 1500;
    const animationEasingUpdate = 'quinticInOut';
    const series = [
      {
        name: 'Graph database',
        type: 'graph',
        layout: 'none',
        data: dataset.nodes,
        links: dataset.links,
        categories: dataset.categories,
        roam: 'move',
        label: {
          show: true,
          position: 'right',
          formatter: ((x) =>
            AppUtils.shorten(x.value[0].name, 32)),
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 10,
          },
        },
      },
    ];

    return {
      title,
      tooltip,
      legend,
      animationDuration,
      animationEasingUpdate,
      series,
    };
  }

  parseNode(nodeData, idx) {
    const label = nodeData.label;
    return {
      id: idx,
      name: label,
      symbolSize: NODESIZE_BY_TYPE[label] || 10,
      ...this.computeXYCoord(),
      value: [
        nodeData,
      ],
      category: this.graphMapping[label].categoryId,
    };
  }

  computeXYCoord() {
    const start = 0 - 1200;
    const end = 1200;
    const random = end - start + 10;

    const x = Math.floor(Math.random() * random + start);
    const y = Math.floor(Math.random() * random + start);
    return {
      x,
      y,
    };
  }

  createLoadMoreButton(form) {
    const btn = $('<button/>')
      .addClass('btn btn-outline-success my-2')
      .attr('type', 'submit')
      .append('Load more');

    btn.on('click', async (event) => {
      try {
        this.loading(true);
        event.preventDefault();
        const select = form.find('select');
        const val = select.val();
        if (val === 'undefined') {
          return false;
        }
        const option = select.children('option:selected').first();
        let token = option.data('next-token');

        const dataset = await this.queryNodesBy(val, token);
        token += dataset.length;
        option.data('next-token', token);

        const series = this.graph.getOption().series[0];
        while (dataset.length) {
          const item = dataset.shift();
          let node = series.data.find((x) =>
            x.value[0].id === item.id);
          if (node !== undefined) {
            continue;
          }
          node = await this.createNode(item, series.data.length);
          series.data.push(node);
        }
        /* update graph */
        this.graph.setOption({
          series: [series],
        });
        return true;
      } catch (e) {
        console.error(e);
        return false;
      } finally {
        this.loading(false);
      }
    });
    return btn;
  }
}
