import Localization from '../../../../../../shared/localization.js';
import AnalysisTypes from '../../../../../../shared/analysis/analysisTypes.js';
import BaseComprehendTab from './baseComprehendTab.js';

export default class SentimentTab extends BaseComprehendTab {
  constructor(previewComponent, defaultTab = false) {
    super(Localization.Messages.SentimentTab, previewComponent, defaultTab);
  }

  async createContent() {
    const col = $('<div/>').addClass('col-9 my-4');
    const tracks = await this.createTimelineButtons(AnalysisTypes.Comprehend.Sentiment);
    if (!(tracks || []).length) {
      return super.createContent();
    }
    tracks.forEach(btn => col.append(btn));
    return col;
  }
}