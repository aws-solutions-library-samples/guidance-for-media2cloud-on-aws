// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../shared/localization.js';
import AppUtils from '../shared/appUtils.js';
import Spinner from '../shared/spinner.js';
import ApiHelper from '../shared/apiHelper.js';
import {
  GetUserSession,
} from '../shared/cognito/userSession.js';
import {
  GetServiceAvailability,
} from '../shared/serviceAvailability.js';
import {
  GetFaceManager,
  RegisterFaceManagerEvent,
} from '../shared/faceManager/index.js';
import ServiceNames from '../shared/serviceNames.js';
import LanguageCodes from '../shared/languageCodes.js';
import {
  GetSettingStore,
} from '../shared/localCache/index.js';

// rekognition options
const {
  AnalysisTypes: {
    Rekognition,
    Comprehend,
    Transcribe,
    Textract,
    AdBreak,
    AutoFaceIndexer,
    ZeroshotLabels,
    Shoppable,
    Scene,
    Toxicity,
    Transcode,
  },
  FrameCaptureMode,
  AIML,
  Shoppable: {
    ApiKey: ShoppableApiKey = '',
    Endpoint: ShoppableEndpoint = '',
  },
} = SolutionManifest;
const {
  Messages,
  Tooltips,
  Buttons,
} = Localization;

const OPT_CELEB = Rekognition.Celeb;
const OPT_FACE = Rekognition.Face;
const OPT_FACEMATCH = Rekognition.FaceMatch;
const OPT_LABEL = Rekognition.Label;
const OPT_MODERATION = Rekognition.Moderation;
const OPT_PERSON = Rekognition.Person;
const OPT_TEXT = Rekognition.Text;
const OPT_SEGMENT = Rekognition.Segment;
const OPT_CUSTOMLABEL = Rekognition.CustomLabel;
// >> advanced rekognition settings
const OPT_MINCONFIDENCE = 'minConfidence';
const OPT_FACECOLLECTIONID = 'faceCollectionId';
const OPT_CUSTOMLABELMODELS = 'customLabelModels';
const OPT_FRAMECATPUREMODE = 'frameCaptureMode';
const OPT_TEXTROI = 'textROI';
const OPT_FRAMEBASED = 'framebased';
// comprehend options
const OPT_ENTITY = Comprehend.Entity;
const OPT_KEYPHRASE = Comprehend.Keyphrase;
const OPT_SENTIMENT = Comprehend.Sentiment;
const OPT_CUSTOMENTITY = Comprehend.CustomEntity;
// >> advanced comprehend settings
const OPT_CUSTOMENTITYRECOGNIZER = 'customEntityRecognizer';
// transcribe options
const OPT_TRANSCRIBE = Transcribe;
const OPT_TOXICITY = Toxicity;
// >> advanced transcribe settings
const OPT_LANGUAGECODE = 'languageCode';
const OPT_CUSTOMLANGUAGEMODEL = 'customLanguageModel';
const OPT_CUSTOMVOCABULARY = 'customVocabulary';
// textract options
const OPT_TEXTRACT = Textract;
// advanced, new features
const OPT_IMAGEPROPERTY = Rekognition.ImageProperty;
const OPT_AD_BREAK = AdBreak;
const OPT_AUTO_FACE_INDEXER = AutoFaceIndexer;
const OPT_ZEROSHOT_LABELS = ZeroshotLabels;
const OPT_SHOPPABLE = Shoppable;
const OPT_SCENE = Scene;
const OPT_TRANSCODE = Transcode;
// key to store configuration locally
const OPT_AIOPTIONS = 'aioptions';
// misc.
const TEXTROI_GRIDS = [
  'TL', 'TC', 'TR',
  'ML', 'C', 'MR',
  'BL', 'BC', 'BR',
];
const MAX_CUSTOMALBELMODELS = 2;
const AVAILABLE_FRAMECAPTUREMODES = [
  {
    name: Messages.FrameCaptureModeNone,
    value: FrameCaptureMode.MODE_NONE,
  },
  {
    name: Messages.FrameCaptureModeDynamic,
    value: FrameCaptureMode.MODE_DYNAMIC_FPS,
  },
  {
    name: Messages.FrameCaptureMode1FPS,
    value: FrameCaptureMode.MODE_1FPS,
  },
  {
    name: Messages.FrameCaptureMode2FPS,
    value: FrameCaptureMode.MODE_2FPS,
  },
  {
    name: Messages.FrameCaptureMode3FPS,
    value: FrameCaptureMode.MODE_3FPS,
  },
  {
    name: Messages.FrameCaptureMode4FPS,
    value: FrameCaptureMode.MODE_4FPS,
  },
  {
    name: Messages.FrameCaptureMode5FPS,
    value: FrameCaptureMode.MODE_5FPS,
  },
  {
    name: Messages.FrameCaptureMode10FPS,
    value: FrameCaptureMode.MODE_10FPS,
  },
  {
    name: Messages.FrameCaptureMode12FPS,
    value: FrameCaptureMode.MODE_12FPS,
  },
  {
    name: Messages.FrameCaptureMode15FPS,
    value: FrameCaptureMode.MODE_15FPS,
  },
  {
    name: Messages.FrameCaptureModeAllFrames,
    value: FrameCaptureMode.MODE_ALL,
  },
  {
    name: Messages.FrameCaptureModeEveryOtherFrame,
    value: FrameCaptureMode.MODE_HALF_FPS,
  },
  {
    name: Messages.FrameCaptureMode1FramePer2Seconds,
    value: FrameCaptureMode.MODE_1F_EVERY_2S,
  },
  {
    name: Messages.FrameCaptureMode1FramePer5Seconds,
    value: FrameCaptureMode.MODE_1F_EVERY_5S,
  },
  {
    name: Messages.FrameCaptureMode1FramePer10Seconds,
    value: FrameCaptureMode.MODE_1F_EVERY_10S,
  },
  {
    name: Messages.FrameCaptureMode1FramePer30Seconds,
    value: FrameCaptureMode.MODE_1F_EVERY_30S,
  },
  {
    name: Messages.FrameCaptureMode1FramePer1Minute,
    value: FrameCaptureMode.MODE_1F_EVERY_1MIN,
  },
  {
    name: Messages.FrameCaptureMode1FramePer2Minutes,
    value: FrameCaptureMode.MODE_1F_EVERY_2MIN,
  },
  {
    name: Messages.FrameCaptureMode1FramePer5Minutes,
    value: FrameCaptureMode.MODE_1F_EVERY_5MIN,
  },
];

const DISABLED_FEATURES = [
  OPT_TOXICITY,
  OPT_IMAGEPROPERTY,
];

const FILTER_SETTINGS = {
  [OPT_SEGMENT]: {
    maxPixelThreshold: 0.15,
    minCoveragePercentage: 98,
    enableTechnicalCue: true,
  },
  [OPT_AUTO_FACE_INDEXER]: {
    minFaceW: 64,
    minFaceH: 64,
    maxPitch: 26,
    maxRoll: 26,
    maxYaw: 26,
    minBrightness: 30,
    minSharpness: 12, // 18,
    minCelebConfidence: 100,
    occludedFaceFiltering: true,
  },
  [OPT_SCENE]: {
    enhanceWithTranscript: true,
    enhanceWithLLM: true,
    minFrameSimilarity: 0.85,
    maxTimeDistance: 180000,
  },
  [OPT_AD_BREAK]: {
    breakInterval: 0,
    breakOffset: 0,
    pauseWeight: 1,
    quietnessWeight: 1,
    contextualWeight: 1,
  },
  [OPT_TRANSCODE]: {
    cropX: 0,
    cropY: 0,
    keepAR: true,
  },
  [OPT_TRANSCRIBE]: {
    analyseConversation: true,
  },
};

const mxAnalysisSettings = (Base) => class extends Base {
  constructor(...params) {
    super(...params);
    this.$mixerId = AppUtils.randomHexstring();
    this.$settingStore = GetSettingStore();
    this.$serviceAvailability = {};

    this.$aiOptions = JSON.parse(JSON.stringify(AIML));

    if (!ShoppableApiKey.length || !ShoppableEndpoint.length) {
      DISABLED_FEATURES.push(OPT_SHOPPABLE);
    }

    RegisterFaceManagerEvent(
      `mxanalysissettings-${this.mixerId}`,
      this.onFaceManagerEvent.bind(this)
    );

    Spinner.useSpinner();
  }

  get mixerId() {
    return this.$mixerId;
  }

  // dervied class to implement
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

  get filters() {
    if (this.aiOptions.filters === undefined) {
      this.aiOptions.filters = {};
    }
    return this.aiOptions.filters;
  }

  get maxPixelThreshold() {
    if ((this.filters[OPT_SEGMENT] || {}).maxPixelThreshold === undefined) {
      return FILTER_SETTINGS[OPT_SEGMENT].maxPixelThreshold;
    }
    return this.filters[OPT_SEGMENT].maxPixelThreshold;
  }

  set maxPixelThreshold(val) {
    if (!this.aiOptions.filters[OPT_SEGMENT]) {
      this.filters[OPT_SEGMENT] = {};
    }
    this.filters[OPT_SEGMENT].maxPixelThreshold = val;
  }

  get minCoveragePercentage() {
    if ((this.filters[OPT_SEGMENT] || {}).minCoveragePercentage === undefined) {
      return FILTER_SETTINGS[OPT_SEGMENT].minCoveragePercentage;
    }
    return this.filters[OPT_SEGMENT].minCoveragePercentage;
  }

  set minCoveragePercentage(val) {
    if (!this.filters[OPT_SEGMENT]) {
      this.filters[OPT_SEGMENT] = {};
    }
    this.filters[OPT_SEGMENT].minCoveragePercentage = val;
  }

  get enableTechnicalCue() {
    if ((this.filters[OPT_SEGMENT] || {}).enableTechnicalCue === undefined) {
      return FILTER_SETTINGS[OPT_SEGMENT].enableTechnicalCue;
    }
    return this.filters[OPT_SEGMENT].enableTechnicalCue;
  }

  set enableTechnicalCue(val) {
    if (!this.filters[OPT_SEGMENT]) {
      this.filters[OPT_SEGMENT] = {};
    }
    this.filters[OPT_SEGMENT].enableTechnicalCue = val;
  }

  get enhanceWithTranscript() {
    if ((this.filters[OPT_SCENE] || {}).enhanceWithTranscript === undefined) {
      return FILTER_SETTINGS[OPT_SCENE].enhanceWithTranscript;
    }
    return this.filters[OPT_SCENE].enhanceWithTranscript;
  }

  set enhanceWithTranscript(val) {
    if (!this.aiOptions.filters[OPT_SCENE]) {
      this.filters[OPT_SCENE] = {};
    }
    this.filters[OPT_SCENE].enhanceWithTranscript = !!(val);
  }

  get enhanceWithLLM() {
    if ((this.filters[OPT_SCENE] || {}).enhanceWithLLM === undefined) {
      return FILTER_SETTINGS[OPT_SCENE].enhanceWithLLM;
    }
    return this.filters[OPT_SCENE].enhanceWithLLM;
  }

  set enhanceWithLLM(val) {
    if (!this.aiOptions.filters[OPT_SCENE]) {
      this.filters[OPT_SCENE] = {};
    }
    this.filters[OPT_SCENE].enhanceWithLLM = !!(val);
  }

  get minFrameSimilarity() {
    if ((this.filters[OPT_SCENE] || {}).minFrameSimilarity === undefined) {
      return FILTER_SETTINGS[OPT_SCENE].minFrameSimilarity;
    }
    return this.filters[OPT_SCENE].minFrameSimilarity;
  }

  set minFrameSimilarity(val) {
    if (!this.aiOptions.filters[OPT_SCENE]) {
      this.filters[OPT_SCENE] = {};
    }
    this.filters[OPT_SCENE].minFrameSimilarity = val;
  }

  get maxTimeDistance() {
    if ((this.filters[OPT_SCENE] || {}).maxTimeDistance === undefined) {
      return FILTER_SETTINGS[OPT_SCENE].maxTimeDistance / 60000;
    }
    return this.filters[OPT_SCENE].maxTimeDistance / 60000;
  }

  set maxTimeDistance(val) {
    if (!this.aiOptions.filters[OPT_SCENE]) {
      this.filters[OPT_SCENE] = {};
    }
    this.filters[OPT_SCENE].maxTimeDistance = val * 60000;
  }

  get breakInterval() {
    if ((this.filters[OPT_AD_BREAK] || {}).breakInterval === undefined) {
      return FILTER_SETTINGS[OPT_AD_BREAK].breakInterval / 60000;
    }
    return (this.filters[OPT_AD_BREAK].breakInterval / 60000);
  }

  set breakInterval(val) {
    if (!this.aiOptions.filters[OPT_AD_BREAK]) {
      this.filters[OPT_AD_BREAK] = {};
    }
    this.filters[OPT_AD_BREAK].breakInterval = (val * 60000);
  }

  get breakOffset() {
    if ((this.filters[OPT_AD_BREAK] || {}).breakOffset === undefined) {
      return FILTER_SETTINGS[OPT_AD_BREAK].breakOffset / 60000;
    }
    return (this.filters[OPT_AD_BREAK].breakOffset / 60000);
  }

  set breakOffset(val) {
    if (!this.aiOptions.filters[OPT_AD_BREAK]) {
      this.filters[OPT_AD_BREAK] = {};
    }
    this.filters[OPT_AD_BREAK].breakOffset = (val * 60000);
  }

  get pauseWeight() {
    if ((this.filters[OPT_AD_BREAK] || {}).pauseWeight === undefined) {
      return FILTER_SETTINGS[OPT_AD_BREAK].pauseWeight;
    }
    return this.filters[OPT_AD_BREAK].pauseWeight;
  }

  set pauseWeight(val) {
    if (!this.aiOptions.filters[OPT_AD_BREAK]) {
      this.filters[OPT_AD_BREAK] = {};
    }
    this.filters[OPT_AD_BREAK].pauseWeight = val;
  }

  get quietnessWeight() {
    if ((this.filters[OPT_AD_BREAK] || {}).quietnessWeight === undefined) {
      return FILTER_SETTINGS[OPT_AD_BREAK].quietnessWeight;
    }
    return this.filters[OPT_AD_BREAK].quietnessWeight;
  }

  set quietnessWeight(val) {
    if (!this.aiOptions.filters[OPT_AD_BREAK]) {
      this.filters[OPT_AD_BREAK] = {};
    }
    this.filters[OPT_AD_BREAK].quietnessWeight = val;
  }

  get contextualWeight() {
    if ((this.filters[OPT_AD_BREAK] || {}).contextualWeight === undefined) {
      return FILTER_SETTINGS[OPT_AD_BREAK].contextualWeight;
    }
    return this.filters[OPT_AD_BREAK].contextualWeight;
  }

  set contextualWeight(val) {
    if (!this.aiOptions.filters[OPT_AD_BREAK]) {
      this.filters[OPT_AD_BREAK] = {};
    }
    this.filters[OPT_AD_BREAK].contextualWeight = val;
  }

  //
  get minFaceW() {
    if ((this.filters[OPT_AUTO_FACE_INDEXER] || {}).minFaceW === undefined) {
      return FILTER_SETTINGS[OPT_AUTO_FACE_INDEXER].minFaceW;
    }
    return this.filters[OPT_AUTO_FACE_INDEXER].minFaceW;
  }

  set minFaceW(val) {
    if (!this.filters[OPT_AUTO_FACE_INDEXER]) {
      this.filters[OPT_AUTO_FACE_INDEXER] = {};
    }
    this.filters[OPT_AUTO_FACE_INDEXER].minFaceW = val;
  }

  get minFaceH() {
    if ((this.filters[OPT_AUTO_FACE_INDEXER] || {}).minFaceH === undefined) {
      return FILTER_SETTINGS[OPT_AUTO_FACE_INDEXER].minFaceH;
    }
    return this.filters[OPT_AUTO_FACE_INDEXER].minFaceH;
  }

  set minFaceH(val) {
    if (!this.filters[OPT_AUTO_FACE_INDEXER]) {
      this.filters[OPT_AUTO_FACE_INDEXER] = {};
    }
    this.filters[OPT_AUTO_FACE_INDEXER].minFaceH = val;
  }

  get maxPitch() {
    if ((this.filters[OPT_AUTO_FACE_INDEXER] || {}).maxPitch === undefined) {
      return FILTER_SETTINGS[OPT_AUTO_FACE_INDEXER].maxPitch;
    }
    return this.filters[OPT_AUTO_FACE_INDEXER].maxPitch;
  }

  set maxPitch(val) {
    if (!this.filters[OPT_AUTO_FACE_INDEXER]) {
      this.filters[OPT_AUTO_FACE_INDEXER] = {};
    }
    this.filters[OPT_AUTO_FACE_INDEXER].maxPitch = val;
  }

  get maxRoll() {
    if ((this.filters[OPT_AUTO_FACE_INDEXER] || {}).maxRoll === undefined) {
      return FILTER_SETTINGS[OPT_AUTO_FACE_INDEXER].maxRoll;
    }
    return this.filters[OPT_AUTO_FACE_INDEXER].maxRoll;
  }

  set maxRoll(val) {
    if (!this.filters[OPT_AUTO_FACE_INDEXER]) {
      this.filters[OPT_AUTO_FACE_INDEXER] = {};
    }
    this.filters[OPT_AUTO_FACE_INDEXER].maxRoll = val;
  }

  get maxYaw() {
    if ((this.filters[OPT_AUTO_FACE_INDEXER] || {}).maxYaw === undefined) {
      return FILTER_SETTINGS[OPT_AUTO_FACE_INDEXER].maxYaw;
    }
    return this.filters[OPT_AUTO_FACE_INDEXER].maxYaw;
  }

  set maxYaw(val) {
    if (!this.filters[OPT_AUTO_FACE_INDEXER]) {
      this.filters[OPT_AUTO_FACE_INDEXER] = {};
    }
    this.filters[OPT_AUTO_FACE_INDEXER].maxYaw = val;
  }

  get minBrightness() {
    if ((this.filters[OPT_AUTO_FACE_INDEXER] || {}).minBrightness === undefined) {
      return FILTER_SETTINGS[OPT_AUTO_FACE_INDEXER].minBrightness;
    }
    return this.filters[OPT_AUTO_FACE_INDEXER].minBrightness;
  }

  set minBrightness(val) {
    if (!this.filters[OPT_AUTO_FACE_INDEXER]) {
      this.filters[OPT_AUTO_FACE_INDEXER] = {};
    }
    this.filters[OPT_AUTO_FACE_INDEXER].minBrightness = val;
  }

  get minSharpness() {
    if ((this.filters[OPT_AUTO_FACE_INDEXER] || {}).minSharpness === undefined) {
      return FILTER_SETTINGS[OPT_AUTO_FACE_INDEXER].minSharpness;
    }
    return this.filters[OPT_AUTO_FACE_INDEXER].minSharpness;
  }

  set minSharpness(val) {
    if (!this.filters[OPT_AUTO_FACE_INDEXER]) {
      this.filters[OPT_AUTO_FACE_INDEXER] = {};
    }
    this.filters[OPT_AUTO_FACE_INDEXER].minSharpness = val;
  }

  get minCelebConfidence() {
    if ((this.filters[OPT_AUTO_FACE_INDEXER] || {}).minCelebConfidence === undefined) {
      return FILTER_SETTINGS[OPT_AUTO_FACE_INDEXER].minCelebConfidence;
    }
    return this.filters[OPT_AUTO_FACE_INDEXER].minCelebConfidence;
  }

  set minCelebConfidence(val) {
    if (!this.filters[OPT_AUTO_FACE_INDEXER]) {
      this.filters[OPT_AUTO_FACE_INDEXER] = {};
    }
    this.filters[OPT_AUTO_FACE_INDEXER].minCelebConfidence = val;
  }

  get occludedFaceFiltering() {
    if ((this.filters[OPT_AUTO_FACE_INDEXER] || {}).occludedFaceFiltering === undefined) {
      return FILTER_SETTINGS[OPT_AUTO_FACE_INDEXER].occludedFaceFiltering;
    }
    return this.filters[OPT_AUTO_FACE_INDEXER].occludedFaceFiltering;
  }

  set occludedFaceFiltering(val) {
    if (!this.filters[OPT_AUTO_FACE_INDEXER]) {
      this.filters[OPT_AUTO_FACE_INDEXER] = {};
    }
    this.filters[OPT_AUTO_FACE_INDEXER].occludedFaceFiltering = val;
  }

  get cropX() {
    if ((this.filters[OPT_TRANSCODE] || {}).cropX === undefined) {
      return FILTER_SETTINGS[OPT_TRANSCODE].cropX;
    }
    return this.filters[OPT_TRANSCODE].cropX;
  }

  set cropX(val) {
    if (!this.filters[OPT_TRANSCODE]) {
      this.filters[OPT_TRANSCODE] = {};
    }
    this.filters[OPT_TRANSCODE].cropX = val;
  }

  get cropY() {
    if ((this.filters[OPT_TRANSCODE] || {}).cropY === undefined) {
      return FILTER_SETTINGS[OPT_TRANSCODE].cropY;
    }
    return this.filters[OPT_TRANSCODE].cropY;
  }

  set cropY(val) {
    if (!this.filters[OPT_TRANSCODE]) {
      this.filters[OPT_TRANSCODE] = {};
    }
    this.filters[OPT_TRANSCODE].cropY = val;
  }

  get keepAR() {
    if ((this.filters[OPT_TRANSCODE] || {}).keepAR === undefined) {
      return FILTER_SETTINGS[OPT_TRANSCODE].keepAR;
    }
    return this.filters[OPT_TRANSCODE].keepAR;
  }

  set keepAR(val) {
    if (!this.filters[OPT_TRANSCODE]) {
      this.filters[OPT_TRANSCODE] = {};
    }
    this.filters[OPT_TRANSCODE].keepAR = !!(val);
  }

  // transcribe filter
  get analyseConversation() {
    if ((this.filters[OPT_TRANSCRIBE] || {}).analyseConversation === undefined) {
      return FILTER_SETTINGS[OPT_TRANSCRIBE].analyseConversation;
    }
    return this.filters[OPT_TRANSCRIBE].analyseConversation;
  }

  set analyseConversation(val) {
    if (!this.aiOptions.filters[OPT_TRANSCRIBE]) {
      this.filters[OPT_TRANSCRIBE] = {};
    }
    this.filters[OPT_TRANSCRIBE].analyseConversation = !!(val);
  }

  get canModify() {
    const session = GetUserSession();
    return session.canModify();
  }

  loading(enabled) {
    return Spinner.loading(enabled);
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
      let promises = [];

      promises.push(this.loadLocalSettings());
      promises.push(this.checkServiceAvailability());
      promises = await Promise.all(promises);

      this.aiOptions = {
        ...this.aiOptions,
        ...promises[0],
      };

      this.serviceAvailability = promises[1];

      const container = this.createSkeleton();
      this.parentContainer.append(container);
    }

    return super.show();
  }

  createSkeleton() {
    const container = $('<div/>')
      .addClass('row no-gutters');

    const descContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(descContainer);

    const desc = this.createDescription();
    descContainer.append(desc);

    const transcodeContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(transcodeContainer);

    const transcodeFeatures = this.createTranscodeFeaturesForm();
    transcodeContainer.append(transcodeFeatures);

    const rekognitionContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(rekognitionContainer);

    const rekognition = this.createRekognitionFeaturesForm();
    rekognitionContainer.append(rekognition);

    const transcribeContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(transcribeContainer);

    const transcribe = this.createTranscribeFeaturesForm();
    transcribeContainer.append(transcribe);

    const comprehendContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(comprehendContainer);

    const comprehend = this.createComprehendFeaturesForm();
    comprehendContainer.append(comprehend);

    const textractContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(textractContainer);

    const textract = this.createTextractFeaturesForm();
    textractContainer.append(textract);

    const controlContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(controlContainer);

    const controls = this.createControls();
    controlContainer.append(controls);

    return container;
  }

  createDescription() {
    return $('<p/>')
      .addClass('lead')
      .html(Messages.SettingsDesc);
  }

  createTranscodeFeaturesForm() {
    const container = $('<div/>')
      .addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start');

    const aiGroup = $('<div/>')
      .addClass('mt-4');
    container.append(aiGroup);

    const title = $('<span/>')
      .addClass('d-block p-2 bg-light text-black lead')
      .html(Messages.TranscodeFeatures);
    aiGroup.append(title);

    const form = $('<form/>')
      .addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    aiGroup.append(form);

    const inputCropSettings = this.createInputCropSettingsFormGroup();
    form.append(inputCropSettings);

    // event handling
    form.submit((event) =>
      event.preventDefault());

    return container;
  }

  createRekognitionFeaturesForm() {
    const container = $('<div/>')
      .addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start');

    const aiGroup = $('<div/>')
      .addClass('mt-4');
    container.append(aiGroup);

    const title = $('<span/>')
      .addClass('d-block p-2 bg-light text-black lead')
      .html(Messages.RekognitionFeatures);
    aiGroup.append(title);

    const desc = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.RekognitionFeaturesDesc);
    aiGroup.append(desc);

    const form = $('<form/>')
      .addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    aiGroup.append(form);

    // minConfidence
    const minConfidence = this.createMinConfidenceRange();
    form.append(minConfidence);

    // basic features with dependency
    const basicOptions = [
      [OPT_CELEB, Messages.Celeb, Tooltips.Celeb],
      [OPT_FACE, Messages.Face, Tooltips.Face],
      [OPT_LABEL, Messages.Label, Tooltips.Label],
      [OPT_IMAGEPROPERTY, Messages.ImageProperty, Tooltips.ImageProperty, this.onImagePropertyChange.bind(this)],
      [OPT_MODERATION, Messages.Moderation, Tooltips.Moderation],
      // [OPT_PERSON, Messages.Person, Tooltips.Person],
      [OPT_TEXT, Messages.Text, Tooltips.Text],
      [OPT_SEGMENT, Messages.Segment, Tooltips.Segment, this.onSegmentChange.bind(this)],
    ].map((x) =>
      this.createToggle(
        ServiceNames.Rekognition,
        ...x
      ));
    form.append(basicOptions);

    // face collection id
    const faceCollection = this.createFaceCollectionFormGroup();
    form.append(faceCollection);

    // text region of interest
    const textROI = this.createTextROIFormGroup();
    form.append(textROI);

    // black frame settings
    const blackFrameSettings = this.createBlackFrameSettingsFormGroup();
    form.append(blackFrameSettings);

    // custom label models
    const customlabel = this.createCustomLabelFormGroup();
    form.append(customlabel);

    // frame capture mode
    const frameCaptureMode = this.createFrameCaptureModeFormGroup();
    form.append(frameCaptureMode);

    // scene detection
    const sceneGroup = this.createSceneFormGroup();
    form.append(sceneGroup);

    // ad break
    const adbreakGroup = this.createAdBreakFormGroup();
    form.append(adbreakGroup);

    // auto face indexer
    const faceIndexerGroup = this.createFaceIndexerFormGroup();
    form.append(faceIndexerGroup);

    // shoppable experience
    const shoppableGroup = this.createShoppableFormGroup();
    form.append(shoppableGroup);

    // zeroshot label multiselect group
    const zeroshotGroup = this.createZeroshotLabelFormGroup();
    form.append(zeroshotGroup);

    // event handling
    form.submit((event) =>
      event.preventDefault());

    return container;
  }

  createComprehendFeaturesForm() {
    const container = $('<div/>')
      .addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start');

    const aiGroup = $('<div/>')
      .addClass('mt-4');
    container.append(aiGroup);

    const title = $('<span/>')
      .addClass('d-block p-2 bg-light text-black lead')
      .html(Messages.ComprehendFeatures);
    aiGroup.append(title);

    const desc = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.ComprehendFeaturesDesc);
    aiGroup.append(desc);

    const form = $('<form/>')
      .addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    aiGroup.append(form);

    // basic options (on/off)
    const basicOptions = [
      [ServiceNames.Comprehend, OPT_ENTITY, Messages.Entity, Tooltips.Entity, this.ensureTranscribeIsEnabled.bind(this)],
      [ServiceNames.Comprehend, OPT_KEYPHRASE, Messages.Keyphrase, Tooltips.Keyphrase, this.ensureTranscribeIsEnabled.bind(this)],
      [ServiceNames.Comprehend, OPT_SENTIMENT, Messages.Sentiment, Tooltips.Sentiment, this.ensureTranscribeIsEnabled.bind(this)],
    ].map((x) =>
      this.createToggle(
        ...x
      ));
    form.append(basicOptions);

    // custom entity recognizer
    const entityRecognizer = this.createEntityRecognizerFormGroup();
    form.append(entityRecognizer);

    form.submit((event) =>
      event.preventDefault());

    return container;
  }

  createTranscribeFeaturesForm() {
    const container = $('<div/>')
      .addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start');

    const aiGroup = $('<div/>')
      .addClass('mt-4');
    container.append(aiGroup);

    const title = $('<span/>')
      .addClass('d-block p-2 bg-light text-black lead')
      .html(Messages.TranscribeFeatures);
    aiGroup.append(title);

    const desc = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.TranscribeFeaturesDesc);
    aiGroup.append(desc);

    const form = $('<form/>')
      .addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    aiGroup.append(form);

    // basic on/off options
    const basicOptions = [
      [ServiceNames.Transcribe, OPT_TRANSCRIBE, Messages.Transcribe, Tooltips.Transcribe],
    ].map((x) =>
      this.createToggle(
        ...x
      ));
    form.append(basicOptions);

    // language code
    const languageCode = this.createLanguageCodeFormGroup();
    form.append(languageCode);

    // custom vocabulary
    const customVocabulary = this.createCustomVocabularyFormGroup();
    form.append(customVocabulary);

    // custom language model
    const customLanguageModel = this.createCustomLanguageModelFormGroup();
    form.append(customLanguageModel);

    // toxicity
    const toxicity = this.createToxicityFormGroup();
    form.append(toxicity);

    // analyse conversation
    const conversation = this.createConversationFormGroup();
    form.append(conversation);

    // event handling
    form.submit((event) =>
      event.preventDefault());

    return container;
  }

  createTextractFeaturesForm() {
    const container = $('<div/>')
      .addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start');

    const aiGroup = $('<div/>')
      .addClass('mt-4');
    container.append(aiGroup);

    const title = $('<span/>')
      .addClass('d-block p-2 bg-light text-black lead')
      .html(Messages.TextractFeatures);
    aiGroup.append(title);

    const desc = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.TextractFeaturesDesc);
    aiGroup.append(desc);

    const form = $('<form/>')
      .addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    aiGroup.append(form);

    // basic options (on/off)
    const basicOptions = [
      OPT_TEXTRACT,
    ].map((x) => {
      const x0 = x.charAt(0).toUpperCase() + x.slice(1);

      return this.createToggle(
        ServiceNames.Textract,
        x,
        Messages[x0],
        Tooltips[x0]
      );
    });
    form.append(basicOptions);

    form.submit((event) =>
      event.preventDefault());

    return container;
  }

  createControls() {
    if (!this.canModify) {
      return undefined;
    }

    const form = $('<form/>')
      .addClass('form-inline');

    const btnGroup = $('<div/>')
      .addClass('ml-auto');
    form.append(btnGroup);

    const applyAll = $('<button/>')
      .addClass('btn btn-outline-success ml-1')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.ApplyToAllUsers)
      .html(Buttons.ApplyToAllUsers)
      .tooltip({
        trigger: 'hover',
      });
    btnGroup.append(applyAll);

    const restoreOriginal = $('<button/>')
      .addClass('btn btn-secondary ml-1')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.RestoreOriginal)
      .html(Buttons.RestoreOriginal)
      .tooltip({
        trigger: 'hover',
      });
    btnGroup.append(restoreOriginal);

    // event handling
    form.submit((event) =>
      event.preventDefault());

    applyAll.on('click', async () =>
      this.storeGlobalSettings());

    restoreOriginal.on('click', async () =>
      this.restoreFactorySettings());

    return form;
  }

  createMinConfidenceRange() {
    const id = `${OPT_MINCONFIDENCE}-${this.$mixerId}`;

    const formGroup = $('<div/>')
      .addClass('form-group col-10 px-0 mt-2 mb-2');

    const label = $('<label/>')
      .addClass('col-4 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.MinConfidence)
      .html(Messages.MinConfidence);
    label.tooltip({
      trigger: 'hover',
    });
    formGroup.append(label);

    let minConfidence = this.aiOptions[OPT_MINCONFIDENCE];

    const range = $('<input/>')
      .addClass('custom-range col-6')
      .attr('data-type', OPT_MINCONFIDENCE)
      .attr('type', 'range')
      .attr('min', 0)
      .attr('max', 100)
      .attr('value', minConfidence)
      .attr('step', 1)
      .attr('id', id);
    formGroup.append(range);

    const input = $('<input/>')
      .addClass('col-1 text-center text-muted ml-1')
      .attr('data-type', OPT_MINCONFIDENCE)
      .attr('type', 'text')
      .attr('value', minConfidence)
      .attr('disabled', 'disabled')
      .attr('id', `${id}-text`);
    formGroup.append(input);

    // event handling
    range.on('input', () => {
      minConfidence = Number(range.val());
      this.aiOptions[OPT_MINCONFIDENCE] = minConfidence;
      input.val(minConfidence);
    });

    return formGroup;
  }

  createToggle(
    category,
    type,
    name,
    tooltip,
    handler
  ) {
    const formGroup = $('<div/>')
      .addClass('form-group col-5 px-0 mt-2 mb-2');

    const inputGroup = $('<div/>')
      .addClass('input-group col-12 pl-0');
    formGroup.append(inputGroup);

    const title = $('<span/>')
      .addClass('col-8 px-0')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', tooltip)
      .html(name);
    title.tooltip({
      trigger: 'hover',
    });
    inputGroup.append(title);

    const label = $('<label/>')
      .addClass('xs-switch');
    inputGroup.append(label);

    const input = $('<input/>')
      .attr('name', type)
      .attr('type', 'checkbox')
      .attr('data-category', category)
      .attr('data-type', type);
    label.append(input);

    const slider = $('<span/>')
      .addClass('xs-slider round');
    label.append(slider);

    if (!this.checkDetectionSupported(type)) {
      input.attr('disabled', 'disabled');
      formGroup.addClass('text-muted');
    } else if (this.aiOptions[type]) {
      input.attr('checked', 'checked');
    }

    // event handling
    input.on('click', async () => {
      const to = input.prop('checked');
      this.aiOptions[type] = to;
      if (handler) {
        await handler(type, to);
      }
    });

    return formGroup;
  }

  createInputCropSettingsFormGroup() {
    const formItems = [];

    const formDesc = $('<p/>')
      .addClass('lead-s')
      .html(Messages.InputCropDesc);
    formItems.push(formDesc);

    // maintain aspect ratio
    const opt = 'keepAR';
    const title = Messages.InputCropKeepAR;
    const tooltip = Tooltips.InputCropKeepAR;

    const formGroup = $('<div/>')
      .addClass('form-group col-10 px-0 mt-2 mb-2');
    formItems.push(formGroup);

    const inputGroup = $('<div/>')
      .addClass('input-group col-12 pl-0 lead-xs b-400');
    formGroup.append(inputGroup);

    const name = $('<span/>')
      .addClass('col-4 px-0')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', tooltip)
      .html(title);
    name.tooltip({
      trigger: 'hover',
    });
    inputGroup.append(name);

    const label = $('<label/>')
      .addClass('xs-switch');
    inputGroup.append(label);

    const input = $('<input/>')
      .attr('name', opt)
      .attr('type', 'checkbox');
    label.append(input);

    const slider = $('<span/>')
      .addClass('xs-slider round');
    label.append(slider);

    if (this[opt]) {
      input.attr('checked', 'checked');
    }

    // cropX and cropY
    [
      ['cropX', Messages.InputCropX, Tooltips.InputCropX, [0, 20, 2]],
      ['cropY', Messages.InputCropY, Tooltips.InputCropY, [0, 20, 2]],
    ].forEach((item) => {
      const [
        _opt,
        _title,
        _tooltip,
        _minMaxStep,
      ] = item;

      const _formGroup = this.createRangeFormGroup(
        _opt,
        _title,
        _tooltip,
        _minMaxStep
      );
      formItems.push(_formGroup);
    });

    // event handling
    input.on('click', async () => {
      const to = input.prop('checked');
      this[opt] = to;
    });

    return formItems;
  }

  createFaceCollectionFormGroup() {
    const formGroup = this.createCustomFormGroup({
      name: OPT_FACECOLLECTIONID,
      label: Messages.FaceCollectionId,
      tooltip: Tooltips.FaceCollection,
      default: Messages.SelectCollection,
      afterChange: this.onFaceCollectionChange.bind(this),
    });

    formGroup.ready(async () => {
      const faceCollections = await this.getAvailableFaceCollections();

      const options = faceCollections
        .map((faceCollection) => {
          const faces = faceCollection.faces;
          const value = faceCollection.name;
          const name = `${value} (${faces} faces)`;

          return {
            name,
            value,
            canUse: true, // (faces > 0),
          };
        });

      if (options.length > 0) {
        this.refreshCustomFormOptions({
          name: OPT_FACECOLLECTIONID,
          options,
        });
      }
    });

    return formGroup;
  }

  createCustomLabelFormGroup() {
    const message = Messages.CustomlabelDesc
      .replace('{{MAX_CUSTOMALBELMODELS}}', MAX_CUSTOMALBELMODELS);

    const desc = $('<p/>')
      .addClass('lead-s mt-4')
      .html(message);

    const customLabelModels = this.createMultiselectFormGroup({
      name: OPT_CUSTOMLABELMODELS,
      label: Messages.CustomLabelModels,
      tooltip: Tooltips.CustomLabelModels,
      default: Messages.SelectModels,
      listSelection: this.getAvailableCustomLabelModels.bind(this),
      beforeChange: this.onCustomLabelModelChange.bind(this),
    });

    return [
      desc,
      customLabelModels,
    ];
  }

  createFrameCaptureModeFormGroup() {
    const desc = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.FramebasedDesc);

    const formGroup = this.createCustomFormGroup({
      name: OPT_FRAMECATPUREMODE,
      label: Messages.FrameCaptureMode,
      tooltip: Tooltips.FrameCaptureMode,
      // default: Messages.SelectFrameCaptureMode,
      afterChange: this.onFrameCaptureModeChange.bind(this),
    });

    formGroup.ready(() => {
      this.refreshCustomFormOptions({
        name: OPT_FRAMECATPUREMODE,
        options: AVAILABLE_FRAMECAPTUREMODES,
      });
    });

    return [
      desc,
      formGroup,
    ];
  }

  createTextROIFormGroup() {
    const id = `${OPT_TEXTROI}-${this.mixerId}`;
    const formGroup = $('<div/>')
      .addClass('form-group col-10 px-0 my-2');

    const label = $('<div/>')
      .addClass('col-4 px-0 justify-content-start mb-auto')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.TextROI)
      .html(Messages.TextROI);

    label.tooltip({
      trigger: 'hover',
    });
    formGroup.append(label);

    const gridContainer = $('<div/>')
      .addClass('col-7 m-0 p-0')
      .attr('id', id);
    formGroup.append(gridContainer);

    const grids = $('<div/>')
      .addClass('row no-gutters')
      .addClass('text-roi-screen')
      .attr('data-type', OPT_TEXTROI);
    gridContainer.append(grids);

    const curROI = this.aiOptions[OPT_TEXTROI];
    TEXTROI_GRIDS.forEach((x, i) => {
      const grid = $('<div/>')
        .attr('data-index', i)
        .addClass('col-4')
        .addClass('d-flex text-roi-grid');

      if (curROI[i] === true) {
        grid.addClass('text-roi-grid-active');
      }
      grids.append(grid);

      const text = $('<div/>')
        .addClass('mx-auto my-auto lead-sm b-400')
        .html(x);
      grid.append(text);

      // event handling
      grid.on('click', async () => {
        const active = grid.hasClass('text-roi-grid-active');

        if (active) {
          grid.removeClass('text-roi-grid-active');
          this.aiOptions[OPT_TEXTROI][i] = false;
        } else {
          grid.addClass('text-roi-grid-active');
          this.aiOptions[OPT_TEXTROI][i] = true;
        }
      });
    });

    return formGroup;
  }

  createRangeFormGroup(
    opt,
    title,
    tooltip,
    minMaxStep
  ) {
    const [min, max, step] = minMaxStep;
    const id = [
      opt,
      this.mixerId,
    ].join('-');

    const formGroup = $('<div/>')
      .addClass('form-group col-10 px-0 my-2');

    const label = $('<label/>')
      .addClass('col-3 px-0 justify-content-start mb-auto')
      .addClass('lead-xs b-400')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', tooltip)
      .html(title);
    label.tooltip({
      trigger: 'hover',
    });
    formGroup.append(label);

    // range
    const value = this[opt];
    const range = $('<input/>')
      .addClass('custom-range')
      .addClass('col-7 m-0 pr-2 ml-4')
      .attr('type', 'range')
      .attr('min', min)
      .attr('max', max)
      .attr('step', step)
      .attr('value', value)
      .attr('id', id);
    formGroup.append(range);

    const rangeText = $('<input/>')
      .addClass('col-1 text-center text-muted p-0 lead-xs b-500')
      .attr('type', 'text')
      .attr('name', opt)
      .attr('value', value)
      .attr('disabled', 'disabled');
    formGroup.append(rangeText);

    range.on('input', () => {
      const val = Number(range.val());
      rangeText.val(val);
      this[opt] = Number(val);
    });

    return formGroup;
  }

  createBlackFrameSettingsFormGroup() {
    const formItems = [];

    const formDesc = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.BlackFrameDesc);
    formItems.push(formDesc);

    [
      // pixel threshold
      ['maxPixelThreshold', Messages.BlackFramePixelThreshold, Tooltips.BlackFramePixelThreshold, [0, 0.3, 0.05]],
      // coverage percentage
      ['minCoveragePercentage', Messages.BlackFrameCoveragePercentage, Tooltips.BlackFrameCoveragePercentage, [90, 100, 0.5]],
    ].forEach((item) => {
      const [
        opt,
        title,
        tooltip,
        minMaxStep,
      ] = item;

      const formGroup = this.createRangeFormGroup(
        opt,
        title,
        tooltip,
        minMaxStep
      );
      formItems.push(formGroup);
    });

    [
      ['enableTechnicalCue', Messages.EnableTechnicalCue, Tooltips.EnableTechnicalCue],
    ].forEach((item) => {
      const formGroup = this.createFilterToggle(item);
      formItems.push(formGroup);
    });

    return formItems;
  }

  createSceneFormGroup() {
    const formItems = [];

    const description = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.SceneDesc);
    formItems.push(description);

    const toggle = this.createToggle(
      ServiceNames.Rekognition,
      OPT_SCENE,
      Messages.Scene,
      Tooltips.Scene,
      this.onSceneChange.bind(this)
    );
    formItems.push(toggle);

    [
      ['minFrameSimilarity', Messages.MinFrameSimilarity, Tooltips.MinFrameSimilarity, [0.5, 1.0, 0.05]],
      ['maxTimeDistance', Messages.MaxTimeDistance, Tooltips.MaxTimeDistance, [1, 10, 0.5]],
    ].forEach((item) => {
      const [
        opt,
        title,
        tooltip,
        minMaxStep,
      ] = item;

      const formGroup = this.createRangeFormGroup(
        opt,
        title,
        tooltip,
        minMaxStep
      );
      formItems.push(formGroup);
    });

    [
      ['enhanceWithTranscript', Messages.SceneEnhanceWithTranscript, Tooltips.SceneEnhanceWithTranscript],
      ['enhanceWithLLM', Messages.SceneEnhanceWithLLM, Tooltips.SceneEnhanceWithLLM],
    ].forEach((item) => {
      const formGroup = this.createFilterToggle(item);
      formItems.push(formGroup);
    });

    return formItems;
  }

  createAdBreakFormGroup() {
    const formItems = [];

    const description = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.AdBreakDesc);
    formItems.push(description);

    const toggle = this.createToggle(
      ServiceNames.Rekognition,
      OPT_AD_BREAK,
      Messages.AdBreak,
      Tooltips.AdBreak,
      this.onAdBreakChange.bind(this)
    );
    formItems.push(toggle);

    [
      // break interval (in minutes)
      ['breakInterval', Messages.AdBreakInterval, Tooltips.AdBreakInterval, [0, 20, 1]],
      // break offset (in minutes)
      ['breakOffset', Messages.AdBreakOffset, Tooltips.AdBreakOffset, [0, 5, 0.5]],
      // weight proportion
      ['pauseWeight', Messages.PauseWeight, Tooltips.AdBreakWeight, [0, 1, 0.1]],
      ['quietnessWeight', Messages.QuietnessWeight, Tooltips.AdBreakWeight, [0, 1, 0.1]],
      ['contextualWeight', Messages.ContextualWeight, Tooltips.AdBreakWeight, [0, 1, 0.1]],
    ].forEach((item) => {
      const [
        opt,
        title,
        tooltip,
        minMaxStep,
      ] = item;

      const formGroup = this.createRangeFormGroup(
        opt,
        title,
        tooltip,
        minMaxStep
      );
      formItems.push(formGroup);
    });

    return formItems;
  }

  createFaceIndexerFormGroup() {
    const formItems = [];

    const description = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.AutoFaceIndexerDesc);
    formItems.push(description);

    const toggle = this.createToggle(
      ServiceNames.Rekognition,
      OPT_AUTO_FACE_INDEXER,
      Messages.AutoFaceIndexer,
      Tooltips.AutoFaceIndexer,
      this.onAutoFaceIndex.bind(this)
    );
    formItems.push(toggle);

    [
      // minimum face width/height
      ['minFaceW', Messages.MinFaceWidth, Tooltips.MinFaceValue, [48, 192, 2]],
      ['minFaceH', Messages.MinFaceHeight, Tooltips.MinFaceValue, [48, 192, 2]],
      // brightness/sharpness
      ['minBrightness', Messages.MinFaceBrightness, Tooltips.MinFaceValue, [0, 100, 1]],
      ['minSharpness', Messages.MinFaceSharpness, Tooltips.MinFaceValue, [0, 100, 1]],
      // maximum pitch/roll/yaw
      ['maxPitch', Messages.MaxPosePitch, Tooltips.MaxPoseThreshold, [0, 90, 1]],
      ['maxRoll', Messages.MaxPoseRoll, Tooltips.MaxPoseThreshold, [0, 90, 1]],
      ['maxYaw', Messages.MaxPoseYaw, Tooltips.MaxPoseThreshold, [0, 90, 1]],
      // celeb confidence
      ['minCelebConfidence', Messages.MinCelebConfidence, Tooltips.MinCelebConfidence, [80, 100, 0.5]],
    ].forEach((item) => {
      const [
        opt,
        title,
        tooltip,
        minMaxStep,
      ] = item;

      const formGroup = this.createRangeFormGroup(
        opt,
        title,
        tooltip,
        minMaxStep
      );
      formItems.push(formGroup);
    });

    [
      ['occludedFaceFiltering', Messages.OccludedFaceFiltering, Tooltips.OccludedFaceFiltering],
    ].forEach((item) => {
      const formGroup = this.createFilterToggle(item);
      formItems.push(formGroup);
    });

    return formItems;
  }

  createShoppableFormGroup() {
    const description = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.ShoppableDesc);

    const toggle = this.createToggle(
      ServiceNames.Rekognition,
      OPT_SHOPPABLE,
      Messages.Shoppable,
      Tooltips.Shoppable,
      this.onShoppableChange.bind(this)
    );

    return [
      description,
      toggle,
    ];
  }

  createZeroshotLabelFormGroup() {
    const description = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.ZeroshotLabelDesc);

    const selection = this.createMultiselectFormGroup({
      name: OPT_ZEROSHOT_LABELS,
      label: Messages.ZeroshotLabel,
      tooltip: Tooltips.ZeroshotLabel,
      default: Messages.SelectModels,
      listSelection: this.getAvailableZeroshotModels.bind(this),
      beforeChange: this.onZeroshotModelChange.bind(this),
    });

    return [
      description,
      selection,
    ];
  }

  createLanguageCodeFormGroup() {
    const formGroup = this.createCustomFormGroup({
      name: OPT_LANGUAGECODE,
      label: Messages.LanguageCode,
      tooltip: Tooltips.LanguageCode,
      default: Messages.SelectLanguageCode,
    });

    formGroup.ready(() => {
      this.refreshCustomFormOptions({
        name: OPT_LANGUAGECODE,
        options: LanguageCodes,
      });
    });

    return formGroup;
  }

  createCustomVocabularyFormGroup() {
    const formGroup = this.createCustomFormGroup({
      name: OPT_CUSTOMVOCABULARY,
      label: Messages.CustomVocabulary,
      tooltip: Tooltips.CustomVocabulary,
      default: Messages.SelectModel,
    });

    formGroup.ready(async () => {
      let options = await this.getAvailableCustomVocabulary();

      if (options.length > 0) {
        options = options
          .map((option) => ({
            canUse: option.canUse,
            name: `${option.name} (${option.languageCode})`,
            value: option.name,
          }));
        this.refreshCustomFormOptions({
          name: OPT_CUSTOMVOCABULARY,
          options,
        });
      }
    });

    return formGroup;
  }

  createCustomLanguageModelFormGroup() {
    const formGroup = this.createCustomFormGroup({
      name: OPT_CUSTOMLANGUAGEMODEL,
      label: Messages.CustomLanguageModel,
      tooltip: Tooltips.CustomLanguageModel,
      default: Messages.SelectModel,
    });

    formGroup.ready(async () => {
      let options = await this.getAvailableCustomLanguageModels();
      if (options.length > 0) {
        options = options
          .map((option) => ({
            canUse: option.canUse,
            name: `${option.name} (${option.languageCode})`,
            value: option.name,
          }));
        this.refreshCustomFormOptions({
          name: OPT_CUSTOMLANGUAGEMODEL,
          options,
        });
      }
    });

    return formGroup;
  }

  createEntityRecognizerFormGroup() {
    const formGroup = this.createCustomFormGroup({
      name: OPT_CUSTOMENTITYRECOGNIZER,
      label: Messages.CustomEntityRecognizer,
      tooltip: Tooltips.CustomEntityRecognizer,
      default: Messages.SelectModel,
      afterChange: this.onEntityRecognizerChange.bind(this),
    });

    formGroup.ready(async () => {
      const options = await this.getAvailableCustomEntityRecognizers();

      if (options.length > 0) {
        this.refreshCustomFormOptions({
          name: OPT_CUSTOMENTITYRECOGNIZER,
          options,
        });
      }
    });

    return formGroup;
  }

  createToxicityFormGroup() {
    const description = $('<p/>')
      .addClass('lead-s mt-4')
      .html(Messages.ToxicityDesc);

    const toggle = this.createToggle(
      ServiceNames.Transcibe,
      OPT_TOXICITY,
      Messages.Toxicity,
      Tooltips.Toxicity,
      this.onToxicityChange.bind(this)
    );
    return [
      description,
      toggle,
    ];
  }

  createConversationFormGroup() {
    const item = [
      'analyseConversation',
      Messages.AnalyseConversation,
      Tooltips.AnalyseConversation,
    ];

    const formGroup = this.createFilterToggle(item, '');

    return formGroup;
  }

  createFilterToggle(item, fontClass = 'lead-xs b-400') {
    const [opt, title, tooltip] = item;

    const formGroup = $('<div/>')
      .addClass('form-group col-10 px-0 mt-2 mb-2');

    const inputGroup = $('<div/>')
      .addClass('input-group col-12 pl-0')
      .addClass(fontClass);
    formGroup.append(inputGroup);

    const name = $('<span/>')
      .addClass('col-4 px-0')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', tooltip)
      .html(title);
    name.tooltip({
      trigger: 'hover',
    });
    inputGroup.append(name);

    const label = $('<label/>')
      .addClass('xs-switch');
    inputGroup.append(label);

    const input = $('<input/>')
      .attr('name', opt)
      .attr('type', 'checkbox');
    label.append(input);

    const slider = $('<span/>')
      .addClass('xs-slider round');
    label.append(slider);

    if (this[opt]) {
      input.attr('checked', 'checked');
    }

    // event handling
    input.on('click', async () => {
      const to = input.prop('checked');
      this[opt] = to;
    });

    return formGroup;
  }

  createCustomFormGroup(custom) {
    const formGroup = $('<div/>')
      .addClass('form-group col-10 px-0 my-2');

    const id = `${custom.name}-${this.mixerId}`;
    const label = $('<label/>')
      .addClass('col-4 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', custom.tooltip)
      .html(custom.label);

    label.tooltip({
      trigger: 'hover',
    });
    formGroup.append(label);

    const select = $('<select/>')
      .addClass('custom-select custom-select-sm col-7')
      .attr('data-type', custom.name)
      .attr('id', id);
    formGroup.append(select);

    if (custom.default) {
      const option = $('<option/>')
        .attr('value', 'undefined')
        .html(custom.default);
      select.append(option);
    }

    // event handling
    select.on('change', async () => {
      let val = select.val();

      if (val === 'undefined') {
        val = undefined;
      } else if (/^[0-9]+$/.test(val)) {
        val = Number(val);
      }

      this.aiOptions[custom.name] = val;

      if (typeof custom.afterChange === 'function') {
        await custom.afterChange(custom.name, val);
      }
    });

    return formGroup;
  }

  refreshCustomFormOptions(custom) {
    const select = this.parentContainer
      .find(`select[data-type="${custom.name}"]`);

    // select.children('option[value!="undefined"]')
    select.find('option[value!="undefined"]')
      .remove();

    custom.options.forEach((x) => {
      const option = $('<option/>')
        .attr('value', x.value)
        .html(x.name);

      if (x.canUse === false) {
        option.attr('disabled', 'disabled');
      } else {
        option.removeAttr('disabled');
        if (this.aiOptions[custom.name] !== undefined
          && this.aiOptions[custom.name] === x.value) {
          option.attr('selected', 'selected');
        }
      }
      select.append(option);
    });

    if (!this.canModify) {
      select.attr('disabled', 'disabled');
    }
  }

  createMenuItem(
    item,
    selectedModels,
    availableModel,
    toggleBtn
  ) {
    const canUse = availableModel.canUse;
    const value = availableModel.name;
    let name = availableModel.displayName;
    if (!name) {
      name = value.split('/').shift();
    }

    const menuItem = $('<a/>')
      .addClass('dropdown-item')
      .attr('href', '#')
      .attr('data-value', value)
      .html(name);

    if (canUse !== true) {
      menuItem.attr('disabled', 'disabled');
    } else if (selectedModels.includes(value)) {
      menuItem.addClass('active');
    }

    menuItem.on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const isActive = menuItem.hasClass('active');
      let canChange = true;

      if (typeof item.beforeChange === 'function') {
        canChange = await item.beforeChange(
          value,
          !isActive
        );
      }

      if (canChange && isActive) {
        menuItem.removeClass('active');
      } else if (canChange && !isActive) {
        menuItem.addClass('active');
      }

      this.updateMenuToggleText(
        toggleBtn,
        this.aiOptions[item.name],
        item.default
      );
    });

    return menuItem;
  }

  updateMenuToggleText(toggleBtn, selectedModels, defaultText) {
    let texts = selectedModels
      .map((model) =>
        `${model.substring(0, 5)}...`);

    if (texts.length === 0) {
      texts = defaultText;
    }

    toggleBtn.text(texts);
  }

  createMultiselectFormGroup(custom) {
    const id = `${custom.name}-${this.mixerId}`;

    const formGroup = $('<div/>')
      .addClass('form-group col-10 px-0 my-2');

    const label = $('<label/>')
      .addClass('col-4 px-0 justify-content-start')
      .attr('for', id)
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', custom.tooltip)
      .html(custom.label);
    label.tooltip({
      trigger: 'hover',
    });
    formGroup.append(label);

    const dropdown = $('<div/>')
      .addClass('dropdown col-8');
    formGroup.append(dropdown);

    const toggleBtn = $('<button/>')
      .addClass('col-8 btn btn-sm btn-outline-dark overflow-auto')
      .addClass('dropdown-toggle')
      .attr('type', 'button')
      .attr('id', id)
      .attr('data-toggle', 'dropdown')
      .attr('aria-haspopup', true)
      .attr('aria-expanded', false)
      .html(custom.default);
    dropdown.append(toggleBtn);

    const menu = $('<div/>')
      .addClass('dropdown-menu col-12 lead-xs')
      .attr('data-type', custom.name)
      .attr('aria-labelledby', id);
    dropdown.append(menu);

    const deselectAllMenuItems = $('<a/>')
      .addClass('dropdown-item')
      .attr('href', '#')
      .attr('data-value', 'undefined')
      .html(Messages.SelectNone);
    menu.append(deselectAllMenuItems);

    const divider = $('<div/>')
      .addClass('dropdown-divider');
    menu.append(divider);

    // event handling
    formGroup.ready(async () => {
      const selectedModels = this.aiOptions[custom.name];

      let availableModels = [];
      if (typeof custom.listSelection === 'function') {
        availableModels = await custom.listSelection();
      }

      // adding available models to the menu
      availableModels.forEach((availableModel) => {
        const menuItem = this.createMenuItem(
          custom,
          selectedModels,
          availableModel,
          toggleBtn
        );
        menu.append(menuItem);
      });

      this.updateMenuToggleText(
        toggleBtn,
        selectedModels,
        custom.default
      );
    });

    deselectAllMenuItems.on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      let canChange = false;
      if (typeof custom.beforeChange === 'function') {
        canChange = await custom.beforeChange('undefined', true);
      }

      if (canChange) {
        menu.find('a.dropdown-item')
          .removeClass('active');
        toggleBtn.html(custom.default);
      }
    });

    return formGroup;
  }

  checkDetectionSupported(type) {
    // explicitly disabled these options for now
    if (DISABLED_FEATURES.includes(type)) {
      return false;
    }

    let options;
    options = [
      OPT_CELEB,
      OPT_FACE,
      OPT_LABEL,
      OPT_MODERATION,
      // OPT_PERSON,
      OPT_TEXT,
      OPT_SEGMENT,
      OPT_IMAGEPROPERTY,
      OPT_AD_BREAK,
      OPT_AUTO_FACE_INDEXER,
      OPT_SCENE,
      OPT_SHOPPABLE,
    ];
    if (options.includes(type)) {
      return this.serviceAvailability[ServiceNames.Rekognition];
    }

    options = [
      OPT_TRANSCRIBE,
      OPT_TOXICITY,
    ];
    if (options.includes(type)) {
      return this.serviceAvailability[ServiceNames.Transcribe];
    }

    options = [OPT_ENTITY, OPT_KEYPHRASE, OPT_SENTIMENT];
    if (options.includes(type)) {
      return this.serviceAvailability[ServiceNames.Comprehend];
    }

    options = [OPT_TEXTRACT];
    if (options.includes(type)) {
      return this.serviceAvailability[ServiceNames.Textract];
    }

    // feature only rely on open source models
    options = [OPT_ZEROSHOT_LABELS];
    if (options.includes(type)) {
      return true;
    }

    return false;
  }

  async checkServiceAvailability() {
    const availibity = GetServiceAvailability();
    return availibity.detectServices();
  }

  async getAvailableFaceCollections() {
    const faceManager = GetFaceManager();

    if (this.serviceAvailability[ServiceNames.Rekognition]) {
      return faceManager.getCollections();
    }

    return [];
  }

  async getAvailableCustomLabelModels() {
    if (this.serviceAvailability[ServiceNames.Rekognition]) {
      return ApiHelper.getRekognitionCustomLabelModels();
    }

    return [];
  }

  async getAvailableCustomVocabulary() {
    if (this.serviceAvailability[ServiceNames.Transcribe]) {
      return ApiHelper.getTranscribeCustomVocabulary();
    }

    return [];
  }

  async getAvailableCustomLanguageModels() {
    if (this.serviceAvailability[ServiceNames.Transcribe]) {
      return ApiHelper.getTranscribeCustomLanguageModels();
    }

    return [];
  }

  async getAvailableCustomEntityRecognizers() {
    if (this.serviceAvailability[ServiceNames.Transcribe]
      && this.serviceAvailability[ServiceNames.Comprehend]) {
      return ApiHelper.getComprehendCustomEntityRecognizers();
    }

    return [];
  }

  async getAvailableZeroshotModels() {
    const models = [];

    // models.push({
    //   name: 'apparel-object-detection',
    //   displayName: 'Apparel object detection',
    //   canUse: true,
    // });

    // models.push({
    //   name: 'moderation-classification',
    //   displayName: 'Moderation classification',
    //   canUse: true,
    // });

    return models;
  }

  updateControls() {
    const aioptions = this.aiOptions;

    // on/off checkboxes
    const checkboxes = {
      [ServiceNames.Rekognition]: [
        OPT_CELEB,
        OPT_FACE,
        OPT_LABEL,
        OPT_MODERATION,
        // OPT_PERSON,
        OPT_TEXT,
        OPT_SEGMENT,
        OPT_IMAGEPROPERTY,
        OPT_AD_BREAK,
        OPT_AUTO_FACE_INDEXER,
        OPT_ZEROSHOT_LABELS,
        OPT_SHOPPABLE,
        OPT_SCENE,
      ],
      [ServiceNames.Transcribe]: [
        OPT_TRANSCRIBE,
        OPT_TOXICITY,
      ],
      [ServiceNames.Comprehend]: [
        OPT_ENTITY,
        OPT_KEYPHRASE,
        OPT_SENTIMENT,
      ],
      [ServiceNames.Textract]: [
        OPT_TEXTRACT,
      ],
    };

    Object.keys(checkboxes)
      .forEach((category) => {
        const types = checkboxes[category];
        types.forEach((type) => {
          this.updateCheckboxInput(
            category,
            type,
            aioptions[type]
          );
        });
      });

    // single select
    [
      OPT_FACECOLLECTIONID,
      OPT_FRAMECATPUREMODE,
      OPT_LANGUAGECODE,
      OPT_CUSTOMVOCABULARY,
      OPT_CUSTOMLANGUAGEMODEL,
      OPT_CUSTOMENTITYRECOGNIZER,
    ].forEach((opt) => {
      this.updateSelectOption(opt, aioptions[opt]);
    });

    // update multiselect dropdown
    [
      [OPT_CUSTOMLABELMODELS, aioptions[OPT_CUSTOMLABELMODELS], Messages.SelectModels],
    ].forEach((x) => {
      this.updateMultiselectOptions(
        ...x
      );
    });

    // minConfidence
    this.updateMinConfidenceRange(
      aioptions[OPT_MINCONFIDENCE]
    );

    // textROI
    this.updateTextROICheckStates(aioptions[OPT_TEXTROI]);
  }

  updateCheckboxInput(category, type, checked) {
    const input = this.findCheckboxInput(category, type);
    const formGroup = input.closest('div.form-group');

    if (!this.checkDetectionSupported(type)) {
      formGroup.addClass('text-muted');
      input.attr('disabled', 'disabled');
    } else {
      formGroup.removeClass('text-muted');
      input.removeAttr('disabled');

      const _checked = input.prop('checked');
      if (_checked !== checked) {
        input.trigger('click');
      }
    }

    if (!this.canModify) {
      input.attr('disabled', 'disabled');
    }
  }

  updateSelectOption(type, value) {
    const select = this.parentContainer
      .find(`select[data-type=${type}]`);

    let _value = value;
    if (_value === undefined) {
      _value = 'undefined';
    } else {
      _value = String(_value);
    }

    const selected = select.val();

    if (_value !== selected) {
      select.val(_value)
        .trigger('change');
    }
  }

  updateMultiselectOptions(type, values, defaultText) {
    const dropdown = this.parentContainer
      .find(`div.dropdown-menu[data-type=${type}]`);

    const menuItems = dropdown
      .children('a.dropdown-item');

    menuItems.each((k, v) => {
      const item = $(v);
      const value = item.prop('data');

      if (values.includes(value)) {
        item.addClass('active');
      } else {
        item.removeClass('active');
      }
    });

    const toggleBtn = dropdown
      .siblings('button.dropdown-toggle')
      .first();

    let text = values
      .map((value) =>
        `${value.substring(0, 5)}...`);

    if (text.length === 0) {
      text = defaultText;
    }
    toggleBtn.text(text);

    if (!this.canModify) {
      toggleBtn.attr('disabled', 'disabled');
    }
  }

  updateMinConfidenceRange(value) {
    const type = OPT_MINCONFIDENCE;
    const input = this.parentContainer
      .find(`input[data-type=${type}]`);

    input.val(value);

    if (!this.canModify) {
      input.attr('disabled', 'disabled');
    }
  }

  updateTextROICheckStates(textROI) {
    const screen = this.parentContainer
      .find(`div[data-type=${OPT_TEXTROI}]`);

    screen.children()
      .each((k, v) => {
        const grid = $(v);
        const idx = Number(grid.data('index'));

        if (textROI[idx]) {
          grid.addClass('text-roi-grid-active');
        } else {
          grid.removeClass('text-roi-grid-active');
        }
      });
  }

  async loadLocalSettings() {
    let promises = [];

    promises.push(this.getGlobalAIOptions());
    promises.push(this.getItem(OPT_AIOPTIONS));
    promises = await Promise.all(promises);

    return promises
      .reduce((a0, c0) => ({
        ...a0,
        ...c0,
      }), {});
  }

  async restoreFactorySettings() {
    try {
      Spinner.loading();

      // reset aiOptions
      this.aiOptions = JSON.parse(JSON.stringify(AIML));

      const promises = [];
      // delete global options
      promises.push(ApiHelper.setGlobalAIOptions(this.aiOptions));
      // delete local cache
      promises.push(this.deleteItem(OPT_AIOPTIONS));

      await Promise.all(promises);

      this.updateControls();
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }

  async storeGlobalSettings() {
    try {
      Spinner.loading();
      await this.saveAIOptions();
      await ApiHelper.setGlobalAIOptions(this.aiOptions);
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }

  async getGlobalAIOptions() {
    return ApiHelper.getGlobalAIOptions()
      .catch((e) =>
        JSON.parse(JSON.stringify(AIML)));
  }

  async removeGlobalAIOptions() {
    return ApiHelper.deleteGlobalAIOptions();
  }

  async onFaceManagerEvent(
    event,
    data
  ) {
    if (!this.parentContainer) {
      return;
    }

    const select = this.parentContainer
      .find(`select[data-type=${OPT_FACECOLLECTIONID}]`);

    const currentSelected = select
      .children('option:selected')
      .first()
      .val();

    const faceCollections = await this.getAvailableFaceCollections();

    const options = faceCollections
      .map((faceCollection) => {
        const faces = faceCollection.faces;
        const value = faceCollection.name;
        const name = `${value} (${faces} faces)`;

        return {
          name,
          value,
          canUse: true,
        };
      });

    this.refreshCustomFormOptions({
      name: OPT_FACECOLLECTIONID,
      options,
    });

    if (currentSelected && currentSelected !== 'undefined') {
      const found = faceCollections
        .find((x) =>
          x.name === currentSelected);

      if (found && found.faces > 0) {
        select.val(found.name)
          .trigger('change');
      }
    }
  }

  findCheckboxInput(category, type) {
    let query = `input[type="checkbox"][data-category="${category}"]`;
    if (type) {
      query = `${query}[data-type="${type}"]`;
    }

    return this.parentContainer
      .find(query);
  }

  async onFrameCaptureModeChange(opt, val) {
    if (opt === OPT_FRAMECATPUREMODE) {
      // set framebased (internal) flag
      if (val === undefined || val === FrameCaptureMode.MODE_NONE) {
        this.aiOptions[OPT_FRAMEBASED] = false;
      } else {
        this.aiOptions[OPT_FRAMEBASED] = true;
      }
    }
  }

  async onCustomLabelModelChange(model, enabled) {
    const opt = OPT_CUSTOMLABELMODELS;

    // deselect all menu item, reset custom label list
    if (model === 'undefined') {
      this.aiOptions[opt] = [];
      this.aiOptions[OPT_CUSTOMLABEL] = false;
      return true;
    }

    const idx = this.aiOptions[opt]
      .findIndex((x) =>
        x === model);

    // remove model from list
    if (!enabled) {
      if (idx >= 0) {
        this.aiOptions[opt].splice(idx, 1);
      }

      if (this.aiOptions[opt].length === 0) {
        this.aiOptions[OPT_CUSTOMLABEL] = false;
      } else {
        await this.ensureFrameCaptureMode(
          FrameCaptureMode.MODE_DYNAMIC_FPS
        );
      }

      return true;
    }

    // add model to list
    if (this.aiOptions[opt].length < MAX_CUSTOMALBELMODELS) {
      if (idx < 0) {
        this.aiOptions[opt].splice(
          this.aiOptions[opt].length,
          0,
          model
        );
      }

      if (this.aiOptions[opt].length > 0) {
        this.aiOptions[OPT_CUSTOMLABEL] = true;
        await this.ensureFrameCaptureMode(
          FrameCaptureMode.MODE_DYNAMIC_FPS
        );
      }

      return true;
    }

    return false;
  }

  async onAutoFaceIndex(opt, enabled) {
    if (opt === OPT_AUTO_FACE_INDEXER && enabled) {
      const dependencies = [];

      // depends on facematch/facecollection, celeb, framecapture mode
      [
        // [ServiceNames.Rekognition, OPT_CELEB],
      ].forEach((params) => {
        const input = this.findCheckboxInput(...params).first();

        const checked = input.prop('checked');
        const disabled = input.is(':disabled');

        if (!checked && !disabled) {
          dependencies.push(input);
        }
      });

      setTimeout(async () => {
        dependencies.forEach((x) => {
          x.trigger('click');
        });

        const promises = [];

        promises.push(this.ensureFrameCaptureMode(
          FrameCaptureMode.MODE_DYNAMIC_FPS
        ));
        promises.push(this.ensureFaceCollectionIsValid());

        await Promise.all(promises);
      }, 0);
    }
  }

  async onShoppableChange(opt, enabled) {
    if (enabled && opt === OPT_SHOPPABLE) {
      await this.ensureFrameCaptureMode(
        FrameCaptureMode.MODE_DYNAMIC_FPS
      );
    }
  }

  async onSceneChange(opt, enabled) {
    if (opt === OPT_SCENE && enabled) {
      const dependencies = [];
      // depends on segment and framecapture mode
      [
        [ServiceNames.Rekognition, OPT_SEGMENT],
      ].forEach((params) => {
        const input = this.findCheckboxInput(...params).first();

        const checked = input.prop('checked');
        const disabled = input.is(':disabled');

        if (!checked && !disabled) {
          dependencies.push(input);
        }
      });

      if (dependencies.length > 0) {
        setTimeout(() => {
          dependencies.forEach((x) => {
            x.trigger('click');
          });
        }, 0);
      }

      await this.ensureFrameCaptureMode(
        FrameCaptureMode.MODE_DYNAMIC_FPS
      );
    }
  }

  async onAdBreakChange(opt, enabled) {
    if (opt === OPT_AD_BREAK && enabled) {
      const dependencies = [];
      // depends on
      // scene (which depends on segment and framecapture mode),
      // label
      // and transcribe
      [
        [ServiceNames.Rekognition, OPT_LABEL],
        [ServiceNames.Rekognition, OPT_SCENE],
        [ServiceNames.Transcribe, OPT_TRANSCRIBE],
      ].forEach((params) => {
        const input = this.findCheckboxInput(...params).first();

        const checked = input.prop('checked');
        const disabled = input.is(':disabled');

        if (!checked && !disabled) {
          dependencies.push(input);
        }
      });

      if (dependencies.length > 0) {
        setTimeout(() => {
          dependencies.forEach((x) => {
            x.trigger('click');
          });
        }, 0);
      }
    }
  }

  async onZeroshotModelChange(model, enabled) {
    const opt = OPT_ZEROSHOT_LABELS;

    // deselect all menu item, reset custom label list
    if (model === 'undefined') {
      this.aiOptions[opt] = [];
      return true;
    }

    const idx = this.aiOptions[opt]
      .findIndex((x) =>
        x === model);

    // remove model from list
    if (!enabled && idx >= 0) {
      this.aiOptions[opt].splice(idx, 1);
      // add model to the list
    } else if (enabled && idx < 0) {
      this.aiOptions[opt].push(model);
    }

    if (this.aiOptions[opt].length > 0) {
      await this.ensureFrameCaptureMode(
        FrameCaptureMode.MODE_DYNAMIC_FPS
      );
    }

    return true;
  }

  async onFaceCollectionChange(opt, collectionId) {
    if (opt === OPT_FACECOLLECTIONID) {
      // set facematch flag
      if (collectionId === undefined) {
        this.aiOptions[OPT_FACEMATCH] = false;
      } else {
        this.aiOptions[OPT_FACEMATCH] = true;
      }
    }
  }

  async onImagePropertyChange(opt, enabled) {
    if (enabled && opt === OPT_IMAGEPROPERTY) {
      await this.ensureFrameCaptureMode(
        FrameCaptureMode.MODE_DYNAMIC_FPS
      );
    }
  }

  async onSegmentChange(opt, enabled) {
    // enable/disable blackframe settings
  }

  async onEntityRecognizerChange(opt, enabled) {
    if (opt === OPT_CUSTOMENTITYRECOGNIZER) {
      this.aiOptions[OPT_CUSTOMENTITY] = !!(enabled);

      // depends on Transcribe
      if (enabled) {
        await this.ensureTranscribeIsEnabled(
          OPT_TRANSCRIBE,
          enabled
        );
      }
    }
  }

  async onToxicityChange(opt, enabled) {
    if (opt === OPT_TOXICITY) {
      if (enabled) {
        await Promise.all([
          this.ensureTranscribeIsEnabled(OPT_TRANSCRIBE, enabled),
          this.ensureTranscribeLanguageCode('en-US'),
          this.ensureTranscribeCustomVocabulary('undefined'),
          this.ensureTranscribeCustomLanguageModel('undefined'),
        ]);
      }
    }
  }

  async ensureFrameCaptureMode(frameCaptureMode) {
    const select = this.parentContainer
      .find(`select[data-type=${OPT_FRAMECATPUREMODE}]`);

    let from = select.children('option:selected').first();
    from = from.val();

    // force changes if mode is none
    if (from === 'undefined'
      || from === String(FrameCaptureMode.MODE_NONE)) {
      select.val(String(frameCaptureMode))
        .trigger('change');
    }
  }

  async ensureTranscribeIsEnabled(opt, enabled) {
    if (enabled) {
      const input = this.findCheckboxInput(
        ServiceNames.Transcribe,
        OPT_TRANSCRIBE
      );

      const checked = input.prop('checked');
      const disabled = input.is(':disabled');

      if (!checked && !disabled) {
        setTimeout(() => {
          input.trigger('click');
        }, 0);
      }
    }
  }

  async ensureTranscribeLanguageCode(languageCode) {
    const select = this.parentContainer
      .find(`select[data-type=${OPT_LANGUAGECODE}]`);

    let from = select.children('option:selected').first();
    from = from.val();

    // force changes if mode is none
    if (from !== languageCode) {
      select.val(languageCode)
        .trigger('change');
    }
  }

  async ensureTranscribeCustomVocabulary(vocabulary) {
    const select = this.parentContainer
      .find(`select[data-type=${OPT_CUSTOMVOCABULARY}]`);

    let from = select.children('option:selected').first();
    from = from.val();

    // force changes if mode is none
    if (from !== vocabulary) {
      select.val(vocabulary)
        .trigger('change');
    }
  }

  async ensureTranscribeCustomLanguageModel(languageModel) {
    const select = this.parentContainer
      .find(`select[data-type=${OPT_CUSTOMLANGUAGEMODEL}]`);

    let from = select.children('option:selected').first();
    from = from.val();

    // force changes if mode is none
    if (from !== languageModel) {
      select.val(languageModel)
        .trigger('change');
    }
  }

  async ensureFaceCollectionIsValid() {
    const select = this.parentContainer
      .find(`select[data-type=${OPT_FACECOLLECTIONID}]`);

    let from = select.children('option:selected').first();
    from = from.val();

    if (from !== 'undefined') {
      return;
    }

    // force to select a face collection
    let to = select.children('option[value!="undefined"]').first();
    to = to.val();

    select.val(to)
      .trigger('change');
  }

  async saveAIOptions() {
    await this.putItem(OPT_AIOPTIONS, this.aiOptions);
    console.log(
      'aiOptions',
      this.aiOptions
    );
  }
};

export default mxAnalysisSettings;
