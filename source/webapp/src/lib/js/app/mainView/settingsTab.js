import Localization from '../shared/localization.js';
import mxAnalysisSettings from '../mixins/mxAnalysisSettings.js';
import BaseTab from '../shared/baseTab.js';

export default class SettingsTab extends mxAnalysisSettings(BaseTab) {
  constructor(defaultTab = false) {
    super(Localization.Messages.SettingsTab, {
      selected: defaultTab,
    });
  }

  get parentContainer() {
    return this.tabContent;
  }
}
