// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../shared/localization.js';
import AppUtils from '../../../../shared/appUtils.js';
import Spinner from '../../../../shared/spinner.js';
import CropUtils from '../../../../shared/cropUtils.js';
import {
  GetFaceManager,
  RegisterFaceManagerEvent,
  ON_FACE_COLLECTION_ADDED,
  ON_FACE_COLLECTION_REMOVED,
} from '../../../../shared/faceManager/index.js';
import mxAlert from '../../../../mixins/mxAlert.js';

const {
  Messages: {
    Name: MSG_NAME,
    SelectFaceCollection: MSG_SELECT_COLLECTION,
    EnableSnapshotMode: MSG_ENABLE_SNAPSHOT_MODE,
  },
  Buttons: {
    IndexFace: BTN_INDEX_FACE,
  },
  Tooltips: {
    IndexFace: TOOLTIP_INDEX_FACE,
  },
  Alerts: {
    Oops: OOPS,
    Confirmed: CONFIRMED,
    ConfirmFaceIndexed: MSG_CONFIRMATION,
    InvalidFaceCollectionSelection: ERR_INVALID_COLLECTION,
    InvalidIndexedName: ERR_INVALID_FACE_NAME,
  },
  RegularExpressions: {
    CharacterSet255,
  },
} = Localization;

const RANDOM_ID = AppUtils.randomHexstring();
const ID_CONTAINER = `snapshot-${RANDOM_ID}`;
const ID_SNAPSHOT_TOGGLE = `snapshot-toggle-${RANDOM_ID}`;
const ID_SELECT_COLLECTION = `collection-select-${RANDOM_ID}`;

export default class SnapshotComponent extends mxAlert(class {}) {
  constructor(previewComponent) {
    super();
    this.$previewComponent = previewComponent;
    this.$faceManager = GetFaceManager();
    this.$cropUtils = new CropUtils();
    this.$container = $('<div/>')
      .addClass('col-12 p-0 m-0 my-2 bg-white')
      .attr('id', ID_CONTAINER);

    RegisterFaceManagerEvent(
      'snapshotcomponent',
      this.onFaceManagerEvent.bind(this)
    );

    Spinner.useSpinner();
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
    await this.cropUtils
      .unload();

    this.container.children()
      .remove();
  }

  createComponent() {
    this.container.children()
      .remove();

    const container = $('<div/>')
      .addClass('row no-gutters');
    this.container.append(container);

    const formContainer = $('<div/>')
      .addClass('col-lg-9 col-md-12 col-sm-12 p-0 m-0');
    container.append(formContainer);

    const form = this.createFaceIndexForm();
    formContainer.append(form);

    const toggleContainer = $('<div/>')
      .addClass('col-lg-3 col-md-12 col-sm-12 p-0 m-0 my-auto text-right');
    container.append(toggleContainer);

    const snapshotToggle = this.createSnapshotToggle(form);
    toggleContainer.append(snapshotToggle);

    return this.container;
  }

  createFaceIndexForm() {
    const form = $('<form/>')
      .addClass('form-inline needs-validation my-2')
      .attr('novalidate', 'novalidate');

    const labelName = $('<span/>')
      .addClass('lead-s mx-2')
      .html(MSG_NAME);
    form.append(labelName);

    const inputName = $('<input/>')
      .addClass('form-control form-control-sm col-4 disabled')
      .attr('pattern', CharacterSet255)
      .attr('placeholder', '(Blank)')
      .attr('disabled', 'disabled');
    form.append(inputName);

    const selectCollection = $('<select/>')
      .addClass('custom-select custom-select-sm col-4 disabled')
      .attr('id', ID_SELECT_COLLECTION)
      .attr('disabled', 'disabled');
    form.append(selectCollection);

    const defaultOption = $('<option/>')
      .attr('value', 'undefined')
      .html(MSG_SELECT_COLLECTION);
    selectCollection.append(defaultOption);

    const btnIndexFace = $('<button/>')
      .addClass('btn btn-sm btn-success disabled')
      .attr('disabled', 'disabled')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_INDEX_FACE)
      .html(BTN_INDEX_FACE)
      .tooltip({
        trigger: 'hover',
      });
    form.append(btnIndexFace);

    form.ready(async () => {
      /* event handlings */
      form.submit((event) =>
        event.preventDefault());

      btnIndexFace.on('click', async (event) => {
        try {
          Spinner.loading();

          btnIndexFace.tooltip('hide');

          const collectionId = selectCollection.val();
          const name = inputName.val();

          if (collectionId === 'undefined') {
            this.shake(form);
            throw ERR_INVALID_COLLECTION;
          }

          if (!this.validateForm(event, form) || !name) {
            this.shake(form);
            inputName.focus();
            throw ERR_INVALID_FACE_NAME;
          }

          const blob = await this.cropUtils
            .snapshot();

          const uuid = this.previewComponent.media.uuid;
          const timestamp = this.previewComponent.getCurrentTime() || 0;

          await this.faceManager.indexFace(
            uuid,
            timestamp,
            collectionId,
            name,
            blob
          );

          this.container
            .find(`input#${ID_SNAPSHOT_TOGGLE}`)
            .trigger('click');

          const message = MSG_CONFIRMATION
            .replace('{{NAME}}', name)
            .replace('{{FACECOLLECTION}}', collectionId);

          await this.showConfirm(
            message,
            2000
          );

          return true;
        } catch (e) {
          let message = e;
          if (e instanceof Error) {
            message = e.message;
          }

          await this.showAlert(
            message,
            5000
          );

          return false;
        } finally {
          Spinner.loading(false);
        }
      });

      /* load face collections */
      try {
        Spinner.loading();

        const collections = await this.faceManager
          .getCollections();

        const options = collections
          .map((collection) =>
            $('<option/>')
              .attr('value', collection.name)
              .html(collection.name));

        selectCollection.append(options);
      } catch (e) {
        console.errror(e);
      } finally {
        Spinner.loading(false);
      }
    });

    return form;
  }

  createSnapshotToggle(form) {
    const container = $('<div/>')
      .addClass('custom-control custom-switch mr-2');

    const input = $('<input/>')
      .addClass('custom-control-input')
      .attr('type', 'checkbox')
      .attr('id', ID_SNAPSHOT_TOGGLE);
    container.append(input);

    const label = $('<label/>')
      .addClass('custom-control-label')
      .attr('for', ID_SNAPSHOT_TOGGLE)
      .append(MSG_ENABLE_SNAPSHOT_MODE);
    container.append(label);

    input.on('click', async () => {
      const to = input.prop('checked');

      if (to) {
        await this.previewComponent.pause();

        const view = this.previewComponent.getView();
        await this.cropUtils.load(view);

        form.children()
          .removeAttr('disabled')
          .removeClass('disabled');
      } else {
        await this.cropUtils.unload();

        await this.previewComponent.unpause();

        form.children()
          .attr('disabled', 'disabled')
          .addClass('disabled');
      }
    });

    return container;
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

      return super.showMessage(
        view,
        'danger',
        OOPS,
        message,
        duration
      );
    }

    return undefined;
  }

  async showConfirm(message, duration) {
    if (this.previewComponent) {
      const view = this.previewComponent.container;

      return super.showMessage(
        view,
        'success',
        CONFIRMED,
        message,
        duration
      );
    }

    return undefined;
  }

  async onFaceManagerEvent(
    event,
    data
  ) {
    if (event !== ON_FACE_COLLECTION_ADDED
    && event !== ON_FACE_COLLECTION_REMOVED) {
      return;
    }

    const select = this.container
      .find(`select#${ID_SELECT_COLLECTION}`);

    let option = select
      .find(`option[value="${data.name}"]`);

    if (event === ON_FACE_COLLECTION_ADDED) {
      if (option.length === 0) {
        option = $('<option/>')
          .attr('value', data.name)
          .html(data.name);

        select.append(option);
      }
    } else if (event === ON_FACE_COLLECTION_REMOVED) {
      if (option.length > 0) {
        if (option.is(':selected')) {
          select.val('undefined')
            .trigger('change');
        }
        option.remove();
      }
    }
  }
}
