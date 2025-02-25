// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../../shared/localization.js';
import AppUtils from '../../../../../../../shared/appUtils.js';
import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import {
  GetFaceManager,
  TAGGING_FACE,
} from '../../../../../../../shared/faceManager/index.js';
import mxAlert from '../../../../../../../mixins/mxAlert.js';
import BaseRekognitionTab from './baseRekognitionTab.js';

const {
  Messages,
  Tooltips,
  RegularExpressions: {
    UnicodeUsername,
  },
} = Localization;

const {
  validateUuid,
  readableDuration,
  shorten,
} = AppUtils;

const {
  Rekognition: {
    FaceMatch,
  },
} = AnalysisTypes;

function _mergeGraphDatapoints(source, target) {
  const _source = source;

  const sourceXs = _source.data
    .map((item) =>
      item.x);

  target.data.forEach((item) => {
    const idx = sourceXs.indexOf(item.x);

    if (idx >= 0) {
      const data = _source.data[idx];
      data.y += item.y;
      data.details = data.details
        .concat(item.details);
    } else {
      _source.data.push(item);
    }
  });

  // resort timestamp
  _source.data
    .sort((a, b) =>
      b.x - a.x);

  _source.appearance += target.appearance;

  return _source;
}

export default class FaceMatchTab extends mxAlert(BaseRekognitionTab) {
  constructor(previewComponent, data) {
    super(FaceMatch, previewComponent, data);
    this.$faceManager = GetFaceManager();
    this.$facesInThisContent = [];
  }

  // disable caching dataset locally
  get shouldCache() {
    return false;
  }

  get faceManager() {
    return this.$faceManager;
  }

  get facesInThisContent() {
    return this.$facesInThisContent;
  }

  set facesInThisContent(val) {
    this.$facesInThisContent = val;
  }

  async transformDataset(data) {
    const faceIds = [];
    const modified = {};

    const faceMap = await this.mapNameToFaceId();

    for (const [name, val] of Object.entries(data)) {
      let faceId;
      if (validateUuid(name)) {
        faceId = name;
      } else if ((faceMap[name] || {}).faceId) {
        faceId = faceMap[name].faceId;
      } else if (val.faceId) {
        faceId = val.faceId;
      }

      if (faceId) {
        modified[faceId] = val;
        faceIds.push(faceId);
      }
    }

    let facesInThisContent = [];
    if (faceIds.length > 0) {
      facesInThisContent = await this.faceManager.batchGetFaces(faceIds);
    }

    // update label with the celeb name
    for (const face of facesInThisContent) {
      const { faceId, celeb } = face;
      if (modified[faceId] === undefined) {
        continue;
      }
      if (celeb) {
        modified[faceId].label = celeb;
      }
      // total on-screen time
      face.appearance = modified[faceId].appearance;
      // adding appearances for on-screen play
      face.appearances = [];
      for (const item of Object.values(faceMap)) {
        if (faceId === item.faceId) {
          face.appearances = item.appearances;
          break;
        }
      }
    }

    facesInThisContent.sort((a, b) => {
      if (a.celeb && b.celeb === undefined) {
        return -1;
      }
      if (a.celeb === undefined && b.celeb) {
        return 1;
      }
      return b.appearance - a.appearance;
    });

    this.facesInThisContent = facesInThisContent;

    return super.transformDataset(modified);
  }

  async mapNameToFaceId() {
    const faceMap = {};
    try {
      let metadata = await this.download(this.data.metadata);
      metadata = await metadata.Body.transformToString()
        .then((res) =>
          JSON.parse(res));

      for (const faces of Object.values(metadata)) {
        for (const face of faces) {
          const { faceId, name, begin, end } = face;
          if (faceMap[name] === undefined) {
            faceMap[name] = { faceId, appearances: [] };
          }
          faceMap[name].appearances.push([begin, end]);
        }
      }

      return faceMap;
    } catch (e) {
      console.error(e);
      return faceMap;
    }
  }

  async delayContentLoad(container) {
    await super.delayContentLoad(container);

    const manageFaces = this.manageFacesSection();
    container.append(manageFaces);
  }

  manageFacesSection() {
    const container = $('<section/>')
      .addClass('col-12 mb-4 p-0 m-0');

    const details = $('<details/>');
    container.append(details);

    const summary = $('<summary/>')
      .addClass('my-4');
    details.append(summary);

    const title = $('<span/>')
      .addClass('lead ml-2')
      .text(Messages.ManageFaceTagging);
    summary.append(title);

    container.ready(async () => {
      try {
        this.loading();

        const wasOpen = details.prop('open');
        const rendered = details.data('rendered');

        if (!rendered && !wasOpen) {
          const elements = await this.buildFaceTagElements(this.facesInThisContent);
          details.append(elements);
          details.data('rendered', true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        this.loading(false);
      }
    });

    return container;
  }

  async buildFaceTagElements(facesInThisContent = []) {
    const container = $('<section/>');

    const table = $('<table/>')
      .addClass('table table-hover my-4 lead-xxs');
    container.append(table);

    const thead = $('<thead/>');
    table.append(thead);

    let tr = $('<tr/>');
    thead.append(tr);

    const headers = [
      '#',
      Messages.Name,
      Messages.ColumnOnScreenTime,
      Messages.ColumnFaceId,
      Messages.ColumnIndexedAt,
    ];

    for (const header of headers) {
      const item = $('<th/>')
        .addClass('align-middle text-center lead-sm b-300')
        .attr('scope', 'col')
        .append(header);
      tr.append(item);
    }

    const tbody = $('<tbody/>');
    table.append(tbody);

    for (const face of facesInThisContent) {
      const {
        celeb,
        faceId,
        timestamp,
        fullImageKey,
        key,
        appearances,
        coord,
      } = face;

      if (appearances.length === 0) {
        continue;
      }

      tr = $('<tr/>');
      tbody.append(tr);

      // load image
      tr.append(this.makeFaceTableRowImage(key, fullImageKey, coord));

      // celeb
      tr.append(this.makeFaceTableRowCeleb(faceId, celeb));

      // on-screen time
      tr.append(this.makeFaceTableRowScreenTime(celeb || faceId, appearances));

      // faceid
      tr.append(this.makeFaceTableRowFaceId(faceId));

      // timestamp
      tr.append(this.makeFaceTableRowIndexedAt(timestamp));
    }

    return container;
  }

  makeFaceTableRowImage(key, fullImageKey, coord) {
    const td = $('<td/>')
      .addClass('h-100 align-middle text-center')
      .addClass('m-0 p-0');
    td.css('cursor', 'pointer');

    td.ready(async () => {
      const proxyBucket = this.media.getProxyBucket();
      const promises = [];

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

  async playSegments(parent, name, appearances) {
    const id = `PlaySegments-${this.id}`;
    const [modal, body] = this.createModelElement(id);
    parent.append(modal);

    const video = $('<video/>')
      .attr('crossorigin', 'anonymous')
      .attr('preload', 'metadata')
      .attr('autoplay', 'autoplay')
      .attr('width', '100%')
      .css('aspect-ratio', '16 / 9')
      .css('background', 'black');
    body.append(video);

    let currentTimestamp;

    const url = await this.media.getProxyVideo();
    const duped = appearances.slice();

    currentTimestamp = duped.shift();
    this.setVideoSource(video, url, currentTimestamp);

    // show name
    const box = $('<div/>')
      .addClass('bbox')
      .css('background-color', 'black')
      .css('border-color', 'white')
      .css('left', 10)
      .css('top', 10);
    body.append(box);

    const nameEl = $('<div/>')
      .addClass('inline-text-sm')
      .addClass('text-white')
      .append(name);
    box.append(nameEl);

    let duration = `${readableDuration(currentTimestamp[0], false)} / ${readableDuration(currentTimestamp[1], false)}`;
    const durationEl = $('<div/>')
      .addClass('inline-text-sm')
      .addClass('text-white')
      .append(duration);
    box.append(durationEl);

    // dispose itself
    modal.on('hidden.bs.modal', () => {
      modal.remove();
    });

    // play next segment if available
    modal.on('shown.bs.modal', () => {
      video.on('pause', () => {
        if (duped.length === 0) {
          video.off('pause');
          video[0].pause();
          durationEl.text('Segments ended');
          return;
        }

        currentTimestamp = duped.shift();
        this.setVideoSource(video, url, currentTimestamp);

        duration = `${readableDuration(currentTimestamp[0], false)} / ${readableDuration(currentTimestamp[1], false)}`;
        durationEl.text(duration);
      });
    });

    modal.modal({
      backdrop: true,
      keyboard: true,
      show: true,
    });
  }

  makeFaceTableRowCeleb(faceId, celeb) {
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
        this.loading();

        if (!_validateForm(event, formContainer)) {
          const parent = td.parents('tr').first();
          this.shake(parent);
          input.focus();
          return;
        }

        // only update the backend if the name has changed.
        const celeb = input.val();
        if (celeb.localeCompare(oName) !== 0) {
          const uuid = this.media.uuid;
          const items = [];
          items.push({
            action: TAGGING_FACE,
            faceId,
            celeb,
          });

          const response = await this.faceManager.updateFaceTaggings(items, uuid);
          console.log(response);

          for (const face of this.facesInThisContent) {
            if (face.faceId === faceId) {
              face.celeb = celeb;
            }
          }

          this.updateGraphData(response);
        }

        input.attr('readonly', 'readonly');
        btnEdit.removeClass('collapse');
        btnSave.addClass('collapse');
        btnCancel.addClass('collapse');
      } catch (e) {
        console.error(e);
      } finally {
        this.loading(false);
      }
    });

    // Check user permission to ensure we allow edit
    if (!this.canWrite) {
      btnEdit.addClass('collapse')
    }

    return td;
  }

  makeFaceTableRowScreenTime(name, appearances) {
    const td = $('<td/>')
      .addClass('h-100 align-middle text-center');

    let onscreen = 0;
    for (const [t0, t1] of appearances) {
      onscreen += (t1 - t0);
    }

    let str = '--';
    if (onscreen > 0) {
      str = readableDuration(onscreen, false);
    }

    const text = $('<div/>')
      .addClass('inline-text-sm col-9')
      .append(str);
    td.append(text);

    // play button
    const btnPlay = $('<button/>')
      .addClass('btn btn-sm btn-outline-success')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Tooltips.PlaySegments)
      .tooltip({ trigger: 'hover' });
    td.append(btnPlay);

    const iconPlay = $('<i/>')
      .addClass('far fa-play-circle');
    btnPlay.append(iconPlay);

    // event handling
    btnPlay.on('click', async () => {
      const parent = td.parents('section').first();
      await this.playSegments(parent, name, appearances);
    });

    return td;
  }

  makeFaceTableRowFaceId(faceId) {
    const td = $('<td/>')
      .addClass('h-100 align-middle text-center')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', faceId)
      .tooltip({ trigger: 'hover' })
      .append(shorten(faceId, 20));

    return td;
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

  setVideoSource(video, url, timestamp) {
    const [tsta, tend] = timestamp;
    const src = `${url}#t=${tsta / 1000},${tend / 1000}`;
    video.attr('src', src);
  }

  updateGraphData(changes = {}) {
    const { updated = [] } = changes;
    if (updated.length === 0) {
      return;
    }

    let datasets = this.scatterGraph.datasets;

    const faceMap = {};
    for (const face of datasets) {
      faceMap[face.faceId] = face;
    }

    for (const face of updated) {
      if (faceMap[face.faceId] !== undefined) {
        faceMap[face.faceId].label = face.celeb;
      }
    }

    datasets = Object.values(faceMap);
    this.scatterGraph.updateGraphData(datasets);
  }
}

function _validateForm(event, form) {
  event.preventDefault();
  if (form[0].checkValidity() === false) {
    event.stopPropagation();
    return false;
  }
  return true;
}
