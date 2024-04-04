// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AppUtils from './app/shared/appUtils.js';
import {
  GetLocalStoreDB,
} from './app/shared/localCache/index.js';
import MainView from './app/mainView.js';
import {
  SignInFlow,
  ON_SIGNIN_VIEW_HIDDEN,
} from './app/signInFlow.js';

const ID_DEMOAPP = '#demo-app';

export default class DemoApp {
  constructor() {
    this.$ids = {
      container: `app-${AppUtils.randomHexstring()}`,
    };

    const view = $('<div/>')
      .attr('id', this.ids.container);

    const signIn = new SignInFlow();
    signIn.appendTo(view);

    signIn.view.on(ON_SIGNIN_VIEW_HIDDEN, () =>
      setTimeout(async () => { // nosemgrep: javascript.lang.security.detect-eval-with-expression.detect-eval-with-expression
        const mainView = new MainView();
        mainView.appendTo(view);

        const hashtag = document.location.hash.slice(1);
        mainView.show(hashtag);
      }, 10));
    this.$signInFlow = signIn;
    this.$view = view;
  }

  get ids() {
    return this.$ids;
  }

  get view() {
    return this.$view;
  }

  get signInFlow() {
    return this.$signInFlow;
  }

  appendTo(parent) {
    parent.append(this.view);
  }

  async show() {
    this.hide();
    await this.openIndexedDB();
    return this.signInFlow.show();
  }

  async hide() {
    return this.closeIndexedDB();
  }

  async openIndexedDB() {
    const db = GetLocalStoreDB();

    return db.open()
      .catch((e) =>
        console.error(e));
  }

  async closeIndexedDB() {
    const db = GetLocalStoreDB();

    return db.close()
      .catch((e) =>
        console.error(e));
  }
}

$(document).ready(async () => {
  const demoApp = new DemoApp();
  demoApp.appendTo($(ID_DEMOAPP));
  await demoApp.show();

  $(window).on('unload', async () => {
    console.log(
      'unload',
      'demoApp.hide'
    );
    await demoApp.hide();
  });

  $(window).on('popstate', async (e) => {
    console.log(
      'popstate',
      'hash',
      e.currentTarget.location.hash
    );
    location.reload();
  });
});
