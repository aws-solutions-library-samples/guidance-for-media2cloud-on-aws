import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import BaseRekognitionImageTab from './baseRekognitionImageTab.js';

export default class FaceImageTab extends BaseRekognitionImageTab {
  constructor(previewComponent, data, defaultTab = false) {
    super(AnalysisTypes.Rekognition.Face, previewComponent, data, defaultTab);
  }
}
