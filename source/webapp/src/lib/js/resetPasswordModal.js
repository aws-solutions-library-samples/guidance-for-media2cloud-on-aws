/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */

/**
 * @class ResetPasswordModal
 * @description handle forgot password flow
 */
class ResetPasswordModal {
  constructor(parent, domId) {
    if (!(parent instanceof SignInModal)) {
      throw new Error('parent must be an instance of SignInModal');
    }

    if (!domId) {
      throw new Error('invalid domId');
    }

    this.$parent = parent;

    this.$forgotPasswordModal = $(domId);

    this.domInit();
  }

  get parent() {
    return this.$parent;
  }

  get forgotPasswordModal() {
    return this.$forgotPasswordModal;
  }

  show() {
    this.forgotPasswordModal.modal('show');
  }

  hide() {
    this.forgotPasswordModal.modal('hide');
  }

  /**
   * @function domInit
   * @description initialize forgot password modal
   */
  async domInit() {
    const formSendCode = 'form-send-code';
    const formResetPassword = 'form-reset-password';
    const usernameField = 'username-id';
    const alertField = 'alert-field-id';
    const codeField = 'verification-code-id';
    const newPasswordField = 'new-password-id';
    const actionSendCode = 'send-code';
    const actionResetPassword = 'reset-password';
    const verificationDestination = 'verification-destination';

    const element = $(`
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Reset Password</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          <div class="modal-body">
            <form id="${formSendCode}">
              <div class="form-group">
                <label for="${usernameField}">Username</label>
                <input
                  type="text"
                  class="form-control"
                  id="${usernameField}"
                  placeholder="Username">
              </div>
              <button type="submit" class="btn btn-primary mb-2" data-action="${actionSendCode}">Send code</button>
            </form>

            <form id="${formResetPassword}" class="collapse">
              <div class="form-group">
                <label for="${codeField}">Verification code</label>
                <input type="text" class="form-control" id="${codeField}" placeholder="Pin code">
                <span id="${verificationDestination}"></span>
              </div>
              <div class="form-group">
                <label for="${newPasswordField}">New Password</label>
                <input type="password" class="form-control" id="${newPasswordField}" placeholder="Password">
              </div>
              <button type="submit" class="btn btn-primary mb-2" data-action="${actionResetPassword}">Reset Password</button>
            </form>

            <div>
              <span id="${alertField}" class="collapse text-danger">Alert message...</span>
            </div>
          </div>
        </div>
      </div>
    `);

    element.appendTo(this.forgotPasswordModal);

    /* register events */
    let form = $(`#${formSendCode}`, this.forgotPasswordModal);
    form.off('submit').submit(async (event) => {
      try {
        event.preventDefault();

        const username = $(`#${usernameField}`, this.forgotPasswordModal);
        if (!username.val()) {
          throw new Error('username must be specified');
        }

        const {
          data: {
            CodeDeliveryDetails: {
              Destination,
            },
          },
        } = await this.parent.cognito.forgotPasswordFlow({
          Username: username.val(),
        });

        $(`#${verificationDestination}`, this.forgotPasswordModal)
          .html(`<small>(verification code has sent to ${Destination})</small>`);

        $(`#${alertField}`, this.forgotPasswordModal)
          .collapse('hide');

        $(`#${formSendCode}`, this.forgotPasswordModal)
          .addClass('collapse');

        $(`#${formResetPassword}`, this.forgotPasswordModal)
          .removeClass('collapse');
      } catch (e) {
        $(`#${alertField}`, this.forgotPasswordModal)
          .html(`<small>${AppUtils.sanitize(e.message)}</small>`)
          .collapse('show');
      }
    });

    form = $(`#${formResetPassword}`, this.forgotPasswordModal);
    form.off('submit').submit(async (event) => {
      try {
        event.preventDefault();

        const code = $(`#${codeField}`, this.forgotPasswordModal);
        const password = $(`#${newPasswordField}`, this.forgotPasswordModal);

        if (!code.val()) {
          throw new Error('You must provide verification code.');
        }

        if (!password.val().match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/)) {
          throw new Error('password does not meet criteria. Please re-enter');
        }

        const instance = this.parent.cognito;

        /* confirm reset password flow */
        await instance.confirmPassword(code.val(), password.val());

        /* now, do the sign in  */
        await instance.authenticate({
          Username: instance.user.username,
          Password: password.val(),
        });

        await this.parent.signIn();

        this.hide();
      } catch (e) {
        $(`#${alertField}`, this.forgotPasswordModal)
          .html(`<small>${AppUtils.sanitize(e.message)}</small>`)
          .collapse('show');
      }
    });

    /* reset all fields onHide */
    this.forgotPasswordModal.off('hide.bs.modal').on('hide.bs.modal', () => {
      [
        usernameField,
        newPasswordField,
        codeField,
      ].forEach(x =>
        $(`#${x}`, this.forgotPasswordModal).val(''));

      $(`#${formSendCode}`, this.forgotPasswordModal)
        .removeClass('collapse');

      $(`#${formResetPassword}`, this.forgotPasswordModal)
        .addClass('collapse');

      $(`#${alertField}`, this.forgotPasswordModal)
        .html('')
        .collapse('hide');
    });
  }
}
