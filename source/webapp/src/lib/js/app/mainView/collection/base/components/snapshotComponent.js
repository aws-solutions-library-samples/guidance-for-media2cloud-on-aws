// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../shared/localization.js';
import AppUtils from '../../../../shared/appUtils.js';
import CropUtils from '../../../../shared/cropUtils.js';
import FaceManager from '../../../../shared/faceManager/index.js';
import mxSpinner from '../../../../mixins/mxSpinner.js';
import mxAlert from '../../../../mixins/mxAlert.js';

export default class SnapshotComponent extends mxAlert(mxSpinner(class {})) {
  constructor(previewComponent) {
    super();
    this.$previewComponent = previewComponent;
    this.$faceManager = FaceManager.getSingleton();
    this.$cropUtils = new CropUtils();
    this.$ids = {
      container: `snapshot-${AppUtils.randomHexstring()}`,
      toggleSnapshot: `toggle-${AppUtils.randomHexstring()}`,
      selectCollection: `select-${AppUtils.randomHexstring()}`,
    };
    this.$container = $('<div/>').addClass('col-12 p-0 m-0 my-2 bg-white')
      .attr('id', this.$ids.container);
  }

  get ids() {
    return this.$ids;
  }

  get container() {
    return this.$container;
  }

  get previewComponent() {
    return this.$previewComponent;
  }

  get faceManager() {
    return this.$faceManager;
  }

  get cropUtils() {
    return this.$cropUtils;
  }

  async hide() {
    await this.cropUtils.unload();
    this.container.children().remove();
  }

  createComponent() {
    this.container.children().remove();
    const row = $('<div/>').addClass('row no-gutters');
    const form = this.createFaceIndexForm();
    row.append($('<div/>').addClass('col-lg-9 col-md-12 col-sm-12 p-0 m-0')
      .append(form));
    const snapshotToggle = this.createSnapshotToggle(form);
    row.append($('<div/>').addClass('col-lg-3 col-md-12 col-sm-12 p-0 m-0 my-auto text-right')
      .append(snapshotToggle));
    const loading = this.createLoading();
    row.append(loading);
    return this.container.append(row);
  }

  createFaceIndexForm() {
    const form = $('<form/>').addClass('form-inline needs-validation my-2')
      .attr('novalidate', 'novalidate');
    form.submit((event) =>
      event.preventDefault());

    const id = this.ids.selectCollection;
    const select = $('<select/>').addClass('custom-select custom-select-sm col-4 disabled')
      .attr('id', id)
      .attr('disabled', 'disabled')
      .append($('<option/>')
        .attr('value', 'undefined')
        .html(Localization.Messages.SelectFaceCollection));
    this.delayLoadFaceCollections(select);

    const label = $('<span/>').addClass('lead-s mx-2')
      .html(Localization.Messages.Name);
    const input = $('<input/>').addClass('form-control form-control-sm col-4 disabled')
      .attr('pattern', '^[a-zA-Z0-9 _.-]{0,255}$')
      .attr('placeholder', '(Blank)')
      .attr('disabled', 'disabled');
    const btn = $('<button/>').addClass('btn btn-sm btn-success disabled')
      .attr('disabled', 'disabled')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.IndexFace)
      .html(Localization.Buttons.IndexFace)
      .tooltip({
        trigger: 'hover',
      });
    btn.off('click').on('click', async (event) => {
      try {
        this.loading(true);
        btn.tooltip('hide');
        const collectionId = select.val();
        const name = input.val();
        if (collectionId === 'undefined') {
          this.shake(form);
          throw new Error(Localization.Alerts.InvalidFaceCollectionSelection);
        }
        if (!this.validateForm(event, form) || !name) {
          this.shake(form);
          input.focus();
          throw new Error(Localization.Alerts.InvalidIndexedName);
        }
        const blob = await this.cropUtils.snapshot();
        await this.faceManager.indexFace(collectionId, name, blob);
        this.container.find(`input#${this.ids.toggleSnapshot}`).trigger('click');
        const message = Localization.Alerts.ConfirmFaceIndexed.replace('{{NAME}}', name)
          .replace('{{FACECOLLECTION}}', collectionId);
        await this.showConfirm(message, 2000);
        return true;
      } catch (e) {
        await this.showAlert(e.message, 5000);
        return false;
      } finally {
        this.loading(false);
      }
    });
    return form
      .append(label)
      .append(input)
      .append(select)
      .append(btn);
  }

  createSnapshotToggle(form) {
    const id = this.ids.toggleSnapshot;
    const input = $('<input/>').addClass('custom-control-input')
      .attr('type', 'checkbox')
      .attr('id', id);
    const label = $('<label/>').addClass('custom-control-label')
      .attr('for', id)
      .append(Localization.Messages.EnableSnapshotMode);
    const toggle = $('<div/>').addClass('custom-control custom-switch mr-2')
      .append(input)
      .append(label);
    input.off('click').on('click', async () => {
      const to = input.prop('checked');
      if (to) {
        await this.previewComponent.pause();
        const view = this.previewComponent.getView();
        await this.cropUtils.load(view);
        form.children().removeAttr('disabled').removeClass('disabled');
      } else {
        await this.cropUtils.unload();
        await this.previewComponent.unpause();
        form.children().attr('disabled', 'disabled').addClass('disabled');
      }
    });
    return toggle;
  }

  delayLoadFaceCollections(select) {
    setTimeout(async () => {
      const faceCollections = await this.faceManager.getCollections();
      const options = (faceCollections || []).map((x) =>
        $('<option/>')
          .attr('value', x.name)
          .html(x.name));
      select.append(options);
    }, 10);
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
    if (this.previewComponent) {
      const view = this.previewComponent.container;
      return super.showMessage(view, 'danger', Localization.Alerts.Oops, message, duration);
    }
    return undefined;
  }

  async showConfirm(message, duration) {
    if (this.previewComponent) {
      const view = this.previewComponent.container;
      return super.showMessage(view, 'success', Localization.Alerts.Confirmed, message, duration);
    }
    return undefined;
  }
}
