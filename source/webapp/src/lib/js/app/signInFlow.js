// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from './shared/localization.js';
import AppUtils from './shared/appUtils.js';
import AuthenticationFlow from './shared/cognito/authenticationFlow.js';
import {
  UserSession,
  GetUserSession,
  LoadUserSessionFromCache,
  OPT_USERNAME,
} from './shared/cognito/userSession.js';
import {
  GetIotSubscriber,
} from './shared/iotSubscriber.js';
import {
  GetSettingStore,
} from './shared/localCache/settingStore.js';

const {
  ChallengeNameType,
} = window.AWSv3;

const SOLUTION_ICON = '/images/m2c-full-black.png';

const {
  Copyright: COPYRIGHT,
  RegularExpressions: {
    Username: REGEX_USERNAME,
  },
  Messages: {
    Title: MSG_TITLE,
    PwdRequirement: MSG_PASSWORD_REQ,
    ResetSendCode: MSG_RESET_SEND_CODE,
    ResetPwd: MSG_RESET_PASSWORD,
  },
  Alerts: {
    Oops: OOPS,
    MismatchPwds: MSG_MISMATCH_PASSWORDS,
    PwdConformance: MSG_PASSWORD_NOT_CONFORM,
    SignInProblem: MSG_SIGNIN_PROBLEM,
    UsernameConformance: MSG_USERNAME_NOT_CONFORM,
  },
} = Localization;

const RANDOM_ID = AppUtils.randomHexstring();
const ID_SPINNER = `signin-spinner-${RANDOM_ID}`;
const ID_CONTAINER = `signin-${RANDOM_ID}`;
const ID_MODAL = `signin-modal-${RANDOM_ID}`;
const ID_CAROUSEL = `signin-carousel-${RANDOM_ID}`;
const ID_PASSWORD = `signin-password-${RANDOM_ID}`;
const ID_PASSWORD_01 = `signin-password-01-${RANDOM_ID}`;
const ID_PASSWORD_02 = `signin-password-02-${RANDOM_ID}`;
const SLIDEID_SIGNIN = `slide-signin-${RANDOM_ID}`;
const SLIDEID_NEW_PASSWORD = `slide-new-password-${RANDOM_ID}`;
const SLIDEID_SEND_CODE = `slide-send-code-${RANDOM_ID}`;
const SLIDEID_RESET_PASSWORD = `slide-reset-password-${RANDOM_ID}`;

const ON_SIGNIN_VIEW_HIDDEN = 'signin:view:hidden';

const _tmpFlowData = {};

class SignInFlow {
  constructor(title = MSG_TITLE, logo = undefined) {
    this.$view = $('<div/>')
      .attr('id', ID_CONTAINER);

    this.$title = title;
    this.$customLogo = logo;
    this.$authFlow = new AuthenticationFlow();
  }

  appendTo(parent) {
    return parent.append(this.view);
  }

  get view() {
    return this.$view;
  }

  get title() {
    return this.$title;
  }

  get customLogo() {
    return this.$customLogo;
  }

  get authFlow() {
    return this.$authFlow;
  }

  async show() {
    await this.hide();

    /* try to auto sign in */
    let username;
    try {
      const userSession = await this.userSignInFromCache();

      username = (userSession || {}).username;

      if (username !== undefined) {
        return this.view.trigger(ON_SIGNIN_VIEW_HIDDEN);
      }
    } catch (e) {
      /* do nothing */
    } finally {
      if (username === undefined) {
        const store = GetSettingStore();
        username = await store.getItem(OPT_USERNAME);
      }
    }

    const modal = $('<div/>')
      .addClass('modal fade')
      .attr('id', ID_MODAL)
      .attr('tabindex', -1)
      .attr('role', 'dialog');
    this.view.append(modal);

    const modalDialog = $('<div/>')
      .addClass('modal-dialog')
      .attr('role', 'document');
    modal.append(modalDialog);

    const content = $('<div/>')
      .addClass('modal-content');
    modalDialog.append(content);

    const header = $('<div/>')
      .addClass('modal-header');
    content.append(header);

    const title = $('<h5/>')
      .addClass('modal-title lead')
      .html(this.title);
    header.append(title);

    const body = $('<div/>')
      .addClass('modal-body');
    content.append(body);

    const carousel = this.createCarousel(username);
    body.append(carousel);

    const footer = $('<div/>')
      .addClass('modal-footer');
    content.append(footer);

    const copyright = this.createCopyright();
    footer.append(copyright);

    const spinner = this.createSpinner();
    modalDialog.append(spinner);

    modal.on('hidden.bs.modal', () => {
      Object.keys(_tmpFlowData)
        .forEach((key) =>
          delete _tmpFlowData[key]);

      this.view.trigger(ON_SIGNIN_VIEW_HIDDEN);
    });

    return modal.modal({
      backdrop: 'static',
      keyboard: false,
      show: true,
    });
  }

  async hide() {
    this.view.children()
      .remove();
  }

  async userSignIn() {
    const session = GetUserSession();

    const credentials = await session.signIn();

    if (credentials !== undefined) {
      /* start iot connection */
      const subscriber = GetIotSubscriber();
      await subscriber.connect();
    }

    return session;
  }

  async userSignInFromCache() {
    const session = await LoadUserSessionFromCache();

    if (session === undefined) {
      return session;
    }

    return this.userSignIn();
  }

  createCarousel(username) {
    const carousel = $('<div/>')
      .addClass('carousel slide')
      .attr('data-ride', false)
      .attr('data-interval', false)
      .attr('id', ID_CAROUSEL);

    const carouselInner = $('<div/>')
      .addClass('carousel-inner');
    carousel.append(carouselInner);

    const carouselItems = [
      {
        id: SLIDEID_SIGNIN,
        el: this.createSignInForm(username),
      },
      {
        id: SLIDEID_NEW_PASSWORD,
        el: this.createNewPasswordForm(),
      },
      {
        id: SLIDEID_SEND_CODE,
        el: this.createResetSendCodeForm(),
      },
      {
        id: SLIDEID_RESET_PASSWORD,
        el: this.createResetPasswordForm(),
      },
    ].map((slide) => {
      const carouselItem = $('<div/>')
        .addClass('carousel-item')
        .attr('id', slide.id)
        .append(slide.el);

      return carouselItem;
    });

    /* set 1st slide active */
    carouselItems[0]
      .addClass('active');

    carouselInner.append(carouselItems);

    return carousel;
  }

  createSignInForm(username) {
    const formContainer = $('<form/>')
      .addClass('form-signin text-center needs-validation')
      .attr('novalidate', 'novalidate');

    const logo = this.createLogo();
    formContainer.append(logo);

    const inputId = `signin-username-${RANDOM_ID}`;
    const userInput = this.createUserInput(
      inputId,
      'Username',
      username
    );
    formContainer.append(userInput);

    const passwordId = ID_PASSWORD;
    const passwordInput = this.createPasswordInput(
      passwordId,
      'Password',
      'current-password'
    );
    formContainer.append(passwordInput);

    const submitBtn = this.createSubmitButton();
    formContainer.append(submitBtn);

    const resetLink = this.createResetLink();
    formContainer.append(resetLink);

    resetLink.on('click', async () => {
      this.slideTo(SLIDEID_SEND_CODE);
    });

    formContainer.submit(async (event) => {
      event.preventDefault();

      try {
        this.loading();

        if (formContainer[0].checkValidity() === false) {
          event.stopPropagation();
          this.shake();

          throw MSG_PASSWORD_NOT_CONFORM;
        }

        const [
          inputUsername,
          inputPassword,
        ] = [
          inputId,
          passwordId,
        ].map((id) =>
          formContainer.find(`#${id}`));

        const response = await this.authFlow.authenticateUser(
          inputUsername.val(),
          inputPassword.val()
        );

        if (response instanceof UserSession) {
          await this.userSignIn();

          inputUsername.val('');
          inputPassword.val('');

          setTimeout(() => {
            const modal = this.view
              .find(`div#${ID_MODAL}`);

            modal.modal('hide');
          }, 10);

          return true;
        }

        if (response.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED) {
          _tmpFlowData.username = inputUsername.val();
          _tmpFlowData.challengeResponse = response;

          this.slideTo(SLIDEID_NEW_PASSWORD);
          return true;
        }

        console.log(
          'ERR:',
          'authenticateUser:',
          response
        );

        throw new Error(`fail to authenticate user, ${(response.$metadata || {}).httpStatusCode}`);
      } catch (e) {
        let message = e;

        if (e instanceof Error) {
          message = [
            MSG_SIGNIN_PROBLEM,
            `<br><pre class="text-danger small">(error: ${e.message})</pre>`,
          ].join('');
        }

        await this.showMessage(
          'danger',
          OOPS,
          message
        );

        return false;
      } finally {
        this.loading(false);
      }
    });

    return formContainer;
  }

  createNewPasswordForm() {
    const container = $('<div/>');

    const desc = $('</p>')
      .addClass('text-muted')
      .html(MSG_PASSWORD_REQ);
    container.append(desc);

    const formContainer = $('<form/>')
      .addClass('form-signin text-center needs-validation')
      .attr('novalidate', 'novalidate');
    container.append(formContainer);

    const inputs = [
      [
        ID_PASSWORD_01,
        'New Password',
        'new-password',
      ],
      [
        ID_PASSWORD_02,
        'Confirm Password',
        'new-password',
      ],
    ].map((x) =>
      this.createPasswordInput(
        ...x
      ));
    formContainer.append(inputs);

    const confirmBtn = this.createSubmitButton('Confirm');
    formContainer.append(confirmBtn);

    formContainer.submit(async (event) => {
      event.preventDefault();

      const [
        password01,
        password02,
      ] = [
        ID_PASSWORD_01,
        ID_PASSWORD_02,
      ].map((id) =>
        formContainer.find(`#${id}`));

      try {
        this.loading();

        if (password01.val() !== password02.val()) {
          event.stopPropagation();
          this.shake();

          throw MSG_MISMATCH_PASSWORDS;
        }

        if (formContainer[0].checkValidity() === false) {
          event.stopPropagation();
          this.shake();

          throw MSG_PASSWORD_NOT_CONFORM;
        }

        await this.authFlow.newPasswordRequired(
          _tmpFlowData.challengeResponse,
          _tmpFlowData.username,
          password01.val()
        );

        await this.userSignIn();

        password01.val('');
        password02.val('');

        setTimeout(() => {
          const modal = this.view
            .find(`div#${ID_MODAL}`);

          modal.modal('hide');
        }, 10);

        return true;
      } catch (e) {
        let message = e;

        if (e instanceof Error) {
          message = `<pre class="text-danger">(error: ${e.message})</pre>`;
        }

        await this.showMessage(
          'danger',
          OOPS,
          message
        );

        password02.val('');
        return false;
      } finally {
        this.loading(false);
      }
    });

    return container;
  }

  createResetSendCodeForm() {
    const container = $('<div/>');

    const desc = $('</p>')
      .addClass('text-muted')
      .html(MSG_RESET_SEND_CODE);
    container.append(desc);

    const formContainer = $('<form/>')
      .addClass('form-signin text-center needs-validation')
      .attr('novalidate', 'novalidate');
    container.append(formContainer);

    const inputId = `reset-form-username-${RANDOM_ID}`;
    const userInput = this.createUserInput(
      inputId,
      'Username'
    );
    formContainer.append(userInput);

    const submitBtn = this.createSubmitButton('Send code');
    formContainer.append(submitBtn);

    formContainer.submit(async (event) => {
      event.preventDefault();

      const input = formContainer
        .find(`input#${inputId}`);

      try {
        if (formContainer[0].checkValidity() === false) {
          event.stopPropagation();
          this.shake();

          throw MSG_USERNAME_NOT_CONFORM;
        }

        /* start forgot password flow */
        const username = input.val();
        await this.authFlow.forgotPassword(username);

        _tmpFlowData.username = username;

        this.slideTo(SLIDEID_RESET_PASSWORD);

        return true;
      } catch (e) {
        let message = e;

        if (e instanceof Error) {
          message = `<pre class="text-danger">(error: ${e.message})</pre>`;
        }

        await this.showMessage(
          'danger',
          OOPS,
          message
        );

        input.val('');
        return false;
      }
    });

    return container;
  }

  createResetPasswordForm() {
    const container = $('<div/>');

    const desc = $('</p>')
      .addClass('text-muted')
      .html(MSG_RESET_PASSWORD);
    container.append(desc);

    const formContainer = $('<form/>')
      .addClass('form-signin text-center needs-validation')
      .attr('novalidate', 'novalidate');
    container.append(formContainer);

    const confirmationCodeId = `reset-form-confirmation-code-${RANDOM_ID}`;
    const confirmationCode = this.createCodeInput(confirmationCodeId);
    formContainer.append(confirmationCode);

    const resetPasswordId = `reset-form-reset-password-${RANDOM_ID}`;
    const resetPassword = this.createPasswordInput(
      resetPasswordId,
      'New Password',
      'new-password'
    );
    formContainer.append(resetPassword);

    const submitBtn = this.createSubmitButton('Reset Password');
    formContainer.append(submitBtn);

    formContainer.submit(async (event) => {
      event.preventDefault();

      const inputConfirmationCode = confirmationCode
        .find(`input#${confirmationCodeId}`);

      const inputResetPassword = resetPassword
        .find(`input#${resetPasswordId}`);

      try {
        this.loading();

        if (formContainer[0].checkValidity() === false) {
          event.stopPropagation();
          this.shake();

          throw MSG_PASSWORD_NOT_CONFORM;
        }

        /* confirm password change */
        await this.authFlow.confirmPasswordChange(
          _tmpFlowData.username,
          inputResetPassword.val(),
          inputConfirmationCode.val()
        );

        /* authenticate user w/ new password */
        await this.authFlow.authenticateUser(
          _tmpFlowData.username,
          inputResetPassword.val()
        );

        await this.userSignIn();

        inputConfirmationCode.val('');
        inputResetPassword.val('');

        setTimeout(() => {
          const modal = this.view
            .find(`div#${ID_MODAL}`);

          modal.modal('hide');
        }, 10);

        return true;
      } catch (e) {
        let message = e;

        if (e instanceof Error) {
          message = `<pre class="text-danger">(error: ${e.message})</pre>`;
        }

        inputResetPassword.val('');
        inputConfirmationCode.val('');

        await this.showMessage(
          'danger',
          OOPS,
          message
        );

        return false;
      } finally {
        this.loading(false);
      }
    });

    return container;
  }

  createLogo() {
    if (this.customLogo !== undefined) {
      return this.customLogo;
    }

    return $('<img/>')
      .addClass('mb-4')
      .attr('src', SOLUTION_ICON)
      .attr('alt', 'media2cloud logo')
      .attr('width', 240);
  }

  createUserInput(
    id,
    title,
    username = '',
    sr = 'sr-only'
  ) {
    const container = $('<div/>')
      .addClass('text-left');

    const label = $('<label/>')
      .addClass(sr)
      .attr('for', id)
      .html(title);
    container.append(label);

    const input = $('<input/>')
      .addClass('form-control')
      .attr('type', 'text')
      .attr('id', id)
      .attr('pattern', REGEX_USERNAME)
      .attr('placeholder', title)
      .attr('value', username)
      .attr('autocomplete', 'username')
      .attr('required', 'required')
      .attr('autofocus', 'autofocus');
    container.append(input);

    const invalid = $('<div/>')
      .addClass('invalid-feedback')
      .html('Invalid username');
    container.append(invalid);

    return container;
  }

  createPasswordInput(
    id = `signin-password-${RANDOM_ID}`,
    title = 'Password',
    autocomplete = 'current-password',
    sr = 'sr-only'
  ) {
    const container = $('<div/>')
      .addClass('text-left');

    const label = $('<label/>')
      .addClass(sr)
      .attr('for', id)
      .html(title);
    container.append(label);

    const input = $('<input/>')
      .addClass('form-control')
      .attr('type', 'password')
      .attr('id', id)
      .attr('pattern', '(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,}')
      .attr('placeholder', 'Password')
      .attr('autocomplete', autocomplete)
      .attr('required', 'required');
    container.append(input);

    const invalid = $('<div/>')
      .addClass('invalid-feedback')
      .html('Invalid password');
    container.append(invalid);

    return container;
  }

  createCodeInput(
    id,
    title = 'Verification Code',
    code = undefined,
    sr = ''
  ) {
    const container = $('<div/>')
      .addClass('text-left mb-2');

    const label = $('<label/>')
      .addClass(sr)
      .attr('for', id)
      .html(title);
    container.append(label);

    const input = $('<input/>').addClass('form-control')
      .attr('type', 'text')
      .attr('id', id)
      .attr('pattern', '[0-9]{6}')
      .attr('placeholder', title)
      .attr('value', code)
      .attr('autocomplete', 'one-time-code')
      .attr('required', 'required')
      .attr('autofocus', 'autofocus');
    container.append(input);

    const invalid = $('<div/>')
      .addClass('invalid-feedback')
      .html('Invalid code');
    container.append(invalid);

    return container;
  }

  createSubmitButton(text = 'Sign in') {
    const container = $('<div/>')
      .addClass('mt-4');

    const button = $('<button/>')
      .addClass('btn btn-primary btn-block')
      .attr('type', 'submit')
      .html(text);
    container.append(button);

    return container;
  }

  createResetLink() {
    const button = $('<button/>')
      .addClass('btn btn-sm btn-link mt-2')
      .attr('type', 'button')
      .html('Forgot password?');

    return button;
  }

  createCopyright() {
    const copyright = $('<p/>')
      .addClass('font-weight-light text-muted mb-0')
      .html(COPYRIGHT);

    return copyright;
  }

  createSpinner() {
    let spinner = this.view
      .find(`#${ID_SPINNER}`);
    if (spinner.length > 0) {
      return undefined;
    }

    spinner = $('<div/>')
      .attr('id', ID_SPINNER)
      .addClass('collapse')
      .addClass('spinner-grow text-secondary loading-4');

    const text = $('<span/>')
      .addClass('lead-sm sr-only')
      .html('Loading...');
    spinner.append(text);

    return spinner;
  }

  loading(enabled = true) {
    const spinner = this.view
      .find(`#${ID_SPINNER}`);

    if (enabled) {
      return spinner.removeClass('collapse');
    }

    return spinner.addClass('collapse');
  }

  async showMessage(type, header, description, duration = 5 * 1000) {
    return new Promise((resolve) => {
      const color = `alert-${type}`;

      const alertContainer = $('<div/>')
        .addClass('alert alert-dismissible fade show')
        .addClass(color)
        .attr('role', 'alert');

      const heading = $('<h4/>')
        .addClass('alert-heading')
        .html(header);
      alertContainer.append(heading);

      const desc = $('<p/>')
        .html(description);
      alertContainer.append(desc);

      const closeBtn = $('<button/>').addClass('close')
        .attr('type', 'button')
        .attr('data-dismiss', 'alert')
        .attr('aria-label', 'Close')
        .append($('<span/>')
          .attr('aria-hidden', true)
          .html('&times;'));
      alertContainer.append(closeBtn);

      let timer = setTimeout(() => {
        alertContainer.alert('close');
        timer = undefined;
      }, duration);

      alertContainer.on('close.bs.alert', () => {
        clearInterval(timer);
        timer = undefined;
      });

      alertContainer.on('closed.bs.alert', () => {
        alertContainer.alert('dispose');
        alertContainer.remove();
        resolve();
      });

      const modal = this.view
        .find(`div#${ID_MODAL}`);

      modal.append(alertContainer);
    });
  }

  shake(delay = 200) {
    const modal = this.view
      .find(`div#${ID_MODAL}`);

    modal.addClass('shake-sm')
      .on('webkitAnimationEnd oanimationend msAnimationEnd animationend', (e) =>
        modal.delay(delay)
          .removeClass('shake-sm'));
  }

  slideTo(id) {
    const carousel = this.view
      .find(`div#${ID_CAROUSEL}`)
      .first();

    const idx = carousel
      .find(`#${id}`)
      .index();

    carousel.carousel(idx);
  }
}

export {
  SignInFlow,
  ON_SIGNIN_VIEW_HIDDEN,
};
