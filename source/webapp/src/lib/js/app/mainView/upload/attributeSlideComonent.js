// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../shared/localization.js';
import AppUtils from '../../shared/appUtils.js';
import BaseUploadSlideComponent from './baseUploadSlideComponent.js';

export default class AttributeSlideComponent extends BaseUploadSlideComponent {
  constructor() {
    super();
    this.$ids = {
      ...this.$ids,
      groupName: `attr-${AppUtils.randomHexstring()}`,
      attributeForm: `attr-${AppUtils.randomHexstring()}`,
    };
    this.$group = '';
    this.$attributeList = [];
  }

  static get Constants() {
    return {
      Attribute: {
        Max: 20,
      },
    };
  }

  get group() {
    return this.$group;
  }

  set group(val) {
    this.$group = val;
  }

  get attributeList() {
    return this.$attributeList;
  }

  // override BaseUploadSlideComponent
  async saveData() {
    const group = this.slide.find(`#${this.ids.groupName}`);
    this.group = group.val();
    this.attributeList.length = 0;
    const form = this.slide.find(`#${this.ids.attributeForm}`);
    const inputGrps = form.children('.input-group');
    inputGrps.each((k, inputGrp) => {
      const key = $(inputGrp).find('[data-attr-type="key"]').val();
      const value = $(inputGrp).find('[data-attr-type="value"]').val();
      if (key && value) {
        this.attributeList.push({
          key,
          value,
        });
      }
    });
  }

  // override BaseUploadSlideComponent
  async getData() {
    const attributes = this.attributeList.reduce((a0, c0) => ({
      ...a0,
      [c0.key]: c0.value,
    }), {});
    if (this.group) {
      attributes.group = this.group;
    }
    return attributes;
  }

  // override BaseUploadSlideComponent
  async clearData() {
    this.slide.find(`#${this.ids.attributeForm}`).children('.input-group').remove();
    this.slide.find(`#${this.ids.groupName}`).val('');
    this.attributeList.length = 0;
    this.group = '';
  }

  // override BaseUploadSlideComponent
  async createSlide() {
    const description = this.createDescription();
    const group = this.createGroupName();
    const attributes = this.createAttributes();
    const attrGroup = $('<div/>').addClass('attr-group')
      .addClass('overflow-auto my-auto align-content-start')
      .append(group)
      .append(attributes);
    const controls = this.createControls();
    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-12 p-0 m-0 mt-4')
        .append(description))
      .append($('<div/>').addClass('col-12 p-0 m-0 mt-4')
        .append(attrGroup))
      .append($('<div/>').addClass('col-12 p-0 m-0 mt-4')
        .append(controls));
    this.slide.append(row);
    return super.createSlide();
  }

  createDescription() {
    return $('<p/>').addClass('lead')
      .html(Localization.Messages.AttributeDesc);
  }

  createControls() {
    // carousel slide controls
    const back = $('<button/>').addClass('btn btn-light ml-1')
      .html(Localization.Buttons.Back);
    const quickupload = $('<button/>').addClass('btn btn-success ml-1')
      .html(Localization.Buttons.QuickUpload);
    const next = $('<button/>').addClass('btn btn-primary ml-1')
      .html(Localization.Buttons.Next);

    back.off('click').on('click', async (event) =>
      this.slide.trigger(AttributeSlideComponent.Controls.Back));

    quickupload.off('click').on('click', async (event) => {
      await this.saveData();
      this.slide.trigger(AttributeSlideComponent.Controls.QuickUpload);
    });

    next.off('click').on('click', async (event) => {
      await this.saveData();
      this.slide.trigger(AttributeSlideComponent.Controls.Next);
    });

    const controls = $('<form/>').addClass('form-inline')
      .append($('<div/>').addClass('ml-auto')
        .append(back)
        .append(quickupload)
        .append(next));

    controls.submit(event =>
      event.preventDefault());

    return controls;
  }

  createGroupName() {
    const title = $('<span/>').addClass('d-block p-2 bg-light text-black lead')
      .html('Group Name');
    const desc = $('<p/>').addClass('mt-2')
      .html(Localization.Messages.GroupDesc);
    const name = $('<input/>').addClass('form-control mr-2')
      .attr('id', this.ids.groupName)
      .attr('pattern', '^[a-zA-Z0-9_-]{0,128}$')
      .attr('placeholder', '(Blank)');
    const form = $('<form/>').addClass('col-4 px-0 needs-validation')
      .attr('novalidate', 'novalidate')
      .append($('<label/>').addClass('mr-2 sr-only')
        .attr('for', this.ids.groupName)
        .html(Localization.Messages.GroupName))
      .append(name);

    name.focusout(async (event) => {
      if (!this.validateForm(event, form)) {
        this.shake(form);
        await this.showAlert(Localization.Alerts.InvalidGroupName);
        name.focus();
        return false;
      }
      return true;
    });

    name.keypress(async (event) => {
      if (event.which === 13) {
        if (!this.validateForm(event, form)) {
          this.shake(form);
          await this.showAlert(Localization.Alerts.InvalidGroupName);
          name.focus();
          return false;
        }
      }
      return true;
    });

    return $('<div/>').addClass('mt-0')
      .append(title)
      .append(desc)
      .append(form);
  }

  createAttributes() {
    const title = $('<span/>').addClass('d-block p-2 bg-light text-black lead')
      .html('Additional attributes');
    const desc = $('<p/>').addClass('mt-2')
      .html(Localization.Messages.AttrDesc);

    const addBtn = $('<button/>').addClass('btn btn-success mb-2')
      .attr('type', 'button')
      .html('Add attribute');

    const form = $('<form/>').addClass('col-9 px-0 needs-validation')
      .attr('id', this.ids.attributeForm)
      .attr('novalidate', 'novalidate')
      .append(addBtn);

    addBtn.off('click').on('click', async (event) => {
      event.preventDefault();
      if (form.children('.input-group').length >= AttributeSlideComponent.Constants.Attribute.Max) {
        event.stopPropagation();
        this.shake(form);
        await this.showAlert(Localization.Alerts.MaxNumOfAttrs);
        return false;
      }
      form.append(this.createKeyValue());
      return true;
    });

    return $('<div/>').addClass('mt-4')
      .append(title)
      .append(desc)
      .append(form);
  }

  createKeyValue() {
    const inputGrp = $('<div/>').addClass('input-group mb-2 mr-sm-2');
    const key = $('<input/>').addClass('form-control col-3')
      .attr('data-attr-type', 'key')
      .attr('type', 'text')
      .attr('placeholder', '(Key)')
      .attr('pattern', '^[a-zA-Z0-9_-]{0,128}$');
    const value = $('<input/>').addClass('form-control')
      .attr('data-attr-type', 'value')
      .attr('type', 'text')
      .attr('placeholder', '(Value)')
      .attr('pattern', '^[a-zA-Z0-9_%., -]{0,255}$');
    const removeBtn = $('<button/>').addClass('btn btn-secondary ml-1')
      .append($('<i/>').addClass('far fa-times-circle'));

    removeBtn.off('click').on('click', (event) => {
      event.preventDefault();
      inputGrp.remove();
    });

    [
      key,
      value,
    ].forEach((x) => {
      x.focusout(async (event) => {
        const form = inputGrp.parent('form').first();
        if (!this.validateForm(event, form) && !x[0].validity.valid) {
          this.shake(form);
          await this.showAlert(Localization.Alerts.InvalidKeyValue);
          x.focus();
          return false;
        }
        return true;
      });

      x.keypress(async (event) => {
        if (event.which === 13) {
          const form = inputGrp.parent('form').first();
          if (!this.validateForm(event, form) && !x[0].validity.valid) {
            this.shake(form);
            await this.showAlert(Localization.Alerts.InvalidKeyValue);
            x.focus();
            return false;
          }
        }
        return true;
      });
    });

    inputGrp
      .append(key)
      .append(value)
      .append(removeBtn);
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
}
