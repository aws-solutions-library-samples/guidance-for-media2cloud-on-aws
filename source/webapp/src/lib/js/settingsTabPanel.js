/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable prefer-object-spread */
/* eslint-disable operator-linebreak */
const BOOLEAN_AIOPTIONS = {
  celeb: 'Celebrity detection',
  face: 'Face detection',
  faceMatch: 'Face Match detection',
  label: 'Label detection',
  moderation: 'Moderation detection',
  person: 'Person detection',
  transcript: 'Transcribe / subtitle',
  entity: 'Entity detection',
  keyphrase: 'Keyphrase detection',
  sentiment: 'Sentiment detection',
  topic: 'Topic detection',
  text: 'Text detection',
};

const SELECT_AIOPTIONS = {
  languageCode: 'Language code',
};

const RANGE_AIOPTIONS = {
  minConfidence: 'Min. Confidence',
};

const GENERAL_OPTIONS = {
  debug_window: 'Enable system message',
  pageSize: 'Items per page',
  mapApiKey: 'Map API Key',
};

const SUPPORTED_AIOPTIONS
  = Object.assign({}, BOOLEAN_AIOPTIONS, SELECT_AIOPTIONS, RANGE_AIOPTIONS, GENERAL_OPTIONS);

/**
 * @class SettingsTabPanel
 * @description manage setting UI tab
 */
class SettingsTabPanel {
  constructor(params = {}) {
    const {
      systemMessageInstance,
      cognitoInstance,
      tabPanelId = '#settings',
    } = params;

    if (!systemMessageInstance) {
      throw new Error('invalid setting, systemMessageInstance');
    }

    if (!cognitoInstance) {
      throw new Error('invalid setting, cognitoInstance');
    }

    this.$systemMessageInstance = systemMessageInstance;
    this.$cognitoInstance = cognitoInstance;
    this.$tabPanel = $(tabPanelId);
    this.$generalForm = undefined;
    this.$aiForm = undefined;
    this.$faceForm = undefined;
    this.$groundTruthForm = undefined;
    this.$workteam = new WorkteamWizard(this);

    this.domInit();
  }

  static get Constants() {
    return {
      Id: {
        Loading: 'setting-loading-icon',
        General: 'general-options',
        AIML: 'aiml-options',
        FaceCollection: 'face-collection-form-id',
        GroundTruth: 'ground-truth-form-id',
      },
      Action: {
        ResetCollection: 'reset-collection',
        ConfigureWorkteam: 'configure-workteam',
      },
    };
  }

  get [Symbol.toStringTag]() {
    return 'SettingsTabPanel';
  }

  get systemMessage() {
    return this.$systemMessageInstance;
  }

  get cognito() {
    return this.$cognitoInstance;
  }

  get tabPanel() {
    return this.$tabPanel;
  }

  get generalForm() {
    return this.$generalForm;
  }

  set generalForm(val) {
    this.$generalForm = val;
  }

  get aiForm() {
    return this.$aiForm;
  }

  set aiForm(val) {
    this.$aiForm = val;
  }

  get faceForm() {
    return this.$faceForm;
  }

  set faceForm(val) {
    this.$faceForm = val;
  }

  get groundTruthForm() {
    return this.$groundTruthForm;
  }

  set groundTruthForm(val) {
    this.$groundTruthForm = val;
  }

  get aiOptions() {
    return SO0050.AIML;
  }

  get workteam() {
    return this.$workteam;
  }

  /**
   * @function domCreateLauguageCode
   * @description create language code select menu element, default to 'en-US'
   */
  domCreateLauguageCode() {
    const key = 'languageCode';
    const languageCode = Storage.getOption(key, SO0050.AIML.languageCode);
    const supportedLanguageCodes = Storage.getSupportedLanguageCodes();

    const options = [];
    Object.keys(supportedLanguageCodes).forEach(x =>
      options.push(`<option value="${x}" ${languageCode === x ? 'selected' : ''}>${supportedLanguageCodes[x]}</option>`));

    const dom = [];
    dom.push(`
    <!-- language code setting -->
    <div class="form-group mb-4">
      <label for="${key}" class="col-sm-3">${SUPPORTED_AIOPTIONS[key]}</label>
      <select class="custom-select col-sm-4" id="${key}">
        ${options.join('\n')}
      </select>
      <div
        class="col-sm-6 text-muted"
        style="font-size: 0.8em;">
        ** Comprehend features may not be available in certain languages
      </div>
    </div>
    `);

    return dom.join('\n');
  }

  /**
   * @function domCreateMinConfidence
   * @description create language code select menu element, default to 'en-US'
   */
  domCreateMinConfidence() {
    const key = 'minConfidence';
    const minConfidence = Storage.getOption(key, SO0050.AIML.minConfidence);
    const dom = [];

    dom.push(`
    <!-- min. confidence setting -->
    <div class="form-group mb-4">
      <label for="${key}" class="col-sm-3">${SUPPORTED_AIOPTIONS[key]}</label>
      <input type="range" class="custom-range col-sm-4" min="0" max="100" value="${minConfidence}" step="1" id="${key}"></input>
      <input type="text" class="col-sm-1 text-center text-muted" value="${minConfidence}" disabled id="${key}-text"></input>
    </div>
    `);
    return dom.join('\n');
  }

  domCreateGeneralOptionsForm() {
    const collapsed = true;

    const dom = [];
    dom.push(`
      <form
        id="${SettingsTabPanel.Constants.Id.General}"
        class="mt-4 ${collapsed ? 'collapse' : ''}"
      >`);

    dom.push('<span class="col-sm-8 lead mt-4 mb-4 d-block" style="background-color: #e8e8e8;">General Settings</span>');
    dom.push(this.domDebugWindowCheckbox());
    dom.push(this.domCreatePageSizeInput());
    dom.push(this.domCreateMapApiKeyInput());

    dom.push('</form>');

    return dom.join('\n');
  }

  domDebugWindowCheckbox() {
    const key = 'debug_window';
    const enabled = Storage.getOption(key, false);
    return `
    <!-- debug window setting -->
    <div class="form-group mb-4">
      <div class="input-group mb-3">
        <span class="col-sm-3 col-form-label">${SUPPORTED_AIOPTIONS[key]}</span>
        <label class="switch">
          <input
            type="checkbox"
            id="${key}"
            data-toggle="tooltip"
            data=placement="bottom"
            ${enabled ? 'checked' : ''}
            title="enable / disable ${key}">
          <span class="slider round"></span>
        </label>
      </div>
    </div>
    `;
  }

  domCreatePageSizeInput() {
    const key = 'pageSize';
    const pageSize = Storage.getOption(key, 10);
    return `
    <!-- page size setting -->
    <div class="form-group mb-4">
      <label for="${key}" class="col-sm-3">${SUPPORTED_AIOPTIONS[key]}</label>
      <input
        class="col-sm-4 text-center text-muted"
        type="number"
        id="${key}"
        value="${pageSize}"
        min="1"
        max="100">
    </div>
    `;
  }

  domCreateMapApiKeyInput() {
    const key = 'mapApiKey';
    const mapApi = Storage.getOption(key, '');
    return `
    <!-- map api key setting -->
    <div class="form-group mb-4">
      <label for="${key}" class="col-sm-3">${SUPPORTED_AIOPTIONS[key]}</label>
      <input
        class="col-sm-4 text-center text-muted"
        type="password"
        id="${key}"
        value="${mapApi}">
    </div>
    `;
  }

  /**
   * @function domCreateAiOptionsForm
   * @description create a list of AI option checkboxes
   */
  domCreateAiOptionsForm() {
    const collapsed = true;

    const dom = [];

    dom.push(`<form id=${SettingsTabPanel.Constants.Id.AIML} class="mt-4 ${collapsed ? 'collapse' : ''}">`);
    dom.push('<span class="col-sm-8 lead mt-4 mb-4 d-block" style="background-color: #e8e8e8;">AI/ML Settings</span>');
    dom.push(this.domCreateLauguageCode());
    dom.push(this.domCreateMinConfidence());

    /* create left / right columns */
    const left = [];
    const right = [];

    Object.keys(BOOLEAN_AIOPTIONS).forEach((key, idx) => {
      const enabled = Storage.getOption(key);
      ((idx % 2) ? left : right).push(`
      <!-- ${key} setting -->
      <div class="form-group">
        <div class="input-group mb-3">
          <span class="col-sm-8 col-form-label">${BOOLEAN_AIOPTIONS[key]}</span>
          <label class="switch">
            <input
              type="checkbox"
              id="${key}"
              data-toggle="tooltip"
              data=placement="bottom"
              ${enabled ? 'checked' : ''}
              title="enable / disable ${key}">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      `);
    });

    dom.push(`
    <div class="row">
      <div class="col-sm-4">
        ${left.join('\n')}
      </div>
      <div class="col-sm-4">
        ${right.join('\n')}
      </div>
    </div>
    `);

    dom.push('</form>');

    return dom.join('\n');
  }

  domCreateFaceCollectionForm() {
    const collapsed = true;

    const dom = [];

    dom.push(`<form id=${SettingsTabPanel.Constants.Id.FaceCollection} class="mt-4 ${collapsed ? 'collapse' : ''}">`);
    dom.push('<span class="col-sm-8 lead mt-4 mb-4 d-block" style="background-color: #e8e8e8;">Face Index Settings</span>');

    /* delete the collection */
    dom.push(`
    <!-- reset collection -->
    <div class="form-group mt-4">
      <div class="input-group mb-3">
        <span class="col-sm-4 col-form-label">Reset Rekognition face collection</span>
        <button
          type="button"
          class="btn btn-danger btn-sm float-right"
          data-action="${SettingsTabPanel.Constants.Action.ResetCollection}">
          Delete now
        </button>
      </div>
    </div>
    `);

    dom.push('</form>');
    return dom.join('\n');
  }

  domCreateGroundTruthForm() {
    const collapsed = true;

    const dom = [];

    dom.push(`<form id=${SettingsTabPanel.Constants.Id.GroundTruth} class="mt-4 ${collapsed ? 'collapse' : ''}">`);
    dom.push('<span class="col-sm-8 lead mt-4 mb-4 d-block" style="background-color: #e8e8e8;">Ground Truth Workforce Settings</span>');

    /* sagemaker ground truth private workforces */
    dom.push(`
    <!-- private workforces -->
    <div class="form-group mt-4">
      <div class="input-group mb-3">
        <span class="col-sm-4 col-form-label">Configure private workforce</span>
        <button
          type="button"
          class="btn btn-success btn-sm float-right"
          data-action="${SettingsTabPanel.Constants.Action.ConfigureWorkteam}">
          Run wizard
        </button>
      </div>
    </div>
    `);

    dom.push('</form>');
    return dom.join('\n');
  }

  /**
   * @function domInit
   * @description initialize ui
   */
  domInit() {
    const domGeneralForm = this.domCreateGeneralOptionsForm();
    const domAiForm = this.domCreateAiOptionsForm();
    const domFaceForm = this.domCreateFaceCollectionForm();
    const domGtForm = this.domCreateGroundTruthForm();

    const element = $(`
    <div class="container mt-4">
      <!-- loading icon -->
      <div
        id="${SettingsTabPanel.Constants.Id.Loading}"
        class="spinner-grow text-secondary loading collapse"
        style="height: 3em; width: 3em;"
        role="status">
        <span class="sr-only">Loading...</span>
      </div>
      ${domGeneralForm}
      ${domAiForm}
      ${domFaceForm}
      ${domGtForm}
    </div>
    `);

    element.appendTo(this.tabPanel);

    this.generalForm = $(`#${SettingsTabPanel.Constants.Id.General}`);
    this.aiForm = $(`#${SettingsTabPanel.Constants.Id.AIML}`);
    this.faceForm = $(`#${SettingsTabPanel.Constants.Id.FaceCollection}`);
    this.groundTruthForm = $(`#${SettingsTabPanel.Constants.Id.GroundTruth}`);

    const debug = this.generalForm.find('#debug_window').first().prop('checked');
    if (debug) {
      this.systemMessage.show();
    }

    this.registerEvents();
  }

  /**
   * @function setOptionState
   * @description disable / enable Comprehend options
   * @param {Object} option
   * @param {boolean} [disabled]
   */
  setOptionState(option, disabled = false) {
    if (disabled) {
      option.attr('disabled', 'disabled');
      option.parent().siblings('span').addClass('text-muted');
    } else {
      option.removeAttr('disabled');
      option.parent().siblings('span').removeClass('text-muted');
    }
  }

  /**
   * @function checkServices
   * @description disable AI/ML option if service is not available for the region
   */
  checkServices() {
    const services = ServiceAvailability.createInstance();
    let disabled = [];

    if (!services.rekognition) {
      disabled = disabled.concat(Storage.getRekognitionOptions());
    }
    if (!services.comprehend) {
      disabled = disabled.concat(Storage.getComprehendOptions());
    }
    if (!services.transcribe) {
      disabled = disabled.concat(Storage.getTranscribeOptions(), Storage.getComprehendOptions());
    }
    if (!services.textract) {
      disabled = disabled.concat(Storage.getTextractOptions());
    }
    disabled = Array.from(new Set(disabled));

    [
      ...Storage.getRekognitionOptions(),
      ...Storage.getTranscribeOptions(),
      ...Storage.getComprehendOptions(),
      ...Storage.getTextractOptions(),
    ].forEach((key) => {
      const val = Storage.getOption(key, this.aiOptions[key]);
      const option = $(`#${key}`, this.aiForm);
      option.prop('checked', val);
      this.setOptionState(option, disabled.find(x => x === key));
    });
  }

  /**
   * @function checkComprehendLanguages
   * @description disable Comprehend options if specified language is not supported by Comprehend
   * @param {string} languageCode
   */
  checkComprehendLanguages(languageCode) {
    const disabled = !ServiceAvailability.createInstance().comprehend
      || Storage.getComprehendSupportedLanguages().indexOf(languageCode.slice(0, 2)) < 0;
    Storage.getComprehendOptions().forEach(key =>
      this.setOptionState($(`#${key}`, this.aiForm), disabled));
  }

  /**
   * @function loadSettings
   * @description on 'show.bs.tab' event, load settings from both localStorage and dynamodb
   * @param {number} [delay] default to 10ms
   */
  loadSettings(delay = 10) {
    setTimeout(async () => {
      const hasUserSignedIn = await this.cognito.checkStatus().catch(() => undefined);

      /* languageCode */
      let val = Storage.getOption('languageCode', this.aiOptions.languageCode);
      let option = $(`#languageCode option[value="${val}"]`, this.aiForm);
      option.prop('selected', true);

      /* minConfidence */
      val = Storage.getOption('minConfidence', this.aiOptions.minConfidence);
      option = $('#minConfidence', this.aiForm);
      option.val(val);

      /* validate AI/ML services support per region */
      this.checkServices();

      /* with selected language, check comprehend language support */
      const select = $('select#languageCode', this.aiForm);
      const code = select.children('option:selected').val();
      this.checkComprehendLanguages(code);

      [
        this.generalForm,
        this.aiForm,
        this.faceForm,
        this.groundTruthForm,
      ].forEach((form) => {
        if (!hasUserSignedIn) {
          form.addClass('collapse');
        } else {
          form.removeClass('collapse');
        }
      });
    }, delay);
  }

  /**
   * @function registerEvents
   * @description register 'show.bs.tab' event, 'change' event of
   * debug window checkbox, language code menu, and other ai option checkboxes
   */
  registerEvents() {
    $('#settingsTab').off('show.bs.tab').on('show.bs.tab', async () => {
      this.loadSettings();
    });

    $('#debug_window', this.generalForm).off('change').change((event) => {
      event.preventDefault();
      if ($(event.currentTarget).prop('checked')) {
        Storage.setOption('debug_window', true);
        this.systemMessage.show();
      } else {
        Storage.setOption('debug_window', false);
        this.systemMessage.hide();
      }
    });

    $('#pageSize', this.generalForm).off('change').change((event) => {
      event.preventDefault();
      const pageSize = $(event.currentTarget).val();
      Storage.setOption('pageSize', pageSize);
    });

    $('#mapApiKey', this.generalForm).off('change').change((event) => {
      event.preventDefault();
      const mapApiKey = $(event.currentTarget).val();
      Storage.setOption('mapApiKey', mapApiKey);
    });

    Object.keys(SUPPORTED_AIOPTIONS).forEach((option) => {
      const element = $(`#${option}`, this.aiForm);

      element.off('change').change((event) => {
        event.preventDefault();
        if (option === 'languageCode') {
          const language = $(event.currentTarget).val();
          Storage.setOption(option, language);
          this.checkComprehendLanguages(language);
        } else if (option === 'minConfidence') {
          const minConfidence = $(event.currentTarget).val();
          Storage.setOption(option, minConfidence);
        } else {
          const enabled = !!$(event.currentTarget).prop('checked');
          Storage.setOption(option, enabled);
        }
      });
    });

    $('#minConfidence', this.aiForm).off('input').on('input', (event) => {
      const minConfidence = $(event.currentTarget).val();
      $('#minConfidence-text', this.aiForm).val(minConfidence);
    });

    $(`#${SettingsTabPanel.Constants.Id.AIML}`).find('[data-action]').each((key, val) => {
      $(val).off('click').on('click', async (event) => {
        event.preventDefault();
        await this.onAction($(event.currentTarget).data('action'));
      });
    });

    $(`#${SettingsTabPanel.Constants.Id.FaceCollection}`).find('[data-action]').each((key, val) => {
      $(val).off('click').on('click', async (event) => {
        event.preventDefault();
        await this.onAction($(event.currentTarget).data('action'));
      });
    });

    $(`#${SettingsTabPanel.Constants.Id.GroundTruth}`).find('[data-action]').each((key, val) => {
      $(val).off('click').on('click', async (event) => {
        event.preventDefault();
        await this.onAction($(event.currentTarget).data('action'));
      });
    });
  }

  async onAction(action) {
    try {
      AppUtils.loading(SettingsTabPanel.Constants.Id.Loading, true);
      if (action === SettingsTabPanel.Constants.Action.ResetCollection) {
        await this.onResetCollection();
      } else if (action === SettingsTabPanel.Constants.Action.ConfigureWorkteam) {
        await this.onConfigureWorkteam();
      }
    } catch (e) {
      console.error(encodeURIComponent(e.message));
    } finally {
      AppUtils.loading(SettingsTabPanel.Constants.Id.Loading, false);
    }
  }

  async onResetCollection() {
    const response = await ApiHelper.resetFaceCollection(this.aiOptions.faceCollectionId);
    console.log(JSON.stringify(response, null, 2));
  }

  async onConfigureWorkteam() {
    return this.workteam.show();
  }
}
