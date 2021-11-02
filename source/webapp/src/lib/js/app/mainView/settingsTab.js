// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import Localization from '../shared/localization.js';
import LocalStoreDB from '../shared/localCache/localStoreDB.js';
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

  createSkeleton() {
    const row = super.createSkeleton();
    const datastore = this.createDatastoreForm();
    const first = row.children().first();
    first.after($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
      .append(datastore));
    return row;
  }

  createDatastoreForm() {
    const title = $('<span/>').addClass('d-block p-2 bg-light text-black lead')
      .html(Localization.Messages.DatastoreFeature);
    const desc = $('<p/>').addClass('lead-s mt-4')
      .html(Localization.Messages.DatastoreFeatureDesc);
    const form = $('<form/>').addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    const btn = $('<button/>').addClass('btn btn-sm btn-outline-danger')
      .attr('type', 'button')
      .attr('data-toggle', 'button')
      .attr('aria-pressed', 'false')
      .attr('autocomplete', 'off')
      .append(Localization.Buttons.CleanupDatastore);
    btn.off('click').on('click', async (event) => {
      this.loading(true);
      event.preventDefault();
      event.stopPropagation();
      const db = LocalStoreDB.getSingleton();
      await db.clearAllStores();
      this.loading(false);
      return false;
    });

    form.append(btn);
    form.submit((event) =>
      event.preventDefault());
    return $('<div/>').addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start')
      .append($('<div/>').addClass('mt-4')
        .append(title)
        .append(desc)
        .append(form));
  }
}
