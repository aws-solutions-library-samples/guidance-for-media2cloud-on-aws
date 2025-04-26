// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../shared/localization.js';
import ApiHelper from '../shared/apiHelper.js';
import Spinner from '../shared/spinner.js';
import {
  AWSConsoleCongito,
} from '../shared/awsConsole.js';
import {
  GetS3Utils,
} from '../shared/s3utils.js';
import mxAlert from '../mixins/mxAlert.js';
import BaseTab from '../shared/baseTab.js';

const {
  MD5,
  AES: {
    decrypt,
    encrypt,
  },
  enc: {
    Utf8,
  },
} = window.CryptoJS;

const {
  Cognito: {
    Group: UserGroup,
    UserPoolId,
  },
  StackName,
  Web: {
    Bucket: WebBucket,
  },
} = SolutionManifest;
const { Admin, Creator, Viewer } = UserGroup;

const {
  Messages: {
    UserManagementTab: TITLE,
    UserManagementDesc: DESCRIPTION,
    Username: MSG_USERNAME,
    Email: MSG_EMAIL,
    Group: MSG_GROUP,
    Status: MSG_STATUS,
    LastModified: MSG_LASTMODIFIED,
    RemoveUser: MSG_REMOVE_USER,
    GenerateUserToken: MSG_GENERATE_USER_TOKEN,
    PermissionViewer: VIEWER_PERMISSION,
    PermissionCreator: CREATOR_PERMISSION,
    PermissionAdmin: ADMIN_PERMISSION,
    CurrentUsers: MSG_CURRENT_USER_LIST,
    CreateNewUsers: MSG_CREATE_NEW_USERS,
    CreateNewUsersDesc: MSG_CREATE_NEW_USERS_DESC,
  },
  Tooltips: {
    RemoveUserFromCognito: TOOLTIP_REMOVE_USER,
    GenerateUserToken: TOOLTIP_GENERATE_USER_TOKEN,
    RefreshUserTable: TOOLTIP_REFRESH_USER_TABLE,
  },
  Buttons: {
    AddEmail: BTN_ADD_EMAIL,
    ConfirmAndAddUsers: BTN_CONFIRM_AND_ADD,
    Refresh: BTN_REFRESH,
  },
  Alerts: {
    Oops: OOPS,
    InvalidEmailAddress: ERR_INVALID_EMAIL_ADDRESS,
    UsernameConformance: ERR_INVALID_USERNAME,
    NoNewUsers: ERR_NO_USER_TO_ADD,
    FailAddingUsers: ERR_FAIL_ADDING_USERS,
  },
  RegularExpressions: {
    Username: REGEX_USERNAME,
  },
} = Localization;

const HASHTAG = TITLE.replaceAll(' ', '');
const PREFIX_TOKEN = '.token';

const TABLE_HEADER = [
  MSG_USERNAME,
  MSG_EMAIL,
  MSG_GROUP,
  MSG_STATUS,
  MSG_LASTMODIFIED,
  MSG_REMOVE_USER,
  MSG_GENERATE_USER_TOKEN,
];

export default class UserManagementTab extends mxAlert(BaseTab) {
  constructor() {
    super(TITLE, {
      hashtag: HASHTAG,
    });

    Spinner.useSpinner();
  }

  loading(enabled) {
    return Spinner.loading(enabled);
  }

  async show(hashtag) {
    if (!this.initialized) {
      const content = await this.createContent();
      this.tabContent.append(content);
    }
    return super.show(hashtag);
  }

  async createContent() {
    const container = $('<div/>')
      .addClass('row no-gutters');

    const sectionDesc = this.createDescriptionSection();
    container.append(sectionDesc);

    const sectionUserTable = await this.createUserTableSection();
    container.append(sectionUserTable);

    const sectionAddUsers = this.createAddUsersSection();
    container.append(sectionAddUsers);

    return container;
  }

  createDescriptionSection() {
    const container = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');

    const url = AWSConsoleCongito.getUserPoolLink(UserPoolId);
    let desc = DESCRIPTION.replace('{{CONSOLE_USERPOOL}}', url);
    desc = $('<p/>').addClass('lead')
      .html(desc);
    container.append(desc);

    return container;
  }

  async createUserTableSection() {
    const usersPromise = ApiHelper.getUsers();

    const container = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4 vh-30');

    const sectionTitle = $('<div/>')
      .addClass('col-12 p-0 mb-4 d-flex justify-content-between');
    container.append(sectionTitle);

    const heading = $('<span/>').addClass('lead')
      .append(MSG_CURRENT_USER_LIST);
    sectionTitle.append(heading);

    const refresh = $('<button/>').addClass('btn btn-sm btn-outline-dark')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_REFRESH_USER_TABLE)
      .html(BTN_REFRESH)
      .tooltip({
        trigger: 'hover',
      });
    refresh.on('click', async () => {
      this.loading(true);
      await this.refreshUserTable();
      this.loading(false);
    });
    sectionTitle.append(refresh);

    const table = $('<table/>')
      .attr('id', `table-${this.id}`)
      .addClass('table table-sm lead-xs no-border');
    container.append(table);

    const tbody = $('<tbody/>');
    table.append(tbody);

    const headers = this.makeTableHeaderRow();
    tbody.append(headers);

    const users = await usersPromise;

    const rowItems = users.map((user) =>
      this.makeTableRowItem(user));
    tbody.append(rowItems);

    return container;
  }

  makeTableHeaderRow() {
    const tr = $('<tr/>');

    const rows = TABLE_HEADER.map((x) =>
      $('<th/>').addClass('align-middle text-center lead-sm')
        .attr('scope', 'col')
        .append(x));
    tr.append(rows);
    return tr;
  }

  makeTableRowItem(user) {
    const tr = $('<tr/>')
      .attr('data-username', user.username);

    let permission = VIEWER_PERMISSION;
    if (user.group === Admin) {
      permission = ADMIN_PERMISSION;
    } else if (user.group === Creator) {
      permission = CREATOR_PERMISSION;
    }
    permission = `${user.group}<br/>(${permission})`;

    const removeBtn = $('<button/>').addClass('btn btn-sm btn-outline-danger')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_REMOVE_USER)
      .append($('<i/>').addClass('far fa-trash-alt'))
      .tooltip({
        trigger: 'hover',
      });

    removeBtn.off('click').on('click', async () => {
      this.loading(true);
      removeBtn.tooltip('hide')
        .addClass('disabled')
        .attr('disabled', 'disabled');
      await this.onRemoveUser(user.username);
      tr.remove();
      this.loading(false);
    });

    const generateTokenBtn = $('<button/>')
      .addClass('btn btn-sm btn-outline-success')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_GENERATE_USER_TOKEN)
      .append($('<i/>').addClass('fas fa-key'))
      .tooltip({
        trigger: 'hover',
      });

    if (user.status !== 'CONFIRMED' || user.group !== Viewer) {
      generateTokenBtn.addClass('disabled')
        .attr('disabled', 'disabled');
    }

    generateTokenBtn.on('click', async () => {
      generateTokenBtn.tooltip('hide');
      const parent = this.tabContent
        .find(`table#table-${this.id}`)
        .parent();
      await this.onGenerateToken(parent, user);
    });

    const tds = [
      user.username,
      user.email,
      permission,
      user.status,
      new Date(user.lastModified).toISOString(),
      removeBtn,
      generateTokenBtn,
    ].map((item) =>
      $('<td/>')
        .addClass('h-100 align-middle text-center col-2')
        .append(item || '--'));
    tr.append(tds);
    return tr;
  }

  createAddUsersSection() {
    const container = $('<div/>')
      .addClass('col-12 p-0 m-0 bg-light');

    const subContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(subContainer);

    const heading = $('<span/>')
      .addClass('d-block p-0 lead mb-4')
      .append(MSG_CREATE_NEW_USERS);
    subContainer.append(heading);

    let description = MSG_CREATE_NEW_USERS_DESC
      .replace('{{ADD_EMAIL}}', BTN_ADD_EMAIL)
      .replace('{{CONFIRM_AND_ADD}}', BTN_CONFIRM_AND_ADD);
    description = $('<p/>')
      .addClass('lead-s')
      .append(description);
    subContainer.append(description);

    const addUserControls = this.createAddUserControls();
    subContainer.append(addUserControls);

    return container;
  }

  createAddUserControls() {
    const id = `form-${this.id}`;
    const form = $('<form/>')
      .addClass('col-9 px-0 needs-validation')
      .attr('id', id)
      .attr('novalidate', 'novalidate');

    const btnGroup = $('<div/>').addClass('form-group mt-2');
    form.append(btnGroup);

    const addEmail = $('<button/>')
      .addClass('btn btn-primary btn-sm mb-2 mr-1')
      .attr('type', 'button')
      .html(BTN_ADD_EMAIL);
    btnGroup.append(addEmail);

    const confirm = $('<button/>')
      .addClass('btn btn-success btn-sm mb-2 mr-1')
      .attr('type', 'button')
      .html(BTN_CONFIRM_AND_ADD);
    btnGroup.append(confirm);

    addEmail.on('click', async (event) => {
      event.preventDefault();
      btnGroup.before(this.createEmailField());
      return true;
    });

    confirm.on('click', async (event) => {
      event.preventDefault();
      let users = [];

      const inputGrps = form.children('.input-group');
      inputGrps.each((k, inputGrp) => {
        const email = $(inputGrp).find('[data-attr-type="email"]').val();
        const group = $(inputGrp).find('select').val();
        let username = $(inputGrp).find('input[type="text"]').val();
        if (username === undefined || username.length === 0) {
          username = undefined;
        }
        if (email && group) {
          users.push({
            email,
            group,
            username,
          });
        }
      });
      if (!users.length) {
        this.shake(btnGroup);
        return this.showAlert(ERR_NO_USER_TO_ADD);
      }

      this.loading(true);
      users = await this.onAddNewUsers(users);
      this.loading(false);

      return inputGrps.children().remove();
    });

    return form;
  }

  async refreshUserTable(data) {
    const users = (data !== undefined)
      ? data.slice(0)
      : (await ApiHelper.getUsers());

    const tbody = this.tabContent
      .find(`table#table-${this.id}`)
      .find('tbody');

    const rows = tbody.children('[data-username]');
    /* replace existing rows */
    rows.each((k, row) => {
      const current = $(row).data('username');
      const idx = users.findIndex((user) =>
        user.username === current);
      if (idx >= 0) {
        const found = users.splice(idx, 1)[0];
        const replacement = this.makeTableRowItem(found);
        $(row).replaceWith(replacement);
      }
    });
    /* process newly added rows */
    const rowItems = users.map((user) =>
      this.makeTableRowItem(user));
    tbody.append(rowItems);
  }

  createEmailField() {
    const inputGrp = $('<div/>')
      .addClass('input-group mb-2 mr-sm-2');
    const email = $('<input/>')
      .addClass('form-control col-3')
      .attr('data-attr-type', 'email')
      .attr('type', 'email')
      .attr('required', 'required')
      .attr('placeholder', '(Email)');
    inputGrp.append(email);

    const select = $('<select/>')
      .addClass('custom-select col-2')
      .attr('id', `select-${this.id}`);
    inputGrp.append(select);

    const options = Object.values(UserGroup).map((group) =>
      $('<option/>')
        .attr('value', group)
        .html(group));
    options[0].attr('selected', 'selected');
    select.append(options);

    const username = $('<input/>')
      .addClass('form-control col-3')
      .attr('type', 'text')
      .attr('pattern', REGEX_USERNAME)
      .attr('placeholder', `(${MSG_USERNAME})`);
    inputGrp.append(username);

    const removeBtn = $('<button/>')
      .addClass('btn btn-secondary ml-1')
      .append($('<i/>').addClass('far fa-times-circle'));
    inputGrp.append(removeBtn);

    removeBtn.on('click', (event) => {
      event.preventDefault();
      inputGrp.remove();
    });

    [
      [
        email, ERR_INVALID_EMAIL_ADDRESS,
      ],
      [
        username, ERR_INVALID_USERNAME,
      ],
    ].forEach((x) => {
      x[0].focusout(async (event) => {
        const form = inputGrp.parent('form').first();
        if (!this.validateForm(event, form) && !x[0].get(0).validity.valid) {
          this.shake(inputGrp);
          await this.showAlert(x[1]);
          x[0].focus();
          return false;
        }
        return true;
      });

      x[0].keypress(async (event) => {
        if (event.which === 13) {
          const form = inputGrp.parent('form').first();
          if (!this.validateForm(event, form) && !x[0].get(0).validity.valid) {
            this.shake(inputGrp);
            await this.showAlert(x[1]);
            x[0].focus();
            return false;
          }
        }
        return true;
      });
    });

    return inputGrp;
  }

  validateForm(event, form) {
    event.preventDefault();
    if (form[0].checkValidity() === false) {
      event.stopPropagation();
      return false;
    }
    return true;
  }

  async showAlert(message, duration) {
    return super.showMessage(this.tabContent, 'danger', OOPS, message, duration);
  }

  async onRemoveUser(username) {
    return ApiHelper.deleteUser(username);
  }

  async onAddNewUsers(users) {
    const response = await ApiHelper.addUsers(users);

    const confirmed = response.filter((user) =>
      user.error === undefined);
    await this.refreshUserTable(confirmed);

    const errors = response.filter((user) =>
      user.error !== undefined);
    if (errors.length > 0) {
      console.error(errors);
      const emails = errors
        .map((user) =>
          `<strong>${user.email}</strong>`)
        .join(', ');
      const message = ERR_FAIL_ADDING_USERS.replace('{{USERS}}', emails);
      await this.showAlert(message);
    }

    return confirmed;
  }

  async onGenerateToken(parent, user) {
    console.log(`onGenerateToken: ${JSON.stringify(user)}`);
    let id = `token-generation-${this.id}`;

    const [modal, body] = this.createModelElement(id);
    parent.append(modal);

    const formContainer = $('<form/>')
      .addClass('form-signin text-center needs-validation')
      .addClass('p-0')
      .attr('novalidate', 'novalidate');
    body.append(formContainer);

    id = `password-${this.id}`;
    const [passwdContainer, passwdInput] = this.createPasswordInput(id, user.username);
    formContainer.append(passwdContainer);

    id = `randomcode-${this.id}`;
    const [codeContainer, codeInput] = this.createCodeInput(id);
    formContainer.append(codeContainer);

    id = `token-${this.id}`;
    const [tokenContainer, tokenInput] = this.createTokenInput(id);
    formContainer.append(tokenContainer);
    tokenContainer.addClass('collapse');

    const [submitContainer, submitBtn] = this.createSubmitButton();
    formContainer.append(submitContainer);

    formContainer.submit(async (event) => {
      event.preventDefault();
      submitBtn.blur();

      if (formContainer[0].checkValidity() === false) {
        event.stopPropagation();
        this.shake(modal);
        return;
      }

      const passwd = passwdInput.val();
      const passphrase = codeInput.val();

      const encrypted = this.encryptMessage(user.username, passwd, passphrase);
      const md5 = MD5(encrypted).toString();
      await this.uploadMessage(md5, encrypted);

      submitBtn.attr('disabled', 'disabled')
        .addClass('disabled');
      passwdContainer.addClass('collapse');
      codeContainer.addClass('collapse');

      tokenContainer.removeClass('collapse');
      tokenInput.val(md5);


      // const decrypted = this.decryptMessage(encrypted);
      // console.log(JSON.stringify(decrypted, null, 2));
    });

    // dispose itself
    modal.on('hidden.bs.modal', () => {
      modal.remove();
    });

    modal.modal({
      backdrop: 'static',
      keyboard: true,
      show: true,
    });
  }

  createModelElement(id) {
    const modal = $('<div/>')
      .addClass('modal fade')
      .attr('aria-labelledby', id)
      .attr('tabindex', -1)
      .attr('role', 'dialog');

    const modalDialog = $('<div/>')
      .addClass('modal-dialog') //  modal-lg
      .attr('role', 'document');
    modal.append(modalDialog);

    const content = $('<div/>')
      .attr('id', id)
      .addClass('modal-content');
    modalDialog.append(content);

    const header = $('<div/>')
      .addClass('modal-header');
    content.append(header);

    const title = $('<div/>')
      .addClass('modal-title');
    header.append(title);

    const icon = $('<i/>')
      .addClass('fas fa-key')
      .addClass('text-dark');
    title.append(icon);
    title.append('&nbsp;&nbsp;Generate user token for Amazon QuickSight');

    const dismissBtn = $('<button/>')
      .addClass('close')
      .attr('type', 'button')
      .attr('data-dismiss', 'modal')
      .attr('aria-label', 'Close');
    header.append(dismissBtn);

    const X = $('<span/>')
      .attr('aria-hidden', 'true')
      .append('&times;');
    dismissBtn.append(X);

    const body = $('<div/>')
      .addClass('modal-body');
    content.append(body);

    return [modal, body];
  }

  createPasswordInput(id, username) {
    const container = $('<div/>')
      .addClass('text-left');

    const label = $('<label/>')
      .html('User Password');
    container.append(label);

    const input = $('<input/>')
      .addClass('form-control')
      .attr('type', 'password')
      .attr('id', id)
      .attr('pattern', '(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,}')
      .attr('placeholder', `Enter password for ${username}`)
      .attr('autocomplete', 'current-password')
      .attr('required', 'required');
    container.append(input);

    const invalid = $('<div/>')
      .addClass('invalid-feedback')
      .html('Invalid password');
    container.append(invalid);

    return [container, input];
  }

  createCodeInput(id) {
    const container = $('<div/>')
      .addClass('text-left mb-2');

    const label = $('<label/>')
      .attr('for', id)
      .html('Passphrase');
    container.append(label);

    const input = $('<input/>').addClass('form-control')
      .attr('type', 'text')
      .attr('id', id)
      .attr('pattern', '(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{6,}')
      .attr('placeholder', '6 characters or more')
      .attr('autocomplete', 'one-time-code')
      .attr('required', 'required')
      .attr('autofocus', 'autofocus');
    container.append(input);

    const invalid = $('<div/>')
      .addClass('invalid-feedback')
      .html('Invalid code');
    container.append(invalid);

    return [container, input];
  }

  createTokenInput(id) {
    const container = $('<div/>')
      .addClass('text-left mb-2');

    const label = $('<label/>')
      .attr('for', id)
      .html('Token to use for Amazon QuickSight');
    container.append(label);

    const input = $('<input/>').addClass('form-control')
      .attr('type', 'text')
      .attr('disabled', 'disabled')
      .attr('readonly', 'readonly')
      .attr('id', id);
    container.append(input);

    return [container, input];
  }

  createSubmitButton(text = 'Generate token') {
    const container = $('<div/>')
      .addClass('col-8 mx-auto my-4');

    const button = $('<button/>')
      .addClass('btn btn-sm btn-outline-success btn-block')
      .attr('type', 'submit')
      .html(text);
    container.append(button);

    return [container, button];
  }

  encryptMessage(username, passwd, passphrase) {
    let encrypted = encrypt(JSON.stringify({
      username,
      password: passwd,
    }), passphrase).toString();

    encrypted = encrypt(JSON.stringify({
      sk: passphrase,
      message: encrypted,
    }), StackName).toString();

    return encrypted;
  }

  decryptMessage(message) {
    let decrypted = decrypt(message, StackName).toString(Utf8)
    decrypted = JSON.parse(decrypted);
    decrypted = decrypt(decrypted.message, decrypted.sk).toString(Utf8);
    decrypted = JSON.parse(decrypted);
    return decrypted;
  }

  async uploadMessage(md5, message) {
    const s3utils = GetS3Utils();
    const key = `${PREFIX_TOKEN}/${md5}`;

    return await s3utils.upload({
      Bucket: WebBucket,
      Key: key,
      Body: message,
      ContentType: 'plain/text',
    });
  }

}
