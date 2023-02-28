// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../shared/localization.js';
import AppUtils from '../shared/appUtils.js';
import ApiHelper from '../shared/apiHelper.js';
import CognitoConnector from '../shared/cognitoConnector.js';
import ServiceAvailability from '../shared/serviceAvailability.js';
import FaceManager from '../shared/faceManager/index.js';
import ServiceNames from '../shared/serviceNames.js';
import LanguageCodes from '../shared/languageCodes.js';
import SettingStore from '../shared/localCache/settingStore.js';
import mxSpinner from './mxSpinner.js';

/* rekognition options */
const OPT_CELEB = SolutionManifest.AnalysisTypes.Rekognition.Celeb;
const OPT_FACE = SolutionManifest.AnalysisTypes.Rekognition.Face;
const OPT_FACEMATCH = SolutionManifest.AnalysisTypes.Rekognition.FaceMatch;
const OPT_LABEL = SolutionManifest.AnalysisTypes.Rekognition.Label;
const OPT_MODERATION = SolutionManifest.AnalysisTypes.Rekognition.Moderation;
const OPT_PERSON = SolutionManifest.AnalysisTypes.Rekognition.Person;
const OPT_TEXT = SolutionManifest.AnalysisTypes.Rekognition.Text;
const OPT_SEGMENT = SolutionManifest.AnalysisTypes.Rekognition.Segment;
const OPT_CUSTOMLABEL = SolutionManifest.AnalysisTypes.Rekognition.CustomLabel;
/* >> advanced rekognition settings */
const OPT_MINCONFIDENCE = 'minConfidence';
const OPT_FACECOLLECTIONID = 'faceCollectionId';
const OPT_CUSTOMLABELMODELS = 'customLabelModels';
const OPT_FRAMECATPUREMODE = 'frameCaptureMode';
const OPT_TEXTROI = 'textROI';
const OPT_FRAMEBASED = 'framebased';
/* comprehend options */
const OPT_ENTITY = SolutionManifest.AnalysisTypes.Comprehend.Entity;
const OPT_KEYPHRASE = SolutionManifest.AnalysisTypes.Comprehend.Keyphrase;
const OPT_SENTIMENT = SolutionManifest.AnalysisTypes.Comprehend.Sentiment;
const OPT_CUSTOMENTITY = SolutionManifest.AnalysisTypes.Comprehend.CustomEntity;
/* >> advanced comprehend settings */
const OPT_CUSTOMENTITYRECOGNIZER = 'customEntityRecognizer';
/* transcribe options */
const OPT_TRANSCRIBE = SolutionManifest.AnalysisTypes.Transcribe;
/* >> advanced transcribe settings */
const OPT_LANGUAGECODE = 'languageCode';
const OPT_CUSTOMLANGUAGEMODEL = 'customLanguageModel';
const OPT_CUSTOMVOCABULARY = 'customVocabulary';
/* textract options */
const OPT_TEXTRACT = SolutionManifest.AnalysisTypes.Textract;
/* misc */
const REKOGNITION_BASIC_OPTIONS = [
  OPT_CELEB,
  OPT_FACE,
  OPT_FACEMATCH,
  OPT_LABEL,
  OPT_MODERATION,
  OPT_PERSON,
  OPT_TEXT,
  OPT_SEGMENT,
];
const REKOGNITION_ADVANCED_OPTIONS = [
  OPT_MINCONFIDENCE,
  OPT_FACECOLLECTIONID,
  OPT_CUSTOMLABELMODELS,
  OPT_FRAMECATPUREMODE,
  OPT_TEXTROI,
  OPT_CUSTOMLABEL,
  OPT_FRAMEBASED,
];
const COMPREHEND_BASIC_OPTIONS = [
  OPT_ENTITY,
  OPT_KEYPHRASE,
  OPT_SENTIMENT,
];
const COMPREHEND_ADVANCED_OPTIONS = [
  OPT_CUSTOMENTITY,
  OPT_CUSTOMENTITYRECOGNIZER,
];
const TRANSCRIBE_BASIC_OPTIONS = [
  OPT_TRANSCRIBE,
];
const TRANSCRIBE_ADVANCED_OPTIONS = [
  OPT_LANGUAGECODE,
  OPT_CUSTOMLANGUAGEMODEL,
  OPT_CUSTOMVOCABULARY,
];
const TEXTRACT_BASIC_OPTIONS = [
  OPT_TEXTRACT,
];
const TEXTROI_GRIDS = [
  'TL', 'TC', 'TR',
  'ML', 'C', 'MR',
  'BL', 'BC', 'BR',
];
const MAX_CUSTOMALBELMODELS = 2;
const AVAILABLE_FRAMECAPTUREMODES = [
  {
    name: Localization.Messages.FrameCaptureModeNone,
    value: SolutionManifest.FrameCaptureMode.MODE_NONE,
  },
  {
    name: Localization.Messages.FrameCaptureMode1FPS,
    value: SolutionManifest.FrameCaptureMode.MODE_1FPS,
  },
  {
    name: Localization.Messages.FrameCaptureMode2FPS,
    value: SolutionManifest.FrameCaptureMode.MODE_2FPS,
  },
  {
    name: Localization.Messages.FrameCaptureMode3FPS,
    value: SolutionManifest.FrameCaptureMode.MODE_3FPS,
  },
  {
    name: Localization.Messages.FrameCaptureMode4FPS,
    value: SolutionManifest.FrameCaptureMode.MODE_4FPS,
  },
  {
    name: Localization.Messages.FrameCaptureMode5FPS,
    value: SolutionManifest.FrameCaptureMode.MODE_5FPS,
  },
  {
    name: Localization.Messages.FrameCaptureMode10FPS,
    value: SolutionManifest.FrameCaptureMode.MODE_10FPS,
  },
  {
    name: Localization.Messages.FrameCaptureMode12FPS,
    value: SolutionManifest.FrameCaptureMode.MODE_12FPS,
  },
  {
    name: Localization.Messages.FrameCaptureMode15FPS,
    value: SolutionManifest.FrameCaptureMode.MODE_15FPS,
  },
  {
    name: Localization.Messages.FrameCaptureModeAllFrames,
    value: SolutionManifest.FrameCaptureMode.MODE_ALL,
  },
  {
    name: Localization.Messages.FrameCaptureModeEveryOtherFrame,
    value: SolutionManifest.FrameCaptureMode.MODE_HALF_FPS,
  },
  {
    name: Localization.Messages.FrameCaptureMode1FramePer2Seconds,
    value: SolutionManifest.FrameCaptureMode.MODE_1F_EVERY_2S,
  },
  {
    name: Localization.Messages.FrameCaptureMode1FramePer5Seconds,
    value: SolutionManifest.FrameCaptureMode.MODE_1F_EVERY_5S,
  },
  {
    name: Localization.Messages.FrameCaptureMode1FramePer10Seconds,
    value: SolutionManifest.FrameCaptureMode.MODE_1F_EVERY_10S,
  },
  {
    name: Localization.Messages.FrameCaptureMode1FramePer30Seconds,
    value: SolutionManifest.FrameCaptureMode.MODE_1F_EVERY_30S,
  },
  {
    name: Localization.Messages.FrameCaptureMode1FramePer1Minute,
    value: SolutionManifest.FrameCaptureMode.MODE_1F_EVERY_1MIN,
  },
  {
    name: Localization.Messages.FrameCaptureMode1FramePer2Minutes,
    value: SolutionManifest.FrameCaptureMode.MODE_1F_EVERY_2MIN,
  },
  {
    name: Localization.Messages.FrameCaptureMode1FramePer5Minutes,
    value: SolutionManifest.FrameCaptureMode.MODE_1F_EVERY_5MIN,
  },
];

const mxAnalysisSettings = Base => class extends mxSpinner(Base) {
  constructor(...params) {
    super(...params);
    this.$settingStore = SettingStore.getSingleton();
    this.$serviceAvailability = {};
    this.$aiOptions = JSON.parse(JSON.stringify(SolutionManifest.AIML));
    this.$availableFaceCollections = undefined;
    this.$availableCustomLabelModels = undefined;
    this.$availableLanguageCodes = LanguageCodes;
    this.$availableCustomVocabularies = undefined;
    this.$availableCustomLanguageModels = undefined;
    this.$availableCustomEntityRecognizers = undefined;
    this.$canModify = CognitoConnector.getSingleton().canModify();
  }

  /* dervied class to implement */
  get parentContainer() {
    throw new Error('dervied class to implement parentContainer getter');
  }

  get settingStore() {
    return this.$settingStore;
  }

  get serviceAvailability() {
    return this.$serviceAvailability;
  }

  set serviceAvailability(val) {
    this.$serviceAvailability = val;
  }

  get aiOptions() {
    return this.$aiOptions;
  }

  set aiOptions(val) {
    this.$aiOptions = val;
  }

  get availableFaceCollections() {
    return this.$availableFaceCollections;
  }

  set availableFaceCollections(val) {
    this.$availableFaceCollections = val;
  }

  get availableCustomLabelModels() {
    return this.$availableCustomLabelModels;
  }

  set availableCustomLabelModels(val) {
    this.$availableCustomLabelModels = val;
  }

  get availableLanguageCodes() {
    return this.$availableLanguageCodes;
  }

  get availableCustomVocabularies() {
    return this.$availableCustomVocabularies;
  }

  set availableCustomVocabularies(val) {
    this.$availableCustomVocabularies = val;
  }

  get availableCustomLanguageModels() {
    return this.$availableCustomLanguageModels;
  }

  set availableCustomLanguageModels(val) {
    this.$availableCustomLanguageModels = val;
  }

  get availableCustomEntityRecognizers() {
    return this.$availableCustomEntityRecognizers;
  }

  set availableCustomEntityRecognizers(val) {
    this.$availableCustomEntityRecognizers = val;
  }

  get canModify() {
    return this.$canModify;
  }

  async getItem(key) {
    if (!this.canModify) {
      return undefined;
    }
    return this.settingStore.getItem(key);
  }

  async putItem(key, val) {
    if (!this.canModify) {
      return undefined;
    }
    return this.settingStore.putItem(key, val);
  }

  async deleteItem(key) {
    if (!this.canModify) {
      return undefined;
    }
    return this.settingStore.deleteItem(key);
  }

  async show() {
    if (!this.initialized) {
      this.parentContainer.append(this.createSkeleton());
      setTimeout(async () => {
        this.loading(true);
        this.serviceAvailability = await this.checkServiceAvailability();
        [
          this.availableFaceCollections,
          this.availableCustomLabelModels,
          this.availableCustomVocabularies,
          this.availableCustomLanguageModels,
          this.availableCustomEntityRecognizers,
        ] = await Promise.all([
          this.getAvailableFaceCollections(),
          this.getAvailableCustomLabelModels(),
          this.getAvailableCustomVocabulary(),
          this.getAvailableCustomLanguageModels(),
          this.getAvailableCustomEntityRecognizers(),
        ]);
        await this.loadLocalSettings();
        this.loading(false);
        return this.refreshContent();
      });
    } else {
      await this.loadLocalSettings();
      await this.refreshContent();
    }
    return super.show();
  }

  createSkeleton() {
    const description = this.createDescription();
    const rekognition = this.createRekognitionFeaturesForm();
    const transcribe = this.createTranscribeFeaturesForm();
    const comprehend = this.createComprehendFeaturesForm();
    const textract = this.createTextractFeaturesForm();
    const controls = this.createControls();
    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(description))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(rekognition))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(transcribe))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(comprehend))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(textract))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(controls))
      .append(this.createLoading());
    return row;
  }

  createDescription() {
    return $('<p/>').addClass('lead')
      .html(Localization.Messages.SettingsDesc);
  }

  createRekognitionFeaturesForm() {
    const title = $('<span/>').addClass('d-block p-2 bg-light text-black lead')
      .html(Localization.Messages.RekognitionFeatures);
    const desc = $('<p/>').addClass('lead-s mt-4')
      .html(Localization.Messages.RekognitionFeaturesDesc);
    const form = $('<form/>').addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    /* min confidence */
    const minConfidence = this.createMinConfidenceRange();
    form.append(minConfidence);
    /* basic options (on/off) */
    const basicOptions = REKOGNITION_BASIC_OPTIONS.map((x) => {
      const x0 = x.charAt(0).toUpperCase() + x.slice(1);
      return this.createToggle(
        ServiceNames.Rekognition,
        x,
        Localization.Messages[x0],
        Localization.Tooltips[x0]
      );
    });
    form.append(basicOptions);
    /* face collection id */
    const faceCollection = this.createFaceCollectionFormGroup();
    form.append(faceCollection);
    /* text region of interest */
    const textROI = this.createTextROIFormGroup();
    form.append(textROI);
    /* custom label models */
    const customlabel = this.createCustomLabelFormGroup();
    form.append(customlabel);
    /* use frame based analysis */
    const framebased = this.createFrameBasedFormGroup();
    form.append(framebased);
    /* frame capture mode */
    const frameCaptureMode = this.createFrameCaptureModeFormGroup();
    form.append(frameCaptureMode);

    form.submit(event =>
      event.preventDefault());

    return $('<div/>').addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start')
      .append($('<div/>').addClass('mt-4')
        .append(title)
        .append(desc)
        .append(form));
  }

  createComprehendFeaturesForm() {
    const title = $('<span/>').addClass('d-block p-2 bg-light text-black lead')
      .html(Localization.Messages.ComprehendFeatures);
    const desc = $('<p/>').addClass('lead-s mt-4')
      .html(Localization.Messages.ComprehendFeaturesDesc);
    const form = $('<form/>').addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    /* basic options (on/off) */
    const basicOptions = COMPREHEND_BASIC_OPTIONS.map((x) => {
      const x0 = x.charAt(0).toUpperCase() + x.slice(1);
      return this.createToggle(
        ServiceNames.Comprehend,
        x,
        Localization.Messages[x0],
        Localization.Tooltips[x0]
      );
    });
    form.append(basicOptions);
    /* custom entity recognizer */
    const entityRecognizer = this.createEntityRecognizerFormGroup();
    form.append(entityRecognizer);
    form.submit((event) =>
      event.preventDefault());
    return $('<div/>').addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start')
      .append($('<div/>').addClass('mt-4')
        .append(title)
        .append(desc)
        .append(form));
  }

  createTranscribeFeaturesForm() {
    const title = $('<span/>').addClass('d-block p-2 bg-light text-black lead')
      .html(Localization.Messages.TranscribeFeatures);
    const desc = $('<p/>').addClass('lead-s mt-4')
      .html(Localization.Messages.TranscribeFeaturesDesc);
    const form = $('<form/>').addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    /* basic options (on/off) */
    const basicOptions = TRANSCRIBE_BASIC_OPTIONS.map((x) => {
      const x0 = x.charAt(0).toUpperCase() + x.slice(1);
      return this.createToggle(
        ServiceNames.Transcribe,
        x,
        Localization.Messages[x0],
        Localization.Tooltips[x0]
      );
    });
    form.append(basicOptions);
    /* languageCode */
    const languageCode = this.createLanguageCodeFormGroup();
    form.append(languageCode);
    /* custom vocabulary */
    const customVocabulary = this.createCustomVocabularyFormGroup();
    form.append(customVocabulary);
    /* custom language model */
    const customLanguageModel = this.createCustomLanguageModelFormGroup();
    form.append(customLanguageModel);

    form.submit((event) =>
      event.preventDefault());

    return $('<div/>').addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start')
      .append($('<div/>').addClass('mt-4')
        .append(title)
        .append(desc)
        .append(form));
  }

  createTextractFeaturesForm() {
    const title = $('<span/>').addClass('d-block p-2 bg-light text-black lead')
      .html(Localization.Messages.TextractFeatures);
    const desc = $('<p/>').addClass('lead-s mt-4')
      .html(Localization.Messages.TextractFeaturesDesc);
    const form = $('<form/>').addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    /* basic options (on/off) */
    const basicOptions = TEXTRACT_BASIC_OPTIONS.map((x) => {
      const x0 = x.charAt(0).toUpperCase() + x.slice(1);
      return this.createToggle(
        ServiceNames.Textract,
        x,
        Localization.Messages[x0],
        Localization.Tooltips[x0]
      );
    });
    form.append(basicOptions);
    form.submit((event) =>
      event.preventDefault());
    return $('<div/>').addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start')
      .append($('<div/>').addClass('mt-4')
        .append(title)
        .append(desc)
        .append(form));
  }

  createControls() {
    if (!this.canModify) {
      return undefined;
    }

    const form = $('<form/>')
      .addClass('form-inline');

    form.submit((event) =>
      event.preventDefault());

    const btnGroup = $('<div/>')
      .addClass('ml-auto');
    form.append(btnGroup);

    const applyAll = $('<button/>').addClass('btn btn-outline-success ml-1')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.ApplyToAllUsers)
      .html(Localization.Buttons.ApplyToAllUsers)
      .tooltip({
        trigger: 'hover',
      });
    btnGroup.append(applyAll);

    const restoreOriginal = $('<button/>').addClass('btn btn-secondary ml-1')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.RestoreOriginal)
      .html(Localization.Buttons.RestoreOriginal)
      .tooltip({
        trigger: 'hover',
      });
    btnGroup.append(restoreOriginal);

    applyAll.off('click').on('click', async () =>
      this.storeGlobalSettings());

    restoreOriginal.off('click').on('click', async () =>
      this.restoreFactorySettings());

    return form;
  }

  createMinConfidenceRange() {
    const id = `${OPT_MINCONFIDENCE}-${AppUtils.randomHexstring()}`;
    const label = $('<label/>').addClass('col-4 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.MinConfidence)
      .html(Localization.Messages.MinConfidence);
    label.tooltip({
      trigger: 'hover',
    });

    const range = $('<input/>').addClass('custom-range col-6')
      .attr('data-type', OPT_MINCONFIDENCE)
      .attr('type', 'range')
      .attr('min', 0)
      .attr('max', 100)
      .attr('value', this.aiOptions[OPT_MINCONFIDENCE])
      .attr('step', 1)
      .attr('id', id);

    const input = $('<input/>').addClass('col-1 text-center text-muted ml-1')
      .attr('data-type', OPT_MINCONFIDENCE)
      .attr('type', 'text')
      .attr('value', this.aiOptions[OPT_MINCONFIDENCE])
      .attr('disabled', 'disabled')
      .attr('id', `${id}-text`);

    range.off('input').on('input', async () => {
      this.aiOptions[OPT_MINCONFIDENCE] = Number.parseInt(range.val(), 10);
      input.val(this.aiOptions[OPT_MINCONFIDENCE]);
      await this.putItem(OPT_MINCONFIDENCE, this.aiOptions[OPT_MINCONFIDENCE]);
    });

    return $('<div/>').addClass('form-group col-10 px-0 mt-2 mb-2')
      .append(label)
      .append(range)
      .append(input);
  }

  createToggle(category, type, name, tooltip, handler) {
    const input = $('<input/>')
      .attr('type', 'checkbox')
      .attr('data-category', category)
      .attr('data-type', type);
    const title = $('<span/>').addClass('col-8 px-0')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', tooltip)
      .html(name);
    title.tooltip({
      trigger: 'hover',
    });

    const toggle = $('<div/>').addClass('form-group col-5 px-0 mt-2 mb-2')
      .append($('<div/>').addClass('input-group col-12 pl-0')
        .append(title)
        .append($('<label/>').addClass('xs-switch')
          .append(input)
          .append($('<span/>').addClass('xs-slider round'))));

    if (!this.checkDetectionSupported(type)) {
      input.attr('disabled', 'disabled');
      toggle.addClass('text-muted');
    } else if (this.aiOptions[type]) {
      input.attr('checked', 'checked');
    }

    input.off('click').on('click', async () => {
      const to = input.prop('checked');
      this.aiOptions[type] = to;
      if (handler) {
        await handler(to);
      }
      await this.putItem(type, this.aiOptions[type]);
    });

    return toggle;
  }

  createFrameBasedFormGroup() {
    const desc = $('<p/>').addClass('lead-s mt-4')
      .html(Localization.Messages.FramebasedDesc);
    const framebased = this.createToggle(
      ServiceNames.Rekognition,
      OPT_FRAMEBASED,
      Localization.Messages.Framebased,
      Localization.Tooltips.Framebased,
      this.onFramebasedChange.bind(this)
    );
    return [
      desc,
      framebased,
    ];
  }

  createFaceCollectionFormGroup() {
    return this.createCustomFormGroup({
      name: OPT_FACECOLLECTIONID,
      label: Localization.Messages.FaceCollectionId,
      tooltip: Localization.Tooltips.FaceCollection,
      default: Localization.Messages.SelectCollection,
    });
  }

  createCustomLabelFormGroup() {
    const desc = $('<p/>').addClass('lead-s mt-4')
      .html(Localization.Messages.CustomlabelDesc.replace('{{MAX_CUSTOMALBELMODELS}}', MAX_CUSTOMALBELMODELS));
    const customLabelModels = this.createMultiselectFormGroup({
      name: OPT_CUSTOMLABELMODELS,
      label: Localization.Messages.CustomLabelModels,
      tooltip: Localization.Tooltips.CustomLabelModels,
      default: Localization.Messages.SelectModels,
      beforeChange: this.onCustomLabelModelChange.bind(this),
    });
    return [
      desc,
      customLabelModels,
    ];
  }

  createFrameCaptureModeFormGroup() {
    return this.createCustomFormGroup({
      name: OPT_FRAMECATPUREMODE,
      label: Localization.Messages.FrameCaptureMode,
      tooltip: Localization.Tooltips.FrameCaptureMode,
      default: Localization.Messages.SelectFrameCaptureMode,
    });
  }

  createTextROIFormGroup() {
    const id = `${OPT_TEXTROI}-${AppUtils.randomHexstring()}`;
    const label = $('<label/>').addClass('col-4 px-0 justify-content-start mb-auto')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.TextROI)
      .html(Localization.Messages.TextROI);
    label.tooltip({
      trigger: 'hover',
    });

    const screen = $('<div/>').addClass('row no-gutters text-roi-screen')
      .attr('data-type', OPT_TEXTROI);

    TEXTROI_GRIDS.forEach((x, i) => {
      const grid = $('<div/>')
        .attr('data-index', i)
        .addClass('d-flex text-roi-grid')
        .append($('<div/>').addClass('mx-auto my-auto lead-sm').html(x));
      grid.off('click').on('click', async () => {
        const active = grid.hasClass('text-roi-grid-active');
        if (active) {
          grid.removeClass('text-roi-grid-active');
          this.aiOptions[OPT_TEXTROI][i] = false;
        } else {
          grid.addClass('text-roi-grid-active');
          this.aiOptions[OPT_TEXTROI][i] = true;
        }
        await this.putItem(OPT_TEXTROI, this.aiOptions[OPT_TEXTROI]);
      });
      screen.append(grid);
    });

    const container = $('<div/>').addClass('col-6 m-0 p-0')
      .attr('id', id)
      .append(screen);

    const formGroup = $('<div/>').addClass('form-group col-10 px-0 my-2')
      .append(label)
      .append(container);

    return formGroup;
  }

  createLanguageCodeFormGroup() {
    return this.createCustomFormGroup({
      name: OPT_LANGUAGECODE,
      label: Localization.Messages.LanguageCode,
      tooltip: Localization.Tooltips.LanguageCode,
      default: Localization.Messages.SelectLanguageCode,
    });
  }

  createCustomVocabularyFormGroup() {
    return this.createCustomFormGroup({
      name: OPT_CUSTOMVOCABULARY,
      label: Localization.Messages.CustomVocabulary,
      tooltip: Localization.Tooltips.CustomVocabulary,
      default: Localization.Messages.SelectModel,
    });
  }

  createCustomLanguageModelFormGroup() {
    return this.createCustomFormGroup({
      name: OPT_CUSTOMLANGUAGEMODEL,
      label: Localization.Messages.CustomLanguageModel,
      tooltip: Localization.Tooltips.CustomLanguageModel,
      default: Localization.Messages.SelectModel,
    });
  }

  createEntityRecognizerFormGroup() {
    return this.createCustomFormGroup({
      name: OPT_CUSTOMENTITYRECOGNIZER,
      label: Localization.Messages.CustomEntityRecognizer,
      tooltip: Localization.Tooltips.CustomEntityRecognizer,
      default: Localization.Messages.SelectModel,
      onChange: this.onEntityRecognizerChange.bind(this),
    });
  }

  createCustomFormGroup(custom) {
    const id = `${custom.name}-${AppUtils.randomHexstring()}`;
    const label = $('<label/>').addClass('col-4 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', custom.tooltip)
      .html(custom.label);
    label.tooltip({
      trigger: 'hover',
    });

    const select = $('<select/>').addClass('custom-select custom-select-sm col-7')
      .attr('data-type', custom.name)
      .attr('id', id)
      .append($('<option/>')
        .attr('value', 'undefined')
        .html(custom.default));
    select.off('change').on('change', async () => {
      const val = select.val();
      if (val === 'undefined') {
        this.aiOptions[custom.name] = undefined;
      }
      else if (/^\d+$/.test(val)) {
        this.aiOptions[custom.name] = Number.parseInt(val, 10);
      }
      else {
        this.aiOptions[custom.name] = val;
      }

      if (typeof custom.onChange === 'function') {
        await custom.onChange(custom.name, this.aiOptions[custom.name]);
      }
      await this.putItem(custom.name, this.aiOptions[custom.name]);
    });

    const formGroup = $('<div/>').addClass('form-group col-10 px-0 my-2')
      .append(label)
      .append(select);
    return formGroup;
  }

  createMultiselectFormGroup(custom) {
    const id = `${custom.name}-${AppUtils.randomHexstring()}`;
    const label = $('<label/>').addClass('col-4 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', custom.tooltip)
      .html(custom.label);
    label.tooltip({
      trigger: 'hover',
    });

    const btn = $('<button/>').addClass('col-8 btn btn-sm btn-outline-dark dropdown-toggle overflow-auto')
      .attr('type', 'button')
      .attr('id', id)
      .attr('data-toggle', 'dropdown')
      .attr('aria-haspopup', true)
      .attr('aria-expanded', false)
      .html(custom.default);
    const dropdown = $('<div/>').addClass('dropdown col-8')
      .append(btn);
    const menu = $('<div/>').addClass('dropdown-menu col-12 lead-xs')
      .attr('data-type', custom.name)
      .attr('aria-labelledby', id);
    const anchor = $('<a/>').addClass('dropdown-item')
      .attr('href', '#')
      .attr('data-value', 'undefined')
      .html(Localization.Messages.SelectNone);
    anchor.on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const canChange = !custom.beforeChange
        || await custom.beforeChange('undefined', true);
      if (canChange) {
        menu.find('a.dropdown-item').removeClass('active');
        btn.html(custom.default);
      }
    });
    menu.append(anchor)
      .append($('<div/>').addClass('dropdown-divider'));
    dropdown.append(menu);

    const formGroup = $('<div/>').addClass('form-group col-10 px-0 my-2')
      .append(label)
      .append(dropdown);
    return formGroup;
  }

  async onCustomLabelModelChange(model, checked) {
    const opt = OPT_CUSTOMLABELMODELS;
    if (model === 'undefined') {
      this.aiOptions[opt].length = 0;
      await Promise.all([
        this.putItem(opt, this.aiOptions[opt]),
        this.onCustomLabelChange(),
      ]);
      return true;
    }
    const idx = this.aiOptions[opt].findIndex(x => x === model);
    if (!checked) {
      if (idx >= 0) {
        this.aiOptions[opt].splice(idx, 1);
      }
      await Promise.all([
        this.putItem(opt, this.aiOptions[opt]),
        this.onCustomLabelChange(),
        this.ensureFrameCaptureMode(SolutionManifest.FrameCaptureMode.MODE_1F_EVERY_2S),
      ]);
      return true;
    }
    if (this.aiOptions[opt].length < MAX_CUSTOMALBELMODELS) {
      if (idx < 0) {
        this.aiOptions[opt].splice(
          this.aiOptions[opt].length,
          0,
          model
        );
      }
      await Promise.all([
        this.putItem(opt, this.aiOptions[opt]),
        this.onCustomLabelChange(),
        this.ensureFrameCaptureMode(SolutionManifest.FrameCaptureMode.MODE_1F_EVERY_2S),
      ]);
      return true;
    }
    return false;
  }

  async onFramebasedChange(enabled) {
    if (enabled) {
      await this.ensureFrameCaptureMode(SolutionManifest.FrameCaptureMode.MODE_1F_EVERY_2S);
    }
    return true;
  }

  async onCustomLabelChange() {
    this.aiOptions[OPT_CUSTOMLABEL] = this.aiOptions[OPT_CUSTOMLABELMODELS].length > 0;
    return this.putItem(OPT_CUSTOMLABEL, this.aiOptions[OPT_CUSTOMLABEL]);
  }

  async onEntityRecognizerChange(opt, val) {
    if (opt === OPT_CUSTOMENTITYRECOGNIZER) {
      this.aiOptions[OPT_CUSTOMENTITY] = !!val;
      return this.putItem(OPT_CUSTOMENTITY, this.aiOptions[OPT_CUSTOMENTITY]);
    }
    return undefined;
  }

  async ensureFrameCaptureMode(frameCaptureMode) {
    const select = this.parentContainer.find(`select[data-type=${OPT_FRAMECATPUREMODE}]`);
    const from = select.children('option:selected').first();
    if (from.val() === `${SolutionManifest.FrameCaptureMode.MODE_NONE}`) {
      select.val(`${frameCaptureMode}`).trigger('change');
    }
  }

  checkDetectionSupported(type) {
    if (REKOGNITION_BASIC_OPTIONS.indexOf(type) >= 0 || OPT_FRAMEBASED === type) {
      return this.serviceAvailability[ServiceNames.Rekognition];
    }
    if (TRANSCRIBE_BASIC_OPTIONS.indexOf(type) >= 0) {
      return this.serviceAvailability[ServiceNames.Transcribe];
    }
    if (COMPREHEND_BASIC_OPTIONS.indexOf(type) >= 0) {
      return this.serviceAvailability[ServiceNames.Comprehend];
    }
    if (TEXTRACT_BASIC_OPTIONS.indexOf(type) >= 0) {
      return this.serviceAvailability[ServiceNames.Textract];
    }

    return false;
  }

  async checkServiceAvailability() {
    return ServiceAvailability.getSingleton().detectServices();
  }

  async getAvailableFaceCollections() {
    return (this.serviceAvailability[ServiceNames.Rekognition])
      ? FaceManager.getSingleton().getCollections()
      : undefined;
  }

  async getAvailableCustomLabelModels() {
    return (this.serviceAvailability[ServiceNames.Rekognition])
      ? ApiHelper.getRekognitionCustomLabelModels()
      : undefined;
  }

  async getAvailableCustomVocabulary() {
    return (this.serviceAvailability[ServiceNames.Transcribe])
      ? ApiHelper.getTranscribeCustomVocabulary()
      : undefined;
  }

  async getAvailableCustomLanguageModels() {
    return (this.serviceAvailability[ServiceNames.Transcribe])
      ? ApiHelper.getTranscribeCustomLanguageModels()
      : undefined;
  }

  async getAvailableCustomEntityRecognizers() {
    return (this.serviceAvailability[ServiceNames.Transcribe]
      && this.serviceAvailability[ServiceNames.Comprehend])
      ? ApiHelper.getComprehendCustomEntityRecognizers()
      : undefined;
  }

  async refreshContent() {
    /* on/off type */
    [
      OPT_FRAMEBASED,
      ...REKOGNITION_BASIC_OPTIONS,
      ...TRANSCRIBE_BASIC_OPTIONS,
      ...COMPREHEND_BASIC_OPTIONS,
      ...TEXTRACT_BASIC_OPTIONS,
    ].forEach(x => this.refreshToggle(x));
    /* select type */
    [
      {
        name: OPT_FACECOLLECTIONID,
        options: (this.availableFaceCollections || []).map(x => ({
          name: `${x.name} (${x.faces} faces)`,
          value: x.name,
          canUse: (x.faces > 0),
        })),
      },
      {
        name: OPT_FRAMECATPUREMODE,
        options: AVAILABLE_FRAMECAPTUREMODES,
      },
      {
        name: OPT_LANGUAGECODE,
        options: this.availableLanguageCodes || [],
      },
      {
        name: OPT_CUSTOMVOCABULARY,
        options: (this.availableCustomVocabularies || []).map(x => ({
          name: `${x.name} (${x.languageCode})`,
          value: x.name,
          canUse: x.canUse,
        })),
      },
      {
        name: OPT_CUSTOMLANGUAGEMODEL,
        options: (this.availableCustomLanguageModels || []).map(x => ({
          name: `${x.name} (${x.languageCode})`,
          value: x.name,
          canUse: x.canUse,
        })),
      },
      {
        name: OPT_CUSTOMENTITYRECOGNIZER,
        options: (this.availableCustomEntityRecognizers || []).map(x => ({
          name: `${x.name} (${x.languageCode})`,
          value: x.name,
          canUse: x.canUse,
        })),
      },
    ].forEach(x => this.refreshCustomFormOptions(x));
    /* update multiselect dropdown */
    [
      {
        name: OPT_CUSTOMLABELMODELS,
        options: (this.availableCustomLabelModels || []).map(x => ({
          name: x.name.split('/').shift(),
          value: x.name,
          canUse: x.canUse,
        })),
        default: Localization.Messages.SelectModels,
        beforeChange: this.onCustomLabelModelChange.bind(this),
      },
    ].forEach(x => this.refreshMultiselectFormGroup(x));
    /* minConfidence */
    this.refreshMinConfidenceRange();
    /* textROI */
    this.refreshTextROIFormGroup();
  }

  refreshToggle(type) {
    const input = this.parentContainer.find(`input[data-type=${type}]`);
    const formGroup = input.closest('div.form-group');
    if (!this.checkDetectionSupported(type)) {
      formGroup.addClass('text-muted');
      input.attr('disabled', 'disabled');
    } else {
      formGroup.removeClass('text-muted');
      input.removeAttr('disabled');
      input.prop('checked', this.aiOptions[type]);
    }
    if (!this.canModify) {
      input.attr('disabled', 'disabled');
    }
  }

  refreshCustomFormOptions(custom) {
    const select = this.parentContainer.find(`select[data-type=${custom.name}]`);
    select.children('option[value!="undefined"]').remove();
    custom.options.forEach((x) => {
      const option = $('<option/>')
        .attr('value', x.value)
        .html(x.name);
      if (x.canUse === false) {
        option.attr('disabled', 'disabled');
      } else {
        option.removeAttr('disabled');
        if (this.aiOptions[custom.name] === x.value) {
          option.attr('selected', 'selected');
        }
      }
      select.append(option);
    });
    if (!this.canModify) {
      select.attr('disabled', 'disabled');
    }
  }

  refreshMultiselectFormGroup(custom) {
    const dropdown = this.parentContainer.find(`div.dropdown-menu[data-type=${custom.name}]`);
    const btn = dropdown.siblings('button.dropdown-toggle').first();
    dropdown.children('a.dropdown-item[data-value!="undefined"]').remove();
    custom.options.forEach((option) => {
      const anchor = $('<a/>').addClass('dropdown-item')
        .attr('href', '#')
        .attr('data-value', option.value)
        .html(option.name);
      if (option.canUse === false) {
        anchor.attr('disabled', 'disabled');
      } else {
        anchor.removeAttr('disabled');
        if (this.aiOptions[custom.name].findIndex(a => a === option.value) >= 0) {
          anchor.addClass('active');
        }
      }
      anchor.on('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const curState = anchor.hasClass('active');
        const canChange = !custom.beforeChange
          || await custom.beforeChange(option.value, !curState);
        if (canChange && curState) {
          anchor.removeClass('active');
        } else if (canChange && !curState) {
          anchor.addClass('active');
        }
        let text = this.aiOptions[custom.name].map(x => `${x.substring(0, 5)}...`);
        text = text.length ? text : custom.default;
        btn.text(text);
        await this.putItem(custom.name, this.aiOptions[custom.name]);
      });
      dropdown.append(anchor);
    });
    let text = this.aiOptions[custom.name].map(x => `${x.substring(0, 5)}...`);
    text = text.length ? text : custom.default;
    btn.text(text);

    if (!this.canModify) {
      btn.attr('disabled', 'disabled');
    }
  }

  refreshMinConfidenceRange() {
    const type = OPT_MINCONFIDENCE;
    const input = this.parentContainer.find(`input[data-type=${type}]`);
    input.val(this.aiOptions[OPT_MINCONFIDENCE]);

    if (!this.canModify) {
      input.attr('disabled', 'disabled');
    }
  }

  refreshTextROIFormGroup() {
    const screen = this.parentContainer.find(`div[data-type=${OPT_TEXTROI}]`);
    screen.children().each((k, v) => {
      const grid = $(v);
      const idx = Number.parseInt(grid.data('index'), 10);
      if (this.aiOptions[OPT_TEXTROI][idx]) {
        grid.addClass('text-roi-grid-active');
      } else {
        grid.removeClass('text-roi-grid-active');
      }
    });
  }

  async loadLocalSettings() {
    /* fetch global options from S3 bucket */
    const remotedAIOptions = await this.getGlobalAIOptions();
    if (remotedAIOptions !== undefined) {
      this.aiOptions = remotedAIOptions;
    }

    await Promise.all([
      ...REKOGNITION_BASIC_OPTIONS,
      ...REKOGNITION_ADVANCED_OPTIONS,
      ...TRANSCRIBE_BASIC_OPTIONS,
      ...TRANSCRIBE_ADVANCED_OPTIONS,
      ...COMPREHEND_BASIC_OPTIONS,
      ...COMPREHEND_ADVANCED_OPTIONS,
      ...TEXTRACT_BASIC_OPTIONS,
    ].map((key) =>
      this.getItem(key)
        .then((val) =>
          this.aiOptions[key] = (val === undefined)
            ? this.aiOptions[key]
            : val)));
    return this.aiOptions;
  }

  async restoreFactorySettings() {
    try {
      this.loading(true);
      await Promise.all([
        ...REKOGNITION_BASIC_OPTIONS,
        ...REKOGNITION_ADVANCED_OPTIONS,
        ...TRANSCRIBE_BASIC_OPTIONS,
        ...TRANSCRIBE_ADVANCED_OPTIONS,
        ...COMPREHEND_BASIC_OPTIONS,
        ...COMPREHEND_ADVANCED_OPTIONS,
        ...TEXTRACT_BASIC_OPTIONS,
      ].map((x) =>
        this.deleteItem(x)));
      /* delete global options */
      await this.removeGlobalAIOptions();
      /* make sure certain contains default values */
      this.aiOptions = JSON.parse(JSON.stringify(SolutionManifest.AIML));
      return this.refreshContent();
    } catch (e) {
      console.error(e);
      return undefined;
    } finally {
      this.loading(false);
    }
  }

  async storeGlobalSettings() {
    try {
      this.loading(true);
      return ApiHelper.setGlobalAIOptions(this.aiOptions);
    } catch (e) {
      console.error(e);
      return undefined;
    } finally {
      this.loading(false);
    }
  }

  async getGlobalAIOptions() {
    return ApiHelper.getGlobalAIOptions();
  }

  async removeGlobalAIOptions() {
    return ApiHelper.deleteGlobalAIOptions();
  }
};

export default mxAnalysisSettings;
