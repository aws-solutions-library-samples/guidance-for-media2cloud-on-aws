// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../localization.js';
import AppUtils from '../appUtils.js';
import Spinner from '../spinner.js';
import mxAlert from '../../mixins/mxAlert.js';
import {
  GetFaceManager,
} from './index.js';

const {
  FaceIndexerDefs: {
    Actions: {
      Tagging,
      Deleting,
    },
  },
} = SolutionManifest;

const {
  Messages: {
    Name: MSG_NAME,
    FaceTagging: MSG_FACE_TAGGING_TITLE,
    FaceTaggingInstruction: MSG_FACE_TAGGING_INSTRUCTION,
    FaceTaggingShortInstruction: MSG_FACE_TAGGING_SHORT_INSTRUCTION,
    ToBeRemoved: MSG_TO_BE_REMOVED,
  },
  Buttons: {
    Cancel: BTN_CANCEL,
    Select: BTN_SELECT,
    ApplyChangesAndDone: BTN_APPLY_CHANGES_DONE,
  },
  RegularExpressions: {
    CharacterSet255,
  },
  Alerts: {
    FailUpdatingFaceTags: ERR_FAIL_UPDATING_FACETAGS,
    Oops: OOPS,
  },
} = Localization;

const TAGGED_LIST_CONTAINER = 'tagged-list-container';
const TAGGED_LIST = 'tagged-list';
const UNTAGGED_LIST = 'untagged-list';

// alert helper
class AlertHelper extends mxAlert(class {}) {}
const _alertAgent = new AlertHelper();

export default class FaceTaggingModal {
  constructor(parent, items, uuid) {
    this.$id = AppUtils.randomHexstring();
    this.$parent = parent;
    this.$items = items;
    this.$uuid = uuid;
    this.$modal = undefined;
    this.$faceManager = GetFaceManager();
    this.$modifiedItems = undefined;

    Spinner.useSpinner(this.spinnerId);
  }

  get parent() {
    return this.$parent;
  }

  get items() {
    return this.$items;
  }

  get uuid() {
    return this.$uuid;
  }

  get modal() {
    return this.$modal;
  }

  set modal(val) {
    this.$modal = val;
  }

  get id() {
    return this.$id;
  }

  get faceManager() {
    return this.$faceManager;
  }

  get spinnerId() {
    return `spinner-${this.id}`;
  }

  get cancelId() {
    return `cancel-${this.id}`;
  }

  get applyId() {
    return `apply-${this.id}`;
  }

  get modifiedItems() {
    return this.$modifiedItems;
  }

  set modifiedItems(val) {
    this.$modifiedItems = val;
  }

  show() {
    const modal = $('<div/>')
      .addClass('modal fade')
      .attr('id', `facetagging-${this.id}`)
      .attr('tabindex', -1)
      .attr('role', 'dialog')
      .attr('aria-labelledby', 'VideoModal')
      .attr('aria-hidden', true);
    this.parent.append(modal);

    this.modal = modal;

    const modalDialog = $('<div/>')
      .addClass('modal-dialog modal-xl')
      .attr('role', 'document');
    modal.append(modalDialog);

    const modalContent = $('<div/>')
      .addClass('modal-content');
    modalDialog.append(modalContent);

    const header = $('<div/>')
      .addClass('modal-header');
    modalContent.append(header);

    const titleContainer = $('<div/>')
      .addClass('col-12 m-0 p-0');
    header.append(titleContainer);

    const title = $('<h5/>')
      .addClass('modal-title lead')
      .html(MSG_FACE_TAGGING_TITLE);
    titleContainer.append(title);

    const instructions = $('<p/>')
      .addClass('lead-s mt-2')
      .append(MSG_FACE_TAGGING_INSTRUCTION);
    titleContainer.append(instructions);

    const body = $('<div/>')
      .addClass('modal-body');
    modalContent.append(body);

    let content = this.createModalContent();
    body.append(content);

    const modalFooter = $('<div/>')
      .addClass('modal-footer');
    modalContent.append(modalFooter);

    // custom spinner
    const spinner = $('<div/>')
      .attr('id', this.spinnerId)
      .addClass('spinner-grow text-success loading-4 collapse');
    modalContent.append(spinner);

    content = this.createFooterContent();
    modalFooter.append(content);

    // event handling
    modal.on('hidden.bs.modal', async (event) => {
      this.parent.trigger('facetagging:modal:hidden');
    });

    return modal.modal({
      backdrop: 'static',
      keyboard: false,
      show: true,
    });
  }

  destroy() {
    this.modal.remove();
    this.modal = undefined;

    return this.modifiedItems;
  }

  createModalContent() {
    const container = $('<div/>')
      .addClass('row no-gutters');

    const panelHeight = 'vh-50x overflow-auto';

    // L-Panel
    const panelL = $('<div/>')
      .addClass('col-8 p-0 m-0')
      .addClass(panelHeight);
    container.append(panelL);

    const untaglist = this.createUntagListView();
    panelL.append(untaglist);

    // R-Panel
    const panelR = $('<div/>')
      .addClass('col-4 p-0 m-0')
      .addClass(panelHeight);
    container.append(panelR);

    const taglist = this.createTagListView();
    panelR.append(taglist);

    return container;
  }

  createFooterContent() {
    const formGroup = $('<form/>')
      .addClass('form-inline')
      .addClass('m-0 p-0 ml-auto');

    const btnCancel = $('<button/>')
      .addClass('btn btn-sm btn-outline-danger')
      .addClass('mr-1')
      .attr('id', this.cancelId)
      .attr('type', 'button')
      .append(BTN_CANCEL);
    formGroup.append(btnCancel);

    const btnApply = $('<button/>')
      .addClass('btn btn-sm btn-success')
      .addClass('disabled')
      .attr('id', this.applyId)
      .attr('disabled', 'disabled')
      .append(BTN_APPLY_CHANGES_DONE);
    formGroup.append(btnApply);

    // event handling
    formGroup.submit((event) => {
      event.preventDefault();
    });

    btnCancel.on('click', () => {
      this.modifiedItems = undefined;
      // close the modal
      this.modal.modal('hide');
    });

    btnApply.on('click', async (event) => {
      try {
        Spinner.loading(true, this.spinnerId);

        const requestItems = [];

        // collect all changes
        const taglist = this.getTagListByLockStatus(true);
        if (taglist.length > 0) {
          taglist.each((k, v) => {
            const item = $(v);
            const deleted = item.data('deleted');
            const celeb = item.data('celeb');

            item.find('div.image-container')
              .each((k1, v1) => {
                const itemid = $(v1).data('itemid');
                if (typeof itemid === 'number') {
                  const itemData = {
                    faceId: this.items[itemid].faceId,
                  };
                  if (celeb) {
                    itemData.action = Tagging;
                    itemData.celeb = celeb;
                  }
                  if (deleted) {
                    itemData.action = Deleting;
                  }
                  requestItems.push(itemData);
                }
              });
          });
        }

        if (requestItems.length > 0) {
          this.modifiedItems = await this.faceManager.updateFaceTaggings(
            requestItems,
            this.uuid
          );
          console.log('modifiedItems', this.modifiedItems);
        }
      } catch (e) {
        this.modifiedItems = undefined;
        const err = `(${ERR_FAIL_UPDATING_FACETAGS}, ${e.message})`;
        await this.showAlert(err, 4000);
      } finally {
        Spinner.loading(false, this.spinnerId);
        // close the modal
        this.modal.modal('hide');
      }

      return true;
    });

    return formGroup;
  }

  createUntagListView() {
    const container = $('<div/>')
      .addClass('row no-gutters')
      .addClass(UNTAGGED_LIST);

    const images = this.items
      .map((item, idx) =>
        this.createUntagListItem(item, idx));

    container.append(images);

    return container;
  }

  createUntagListItem(item, idx) {
    const imgContainer = $('<div/>')
      .addClass('image-container')
      .addClass('col-2')
      .data('itemid', idx);

    imgContainer.attr('data-faceid', item.faceId);

    const img = $('<img/>')
      .addClass('w-100 h-100')
      .addClass('pr-1 pb-1')
      .attr('crossorigin', 'anonymous')
      .css('object-fit', 'cover');
    imgContainer.append(img);

    const curtain = $('<div/>')
      .addClass('preview text-center');
    imgContainer.append(curtain);

    const btnSelect = $('<button/>')
      .addClass('btn btn-sm center btn-outline-success')
      .append(BTN_SELECT);
    curtain.append(btnSelect);

    // event handling
    img.ready(async () => {
      const src = await this.faceManager.getFaceImage(item.key);
      img.attr('src', src);
    });

    btnSelect.on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();

      const itemid = imgContainer.data('itemid');
      this.moveToTaggedList(itemid);

      imgContainer.remove();
    });

    return imgContainer;
  }

  createTagListView() {
    const container = $('<div/>')
      .addClass('col-11 m-0 p-0 mx-2 ml-auto');

    const desc = $('<p/>')
      .addClass('lead-s')
      .append(MSG_FACE_TAGGING_SHORT_INSTRUCTION);
    container.append(desc);

    const taglistContainer = $('<div/>')
      .addClass('col-12 m-0 p-0 mb-4')
      .addClass(TAGGED_LIST_CONTAINER);
    container.append(taglistContainer);

    return container;
  }

  createTagListAndControls() {
    const taggedList = $('<div/>')
      .addClass('curtain-container')
      .addClass('d-inline-flex no-gutters w-100 overflow-auto mb-1')
      .data('locked', false)
      .addClass(TAGGED_LIST);

    const curtain = $('<div/>')
      .addClass('curtain')
      .addClass('h-100 w-100')
      .addClass('text-center text-white')
      .css('display', 'none');
    taggedList.append(curtain);

    const curtainText = $('<span/>')
      .addClass('ml-auto mb-auto px-2 py-1 bg-success')
      .addClass('lead-xs b-300')
      .text('TEXT GOES HERE');
    curtain.append(curtainText);

    // form
    const formGroup = $('<form/>')
      .addClass('form-inline')
      .addClass('col-12 m-0 p-0 mb-4');

    const label = $('<p/>')
      .addClass('col-2 m-0 p-0 lead-s')
      .append(MSG_NAME);
    formGroup.append(label);

    const input = $('<input/>')
      .addClass('form-control form-control-sm')
      .addClass('col-7')
      .attr('pattern', CharacterSet255)
      .attr('placeholder', '(Blank)');
    formGroup.append(input);

    const btnLock = $('<button/>')
      .addClass('btn btn-sm btn-outline-success')
      .addClass('col-2')
      .attr('type', 'button')
      .attr('data-toggle', 'button')
      .attr('aria-pressed', 'false');
    formGroup.append(btnLock);

    const iconLock = $('<i/>')
      .addClass('fas fa-lock');
    btnLock.append(iconLock);

    const btnTrash = $('<button/>')
      .addClass('btn btn-sm btn-outline-danger')
      .addClass('col-1')
      .attr('type', 'button')
      .attr('data-toggle', 'button')
      .attr('aria-pressed', 'false');
    formGroup.append(btnTrash);

    const iconTrash = $('<i/>')
      .addClass('fas fa-trash-alt');
    btnTrash.append(iconTrash);

    // event handling
    formGroup.submit((event) => {
      event.preventDefault();
    });

    btnLock.on('click', (event) => {
      if (!input.val()) {
        this.shake(formGroup);
        input.focus();
        return false;
      }

      const lockNow = btnLock.attr('aria-pressed') === 'false';
      if (lockNow) {
        input.attr('disabled', 'disabled')
          .addClass('disabled');

        iconLock.removeClass('fa-lock')
          .addClass('fa-unlock-alt');

        this.enableButton(btnTrash, false);

        const celeb = input.val();
        curtain.css('display', 'flex');

        taggedList.data('locked', true)
          .data('celeb', celeb)
          .removeData('deleted');

        curtainText
          .removeClass('bg-primary bg-danger')
          .addClass('bg-primary')
          .text(celeb);
      } else {
        input.removeAttr('disabled')
          .removeClass('disabled');

        iconLock.removeClass('fa-unlock-alt')
          .addClass('fa-lock');

        this.enableButton(btnTrash);

        curtain.css('display', 'none');

        taggedList.data('locked', false)
          .removeData('celeb')
          .removeData('deleted');
      }

      this.updateApplyButton();

      btnLock.blur();
      return true;
    });

    btnTrash.on('click', (event) => {
      const trashNow = btnTrash.attr('aria-pressed') === 'false';

      if (trashNow) {
        input.attr('disabled', 'disabled')
          .addClass('disabled');

        iconTrash.removeClass('fa-trash-alt')
          .addClass('fa-trash-restore');

        this.enableButton(btnLock, false);

        curtain.css('display', 'flex');

        taggedList.data('locked', true)
          .data('deleted', true)
          .removeData('celeb');

        curtainText
          .removeClass('bg-primary bg-danger')
          .addClass('bg-danger')
          .text(MSG_TO_BE_REMOVED.toUpperCase());
      } else {
        input.removeAttr('disabled')
          .removeClass('disabled');

        iconTrash.removeClass('fa-trash-restore')
          .addClass('fa-trash-alt');

        this.enableButton(btnLock);

        curtain.css('display', 'none');

        taggedList.data('locked', false)
          .removeData('deleted')
          .removeData('celeb');
      }
      this.updateApplyButton();

      btnTrash.blur();
      return true;
    });

    return [
      taggedList,
      formGroup,
    ];
  }

  createTagListItem(item, idx) {
    const imgContainer = $('<div/>')
      .addClass('image-container')
      .addClass('col-2')
      .data('itemid', idx);

    const img = $('<img/>')
      .addClass('w-100 h-100')
      .addClass('pr-1')
      .attr('crossorigin', 'anonymous')
      .css('object-fit', 'cover');
    imgContainer.append(img);

    const curtain = $('<div/>')
      .addClass('preview text-center');
    imgContainer.append(curtain);

    const btnRedo = $('<button/>')
      .addClass('btn btn-sm center btn-outline-success');
    curtain.append(btnRedo);

    const iconRedo = $('<i/>')
      .addClass('fas fa-undo');
    btnRedo.append(iconRedo);

    // event handling
    img.ready(async () => {
      const src = await this.faceManager.getFaceImage(item.key);
      img.attr('src', src);
    });

    btnRedo.on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();

      // get taglist that contains this face and its sibling form
      const taglist = imgContainer.parentsUntil(`div.${TAGGED_LIST}`);
      const formGroup = taglist.next('form');

      const itemid = imgContainer.data('itemid');
      this.moveToUntaggedList(itemid);
      imgContainer.remove();

      // if this is the last face, remove taglist (parent) as well
      const kids = taglist.find('div.image-container');
      if (kids.length === 0) {
        taglist.remove();
        formGroup.remove();
      }
    });

    return imgContainer;
  }

  enableButton(btn, enable = true) {
    if (enable) {
      btn.removeClass('disabled')
        .removeAttr('disabled');
    } else {
      btn.addClass('disabled')
        .attr('disabled', 'disabled');
    }
  }

  moveToTaggedList(idx) {
    const item = this.items[idx];

    const container = this.modal
      .find(`div.${TAGGED_LIST_CONTAINER}`);

    const taglist = container
      .find(`div.${TAGGED_LIST}`)
      .filter((_, el) =>
        $(el).data('locked') === false);

    if (taglist.length === 0) {
      const newListControl = this.createTagListAndControls();
      container.prepend(newListControl);

      const tagItem = this.createTagListItem(item, idx);
      newListControl[0].append(tagItem);
    } else {
      const lastListControl = taglist.last();

      const tagItem = this.createTagListItem(item, idx);
      lastListControl.append(tagItem);
    }
  }

  moveToUntaggedList(itemId) {
    const item = this.items[itemId];

    const container = this.modal
      .find(`div.${UNTAGGED_LIST}`);

    const untagItem = this.createUntagListItem(item, itemId);
    container.append(untagItem);
  }

  updateApplyButton() {
    const btnApply = this.modal.find(`button#${this.applyId}`);

    const taglist = this.getTagListByLockStatus(true);
    const enabled = (taglist.length > 0);

    this.enableButton(btnApply, enabled);
  }

  getTagListByLockStatus(locked = true) {
    // enable / disable based on taglist lock status
    const taglistContainer = this.modal
      .find(`div.${TAGGED_LIST_CONTAINER}`);

    return taglistContainer
      .find(`div.${TAGGED_LIST}`)
      .filter((_, el) =>
        $(el).data('locked') === locked);
  }

  shake(element, delay = 200) {
    _alertAgent.shake(element, delay);
  }

  async showAlert(message, duration = 2000) {
    return _alertAgent.showMessage(
      this.modal,
      'danger',
      OOPS,
      message,
      duration
    );
  }
}
