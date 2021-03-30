import Localization from '../../shared/localization.js';
import mxAnalysisSettings from '../../mixins/mxAnalysisSettings.js';
import BaseUploadSlideComponent from './baseUploadSlideComponent.js';

const DATATYPE_SLIDE_CONTROLS = 'slide-controls';

export default class AnalysisSlideComponent extends mxAnalysisSettings(BaseUploadSlideComponent) {
  /* override mxAnalysisSettings */
  get parentContainer() {
    return this.slide;
  }

  /* override mxAnalysisSettings */
  createDescription() {
    return $('<p/>').addClass('lead')
      .html(Localization.Messages.ReviewAnalysisSettings);
  }

  /* override mxAnalysisSettings */
  createControls() {
    const back = $('<button/>').addClass('btn btn-light ml-1')
      .html(Localization.Buttons.Back);
    const next = $('<button/>').addClass('btn btn-primary ml-1')
      .html(Localization.Buttons.Next);

    back.off('click').on('click', async (event) =>
      this.slide.trigger(AnalysisSlideComponent.Controls.Back));
    next.off('click').on('click', async (event) =>
      this.slide.trigger(AnalysisSlideComponent.Controls.Next));

    const controls = $('<form/>').addClass('form-inline')
      .attr('data-type', DATATYPE_SLIDE_CONTROLS)
      .append($('<div/>').addClass('ml-auto')
        .append(back)
        .append(next));

    controls.submit(event =>
      event.preventDefault());

    return controls;
  }

  /* override BaseUploadSlideComponent */
  async createSlide() {
    await this.show();
    this.slide.find('form.col-9')
      .removeClass('col-9')
      .addClass('col-12');
    this.slide.find(`form[data-type=${DATATYPE_SLIDE_CONTROLS}]`)
      .parent().removeClass('col-9').addClass('col-12');
    return super.createSlide();
  }

  /* override BaseUploadSlideComponent */
  async getData() {
    return this.loadLocalSettings();
  }
}
