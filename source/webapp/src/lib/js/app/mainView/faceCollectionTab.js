// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../shared/localization.js';
import AppUtils from '../shared/appUtils.js';
import Spinner from '../shared/spinner.js';
import mxAlert from '../mixins/mxAlert.js';
import BaseTab from '../shared/baseTab.js';
import {
  FaceManager,
  GetFaceManager,
  RegisterFaceManagerEvent,
  ON_FACE_ADDED,
  ON_FACE_REMOVED,
} from '../shared/faceManager/index.js';
import FaceTaggingModal from '../shared/faceManager/faceTaggingModal.js';

const {
  Messages: {
    FaceCollectionTab: TITLE,
    FaceCollectionDesc: MSG_FACE_COLLECTION_DESC,
    AvailableFaceCollections: MSG_AVAILABLE_FACE_COLLECTIONS,
    SelectFaceCollection: MSG_SELECT_FACE_COLLECTION,
    Alternatively: MSG_ALTERNATIVELY,
    IndexedFacesInCollection: MSG_FACES_IN_COLLECTION,
    ManagedByFaceIndexer: MSG_MANAGED,
    NotManagedByFaceIndexer: MSG_NOT_MANAGED,
    ImportCollectionCompleted: MSG_IMPORT_COMPLETED,
    Name: COL_NAME,
    ColumnFaceId: COL_FACE_ID,
    ColumnExternalImageId: COL_EXTERNAL_IMAGE_ID,
    ColumnIndexedAt: COL_INDEXED_AT,
    ColumnRelatedAssetId: COL_RELATED_ASSET_ID,
    ColumnRemove: COL_REMOVE,
    NoMoreData: MSG_NO_MORE_DATA,
  },
  Tooltips: {
    RemoveFaceCollection: TOOLTIP_REMOVE_COLLECTION,
    RemoveFaceFromCollection: TOOLTIP_REMOVE_FACE,
    ImportFaceCollection: TOOLTIP_IMPORT_COLLECTION,
    FaceTaggingTool: TOOLTIP_FACE_TAGGING,
  },
  Buttons: {
    CreateNewCollection: BTN_CREATE_NEW_COLLECTION,
    RemoveFaceCollection: BTN_REMOVE_COLLECTION,
    ImportFaceCollection: BTN_IMPORT_COLLECTION,
    FaceTaggingTool: BTN_FACE_TAGGING,
    LoadMore: BTN_LOAD_MORE,
  },
  Alerts: {
    Oops: OOPS,
    Confirmed: CONFIRMED,
    InvalidFaceCollectionName: ERR_INVALID_FACE_COLLECTION_NAME,
    ImportFaceCollectionFailed: ERR_IMPORT_FACE_COLLECTION,
  },
} = Localization;

const HASHTAG = TITLE.replaceAll(' ', '');

export default class FaceCollectionTab extends mxAlert(BaseTab) {
  constructor() {
    super(TITLE, {
      hashtag: HASHTAG,
    });

    this.$faceCollectionContainerId = `facecolllectioncontainer-${this.id}`;
    this.$indexedFaceContainerId = `indexedfacecontainer-${this.id}`;

    this.$faceManager = GetFaceManager();

    RegisterFaceManagerEvent(
      'facecollectiontab',
      this.onFaceManagerEvent.bind(this)
    );

    Spinner.useSpinner();
  }

  get faceManager() {
    return this.$faceManager;
  }

  get faceCollectionContainerId() {
    return this.$faceCollectionContainerId;
  }

  get indexedFaceContainerId() {
    return this.$indexedFaceContainerId;
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

    const descContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(descContainer);

    const desc = this.createDescription();
    descContainer.append(desc);

    const collectionContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(collectionContainer);

    const collectionList = this.createCollectionList();
    collectionContainer.append(collectionList);

    const indexedFaceContainer = $('<div/>')
      .addClass('col-12 p-0 m-0 p-0 bg-light');
    container.append(indexedFaceContainer);

    const indexedFaceList = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4 collapse')
      .attr('id', this.indexedFaceContainerId);
    indexedFaceContainer.append(indexedFaceList);

    return container;
  }

  createDescription() {
    return $('<p/>')
      .addClass('lead')
      .html(MSG_FACE_COLLECTION_DESC);
  }

  createCollectionList() {
    const container = $('<div/>')
      .addClass('col-12 p-0 m-0');

    const title = $('<span/>')
      .addClass('d-block p-0 lead')
      .html(MSG_AVAILABLE_FACE_COLLECTIONS);
    container.append(title);

    const formContainer = $('<form/>')
      .addClass('form-inline needs-validation my-4')
      .attr('novalidate', 'novalidate');
    container.append(formContainer);

    /* select */
    const selectContainer = $('<select/>')
      .addClass('custom-select custom-select-sm col-3')
      .attr('id', this.faceCollectionContainerId);
    formContainer.append(selectContainer);

    const defaultOption = $('<option/>')
      .attr('value', 'undefined')
      .html(MSG_SELECT_FACE_COLLECTION);
    selectContainer.append(defaultOption);

    /* refresh */
    const btnRefresh = $('<button/>')
      .addClass('btn btn-sm btn-outline-dark');
    formContainer.append(btnRefresh);

    const iconRefresh = $('<i/>')
      .addClass('fas fa-sync-alt');
    btnRefresh.append(iconRefresh);

    /* new collection */
    const labelAlternatively = $('<span/>')
      .addClass('lead ml-4 mr-1')
      .html(MSG_ALTERNATIVELY);
    formContainer.append(labelAlternatively);

    const inputCollectionName = $('<input/>')
      .addClass('form-control form-control-sm col-3')
      .attr('pattern', '^[a-zA-Z0-9_.-]{0,255}$')
      .attr('placeholder', '(Blank)');
    formContainer.append(inputCollectionName);

    const btnCreateNewCollection = $('<button/>')
      .addClass('btn btn-sm btn-success')
      .append(BTN_CREATE_NEW_COLLECTION);
    formContainer.append(btnCreateNewCollection);

    container.ready(async () => {
      const indexedFaceContainer = this.tabContent
        .find(`#${this.indexedFaceContainerId}`);

      /* events */
      formContainer.submit((event) =>
        event.preventDefault());

      selectContainer.on('change', async () => {
        const val = selectContainer.val();

        if (val === 'undefined') {
          return indexedFaceContainer
            .addClass('collapse');
        }

        return this.renderIndexedFaces(
          val,
          indexedFaceContainer
        );
      });

      btnRefresh.on('click', async () => {
        await this.refreshCollectionList(selectContainer);
        return false;
      });

      btnCreateNewCollection.on('click', async (event) => {
        if (!this.validateForm(event, formContainer)) {
          this.shake(formContainer);

          await this.showAlert(ERR_INVALID_FACE_COLLECTION_NAME);

          inputCollectionName.focus();
          return false;
        }

        if (!inputCollectionName.val()) {
          return false;
        }

        try {
          Spinner.loading();

          const collectionName = inputCollectionName.val();
          const collection = await this.faceManager
            .createCollection(collectionName);

          if (collection) {
            const option = $('<option/>')
              .attr('value', collection.name);

            const desc = `${collection.name} (${collection.faces} faces)`;
            option.html(desc);

            selectContainer.append(option);

            /* select the newly created collection */
            selectContainer
              .val(collection.name)
              .trigger('change');
          }

          /* reset input */
          inputCollectionName.val('');

          return true;
        } catch (e) {
          console.error(e);
          return false;
        } finally {
          Spinner.loading(false);
        }
      });

      const collections = await this.faceManager.getCollections();

      const options = collections
        .map((collection) => {
          const option = $('<option/>')
            .attr('value', collection.name);

          const desc = `${collection.name} (${collection.faces} faces)`;
          option.html(desc);

          return option;
        });

      selectContainer.append(options);
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

  async renderIndexedFaces(collectionId, container) {
    try {
      Spinner.loading();

      container.children()
        .remove();

      const promiseFaces = await this.faceManager
        .getFacesInCollection(collectionId);

      // check to see if is managed by face indexer
      const managed = (((promiseFaces.faces || [])[0] || {}).timestamp !== undefined);

      // title / delete collection
      const section = $('<div/>')
        .addClass('row no-gutters');
      container.append(section);

      // description
      const descContainer = $('<div/>')
        .addClass('col-6 p-0 m-0');
      section.append(descContainer);

      let desc = MSG_FACES_IN_COLLECTION
        .replace('{{FACECOLLECTION}}', collectionId);
      if (managed) {
        desc = `${desc} ${MSG_MANAGED}`;
      } else {
        desc = `${desc} ${MSG_NOT_MANAGED}`;
      }
      desc = $('<span/>')
        .addClass('d-block p-0 lead')
        .html(desc);
      descContainer.append(desc);

      // import / delete collection button
      const btnContainer = $('<div/>')
        .addClass('col-6 p-0 m-0 text-left');
      section.append(btnContainer);

      // delete btn
      const deleteBtn = this.makeFaceCollectionDeleteBtn(collectionId);
      deleteBtn.addClass('float-right');
      btnContainer.append(deleteBtn);

      // import button
      const importBtn = this.makeImportCollectionBtn(collectionId);
      importBtn.addClass('float-right mr-1');
      if (managed || promiseFaces.faces.length === 0) {
        importBtn.addClass('collapse');
      }
      btnContainer.append(importBtn);

      // face tagging button
      const untagged = [];
      promiseFaces.faces
        .forEach((face) => {
          if (face.celeb === undefined) {
            untagged.push(face);
          }
        });
      const faceTagBtn = this.makeFaceTaggingBtn(collectionId, untagged);
      faceTagBtn.addClass('float-right mr-1');
      if (!managed || untagged.length === 0) {
        faceTagBtn.addClass('collapse');
      }
      btnContainer.append(faceTagBtn);

      // table
      const table = $('<table/>')
        .addClass('table table-hover my-4 lead-xxs');
      container.append(table);

      const thead = $('<thead/>');
      table.append(thead);

      const headerRow = this.makeFaceTableHeaderRow(managed);
      thead.append(headerRow);

      const tbody = $('<tbody/>');
      table.append(tbody);

      const tableRows = promiseFaces.faces
        .map((face) =>
          this.makeFaceTableRow(
            collectionId,
            face
          ));
      tbody.append(tableRows);

      // load more button
      const moreBtn = this.makeLoadMoreBtn(
        table,
        collectionId,
        promiseFaces.token
      );
      container.append(moreBtn);

      container.removeClass('collapse');
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }

  makeFaceTableHeaderRow(managed) {
    const container = $('<tr/>');

    let rows = [
      '#',
      COL_FACE_ID,
      COL_NAME,
      COL_EXTERNAL_IMAGE_ID,
      COL_INDEXED_AT,
      COL_RELATED_ASSET_ID,
    ];
    if (!managed) {
      rows.push(COL_REMOVE);
    }

    rows = rows.map((x) =>
      $('<th/>')
        .addClass('align-middle text-center lead-sm b-300')
        .attr('scope', 'col')
        .append(x));
    container.append(rows);

    return container;
  }

  makeFaceTableRow(collectionId, data) {
    const container = $('<tr/>');

    let key = data.key;
    if (data.blob !== undefined) {
      key = data.blob;
    }

    const image = this.makeFaceTableRowImage(key);
    container.append(image);

    const faceId = this.makeFaceTableRowItem(data.faceId);
    container.append(faceId);

    let friendlyName = data.celeb;
    if (!friendlyName) {
      friendlyName = FaceManager.resolveExternalImageId(data.externalImageId);
    }
    if (!friendlyName) {
      friendlyName = '-';
    }
    friendlyName = this.makeFaceTableRowItem(friendlyName);
    container.append(friendlyName);

    const externalImageId = this.makeFaceTableRowItem(data.externalImageId);
    container.append(externalImageId);

    let indexedAt = data.timestamp;
    if (indexedAt === undefined) {
      indexedAt = '-';
    } else {
      indexedAt = new Date(indexedAt).toISOString();
    }
    indexedAt = this.makeFaceTableRowItem(indexedAt);
    container.append(indexedAt);

    let uuid = data.uuid;
    if (uuid === undefined) {
      uuid = '-';
    }
    uuid = this.makeFaceTableRowItem(uuid);
    container.append(uuid);

    // if not managed by faceindexer, add a delete button
    if (data.timestamp === undefined) {
      const deleteBtn = this.makeFaceTableRowDeleteBtn(
        collectionId,
        data.faceId
      );
      container.append(deleteBtn);
    }

    return container;
  }

  makeFaceTableRowImage(key) {
    const container = $('<td/>')
      .addClass('h-100 align-middle text-center')
      .addClass('m-0 p-0');

    container.ready(async () => {
      let image;
      let blob;

      if (key && key.indexOf('blob:') === 0) {
        blob = key;
      } else {
        blob = await this.faceManager.getFaceImage(key);
      }

      if (blob === undefined) {
        image = $('<div/>')
          .addClass('face-thumbnail');

        const iconImage = $('<i/>')
          .addClass('fas fa-eye-slash text-white');

        image.append(iconImage);
      } else {
        image = $('<img/>')
          .addClass('face-thumbnail')
          .attr('src', blob);
      }

      container.append(image);
    });

    return container;
  }

  makeFaceTableRowItem(name) {
    return $('<td/>')
      .addClass('h-100 align-middle text-center')
      .append(name);
  }

  makeFaceCollectionDeleteBtn(collectionId) {
    const deletBtn = $('<button/>')
      .addClass('btn btn-sm btn-danger')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_REMOVE_COLLECTION)
      .html(BTN_REMOVE_COLLECTION)
      .tooltip({
        trigger: 'hover',
      });

    deletBtn.on('click', async () => {
      try {
        Spinner.loading();
        deletBtn.tooltip('hide')
          .addClass('disabled')
          .attr('disabled', 'disabled');
        await this.faceManager.deleteCollection(collectionId);

        const select = this.tabContent
          .find(`select#${this.faceCollectionContainerId}`);

        /* force it to switch */
        select.val('undefined')
          .trigger('change');

        select.find(`option[value="${collectionId}"]`)
          .remove();
      } catch (e) {
        console.error(e);
      } finally {
        Spinner.loading(false);
      }
    });

    return deletBtn;
  }

  makeImportCollectionBtn(collectionId) {
    const importBtn = $('<button/>')
      .addClass('btn btn-sm btn-outline-success')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_IMPORT_COLLECTION)
      .html(BTN_IMPORT_COLLECTION)
      .tooltip({
        trigger: 'hover',
      });

    importBtn.on('click', async () => {
      try {
        Spinner.loading();

        importBtn.tooltip('hide')
          .addClass('disabled')
          .attr('disabled', 'disabled');

        await this.faceManager.importFaceCollection(collectionId);

        const message = MSG_IMPORT_COMPLETED
          .replace('{{FACECOLLECTION}}', collectionId);
        await this.showConfirm(message);

        // re-render table
        const indexedFaceContainer = this.tabContent
          .find(`#${this.indexedFaceContainerId}`);

        await this.renderIndexedFaces(
          collectionId,
          indexedFaceContainer
        );
      } catch (e) {
        console.error(e);
        const message = ERR_IMPORT_FACE_COLLECTION
          .replace('{{FACECOLLECTION}}', collectionId)
          .replace('{{ERROR}}', e.message);
        await this.showAlert(message);
      } finally {
        Spinner.loading(false);
      }
    });

    return importBtn;
  }

  makeFaceTaggingBtn(collectionId, untagged) {
    const faceTagBtn = $('<button/>')
      .addClass('btn btn-sm btn-outline-dark')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_FACE_TAGGING)
      .html(BTN_FACE_TAGGING)
      .tooltip({
        trigger: 'hover',
      });

    faceTagBtn.on('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();

      const {
        updated = [],
        deleted = [],
      } = await this.showFaceTaggingModal(
        this.tabContent,
        untagged
      ) || {};

      // re-render table upon changes
      if (updated.length + deleted.length > 0) {
        const selectContainer = this.tabContent
          .find(`select#${this.faceCollectionContainerId}`);

        await this.refreshCollectionList(selectContainer, collectionId);
      }
    });

    return faceTagBtn;
  }

  makeFaceTableRowDeleteBtn(collectionId, faceId) {
    const container = $('<td/>')
      .addClass('h-100 align-middle text-center');

    const deleteBtn = $('<button/>')
      .addClass('btn btn-sm btn-outline-danger')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_REMOVE_FACE)
      .tooltip({
        trigger: 'hover',
      });
    container.append(deleteBtn);

    const deleteIcon = $('<i/>')
      .addClass('far fa-trash-alt');
    deleteBtn.append(deleteIcon);

    deleteBtn.on('click', async () => {
      try {
        Spinner.loading();

        deleteBtn.tooltip('hide')
          .addClass('disabled')
          .attr('disabled', 'disabled');

        await this.faceManager.deleteFace(collectionId, faceId);

        const parent = deleteBtn.parents('tr');

        parent.remove();
      } catch (e) {
        console.error(e);
      } finally {
        Spinner.loading(false);
      }
    });

    return container;
  }

  makeLoadMoreBtn(table, collectionId, token) {
    const container = $('<div/>')
      .addClass('col-12 text-center mb-4');

    const moreBtn = $('<button/>')
      .addClass('btn btn-sm btn-outline-dark')
      .html(BTN_LOAD_MORE);
    container.append(moreBtn);

    moreBtn.data('token', token);
    if (!token || token === 'undefined') {
      moreBtn.addClass('disabled')
        .attr('disabled', 'disabled')
        .html(MSG_NO_MORE_DATA);
    }

    moreBtn.on('click', async () => {
      try {
        Spinner.loading();
        const refreshToken = moreBtn.data('token');

        const response = await this.faceManager.getFacesInCollection(
          collectionId,
          refreshToken
        );

        const tbody = table.find('tbody');
        const tableRows = response.faces
          .map((face) =>
            this.makeFaceTableRow(collectionId, face));
        tbody.append(tableRows);

        moreBtn.data('token', response.token);

        if (!response.token) {
          moreBtn.addClass('disabled')
            .attr('disabled', 'disabled')
            .html(MSG_NO_MORE_DATA);
        }
      } catch (e) {
        console.error(e);
      } finally {
        Spinner.loading(false);
      }
    });

    return container;
  }

  async refreshCollectionList(select, collectionId) {
    try {
      Spinner.loading();

      select.val('undefined')
        .trigger('change');

      select
        .find('option[value!="undefined"]')
        .remove();

      const collection = await this.faceManager.refreshCollections();

      const options = collection
        .map((option) =>
          $('<option/>')
            .attr('value', option.name)
            .html(`${option.name} (${option.faces} faces)`));

      select.append(options);

      if (collectionId) {
        select.val(collectionId)
          .trigger('change');
      }
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }

  async showAlert(message, duration) {
    return super.showMessage(
      this.tabContent,
      'danger',
      OOPS,
      message,
      duration
    );
  }

  async showConfirm(message, duration) {
    return super.showMessage(
      this.tabContent,
      'success',
      CONFIRMED,
      message,
      duration
    );
  }

  async onFaceManagerEvent(
    event,
    data
  ) {
    /* only handle face added event */
    if (event !== ON_FACE_ADDED && event !== ON_FACE_REMOVED) {
      return;
    }

    const option = this.tabContent
      .find(`select#${this.faceCollectionContainerId}`)
      .find(`option[value="${data.collectionId}"]`);

    if (option.length === 0) {
      return;
    }

    const faces = await this.faceManager.getFacesInCollection(
      data.collectionId
    ).then((res) =>
      res.faces);

    const collectionName = option.val();
    const desc = `${collectionName} (${faces.length} faces)`;
    option.html(desc);

    if (event === ON_FACE_ADDED && option.is(':selected')) {
      /* redner the newly added face */
      const tbody = this.tabContent
        .find(`#${this.indexedFaceContainerId}`)
        .find('tbody');

      if (tbody.length === 0) {
        return;
      }

      const row = this.makeFaceTableRow(
        data.collectionId,
        data
      );

      tbody.append(row);
    }
  }

  async showFaceTaggingModal(container, untagged) {
    return new Promise((resolve) => {
      const modal = new FaceTaggingModal(
        container,
        untagged
      );

      container.on('facetagging:modal:hidden', async (event) => {
        container.off('facetagging:modal:hidden');
        const data = modal.destroy();
        resolve(data);
      });

      modal.show();
    });
  }
}
