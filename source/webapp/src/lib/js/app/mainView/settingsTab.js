// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../shared/localization.js';
import {
  GetLocalStoreDB,
} from '../shared/localCache/index.js';
import mxAnalysisSettings from '../mixins/mxAnalysisSettings.js';
import BaseTab from '../shared/baseTab.js';

const {
  Messages: {
    SettingsTab: TITLE,
    DatastoreFeature: MSG_DATASTORE_FEATURE,
    DatastoreFeatureDesc: MSG_DATASTORE_FEATURE_DESC,
  },
  Buttons: {
    CleanupDatastore: BTN_CLEANUP_DATASTORE,
  },
} = Localization;

const HASHTAG = TITLE.replaceAll(' ', '');

export default class SettingsTab extends mxAnalysisSettings(BaseTab) {
  constructor() {
    super(TITLE, {
      hashtag: HASHTAG,
    });
  }

  get parentContainer() {
    return this.tabContent;
  }

  createSkeleton() {
    const container = super.createSkeleton();

    const datastoreForm = this.createDatastoreForm();

    const first = container.children()
      .first();

    first.after($('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4')
      .append(datastoreForm));

    // event handling
    container.ready(async () => {
      try {
        this.loading();

        this.createObserver(container);
      } catch (e) {
        console.error(e);
      } finally {
        this.loading(false);
      }
    });

    return container;
  }

  createDatastoreForm() {
    const container = $('<div/>')
      .addClass('ai-group')
      .addClass('overflow-auto my-auto align-content-start');

    const itemContainer = $('<div/>')
      .addClass('mt-4');
    container.append(itemContainer);

    const title = $('<span/>')
      .addClass('d-block p-2 bg-light text-black lead')
      .html(MSG_DATASTORE_FEATURE);
    itemContainer.append(title);

    const desc = $('<p/>')
      .addClass('lead-s mt-4')
      .html(MSG_DATASTORE_FEATURE_DESC);
    itemContainer.append(desc);

    const form = $('<form/>')
      .addClass('col-9 px-0 form-inline mt-4')
      .attr('role', 'form');
    itemContainer.append(form);

    const btnCleanup = $('<button/>')
      .addClass('btn btn-sm btn-outline-danger')
      .attr('type', 'button')
      .attr('data-toggle', 'button')
      .attr('aria-pressed', 'false')
      .attr('autocomplete', 'off')
      .append(BTN_CLEANUP_DATASTORE);
    form.append(btnCleanup);

    // event handlings
    form.submit((event) => {
      event.preventDefault();
    });

    btnCleanup.on('click', async (event) => {
      try {
        event.preventDefault();
        event.stopPropagation();

        this.loading(true);

        const db = GetLocalStoreDB();
        await db.clearAllStores();

        return false;
      } catch (e) {
        console.error(e);
        return false;
      } finally {
        this.loading(false);
      }
    });

    return container;
  }

  createObserver(element) {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: [0.1],
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.intersectionRatio <= options.threshold[0]) {
          console.log(
            'SettingsTab.onPageInvisible',
            'entry.intersectionRatio',
            entry.intersectionRatio
          );
          await this.saveAIOptions();
        }
      });
    }, options);

    observer.observe(element[0]);

    return observer;
  }
}
