// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../shared/localization.js';
import Spinner from '../shared/spinner.js';
import mxAlert from '../mixins/mxAlert.js';
import BaseTab from '../shared/baseTab.js';
import {
  TAGGING_FACE,
  GetFaceManager,
  GetFaceManagerS3Prefix,
} from '../shared/faceManager/index.js';
import {
  GetProxyBucket,
  GetS3Utils,
} from '../shared/s3utils.js';
import AppUtils from '../shared/appUtils.js';
import {
  AWSConsoleStepFunctions,
} from '../shared/awsConsole.js';

const {
  getExecutionLink,
} = AWSConsoleStepFunctions;

const {
  shorten,
  randomHexstring,
  readableDuration,
} = AppUtils;

const {
  Messages,
  Tooltips,
  Buttons,
  Alerts,
  RegularExpressions: {
    UnicodeUsername,
  },
} = Localization;

const FACES_PER_PAGE = 20;
const VISIBLE_PAGES = 5;
const HASHTAG = Messages.FaceCollectionTab.replaceAll(' ', '');

const MODALSPINNERID = `modal-spinner-${randomHexstring()}`;
const UPLOADPREFIX = `${GetFaceManagerS3Prefix()}/_imagestoindex`;

export default class FaceCollectionTab extends mxAlert(BaseTab) {
  constructor() {
    super(Messages.FaceCollectionTab, {
      hashtag: HASHTAG,
    });

    this.$faceCollectionContainerId = `facecolllectioncontainer-${this.id}`;
    this.$indexedFaceContainerId = `indexedfacecontainer-${this.id}`;

    this.$faceManager = GetFaceManager();

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
      .html(Messages.FaceCollectionDesc);
  }

  createCollectionList() {
    const container = $('<div/>')
      .addClass('col-12 p-0 m-0');

    const title = $('<span/>')
      .addClass('d-block p-0 lead')
      .html(Messages.AvailableFaceCollections);
    container.append(title);

    const formContainer = $('<form/>')
      .addClass('form-inline needs-validation my-4')
      .attr('novalidate', 'novalidate')
      .attr('formtype', 'collections');
    container.append(formContainer);

    /* select */
    const selectContainer = $('<select/>')
      .addClass('custom-select custom-select-sm col-3')
      .attr('id', this.faceCollectionContainerId);
    formContainer.append(selectContainer);

    const defaultOption = $('<option/>')
      .attr('value', 'undefined')
      .data('numfaces', 0)
      .html(Messages.SelectFaceCollection);
    selectContainer.append(defaultOption);

    /* refresh */
    const btnRefresh = $('<button/>')
      .addClass('btn btn-sm btn-outline-dark')
      .attr('buttontype', 'refresh');
    formContainer.append(btnRefresh);

    const iconRefresh = $('<i/>')
      .addClass('fas fa-sync-alt');
    btnRefresh.append(iconRefresh);

    /* new collection */
    const labelAlternatively = $('<span/>')
      .addClass('lead ml-4 mr-1')
      .html(Messages.Alternatively);
    formContainer.append(labelAlternatively);

    const inputCollectionName = $('<input/>')
      .addClass('form-control form-control-sm col-3')
      .attr('pattern', '^[a-zA-Z0-9_.\\-]{0,255}$')
      .attr('placeholder', '(Blank)');
    formContainer.append(inputCollectionName);

    const btnCreateNewCollection = $('<button/>')
      .addClass('btn btn-sm btn-success')
      .append(Buttons.CreateNewCollection);
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

          await this.showAlert(Alerts.InvalidFaceCollectionName);

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
              .attr('value', collection.name)
              .data('numfaces', collection.faces);

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
            .attr('value', collection.name)
            .data('numfaces', collection.faces);

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

      const option = this.tabContent
        .find(`select#${this.faceCollectionContainerId}`)
        .find(`option[value="${collectionId}"]`);

      const numFaces = option.data('numfaces') || 0;

      const { faces = [] } = await this.faceManager
        .getFacesInCollection(collectionId);

      // check to see if is managed by face indexer
      let managedByFaceIndexer = true;
      if (faces.length > 0 && faces[0].timestamp === undefined) {
        managedByFaceIndexer = false;
      }

      // title / delete collection
      const section = $('<div/>')
        .addClass('row no-gutters');
      container.append(section);

      // description
      const descContainer = $('<div/>')
        .addClass('col-12 p-0 m-0');
      section.append(descContainer);

      const description = $('<div>')
        .addClass('p-0 lead');
      descContainer.append(description);

      let descText = Messages.IndexedFacesInCollection
        .replace('{{FACECOLLECTION}}', collectionId);
      const instruction = $('<div/>')
        .addClass('mt-2 lead-s font-italic');

      if (managedByFaceIndexer) {
        descText = `${descText} ${Messages.ManagedByFaceIndexer}`;
        instruction.append(Messages.UploadIndexFaces);
      } else {
        descText = `${descText} ${Messages.NotManagedByFaceIndexer}`;
        instruction.append(Messages.ImportFaceCollection);
      }
      description.append(descText)
        .append(instruction);

      // actions
      // import / delete collection button
      const btnContainer = $('<div/>')
        .addClass('col-12 p-0 m-0 mt-2');
      section.append(btnContainer);

      // delete btn
      const deleteBtn = this.makeFaceCollectionDeleteBtn(collectionId);
      btnContainer.append(deleteBtn);

      // upload and index new faces button
      const btnUpload = this.makeUploadFacesBtn(collectionId);
      btnUpload.addClass('ml-1');
      btnContainer.append(btnUpload);
      // disble upload if there are faces in the collection and is not managed by us
      if (!managedByFaceIndexer) {
        btnUpload.addClass('collapse');
      }

      // import collection button
      const importBtn = this.makeImportCollectionBtn(collectionId);
      importBtn.addClass('ml-1');
      // disable import if the collection is already managed by us
      if (managedByFaceIndexer) {
        importBtn.addClass('collapse');
      }
      btnContainer.append(importBtn);

      // face table and pagination
      const sectionFacePagination = await this.buildFacePagination(collectionId, faces, numFaces);
      container.append(sectionFacePagination);

      container.removeClass('collapse');
    } catch (e) {
      console.error(e);
    } finally {
      Spinner.loading(false);
    }
  }

  async buildFacePagination(collectionId, faces, numFaces) {
    const container = $('<section/>')
      .addClass('mt-4');

    const table = $('<table/>')
      .addClass('table table-hover my-2 lead-xxs');

    const thead = $('<thead/>');
    table.append(thead);

    let tr = $('<tr/>');
    thead.append(tr);

    const headers = [
      '#',
      Messages.Name,
      Messages.ColumnFaceId,
      Messages.ColumnExternalImageId,
      Messages.ColumnIndexedAt,
      Messages.ColumnRelatedAssetId,
    ];

    for (const header of headers) {
      const item = $('<th/>')
        .addClass('align-middle text-center lead-sm b-300')
        .attr('scope', 'col')
        .append(header);
      tr.append(item);
    }

    const tbody = $('<tbody/>')
      .data('collectionid', collectionId);
    table.append(tbody);

    // adding pagination
    const [pageContainer, pageList] = this.makePaginationControls(tbody, numFaces);
    container.append(pageContainer);

    // add table afterward
    container.append(table);

    const pages = pageList.children();

    const pagePrevious = pages.first();
    pagePrevious.removeClass('collapse');

    const pageNext = pages.last();
    pageNext.removeClass('collapse');

    const duped = faces.slice();
    for (let i = 0; duped.length > 0; i += 1) {
      const pageId = i + 1;

      // render faces per page
      const facesPerPage = duped.splice(0, FACES_PER_PAGE);
      for (const face of facesPerPage) {
        const tr = this.makeFaceTableRow(pageId, face);
        tbody.append(tr);
      }

      // limit to show 2 pages
      const visiblePages = Math.min(VISIBLE_PAGES, pageNext.index() - 1);
      const pageItems = pages.filter((idx, el) => {
        const index = $(el).index();
        return index > 0 && index <= visiblePages;
      });

      pageItems.removeClass('collapse')
        .removeClass('disabled');
    }

    const hiddenPages = pages.filter((idx, item) =>
      $(item).hasClass('collapse'));

    if (hiddenPages.length > 0) {
      pageNext.removeClass('disabled');
    }

    const pageFirst = pages.get(1);
    $(pageFirst).find('a').trigger('click');

    return container;
  }

  makePaginationControls(tBody, numFaces) {
    const navContainer = $('<nav/>')
      .attr('aria-label', 'Face pagination');

    const pageList = $('<ul/>')
      .addClass('pagination pagination-sm')
      .addClass('justify-content-end'); // 'justify-content-center'
    navContainer.append(pageList);

    const pagePrevious = this.makePageListItem('Previous', '&laquo;', -1, pageList, tBody);
    pageList.append(pagePrevious);

    const pageItems = [];
    const numPages = Math.ceil(numFaces / FACES_PER_PAGE);
    for (let i = 0; i < numPages; i += 1) {
      const pageId = i + 1;
      const label = `Page ${pageId}`;
      const text = String(pageId);
      const pageItem = this.makePageListItem(label, text, pageId, pageList, tBody);
      pageItems.push(pageItem);
    }
    pageList.append(pageItems);

    const pageNext = this.makePageListItem('Next', '&raquo;', -1, pageList, tBody);
    pageNext.attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', `Total of ${numPages} pages`)
      .tooltip({ trigger: 'hover' });

    pageList.append(pageNext);

    return [navContainer, pageList];
  }

  makePageListItem(label, text, pageId, pageList, tBody) {
    const item = $('<li/>')
      .addClass('page-item')
      .addClass('collapse')
      .addClass('disabled')
      .data('pageid', pageId);

    const anchor = $('<a/>')
      .addClass('page-link')
      .attr('href', '#/FaceCollection')
      .attr('aria-label', label)
      .attr('tabindex', String(pageId));
    item.append(anchor);

    const itemText = $('<span/>')
      .attr('aria-hidden', 'true')
      .append(text);
    anchor.append(itemText);

    const srOnly = $('<span/>')
      .addClass('sr-only')
      .append(label);
    anchor.append(srOnly);

    anchor.on('click', async (event) => {
      event.preventDefault();
      anchor.blur();

      const from = pageList.children('li.active').first().index();
      const to = anchor.parent().index();

      await this.onPaginationEvent(from, to, pageList, tBody);
    });

    return item;
  }

  filterVisiblePages(pages, range = []) {
    const [preIdx, nexIdx] = range;

    const visiblePages = [];
    pages
      .filter((_, el) =>
        $(el).hasClass('collapse') === false)
      .each((_, el) => {
        const item = $(el);
        const index = item.index();

        if (index > preIdx && index < nexIdx) {
          visiblePages.push(item);
        }
      });

    return visiblePages;
  }

  async onPaginationEvent(from, to, pageList, tbody) {
    const pages = pageList.children();

    // index of the previous and next controls
    const previousIndex = pages.first().index();
    const nextIndex = pages.last().index();

    if (to === previousIndex) {
      return this.onPagingPreviousEvent(from, to, pageList, tbody);
    }

    if (to === nextIndex) {
      return this.onPagingNextEvent(from, to, pageList, tbody);
    }

    return this.onPagingPageEvent(from, to, pageList, tbody);
  }

  async onPagingPreviousEvent(from, to, pageList, tbody) {
    const pages = pageList.children();

    // index of the previous and next controls
    const previousIndex = pages.first().index();
    const nextIndex = pages.last().index();

    // indices that are currently visible
    const visiblePages = this.filterVisiblePages(pages, [previousIndex, nextIndex]);
    const visiblePageIndices = [];
    for (const item of visiblePages) {
      visiblePageIndices.push(item.index());
    }

    let min = Math.min(...visiblePageIndices);
    let max = Math.max(...visiblePageIndices);
    for (let i = min; i <= max; i += 1) {
      $(pages.get(i)).addClass('collapse')
        .addClass('disabled')
        .removeClass('active');
    }

    min = Math.max(min - VISIBLE_PAGES, previousIndex + 1);
    max = Math.max(min + VISIBLE_PAGES - 1, previousIndex + 1);

    for (let i = min; i <= max; i += 1) {
      const page = $(pages.get(i));
      page.removeClass('collapse').removeClass('disabled');
      if (i === max) {
        page.addClass('active');
        await this.setTableRowsVisible(tbody, i);
      }
    }

    // enable/disable Previous/Next controls
    $(pages.get(nextIndex)).removeClass('disabled');
    if (min <= (previousIndex + 1)) {
      $(pages.get(previousIndex)).addClass('disabled');
    }
  }

  async onPagingNextEvent(from, to, pageList, tbody) {
    const pages = pageList.children();

    // index of the previous and next controls
    const previousIndex = pages.first().index();
    const nextIndex = pages.last().index();

    // indices that are currently visible
    const visiblePages = this.filterVisiblePages(pages, [previousIndex, nextIndex]);
    const visiblePageIndices = [];
    for (const item of visiblePages) {
      visiblePageIndices.push(item.index());
    }

    let min = Math.min(...visiblePageIndices);
    let max = Math.max(...visiblePageIndices);
    for (let i = min; i <= max; i += 1) {
      $(pages.get(i)).addClass('collapse')
        .addClass('disabled')
        .removeClass('active');
    }

    max = Math.min(max + VISIBLE_PAGES, nextIndex - 1);
    min = Math.min(min + VISIBLE_PAGES, nextIndex - VISIBLE_PAGES);

    for (let i = min; i <= max; i += 1) {
      const page = $(pages.get(i));
      page.removeClass('collapse')
        .removeClass('disabled');
      if (i === min) {
        page.addClass('active');
        await this.setTableRowsVisible(tbody, i);
      }
    }

    // enable/disable Previous/Next controls
    $(pages.get(previousIndex)).removeClass('disabled');
    if (max >= (nextIndex - 1)) {
      $(pages.get(nextIndex)).addClass('disabled');
    }
  }

  async onPagingPageEvent(from, to, pageList, tbody) {
    const pages = pageList.children();

    const pageFrom = $(pages.get(from));
    pageFrom.removeClass('active');

    const pageTo = $(pages.get(to));
    pageTo.addClass('active');

    await this.setTableRowsVisible(tbody, to);
  }

  async setTableRowsVisible(tbody, pageId) {
    const rows = tbody.children();
    let updated = 0;

    rows.each((idx, el) => {
      const item = $(el);
      if (item.data('pageid') === pageId) {
        item.removeClass('collapse');
        updated += 1;
      } else {
        item.addClass('collapse');
      }
    });

    if (updated === 0) {
      try {
        Spinner.loading();

        const collectionId = tbody.data('collectionid');
        const { token } = await this.faceManager.getFacesInCollection(collectionId);

        if (token) {
          const { faces } = await this.faceManager.getFacesInCollection(collectionId, token);

          const numItems = rows.length;
          const duped = faces.slice(numItems);

          const lastRenderedPageId = rows.last().data('pageid');

          for (let i = lastRenderedPageId + 1; duped.length > 0; i += 1) {
            // render faces per page
            const facesPerPage = duped.splice(0, FACES_PER_PAGE);
            for (const face of facesPerPage) {
              const tr = this.makeFaceTableRow(i, face);
              if (i === pageId) {
                tr.removeClass('collapse');
              } else {
                tr.addClass('collapse');
              }
              tbody.append(tr);
            }
          }
        }
      } catch (e) {
        console.log(e);
      } finally {
        Spinner.loading(false);
      }
    }
  }

  makeFaceTableRow(pageId, face) {
    const {
      key,
      fullImageKey,
      coord,
      celeb,
      faceId,
      externalImageId,
      timestamp,
      uuid: relatedAssetId,
    } = face;

    const tr = $('<tr/>')
      .data('pageid', pageId);

    // load image
    tr.append(this.makeFaceTableRowImage(key, fullImageKey, coord));

    // celeb
    const managedByIndexer = (timestamp !== undefined);
    tr.append(this.makeFaceTableRowCeleb(faceId, celeb, managedByIndexer));

    // faceid
    tr.append(this.makeFaceTableRowFaceId(faceId));

    // externalImageId
    tr.append(this.makeFaceTableRowExternalImageId(externalImageId));

    // timestamp
    tr.append(this.makeFaceTableRowIndexedAt(timestamp));

    // uuid
    tr.append(this.makeFaceTableRowRelatedAssetId(relatedAssetId));

    return tr;
  }

  makeFaceTableRowImage(key, fullImageKey, coord) {
    const td = $('<td/>')
      .addClass('h-100 align-middle text-center')
      .addClass('m-0 p-0');
    td.css('cursor', 'pointer');

    td.ready(async () => {
      const url = await this.faceManager.getFaceImage(key);

      if (url) {
        td.append($('<img/>')
          .addClass('face-thumbnail')
          .attr('src', url));

        if (fullImageKey) {
          td.css('cursor', 'pointer')
            .attr('data-toggle', 'tooltip')
            .attr('data-placement', 'bottom')
            .attr('title', Tooltips.ShowOriginalImage)
            .tooltip({ trigger: 'hover' });

          td.on('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const parent = td.parents('section').first();
            await this.showOriginalImage(parent, fullImageKey, coord);

            return false;
          });
        }

        return;
      }

      const noImage = $('<div/>')
        .addClass('face-thumbnail')
        .append($('<i/>')
          .addClass('fas fa-eye-slash text-white'));

      td.append(noImage);

      td.attr('data-toggle', 'tooltip')
        .attr('data-placement', 'bottom')
        .attr('title', Tooltips.NoImage)
        .tooltip({ trigger: 'hover' });
    });

    return td;
  }

  async showOriginalImage(parent, key, coord = '') {
    const id = `ImagePreview-${this.id}`;
    const [modal, body] = this.createModelElement(id);
    parent.append(modal);

    const url = await this.faceManager.getFaceImage(key, true);

    const image = $('<img/>')
      .attr('width', '100%')
      .attr('src', url);
    body.append(image);

    // dispose itself
    modal.on('hidden.bs.modal', () => {
      modal.remove();
    });

    // draw bounding box on the face
    modal.on('shown.bs.modal', () => {
      let xywh = coord.split(',').map((x) =>
        Number(x));

      if (xywh.length === 0) {
        return;
      }

      const imgW = image.width();
      const imgH = image.height();
      const x = (Math.round(xywh[0] * imgW) >> 1) << 1;
      const y = (Math.round(xywh[1] * imgH) >> 1) << 1;
      const w = (Math.round(xywh[2] * imgW) >> 1) << 1;
      const h = (Math.round(xywh[3] * imgH) >> 1) << 1;
      const box = $('<div/>')
        .addClass('bbox')
        .css('left', x)
        .css('top', y)
        .css('width', w)
        .css('height', h);
      body.append(box);
    });

    modal.modal({
      backdrop: true,
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
      .addClass('modal-dialog modal-lg')
      .attr('role', 'document');
    modal.append(modalDialog);

    const modalContent = $('<div/>')
      .attr('id', id)
      .addClass('modal-content');
    modalDialog.append(modalContent);

    const body = $('<div/>')
      .addClass('modal-body p-0 m-0');
    modalContent.append(body);

    return [modal, body];
  }

  makeFaceTableRowCeleb(faceId, celeb, managedByFaceIndexer) {
    const td = $('<td/>')
      .addClass('h-100 align-middle text-center');

    const formContainer = $('<form/>')
      .addClass('form-inline')
      .addClass('needs-validation')
      .attr('novalidate', 'novalidate');
    td.append(formContainer);

    const input = $('<input/>')
      .addClass('form-control form-control-sm col-8')
      .attr('pattern', UnicodeUsername)
      .attr('placeholder', '(Blank)')
      .attr('readonly', 'readonly')
      .attr('required', 'required');
    if (celeb) {
      input.val(celeb);
    }
    formContainer.append(input);

    // edit button
    const btnEdit = $('<button/>')
      .addClass('btn btn-sm btn-outline-dark')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.EditName)
      .tooltip({ trigger: 'hover' });
    formContainer.append(btnEdit);

    const iconEdit = $('<i/>')
      .addClass('far fa-edit');
    btnEdit.append(iconEdit);

    // save button
    const btnSave = $('<button/>')
      .addClass('btn btn-sm btn-outline-success')
      .addClass('collapse')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.SaveChanges)
      .tooltip({ trigger: 'hover' });
    formContainer.append(btnSave);

    const iconSave = $('<i/>')
      .addClass('far fa-save');
    btnSave.append(iconSave);

    // cancel button
    const btnCancel = $('<button/>')
      .addClass('btn btn-sm btn-outline-danger')
      .addClass('collapse')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.Cancel)
      .tooltip({ trigger: 'hover' });
    formContainer.append(btnCancel);

    const iconCancel = $('<i/>')
      .addClass('far fa-times-circle');
    btnCancel.append(iconCancel);

    // event handling
    formContainer.submit((event) =>
      event.preventDefault());

    let oName;
    btnEdit.on('click', async () => {
      oName = input.val();
      input.removeAttr('readonly');
      btnEdit.addClass('collapse');
      btnSave.removeClass('collapse');
      btnCancel.removeClass('collapse');
    });

    btnCancel.on('click', async () => {
      input.val(oName);
      input.attr('readonly', 'readonly');
      btnEdit.removeClass('collapse');
      btnSave.addClass('collapse');
      btnCancel.addClass('collapse');
    });

    btnSave.on('click', async (event) => {
      try {
        Spinner.loading();

        if (!_validateForm(event, formContainer)) {
          const parent = td.parents('tr').first();
          this.shake(parent);
          input.focus();
          return;
        }

        // only update the backend if the name has changed.
        const celeb = input.val();
        if (celeb.localeCompare(oName) !== 0) {
          const items = [];
          items.push({
            action: TAGGING_FACE,
            faceId,
            celeb,
          });

          const response = await this.faceManager.updateFaceTaggings(items);
          console.log(response);
        }

        input.attr('readonly', 'readonly');
        btnEdit.removeClass('collapse');
        btnSave.addClass('collapse');
        btnCancel.addClass('collapse');
      } catch (e) {
        console.error(e);
      } finally {
        Spinner.loading(false);
      }
    });

    // disable edit if not managed by FaceIndexer
    if (!managedByFaceIndexer) {
      btnEdit.addClass('collapse');
    }

    return td;
  }

  makeFaceTableRowFaceId(faceId) {
    const text = faceId || '--';
    return this.makeFaceTableRowText(shorten(text, 20), text);
  }

  makeFaceTableRowExternalImageId(externalImageId) {
    const text = externalImageId || '--';
    return this.makeFaceTableRowText(shorten(text, 20), text);
  }

  makeFaceTableRowIndexedAt(timestamp = '') {
    const td = $('<td/>')
      .addClass('h-100 align-middle text-center');

    if (timestamp.length === 0) {
      td.append('--');
      return td;
    }

    const dt = new Date(timestamp);
    const YY = String(dt.getUTCFullYear()).padStart(4, '0');
    const MM = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const DD = String(dt.getUTCDate()).padStart(2, '0');
    const hh = String(dt.getUTCHours()).padStart(2, '0');
    const mm = String(dt.getUTCMinutes()).padStart(2, '0');
    const ss = String(dt.getUTCSeconds()).padStart(2, '0');

    td.append(`${YY}/${MM}/${DD} ${hh}:${mm}:${ss} (UTC)`);
    return td;
  }

  makeFaceTableRowRelatedAssetId(relatedAssetId) {
    const text = relatedAssetId || '--';
    return this.makeFaceTableRowText(shorten(text, 20), text);
  }

  makeFaceTableRowText(text, tooltip) {
    const td = $('<td/>')
      .addClass('h-100 align-middle text-center')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', tooltip)
      .tooltip({ trigger: 'hover' })
      .append(text);

    return td;
  }

  makeFaceCollectionDeleteBtn(collectionId) {
    const deletBtn = $('<button/>')
      .addClass('btn btn-sm btn-danger')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.RemoveFaceCollection)
      .html(Buttons.RemoveFaceCollection)
      .tooltip({
        trigger: 'hover',
      });

    deletBtn.on('click', async () => {
      try {
        Spinner.loading();

        deletBtn.blur();
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

  makeUploadFacesBtn(collectionId) {
    const btnUpload = $('<button/>')
      .addClass('btn btn-sm btn-outline-success')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.UploadIndexFaces)
      .html(Buttons.UploadIndexFaces)
      .tooltip({ trigger: 'hover' });

    btnUpload.on('click', async () => {
      try {
        Spinner.loading();
        btnUpload.blur();
        console.log('btnUpload clicked', collectionId);
        const parent = btnUpload.parent().parent();
        await this.startUploadFlow(parent, collectionId);

        // refresh the list
        const form = this.tabContent.find('form[formtype="collections"]').first();
        const btnRefresh = form.find('button[buttontype="refresh"]');
        btnRefresh.trigger('click');
      } catch (e) {
        console.error(e);
      } finally {
        Spinner.loading(false);
      }
    });

    return btnUpload;
  }

  makeImportCollectionBtn(collectionId) {
    const importBtn = $('<button/>')
      .addClass('btn btn-sm btn-outline-success')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.ImportFaceCollection)
      .html(Buttons.ImportFaceCollection)
      .tooltip({
        trigger: 'hover',
      });

    importBtn.on('click', async () => {
      try {
        Spinner.loading();

        importBtn.blur();
        importBtn.tooltip('hide')
          .addClass('disabled')
          .attr('disabled', 'disabled');

        await this.faceManager.importFaceCollection(collectionId);

        const message = Messages.ImportCollectionCompleted
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
        const message = Alerts.ImportFaceCollectionFailed
          .replace('{{FACECOLLECTION}}', collectionId)
          .replace('{{ERROR}}', e.message);
        await this.showAlert(message);
      } finally {
        Spinner.loading(false);
      }
    });

    return importBtn;
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
            .data('numfaces', option.faces)
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
      Alerts.Oops,
      message,
      duration
    );
  }

  async showConfirm(message, duration) {
    return super.showMessage(
      this.tabContent,
      'success',
      Alerts.Confirmed,
      message,
      duration
    );
  }

  async startUploadFlow(parent, collectionId) {
    const modelId = `uploadmodel-${this.id}`;
    const [modal, body] = this.createModelElement(modelId);
    parent.append(modal);

    const spinner = Spinner.makeSpinner(MODALSPINNERID);
    body.append(spinner);

    // create carousel
    const carouselId = `uploadcarousel-${this.id}`;
    const carousel = $('<div/>')
      .addClass('carousel slide')
      .attr('data-ride', false)
      .attr('data-interval', false)
      .attr('id', carouselId);
    body.append(carousel);

    const inner = $('<div/>')
      .addClass('carousel-inner')
      .addClass('col-12 py-4')
      .css('height', '80vh');
    carousel.append(inner);

    let slides = [];
    slides.push(this.buildDropzoneSlide(slides.length, collectionId));
    slides.push(this.buildIndexInProgressSlide(slides.length, collectionId));

    slides = await Promise.all(slides);

    for (const slide of slides) {
      inner.append(slide);
    }
    // set the first slide active
    slides[0].addClass('active');

    const promise = new Promise((resolve) => {
      // dispose itself
      modal.on('hidden.bs.modal', () => {
        console.log('hidden.bs.modal event');
        modal.remove();
        resolve();
      });

      // modal.on('shown.bs.modal', () => {
      //   console.log('shown.bs.modal event');
      // });

      modal.modal({
        backdrop: 'static',
        keyboard: false,
        show: true,
      });
    });

    return await promise;
  }

  async buildDropzoneSlide(index, collectionId) {
    const id = `dropzone-${this.id}`;

    const container = $('<div/>')
      .addClass('carousel-item')
      .css('height', '100%')
      .data('index', index)
      .attr('id', id);

    const content = $('<section/>')
      .css('height', '90%');
    container.append(content);

    const desc = $('<div/>')
      .addClass('lead-m mb-4')
      .append('Step 1: Drag and drop image files, make any change of the list, and upload the images.');
    content.append(desc);

    const row = $('<div/>')
      .addClass('row no-gutters')
      .css('height', '80%');
    content.append(row);

    const dropzone = this.makeDropzoneArea();
    row.append(dropzone);

    const table = this.makeFilelistArea(collectionId);
    row.append(table);

    const footer = this.makeModalFooter();
    container.append(footer);

    const btnCancel = this.makeControlButton('close', Buttons.Cancel, 'btn-outline-danger');
    btnCancel.removeClass('collapse')
      .removeAttr('disabled');
    footer.append(btnCancel);

    const btnUpload = this.makeControlButton('start', Buttons.StartUpload, 'btn-primary');
    btnUpload.removeClass('collapse');
    footer.append(btnUpload);

    const btnNext = this.makeControlButton('next', Buttons.Uploading, 'btn-primary', index + 1);
    footer.append(btnNext);

    const tbody = table.find('tbody');

    // event handling
    dropzone.on('drop', async (event) => {
      console.log('drop event');
      try {
        Spinner.enable(MODALSPINNERID);

        const { originalEvent: { dataTransfer: { items } } } = event;
        const scanned = await _getAllFileFromEntries(items);

        await this.renderFileTable(tbody, scanned);

        // enable upload button
        btnUpload.removeAttr('disabled');
        console.log(scanned);
      } catch (e) {
        console.log(e);
      } finally {
        Spinner.disable(MODALSPINNERID);
      }
    });

    // override click event
    btnUpload.on('click', async () => {
      try {
        // disable buttons
        btnCancel.attr('disabled', 'disabled');
        // .addClass('collapse');
        btnUpload.attr('disabled', 'disabled')
          .addClass('collapse');
        // enable next
        btnNext.removeClass('collapse');

        const rows = [];
        tbody.children().each((idx, el) => {
          const row = $(el);
          row.find('button')
            .attr('disabled', 'disabled');
          rows.push(row);
        });

        const progressFn = (data) => {
          const { completed, total } = data;
          let text = btnNext.data('origtext');
          text = `${text} (${completed} / ${total})...`;
          btnNext.text(text);
        };

        const response = await this.uploadAllFiles(rows, collectionId, progressFn);
        const carousel = btnUpload.parents('div.carousel');
        carousel.data('payload', response);

        btnCancel.removeAttr('disabled');
        btnNext.data('origtext', Buttons.Next)
          .text(Buttons.Next)
          .removeAttr('disabled');
      } catch (e) {
        console.log(e);
      } finally {
        // Spinner.loading(false, MODALSPINNERID);
      }
    });

    return container;
  }

  async buildIndexInProgressSlide(index, collectionId) {
    const id = `indexinprogress-${this.id}`;

    const container = $('<div/>')
      .addClass('carousel-item')
      .css('height', '100%')
      .data('index', index)
      .attr('id', id);

    const content = $('<section/>')
      .css('height', '90%');
    container.append(content);

    const desc = $('<div/>')
      .addClass('lead-m mb-4')
      .append('Step 2: Start analyzing images and indexing faces to the face collection.');
    content.append(desc);

    const information = $('<div/>')
      .addClass('my-4');
    content.append(information);

    const footer = this.makeModalFooter();
    container.append(footer);

    const btnCancel = this.makeControlButton('close', Buttons.Cancel, 'btn-outline-danger');
    btnCancel.removeClass('collapse')
      .removeAttr('disabled');
    footer.append(btnCancel);

    const btnStart = this.makeControlButton('start', Buttons.StartIndex, 'btn-primary');
    btnStart.removeClass('collapse')
      .removeAttr('disabled');
    footer.append(btnStart);

    const btnClose = this.makeControlButton('close', Buttons.Close, 'btn-success');
    footer.append(btnClose);

    btnStart.on('click', async () => {
      const t0 = Date.now();

      btnCancel.attr('disabled', 'disabled')
        .addClass('collapse');

      btnStart.attr('disabled', 'disabled')
        .data('origttext', Buttons.Processing)
        .text(`${Buttons.Processing} (00:00:00)...`);

      const carousel = container.parents('div.carousel');
      const payload = carousel.data('payload');

      const progressFn = (data) => {
        // RUNNING | SUCCEEDED | FAILED | TIMED_OUT | ABORTED | PENDING_REDRIVE
        const { status } = data || {};
        let elapsed = readableDuration(Date.now() - t0);

        if (status === 'RUNNING') {
          btnStart.text(`${Buttons.Processing} (${elapsed})...`);
        } else if (status === 'SUCCEEDED') {
          console.log(data);

          const { total, processed, faceUndetected, faceUnindexed } = data.output.data;

          btnStart.addClass('collapse');
          btnClose.removeAttr('disabled')
            .removeClass('collapse');

          // update information
          let text = '<span class="text-success">Indexing completed:</span>';
          text = `${text} ${processed} / ${total} faces were successfully indexed.`;
          if (faceUndetected.length > 0 || faceUnindexed.length > 0) {
            const merged = faceUndetected.concat(faceUnindexed);
            const names = [];
            for (const { key } of merged) {
              let name = key.lastIndexOf('/');
              name = key.substring(name + 1);
              names.push(name);
            }
            text = `${text} There are <span class="text-danger">${names.length} face(s)</span> were not indexed. This can be due to the face(s) were not detected, in poor quality, or incompatible file formats. A list of the unprocessed images:<br/><span class="text-danger">${names.join(', ')}.</span>`;
          }

          text = $('<p/>').addClass('lead-s b-400 font-italic')
            .append(text);
          information.append(text);
        } else {
          const { executionArn, error, cause } = data;
          // we got problem here...
          btnStart.addClass('collapse');
          btnCancel.removeAttr('disabled')
            .removeClass('collapse');

          let text;
          if (status === 'ATTENTION_REQUIRED') {
            text = '<span class="text-danger">Oops! Indexing process is taking too long.</span>';
          } else {
            text = `<span class="text-danger">Oops! Indexing failed (${status}):</span>`;
            if ((cause || {}).errorMessage) {
              text = `${text} Error occurs due to ${cause.errorMessage}.`
            } else if (error) {
              text = `${text} Error occurs due to ${error}.`
            }
          }
          text = `${text} Please check the <a href="${getExecutionLink(executionArn)}" target="_blank">state machine execution</a> for more details.`;
          text = $('<p/>').addClass('lead-s b-400 font-italic')
            .append(text);
          information.append(text);
        }
      };

      await this.faceManager.startFaceIndexing(payload, progressFn);
    });

    container.ready(async () => {
      const carousel = container.parents('div.carousel');

      carousel.on('slid.bs.carousel', async (event) => {
        if (event.to !== index) {
          return;
        }

        const carousel = container.parents('div.carousel');
        const payload = carousel.data('payload');
        console.log('payload', payload);

        const { bucket, key, collectionId, numImages } = payload;
        let prefix = key.lastIndexOf('/');
        prefix = key.substring(0, prefix + 1);

        let text = `Total <abbr title="${numImages} images" class="b-400">${numImages}</abbr> images uploaded to the <abbr title="${bucket} (S3 bucket)" class="b-400">${shorten(bucket, 20)}</abbr> bucket under <abbr title="${prefix} prefix" class="b-400">${shorten(prefix, 32)}</abbr>. Click on <span class="text-success">${Buttons.StartIndex}</span> to index faces to your <abbr title="${collectionId} (Amazon Rekognition Face Collection)" class="b-400">${collectionId}</abbr> face collection. <span class="font-italic">(The process could take up to few minutes.)</span>`;
        text = $('<p/>')
          .addClass('lead-s')
          .append(text);
        information.children().remove();
        information.append(text);
      });
    });

    return container;
  }

  makeControlButton(type, text, style, to) {
    const btn = $('<button/>')
      .addClass('btn btn-sm')
      .addClass(style)
      .addClass('ml-1')
      .addClass('collapse')
      .attr('disabled', 'disabled')
      .data('type', type)
      .data('origtext', text)
      .append(text);

    if (to !== undefined) {
      btn.data('to', to);
    }

    btn.on('click', async () => {
      console.log(`Button ${text} clicked`);
      btn.blur();

      if (to !== undefined) {
        const to = btn.data('to');
        const carousel = btn.parents('div.carousel');
        carousel.carousel(to);
      }

      if (type === 'close') {
        const modal = btn.parents('div.modal');
        modal.modal('hide');
      }
    });

    return btn;
  }

  makeModalFooter() {
    const footer = $('<div/>')
      .addClass('col-12 p-0')
      .addClass('text-right');

    return footer;
  }

  makeDropzoneArea() {
    const dropzone = $('<div/>')
      .addClass('col-4')
      .addClass('dropzone')
      .css('display', 'table')
      .css('height', '100%')
      .css('border-width', '0.4rem');
    const text = $('<div/>')
      .addClass('col-6')
      .addClass('text-center')
      .css('display', 'table-cell')
      .css('vertical-align', 'middle')
      .append('Drag and drop face images here');
    dropzone.append(text);

    // default event handlings
    for (const action of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      dropzone.on(action, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }

    return dropzone;
  }

  makeFilelistArea(collectionId) {
    const container = $('<div/>')
      .addClass('col-8')
      .addClass('h-100 pl-2')
      .addClass('table-responsive');

    const table = $('<table/>')
      .addClass('table lead-xxs');
    container.append(table);

    const tbody = $('<tbody/>')
      .data('collectionid', collectionId);
    table.append(tbody);

    return container;
  }

  async renderFileTable(tbody, filelist) {
    let promises = [];

    for (const file of filelist) {
      if (promises.length > 10) {
        promises = await Promise.all(promises);
        for (const tr of promises) {
          tbody.append(tr);
        }
        promises = [];
      }
      promises.push(this.makeFileTableRow(file));
    }

    if (promises.length > 0) {
      promises = await Promise.all(promises);
      for (const tr of promises) {
        tbody.append(tr);
      }
      promises = [];
    }
  }

  async makeFileTableRow(file) {
    const tr = $('<tr/>')
      .data('file', file);

    // image
    const url = await _loadImage(file);
    tr.append(this.makeFileTableRowImage(url));
    // name
    tr.append(this.makeFileTableRowName(file.name));

    return tr;
  }

  makeFileTableRowImage(url) {
    const td = $('<td/>')
      .addClass('h-100 align-middle text-left')
      .addClass('m-0 p-0')
      .css('width', '10%');

    const image = $('<img/>')
      .addClass('face-thumbnail')
      .css('background-color', '#fff')
      .css('object-fit', 'contain')
      .attr('src', url);
    td.append(image);

    return td;
  }

  makeFileTableRowName(name) {
    const td = $('<td/>')
      .addClass('h-100 align-middle text-left')
      .addClass('m-0 p-0')
      .css('width', '90%');
    // .css('width', '50%');

    let base = name.lastIndexOf('.');
    base = name.substring(0, base);
    base = base.trim();

    // if base name ends with number, strips it.
    if (/[0-9]+$/.test(base)) {
      const reversed = base.split(' ').reverse();
      while (reversed.length > 0) {
        if (Number.isNaN(Number(reversed[0]))) {
          break;
        }
        reversed.shift();
      }
      base = reversed.reverse().join(' ');
    }

    const formContainer = $('<form/>')
      .addClass('form-inline')
      .addClass('needs-validation')
      .attr('novalidate', 'novalidate');
    td.append(formContainer);

    const input = $('<input/>')
      .addClass('form-control form-control-sm')
      .addClass('col-10')
      .attr('pattern', UnicodeUsername)
      .attr('placeholder', '(Blank)')
      .attr('readonly', 'readonly')
      .attr('required', 'required')
      .css('width', '80%')
      .val(base);
    formContainer.append(input);

    // edit button
    const btnEdit = $('<button/>')
      .addClass('btn btn-sm btn-outline-dark')
      .addClass('col-1')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.EditName)
      .tooltip({ trigger: 'hover' });
    formContainer.append(btnEdit);

    const iconEdit = $('<i/>')
      .addClass('far fa-edit');
    btnEdit.append(iconEdit);

    // save button
    const btnSave = $('<button/>')
      .addClass('btn btn-sm btn-outline-success')
      .addClass('col-1')
      .addClass('collapse')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.SaveChanges)
      .tooltip({ trigger: 'hover' });
    formContainer.append(btnSave);

    const iconSave = $('<i/>')
      .addClass('far fa-save');
    btnSave.append(iconSave);

    // cancel button
    const btnDelete = $('<button/>')
      .addClass('btn btn-sm btn-outline-danger')
      .addClass('col-1')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.RemoveFromList)
      .tooltip({ trigger: 'hover' });
    formContainer.append(btnDelete);

    const iconDelete = $('<i/>')
      .addClass('far fa-trash-alt');
    btnDelete.append(iconDelete);

    // adding progress bar here
    const progress = $('<div/>')
      .addClass('progress')
      .addClass('col-12')
      .addClass('mt-1')
      .css('height', '3px');
    td.append(progress);

    const bar = $('<div/>')
      .addClass('progress-bar bg-success')
      .attr('role', 'progressbar')
      .attr('aria-valuemin', 0)
      .attr('aria-valuemax', 100)
      .attr('aria-valuenow', 0)
      .css('width', '0%');
    progress.append(bar);

    // event handling
    formContainer.submit((event) =>
      event.preventDefault());

    let oName;
    btnEdit.on('click', async () => {
      btnEdit.blur();
      oName = input.val();
      input.removeAttr('readonly');
      btnEdit.addClass('collapse');
      btnSave.removeClass('collapse');
    });

    btnSave.on('click', async (event) => {
      btnSave.blur();

      if (!_validateForm(event, formContainer)) {
        const parent = td.parents('tr').first();
        this.shake(parent);
        input.focus();
        return;
      }

      input.attr('readonly', 'readonly');
      btnEdit.removeClass('collapse');
      btnSave.addClass('collapse');
    });

    btnDelete.on('click', async () => {
      btnDelete.blur();
      const tr = td.parent('tr');
      tr.remove();
    });

    return td;
  }

  async uploadAllFiles(rows, collectionId, progressFn) {
    let promises = [];
    let completed = [];

    const total = rows.length;

    for (const row of rows) {
      if (promises.length > 10) {
        await Promise.all(promises);
        promises = [];
        if (typeof progressFn === 'function') {
          progressFn({ total, completed: completed.length });
        }
      }

      const file = row.data('file');
      const name = row.find('input').val();
      const bar = row.find('div.progress-bar');

      console.log(name, file);

      promises.push(this.uploadToS3(collectionId, file, name, bar)
        .then((res) =>
          completed.push({
            collectionId,
            name,
            key: res,
          })));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      promises = [];
      if (typeof progressFn === 'function') {
        progressFn({ total, completed: completed.length });
      }
    }

    // create workorder
    const bucket = GetProxyBucket();
    let name = (new Date().toISOString())
      .split('.')[0]
      .replace(/[^0-9T]/g, '');
    name = `${name}.json`;
    const key = `${UPLOADPREFIX}/${collectionId}/${name}`;

    const params = {
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(completed),
      ContentType: 'application/json',
    };

    const s3utils = GetS3Utils();
    const response = await s3utils.upload(params);
    console.log('workorder', response);

    return {
      bucket,
      key,
      collectionId,
      numImages: completed.length,
    };
  }

  async uploadToS3(collectionId, file, name, bar) {
    const bucket = GetProxyBucket();
    const key = `${UPLOADPREFIX}/${collectionId}/${file.name}`;;
    const progressFn = this.uploadProgress.bind(this, bar);

    const params = {
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: file.type,
      Metadata: {
        name,
        collectionid: collectionId,
        webupload: new Date().toISOString(),
      }
    };

    const s3utils = GetS3Utils();

    const response = await s3utils.upload(params, progressFn);
    console.log(file.name, response);

    return key;
  }

  uploadProgress(bar, data) {
    let percentage = data;
    if (typeof data === 'object') {
      const { loaded, total } = data;
      percentage = Math.ceil((loaded / total) * 100);
    }

    bar.css('width', `${percentage}%`)
      .attr('aria-valuenow', percentage);
  }
}

async function _loadImage(file) {
  return URL.createObjectURL(file);
}

async function _getAllFileFromEntries(items) {
  const files = [];
  const queue = [];

  for (const item of items) {
    queue.push(item.webkitGetAsEntry());
  }

  while (queue.length > 0) {
    let entry = queue.shift();
    if (entry.isFile) {
      const file = await _readFileFromEntry(entry)
      if (_canSupport(file.type)) {
        files.push(file);
      }
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      queue.push(...await _readAllDirectoryEntries(reader));
    }
  }

  return files;
}

async function _readFileFromEntry(entry) {
  return await new Promise((resolve, reject) => {
    entry.file((file) => resolve(file), (e) => reject(e));
  });
}

async function _readAllDirectoryEntries(directoryReader) {
  const entries = [];
  let readEntries = await _readEntries(directoryReader);
  while (readEntries.length > 0) {
    entries.push(...readEntries);
    readEntries = await _readEntries(directoryReader);
  }
  return entries;
}

async function _readEntries(directoryReader) {
  try {
    return await new Promise((resolve, reject) => {
      directoryReader.readEntries(resolve, reject);
    });
  } catch (e) {
    console.log(e);
  }
}

function _canSupport(mime) {
  return ['image/jpeg', 'image/png'].includes(mime);
}

function _validateForm(event, form) {
  event.preventDefault();
  if (form[0].checkValidity() === false) {
    event.stopPropagation();
    return false;
  }
  return true;
}
