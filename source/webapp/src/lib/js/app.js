// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AppUtils from './app/shared/appUtils.js';
import LocalStoreDB from './app/shared/localCache/localStoreDB.js';
import MainView from './app/mainView.js';
import SignInFlow from './app/signInFlow.js';

const ID_DEMOAPP = '#demo-app';

export default class DemoApp {
  constructor() {
    this.$ids = {
      container: `app-${AppUtils.randomHexstring()}`,
    };
    const view = $('<div/>').attr('id', this.ids.container);
    const mainView = new MainView();
    mainView.appendTo(view);
    const signIn = new SignInFlow();
    signIn.appendTo(view);
    signIn.view.on(SignInFlow.Events.View.Hidden, () =>
      setTimeout(async () =>
        mainView.show(), 10));
    this.$signInFlow = signIn;
    this.$mainView = mainView;
    this.$view = view;
  }

  get ids() {
    return this.$ids;
  }

  get view() {
    return this.$view;
  }

  get mainView() {
    return this.$mainView;
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
    return LocalStoreDB.getSingleton().open()
      .catch(e => console.error(e));
  }

  async closeIndexedDB() {
    return LocalStoreDB.getSingleton().close()
      .catch(e => console.error(e));
  }
}

$(document).ready(async () => {
  const demoApp = new DemoApp();
  demoApp.appendTo($(ID_DEMOAPP));
  await demoApp.show();

  $(window).on('unload', async () => {
    await demoApp.hide();
  });
});
