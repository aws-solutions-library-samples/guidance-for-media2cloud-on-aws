import SolutionManifest from '/solution-manifest.js';
import Localization from '../../../shared/localization.js';
import MediaTypes from '../../../shared/media/mediaTypes.js';
import AppUtils from '../../../shared/appUtils.js';
import ApiHelper from '../../../shared/apiHelper.js';
import MediaManager from '../../../shared/media/mediaManager.js';
import SettingStore from '../../../shared/localCache/settingStore.js';
import DescriptionList from '../base/descriptionList.js';
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
const DEFAULT_OPTIONS = {
  [MediaTypes.Video]: true,
  [MediaTypes.Photo]: true,
  [MediaTypes.Podcast]: true,
  [MediaTypes.Document]: true,
  [OPTKEY_EXACT]: false,
  [OPTKEY_PAGESIZE]: OPTVAL_PAGESIZE10,
  [OPTKEY_QUERY]: undefined,
};
const DATA_UUID = 'data-uuid';
const DATA_SEARCHTOKEN = 'data-token';
const CSS_DESCRIPTIONLIST = {
  dl: 'row lead-xs ml-2 my-auto col-9 no-gutters',
  dt: 'col-sm-2 my-0 text-left',
  dd: 'col-sm-10 my-0',
};

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
    const form = $('<form/>').addClass('col-9 px-0 form-inline needs-validation')
      .attr('novalidate', 'novalidate')
      .attr('role', 'form');
    const input = this.createSearchInput(form);
    const submit = this.createSubmitButton(form);
    const pageSize = this.createPageSizeSelection();
    const group = $('<div/>').addClass('form-group col-12 p-0 mt-2')
      .append(input)
      .append(submit)
      .append(pageSize);
    const categories = this.createCategoryCheckboxes();
    const exact = this.createExactOption();
    return form.append(categories)
      .append(exact)
      .append(group);
  }

  createCategoryCheckboxes() {
    return [
      [
        MediaTypes.Video,
        Localization.Messages.VideoTab,
        this.searchOptions[MediaTypes.Video],
      ],
      [
        MediaTypes.Photo,
        Localization.Messages.PhotoTab,
        this.searchOptions[MediaTypes.Photo],
      ],
      [
        MediaTypes.Podcast,
        Localization.Messages.PodcastTab,
        this.searchOptions[MediaTypes.Podcast],
      ],
      [
        MediaTypes.Document,
        Localization.Messages.DocumentTab,
        this.searchOptions[MediaTypes.Document],
      ],
    ].map(item => this.createCheckbox(...item));
  }

  createSearchInput(form) {
    const input = $('<input/>').addClass('form-control mr-2 col-6')
      .attr('type', 'search')
      .attr('pattern', '[a-zA-Z0-9 ._%+-]{1,}')
      .attr('placeholder', Localization.Messages.Search);
    input.focusout(async (event) => {
      /*
      if (!this.validateForm(event, form)) {
        this.shake(form);
        await this.showAlert(Localization.Alerts.InvalidGroupName);
        input.focus();
        return false;
      }
      */
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
      console.log(JSON.stringify(this.searchOptions, null, 2));
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
      Localization.Messages.ExactMatch,
      this.searchOptions[OPTKEY_EXACT]
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

  createCheckbox(name, label, defaultChecked = false) {
    const id = `checkbox-${AppUtils.randomHexstring()}`;
    const input = $('<input/>').addClass('form-check-input')
      .attr('type', 'checkbox')
      .attr('id', id)
      .attr('value', name)
      .prop('checked', defaultChecked);
    input.off('click').on('click', (event) => {
      this.searchOptions[name] = input.is(':checked');
      return true;
    });
    return $('<div/>').addClass('form-check form-check-inline mr-4')
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
    const resultList = $('<ul/>').addClass('list-group')
      .attr('id', ID_SEARCHRESULT_LIST);

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
        .append(resultList))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(controls));
  }

  searchResultContainer() {
    return this.slide.find(`#${ID_SEARCHRESULT_CONTAINER}`);
  }

  async refreshSearchResults(results) {
    const container = this.searchResultContainer();
    const list = container.find(`#${ID_SEARCHRESULT_LIST}`);
    while (results.uuids.length) {
      const uuid = results.uuids.shift();
      let item = list.find(`li[${DATA_UUID}="${uuid}"]`);
      if (item.length > 0) {
        continue;
      }
      const media = this.mediaManager.findMediaByUuid(uuid)
        || await this.mediaManager.insertMedia({
          uuid,
        });
      if (!media) {
        console.log(`ERR: refreshSearchResults: fail to render ${uuid}`);
        continue;
      }
      if (media.overallStatus === SolutionManifest.Statuses.Error) {
        continue;
      }
      item = await this.createMediaListItem(media);
      list.append(item);
    }
    return this.refreshLoadButton(results.token, results.total);
  }

  async createMediaListItem(media) {
    const image = await this.createThumbnail(media);
    const bkgdColor = media.type === MediaTypes.Video
      ? 'bg-success'
      : media.type === MediaTypes.Podcast
        ? 'bg-primary'
        : media.type === MediaTypes.Photo
          ? 'bg-secondary'
          : media.type === MediaTypes.Document
            ? 'bg-warning'
            : undefined;
    const category = $('<span/>').addClass('lead-xxs mx-auto my-auto text-white')
      .html(media.type);
    const helper = new DescriptionList(CSS_DESCRIPTIONLIST);
    const dl = helper.createTableList();
    [
      'basename',
      'duration',
      'lastModified',
    ].forEach(name => helper.appendTableList(dl, media, name));
    const content = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-2')
        .append(image))
      .append($('<div/>').addClass('col-1 d-flex')
        .addClass(bkgdColor)
        .append(category))
      .append($('<div/>').addClass('col-9 d-flex')
        .append(dl));

    const li = $('<li/>').addClass('list-group-item list-group-item-action no-gutters p-0')
      .css('cursor', 'pointer')
      .attr(DATA_UUID, media.uuid)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.PreviewMedia)
      .append(content)
      .tooltip({
        trigger: 'hover',
      });

    li.off('click').on('click', (event) => {
      event.preventDefault();
      return this.slide.trigger(CategorySlideEvents.Media.Selected, [media]);
    });
    return li;
  }

  async createThumbnail(media) {
    const proxy = await media.getThumbnail();
    return $('<img/>').addClass('btn-bkgd w-100 h-96px')
      .attr('src', proxy)
      .css('object-fit', 'cover');
  }

  refreshLoadButton(token, total) {
    const container = this.searchResultContainer();
    const form = container.find('form');
    form.removeClass('collapse');
    const btn = form.find('button');
    btn.prop(DATA_SEARCHTOKEN, token);
    if (token === total) {
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
    console.log(JSON.stringify(response, null, 2));
    return this.refreshSearchResults(response);
  }
}
