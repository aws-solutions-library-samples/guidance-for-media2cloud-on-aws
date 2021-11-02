// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import Localization from '../../../../../../shared/localization.js';
import BaseAnalysisTab from '../base/baseAnalysisTab.js';
import ApiHelper from '../../../../../../shared/apiHelper.js';
import mxAlert from '../../../../../../mixins/mxAlert.js';
import mxAnalysisSettings from '../../../../../../mixins/mxAnalysisSettings.js';

const COL_TAB = 'col-11';

export default class ReAnalyzeTab extends mxAnalysisSettings(mxAlert(BaseAnalysisTab)) {
  constructor(previewComponent, defaultTab = false) {
    super(Localization.Messages.ReAnalyzeTab, previewComponent, defaultTab);
    this.$parentContainer = $('<div/>').addClass(`${COL_TAB} my-4 max-h36r`);
  }

  /* override mxAnalysisSettings */
  get parentContainer() {
    return this.$parentContainer;
  }

  /* override baseAnalysisTab */
  async createContent() {
    return this.parentContainer;
  }

  /* override mxAnalysisSettings */
  createSkeleton() {
    const row = super.createSkeleton();
    /* remove Description field */
    row.children().first().remove();
    /* fix the spacing */
    row.children().first().removeClass('mt-4');
    row.children('div.col-9').removeClass('col-9').addClass('col-12');
    row.find('span.bg-light').removeClass('p-2');
    return row;
  }

  /* override mxAnalysisSettings */
  createControls() {
    const btn = $('<button/>').addClass('btn btn-success ml-1')
      .html(Localization.Buttons.ReAnalyzeContent);
    btn.off('click').on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        this.loading(true);
        const uuid = this.previewComponent.media.uuid;
        const params = {
          input: {
            aiOptions: await this.loadLocalSettings(),
          },
        };
        await ApiHelper.startAnalysisWorkflow(uuid, params);
        this.loading(false);
        const message = Localization.Alerts.ReAnalyzeSubmitted
          .replace('{{BASENAME}}', this.previewComponent.media.basename);
        await this.showConfirm(message);
        return false;
      } catch (e) {
        const message = Localization.Alerts.ReAnalzyeFailed
          .replace('{{BASENAME}}', this.previewComponent.media.basename);
        await this.showAlert(message);
        return false;
      } finally {
        btn.addClass('disabled')
          .attr('disabled', 'disabled');
        this.loading(false);
      }
    });
    const form = $('<form/>').addClass('form-inline')
      .append($('<div/>').addClass('ml-auto')
        .append(btn));
    form.submit((event) =>
      event.preventDefault());
    return form;
  }

  async showAlert(message, duration = 2 * 1000) {
    return super.showMessage(this.tabContent, 'danger', Localization.Alerts.Oops, message, duration);
  }

  async showConfirm(message, duration = 2 * 1000) {
    return super.showMessage(this.tabContent, 'success', Localization.Alerts.Confirmed, message, duration);
  }
}
