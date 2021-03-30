import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import BaseRekognitionTab from './baseRekognitionTab.js';

export default class FaceTab extends BaseRekognitionTab {
  constructor(previewComponent, data, defaultTab = false) {
    super(AnalysisTypes.Rekognition.Face, previewComponent, data, defaultTab);
  }
}
