import Localization from '../../../../../../../shared/localization.js';
import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import BaseRekognitionTab from './baseRekognitionTab.js';

export default class SegmentTab extends BaseRekognitionTab {
  constructor(previewComponent, data, defaultTab = false) {
    super(AnalysisTypes.Rekognition.Segment, previewComponent, data, defaultTab);
  }

  async createContent() {
    const col01 = await this.createButtonList();

    const col02 = $('<div/>').addClass('col-12 m-0 p-0 my-4');
    const btnEdl = await this.createEDLButton();
    if (btnEdl) {
      const edlDesc = $('<p/>').addClass('lead-sm')
        .append(Localization.Messages.DownloadEDLDesc);
      col02
        .append(edlDesc)
        .append(btnEdl);
    }
    const container = $('<div/>').addClass('col-9 m-0 p-0')
      .append(col01)
      .append(col02);
    return container;
  }

  async createButtonList() {
    const col = $('<div/>').addClass('col-12 m-0 p-0 my-4');
    const tracks = await this.createTrackButtons(this.category);
    if (!(tracks || []).length) {
      return col.html(Localization.Messages.NoData);
    }
    const enableAll = this.createEnableAll(tracks);
    col.append(enableAll);
    tracks.forEach(btn => col.append(btn));
    return col;
  }

  async createEDLButton() {
    const prefix = (this.data || {}).edl;
    if (!prefix) {
      return undefined;
    }
    const edl = 'shot_segments.edl';
    const bucket = this.media.getProxyBucket();
    const href = await this.media.getUrl(bucket, `${prefix}/${edl}`);
    const btnEdl = $('<a/>').addClass('btn btn-sm btn-success text-capitalize mb-1 ml-1')
      .attr('href', href)
      .attr('target', '_blank')
      .attr('download', `${this.media.basename}-segments.edl`)
      .attr('role', 'button')
      .append(Localization.Buttons.DownloadEDL);
    return btnEdl;
  }
}
