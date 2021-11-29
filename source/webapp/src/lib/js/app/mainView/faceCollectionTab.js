// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../shared/localization.js';
import AppUtils from '../shared/appUtils.js';
import mxSpinner from '../mixins/mxSpinner.js';
import mxAlert from '../mixins/mxAlert.js';
import BaseTab from '../shared/baseTab.js';
import FaceManager from '../shared/faceManager/index.js';

const ID_FACECOLLECTION_CONTAINER = `faceCollectionContainer-${AppUtils.randomHexstring()}`;
const ID_INDEXED_FACE_CONTAINER = `indexedFaceContainer-${AppUtils.randomHexstring()}`;

export default class FaceCollectionTab extends mxAlert(mxSpinner(BaseTab)) {
  constructor(defaultTab = false) {
    super(Localization.Messages.FaceCollectionTab, {
      selected: defaultTab,
    });
    this.$faceManager = FaceManager.getSingleton();
  }

  get faceManager() {
    return this.$faceManager;
  }

  async show() {
    if (!this.initialized) {
      const content = await this.createContent();
      this.tabContent.append(content);
    }
    return super.show();
  }

  async createContent() {
    const description = this.createDescription();
    const collectionList = await this.createCollectionList();
    const loading = this.createLoading();
    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(description))
      .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4')
        .append(collectionList))
      .append($('<div/>').addClass('col-12 p-0 m-0 p-0 bg-light')
        .append($('<div/>').addClass('col-9 p-0 mx-auto mt-4 collapse')
          .attr('id', ID_INDEXED_FACE_CONTAINER)))
      .append(loading);
    return row;
  }

  createDescription() {
    return $('<p/>').addClass('lead')
      .html(Localization.Messages.FaceCollectionDesc);
  }

  async createCollectionList() {
    const faceCollections = await this.faceManager.getCollections();
    const title = $('<span/>').addClass('d-block p-0 lead')
      .html(Localization.Messages.AvailableFaceCollections);

    const form = $('<form/>').addClass('form-inline needs-validation my-4')
      .attr('novalidate', 'novalidate');
    form.submit((event) =>
      event.preventDefault());

    const select = $('<select/>').addClass('custom-select custom-select-sm col-3')
      .attr('id', ID_FACECOLLECTION_CONTAINER)
      .append($('<option/>')
        .attr('value', 'undefined')
        .html(Localization.Messages.SelectFaceCollection));
    select.off('change').on('change', async () => {
      const indexedFaceContainer = this.tabContent.find(`#${ID_INDEXED_FACE_CONTAINER}`);
      const val = select.val();
      if (val === 'undefined') {
        return indexedFaceContainer.addClass('collapse');
      }
      return this.renderIndexedFaces(val, indexedFaceContainer);
    });
    const options = (faceCollections || []).map((x) =>
      $('<option/>')
        .attr('value', x.name)
        .html(`${x.name} (${x.faces} faces)`));
    select.append(options);
    form.append(select);

    /* refresh */
    const refresh = $('<button/>').addClass('btn btn-sm btn-outline-dark')
      .append($('<i/>').addClass('fas fa-sync-alt'));
    refresh.off('click').on('click', async () => {
      await this.refreshCollectionList(select);
      return false;
    });
    form.append(refresh);

    const label = $('<span/>').addClass('lead ml-4 mr-1')
      .html(Localization.Messages.Alternatively);
    const input = $('<input/>').addClass('form-control form-control-sm col-3')
      .attr('pattern', '^[a-zA-Z0-9_.-]{0,255}$')
      .attr('placeholder', '(Blank)');
    const btn = $('<button/>').addClass('btn btn-sm btn-success')
      .append(Localization.Buttons.CreateNewCollection);

    btn.off('click').on('click', async (event) => {
      if (!this.validateForm(event, form)) {
        this.shake(form);
        await this.showAlert(Localization.Alerts.InvalidFaceCollectionName);
        input.focus();
        return false;
      }
      if (!input.val()) {
        return false;
      }
      this.loading(true);
      const collection = await this.faceManager.createCollection(input.val());
      if (collection) {
        const option = $('<option/>')
          .attr('value', collection.name)
          .html(`${collection.name} (${collection.faces} faces)`);
        select.append(option);
        /* select the newly created collection */
        select.val(collection.name).trigger('change');
      }
      input.val('');
      this.loading(false);
      return true;
    });

    form.append(label)
      .append(input)
      .append(btn);

    return $('<div/>').addClass('col-12 p-0 m-0')
      .append(title)
      .append(form);
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
    this.loading(true);
    container.children().remove();

    const response = await this.faceManager.getFacesInCollection(collectionId);
    /* title / delete collection */
    const section = $('<div/>').addClass('row no-gutters');
    const message = Localization.Messages.IndexedFacesInCollection.replace('{{FACE_COLLECTION}}', collectionId);
    section.append($('<div/>').addClass('col-6 p-0 m-0')
      .append($('<span/>').addClass('d-block p-0 lead')
        .html(message)));
    const deleteBtn = this.makeFaceCollectionDeleteBtn(collectionId);
    section.append($('<div/>').addClass('col-6 p-0 m-0 text-left')
      .append(deleteBtn.addClass('float-right')));
    container.append(section);

    /* table */
    const table = $('<table/>').addClass('table table-hover my-4 lead-xs');
    const headers = this.makeFaceTableHeaderRow();
    table.append($('<thead/>')
      .append(headers));
    const rows = await Promise.all(response.faces.map((x) =>
      this.makeFaceTableRow(collectionId, x)));
    table.append($('<tbody/>')
      .append(rows));
    container.append(table);
    /* load more */
    const loadBtn = this.makeLoadMoreBtn(table, collectionId, response.token);
    container.append(loadBtn);

    container.removeClass('collapse');
    this.loading(false);
  }

  makeFaceTableHeaderRow() {
    const rows = [
      '#',
      'ExternalImageId',
      'FriendlyName',
      'FaceId',
      'Remove?',
    ].map((x) =>
      $('<th/>').addClass('align-middle text-center lead-sm')
        .attr('scope', 'col')
        .append(x));
    return $('<tr/>')
      .append(rows);
  }

  async makeFaceTableRow(collectionId, data) {
    const tr = $('<tr/>');
    const image = await this.makeFaceTableRowImage(data.key);
    const friendlyName = this.makeFaceTableRowItem(AppUtils.toFriendlyName(data.externalImageId));
    const faceId = this.makeFaceTableRowItem(data.faceId);
    const externalImageId = this.makeFaceTableRowItem(data.externalImageId);
    const deleteBtn = this.makeFaceTableRowDeleteBtn(collectionId, data.faceId);
    return tr.append(image)
      .append(externalImageId)
      .append(friendlyName)
      .append(faceId)
      .append(deleteBtn);
  }

  async makeFaceTableRowImage(key) {
    const blob = await this.faceManager.getFaceImage(key);
    const image = (!blob)
      ? $('<div/>').addClass('face-thumbnail')
        .append($('<i/>').addClass('fas fa-eye-slash text-white'))
      : $('<img/>').addClass('face-thumbnail')
        .attr('src', blob);
    return $('<td/>').addClass('h-100 align-middle text-center')
      .addClass('m-0 p-0')
      .append(image);
  }

  makeFaceTableRowItem(name) {
    return $('<td/>').addClass('h-100 align-middle text-center')
      .append(name);
  }

  makeFaceCollectionDeleteBtn(collectionId) {
    const btn = $('<button/>').addClass('btn btn-sm btn-danger')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.RemoveFaceCollection)
      .html(Localization.Buttons.RemoveFaceCollection)
      .tooltip({
        trigger: 'hover',
      });
    btn.off('click').on('click', async () => {
      this.loading(true);
      btn.tooltip('hide')
        .addClass('disabled')
        .attr('disabled', 'disabled');
      await this.faceManager.deleteCollection(collectionId);
      const select = this.tabContent.find(`select#${ID_FACECOLLECTION_CONTAINER}`);
      /* force it to switch */
      select.val('undefined').trigger('change');
      select.find(`option[value="${collectionId}"]`).remove();
      this.loading(false);
    });
    return btn;
  }

  makeFaceTableRowDeleteBtn(collectionId, faceId) {
    const btn = $('<button/>').addClass('btn btn-sm btn-outline-danger')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.RemoveFaceFromCollection)
      .append($('<i/>').addClass('far fa-trash-alt'))
      .tooltip({
        trigger: 'hover',
      });
    btn.off('click').on('click', async () => {
      this.loading(true);
      btn.tooltip('hide')
        .addClass('disabled')
        .attr('disabled', 'disabled');
      await this.faceManager.deleteFace(collectionId, faceId);
      const parent = btn.parents('tr');
      parent.remove();
      this.loading(false);
    });
    return $('<td/>').addClass('h-100 align-middle text-center')
      .append(btn);
  }

  makeLoadMoreBtn(table, collectionId, token) {
    const btn = $('<button/>').addClass('btn btn-sm btn-outline-dark')
      .html(Localization.Messages.LoadMore);
    btn.data('token', token);
    if (!token) {
      btn.addClass('disabled')
        .attr('disabled', 'disabled')
        .html(Localization.Messages.NoMoreData);
    }
    btn.off('click').on('click', async () => {
      const refreshToken = btn.data('token');
      const response = await this.faceManager.getFacesInCollection(collectionId, refreshToken);
      const tbody = table.find('tbody');
      const rows = await Promise.all(response.faces.map((x) =>
        this.makeFaceTableRow(collectionId, x)));
      tbody.append(rows);
      btn.data('token', response.token);
      if (!response.token) {
        btn.addClass('disabled')
          .attr('disabled', 'disabled')
          .html(Localization.Messages.NoMoreData);
      }
    });
    const col = $('<div/>').addClass('col-12 text-center mb-4')
      .append(btn);
    return col;
  }

  async refreshCollectionList(select) {
    this.loading(true);
    select.val('undefined').trigger('change');
    select.find('option[value!="undefined"]').remove();
    const faceCollections = await this.faceManager.refreshCollections();
    const options = (faceCollections || []).map((x) =>
      $('<option/>')
        .attr('value', x.name)
        .html(`${x.name} (${x.faces} faces)`));
    select.append(options);
    this.loading(false);
  }

  async showAlert(message, duration) {
    return super.showMessage(this.tabContent, 'danger', Localization.Alerts.Oops, message, duration);
  }
}
