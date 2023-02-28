// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from './shared/localization.js';
import IotSubscriber from './shared/iotSubscriber.js';
import CognitoConnector from './shared/cognitoConnector.js';
import ApiHelper from './shared/apiHelper.js';
import AppUtils from './shared/appUtils.js';

const SOLUTION_ICON = '/images/m2c-full-black.png';

export default class SignInFlow {
  constructor() {
    this.$ids = {
      container: `signin-${AppUtils.randomHexstring()}`,
      carousel: `signin-${AppUtils.randomHexstring()}`,
      slides: {
        signIn: `signin-slide-${AppUtils.randomHexstring()}`,
        newPassword: `signin-slide-${AppUtils.randomHexstring()}`,
        resetSendCode: `signin-slide-${AppUtils.randomHexstring()}`,
        resetPassword: `signin-slide-${AppUtils.randomHexstring()}`,
      },
      normal: {
        username: `signin-normal-${AppUtils.randomHexstring()}`,
        password: `signin-normal-${AppUtils.randomHexstring()}`,
      },
      new: {
        password01: `signin-new-${AppUtils.randomHexstring()}`,
        password02: `signin-new-${AppUtils.randomHexstring()}`,
      },
      reset: {
        code: `signin-new-${AppUtils.randomHexstring()}`,
        email: `signin-new-${AppUtils.randomHexstring()}`,
        username: `signin-new-${AppUtils.randomHexstring()}`,
        password: `signin-new-${AppUtils.randomHexstring()}`,
      },
    };
    this.$view = $('<div/>').attr('id', this.$ids.container);
    this.$cognito = CognitoConnector.getSingleton();
    this.$dialog = undefined;
  }

  static get Events() {
    return {
      View: {
        Hidden: 'signin:view:hidden',
      },
    };
  }

  get ids() {
    return this.$ids;
  }

  appendTo(parent) {
    return parent.append(this.view);
  }

  get view() {
    return this.$view;
  }

  get dialog() {
    return this.$dialog;
  }

  set dialog(val) {
    this.$dialog = val;
  }

  get cognito() {
    return this.$cognito;
  }

  async show() {
    await this.hide();
    const user = await this.userSignIn()
      .catch(() =>
        undefined);

    this.dialog = $('<div/>').addClass('modal fade')
      .attr('tabindex', -1)
      .attr('role', 'dialog');

    const modal = $('<div/>').addClass('modal-dialog')
      .attr('role', 'document')
      .append($('<div/>').addClass('modal-content')
        .append($('<div/>').addClass('modal-header')
          .append($('<h5/>').addClass('modal-title lead')
            .html(Localization.Messages.Title)))
        .append($('<div/>').addClass('modal-body')
          .append(this.createCarousel(user)))
        .append($('<div/>').addClass('modal-footer')
          .append(this.createCopyright())));

    this.dialog.append(modal);
    this.view.append(this.dialog);

    this.dialog.off('hidden.bs.modal').on('hidden.bs.modal', () =>
      this.view.trigger(SignInFlow.Events.View.Hidden));

    if (user) {
      return this.view.trigger(SignInFlow.Events.View.Hidden);
    }
    return this.dialog.modal({
      backdrop: 'static',
      keyboard: false,
      show: true,
    });
  }

  async hide() {
    this.view.children().remove();
    this.dialog = undefined;
  }

  async userSignIn() {
    const user = await this.cognito.signIn();
    if (user !== undefined) {
      /* grant iot policy to the user */
      await ApiHelper.attachIot();
      console.log(`iot permission granted to '${user.username}'...`);
      /* start iot connection */
      await IotSubscriber.getSingleton().connect();
    }
    return user;
  }

  createCarousel(user) {
    const slides = [
      {
        id: this.ids.slides.signIn,
        el: this.createSignInForm(user),
      },
      {
        id: this.ids.slides.newPassword,
        el: this.createNewPasswordForm(user),
      },
      {
        id: this.ids.slides.resetSendCode,
        el: this.createResetSendCodeForm(user),
      },
      {
        id: this.ids.slides.resetPassword,
        el: this.createResetPasswordForm(user),
      },
    ];

    const inner = $('<div/>').addClass('carousel-inner');
    for (let i = 0; i < slides.length; i++) {
      const classes = (i === 0) ? 'carousel-item active' : 'carousel-item';
      inner.append($('<div/>').addClass(classes)
        .attr('id', slides[i].id)
        .append(slides[i].el));
    }

    return $('<div/>').addClass('carousel slide')
      .attr('data-ride', false)
      .attr('data-interval', false)
      .attr('id', this.ids.carousel)
      .append(inner);
  }

  createSignInForm(user) {
    const form = $('<form/>').addClass('form-signin text-center needs-validation')
      .attr('novalidate', 'novalidate')
      .append(this.createLogo())
      .append(this.createUserInput(this.ids.normal.username, 'Username', (user || {}).username))
      .append(this.createPasswordInput())
      .append(this.createSubmitButton())
      .append(this.createResetLink());
    form.off('submit').submit(async (event) => {
      event.preventDefault();
      if (form[0].checkValidity() === false) {
        event.stopPropagation();
        this.shake();
        await this.showMessage('danger', Localization.Alerts.Oops, Localization.Alerts.PwdConformance);
        return false;
      }
      const username = form.find(`#${this.ids.normal.username}`);
      const password = form.find(`#${this.ids.normal.password}`);

      try {
        const response = await this.cognito.authenticate({
          Username: username.val(),
          Password: password.val(),
        });
        password.val('');
        if (response.status === 'newPasswordRequired') {
          return this.slideTo(this.ids.slides.newPassword);
        }
        await this.userSignIn();
        return this.dialog.modal('hide');
      } catch (e) {
        event.stopPropagation();
        this.shake();
        await this.showMessage('danger', Localization.Alerts.Oops, `${Localization.Alerts.SignInProblem}<br><span class="small">(error: ${encodeURIComponent(e.message).replace(/%20/g, ' ')})</span>`);
        return false;
      }
    });
    return form;
  }

  createNewPasswordForm(user) {
    const div = $('<div/>').append($('</p>').addClass('text-muted')
      .html(Localization.Messages.PwdRequirement));

    const form = $('<form/>').addClass('form-signin text-center needs-validation')
      .attr('novalidate', 'novalidate')
      .append(this.createPasswordInput(this.ids.new.password01, 'New Password', ''))
      .append(this.createPasswordInput(this.ids.new.password02, 'Confirm Password', ''))
      .append(this.createSubmitButton('Confirm'));
    form.off('submit').submit(async (event) => {
      event.preventDefault();
      const password01 = form.find(`#${this.ids.new.password01}`);
      const password02 = form.find(`#${this.ids.new.password02}`);

      if (password01.val() !== password02.val()) {
        event.stopPropagation();
        this.shake();
        await this.showMessage('danger', Localization.Alerts.Oops, Localization.Alerts.MismatchPwds);
        password02.val('');
        return false;
      }

      if (form[0].checkValidity() === false) {
        event.stopPropagation();
        this.shake();
        await this.showMessage('danger', Localization.Alerts.Oops, Localization.Alerts.PwdConformance);
        password01.val('');
        password02.val('');
        return false;
      }

      try {
        await this.cognito.confirmNewPassword(password01.val());
        const btn = form.find('button[type="submit"]');
        btn.addClass('disabled')
          .attr('disabled', 'disabled');
        await this.showMessage('success', Localization.Alerts.Confirmed, Localization.Alerts.PwdConfirmed, 3000);
        this.cognito.signOut();
        password01.val('');
        password02.val('');
        return this.slideTo(this.ids.slides.signIn);
      } catch (e) {
        event.stopPropagation();
        this.shake();
        await this.showMessage('danger', Localization.Alerts.Oops, `${Localization.Alerts.SessionExpired}</br><span class="small">(error: ${encodeURIComponent(e.message).replace(/%20/g, ' ')})</span>`);
        return false;
      }
    });
    return div.append(form);
  }

  createResetSendCodeForm(user) {
    const div = $('<div/>').append($('</p>').addClass('text-muted')
      .html(Localization.Messages.ResetSendCode));

    const form = $('<form/>').addClass('form-signin text-center needs-validation')
      .attr('novalidate', 'novalidate')
      .append(this.createUserInput(this.ids.reset.username, 'Username', undefined, ''))
      .append(this.createSubmitButton('Send code'));
    form.off('submit').submit(async (event) => {
      event.preventDefault();
      const username = form.find(`#${this.ids.reset.username}`);
      if (form[0].checkValidity() === false) {
        event.stopPropagation();
        this.shake();
        await this.showMessage('danger', Localization.Alerts.Oops, Localization.Alerts.UsernameConformance);
        username.val('');
        return false;
      }

      try {
        const response = await this.cognito.forgotPasswordFlow({
          Username: username.val(),
        });
        /* pass the email destination to reset password slide */
        // this.dialog.find(`#${this.ids.reset.email}`).val(response.data.CodeDeliveryDetails.Destination);
        return this.slideTo(this.ids.slides.resetPassword);
      } catch (e) {
        event.stopPropagation();
        this.shake();
        await this.showMessage('danger', Localization.Alerts.Oops, `${Localization.Alerts.SessionExpired}</br><span class="small">(error: ${encodeURIComponent(e.message).replace(/%20/g, ' ')})</span>`);
        return false;
      }
    });
    return div.append(form);
  }

  createResetPasswordForm(user) {
    const div = $('<div/>').append($('</p>').addClass('text-muted')
      .html(Localization.Messages.ResetPwd));

    const form = $('<form/>').addClass('form-signin text-center needs-validation')
      .attr('novalidate', 'novalidate')
      .append(this.createCodeInput(this.ids.reset.code))
      .append(this.createPasswordInput(this.ids.reset.password, 'New Password', ''))
      .append(this.createSubmitButton('Reset Password'));
    form.off('submit').submit(async (event) => {
      event.preventDefault();
      const code = form.find(`#${this.ids.reset.code}`);
      const password = form.find(`#${this.ids.reset.password}`);

      if (form[0].checkValidity() === false) {
        event.stopPropagation();
        this.shake();
        await this.showMessage('danger', Localization.Alerts.Oops, Localization.Alerts.PwdConformance);
        code.val('');
        password.val('');
        return false;
      }

      try {
        await this.cognito.confirmPassword(code.val(), password.val());
        await this.showMessage('success', Localization.Alerts.Confirmed, Localization.Alerts.PwdConfirmed);
        this.cognito.signOut();
        code.val('');
        password.val('');
        return this.slideTo(this.ids.slides.signIn);
      } catch (e) {
        event.stopPropagation();
        this.shake();
        code.val('');
        password.val('');
        await this.showMessage('danger', Localization.Alerts.Oops, `${Localization.Alerts.SessionExpired}</br><span class="small">(error: ${encodeURIComponent(e.message).replace(/%20/g, ' ')})</span>`);
        return false;
      }
    });
    return div.append(form);
  }

  createLogo() {
    return $('<img/>').addClass('mb-4')
      .attr('src', SOLUTION_ICON)
      .attr('alt', 'media2cloud logo')
      .attr('width', 240);
  }

  createUserInput(id, title, username, sr = 'sr-only') {
    return $('<div/>').addClass('text-left')
      .append($('<label/>').addClass(sr)
        .attr('for', id)
        .html(title))
      .append($('<input/>').addClass('form-control')
        .attr('type', 'text')
        .attr('id', id)
        .attr('pattern', '[a-zA-Z0-9._%+-]+')
        .attr('placeholder', title)
        .attr('value', username)
        .attr('required', 'required')
        .attr('autofocus', 'autofocus'))
      .append($('<div/>').addClass('invalid-feedback')
        .html('Invalid username'));
  }

  createPasswordInput(id = this.ids.normal.password, name = 'Password', sr = 'sr-only') {
    return $('<div/>')
      .addClass('text-left')
      .append($('<label/>').addClass(sr)
        .attr('for', id)
        .html(name))
      .append($('<input/>').addClass('form-control')
        .attr('type', 'password')
        .attr('id', id)
        .attr('pattern', '(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,}')
        .attr('placeholder', 'Password')
        .attr('required', 'required'))
      .append($('<div/>').addClass('invalid-feedback')
        .html('Invalid password'));
  }

  createCodeInput(id, title = 'Verification Code', code = undefined, sr = '') {
    return $('<div/>').addClass('text-left mb-2')
      .append($('<label/>').addClass(sr)
        .attr('for', id)
        .html(title))
      .append($('<input/>').addClass('form-control')
        .attr('type', 'text')
        .attr('id', id)
        .attr('pattern', '[0-9]{6}')
        .attr('placeholder', title)
        .attr('value', code)
        .attr('required', 'required')
        .attr('autofocus', 'autofocus'))
      .append($('<div/>').addClass('invalid-feedback')
        .html('Invalid code'));
  }

  createSubmitButton(text = 'Sign in') {
    return $('<div/>').addClass('mt-4')
      .append($('<button/>').addClass('btn btn-primary btn-block')
        .attr('type', 'submit')
        .html(text));
  }

  createResetLink() {
    const button = $('<button/>').addClass('btn btn-sm btn-link mt-2')
      .attr('type', 'button')
      .html('Forgot password?');
    button.off('click').on('click', () =>
      this.slideTo(this.ids.slides.resetSendCode));
    return button;
  }

  createCopyright() {
    return $('<p/>').addClass('font-weight-light text-muted mb-0')
      .html('copyright &copy; 2020');
  }

  async showMessage(type, header, description, duration = 5 * 1000) {
    return new Promise((resolve, notuse) => {
      const message = $('<div/>').addClass(`alert alert-dismissible fade show alert-${type}`)
        .attr('role', 'alert')
        .append($('<h4/>').addClass('alert-heading')
          .html(header))
        .append($('<p/>')
          .html(description))
        .append($('<button/>').addClass('close')
          .attr('type', 'button')
          .attr('data-dismiss', 'alert')
          .attr('aria-label', 'Close')
          .append($('<span/>')
            .attr('aria-hidden', true)
            .html('&times;')));

      let timer = setTimeout(() => {
        message.alert('close');
        timer = undefined;
      }, duration);

      message.on('close.bs.alert', () => {
        clearInterval(timer);
        timer = undefined;
      });

      message.on('closed.bs.alert', () => {
        message.alert('dispose');
        message.remove();
        resolve();
      });
      this.dialog.append(message);
    });
  }

  shake(delay = 200) {
    this.dialog.addClass('shake-sm')
      .off('webkitAnimationEnd oanimationend msAnimationEnd animationend')
      .on('webkitAnimationEnd oanimationend msAnimationEnd animationend', e =>
        this.dialog.delay(delay).removeClass('shake-sm'));
  }

  slideTo(id) {
    const carousel = this.dialog.find(`#${this.ids.carousel}`).first();
    const idx = carousel.find(`#${id}`).index();
    carousel.carousel(idx);
  }
}
