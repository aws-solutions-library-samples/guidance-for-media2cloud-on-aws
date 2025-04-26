// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import {
  UserSession,
} from '../app/shared/cognito/userSession.js';
import {
  SignInFlow,
  ON_SIGNIN_VIEW_HIDDEN,
} from '../app/signInFlow.js';

const {
  AES: {
    decrypt,
  },
  enc: {
    Utf8,
  },
} = window.CryptoJS;
const {
  StackName,
} = SolutionManifest;

const PREFIX_TOKEN = '.token';
const POSTER = '/images/background.png';

class LazySignIn extends SignInFlow {
  async show() {
    try {
      await this.hide();

      // try cache
      let userSession = await this.userSignInFromCache();
      if ((userSession || {}).username === undefined) {
        userSession = await this.userSignInFromToken();
      }

      if ((userSession || {}).username !== undefined) {
        return this.view.trigger(ON_SIGNIN_VIEW_HIDDEN);
      }

      return this.showMessage('No user token');
    } catch (e) {
      return this.showMessage(e.message);
    }
  }

  async showMessage(message) {
    const section = $('<section/>');
    this.view.append(section);

    const image = $('<img/>')
      .addClass('bg-dark')
      .css('object-fit', 'contain')
      .css('aspect-ratio', '16 / 9')
      .css('width', '100%')
      .attr('src', POSTER);
    section.append(image);

    // show message
    const box = $('<div/>')
      .addClass('bbox')
      .css('background-color', 'black')
      .css('border-color', 'white')
      .css('border-width', '0.1rem')
      .css('left', 10)
      .css('top', 10);
    section.append(box);

    const msgEl = $('<div/>')
      .addClass('inline-text-sm')
      .addClass('text-white')
      .append(message);
    box.append(msgEl);

    return section;
  }

  async userSignInFromToken() {
    let url = new URL(document.location);
    const searchParams = url.searchParams;
    let token = searchParams.get('token');
    if (!token) {
      throw new Error('No user token');
    }

    let origin = url.origin;
    origin = origin.replace(/\/$/g, '');

    let pathname = url.pathname.substring(0, url.pathname.lastIndexOf('/'));
    pathname = pathname.replace(/^\/|\/$/g, '');
    if (pathname) {
      pathname = `${pathname}/${PREFIX_TOKEN}/${token}`;
    } else {
      pathname = `${PREFIX_TOKEN}/${token}`;
    }
    url = new URL(`${origin}/${pathname}`);

    token = await fetch(url);
    if (token.status !== 200) {
      throw new Error('Invalid user token');
    }
    token = await token.text();

    const decrypted = this.decryptMessage(token);

    const response = await this.authFlow.authenticateUser(decrypted.username, decrypted.password);
    if (response instanceof UserSession) {
      return await this.userSignIn();
    }

    throw new Error('Fail to authenticate');
  }

  decryptMessage(message) {
    let decrypted = decrypt(message, StackName).toString(Utf8)
    decrypted = JSON.parse(decrypted);
    decrypted = decrypt(decrypted.message, decrypted.sk).toString(Utf8);
    decrypted = JSON.parse(decrypted);
    return decrypted;
  }
}

export {
  LazySignIn,
  ON_SIGNIN_VIEW_HIDDEN,
}
