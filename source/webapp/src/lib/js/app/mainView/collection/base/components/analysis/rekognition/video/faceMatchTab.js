// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../../shared/localization.js';
import AppUtils from '../../../../../../../shared/appUtils.js';
import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import {
  GetFaceManager,
} from '../../../../../../../shared/faceManager/index.js';
import BaseRekognitionTab from './baseRekognitionTab.js';
import FaceTaggingModal from '../../../../../../../shared/faceManager/faceTaggingModal.js';

const {
  Messages,
  Buttons,
} = Localization;

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

export default class FaceMatchTab extends BaseRekognitionTab {
  constructor(previewComponent, data) {
    super(FaceMatch, previewComponent, data);
    this.$faceManager = GetFaceManager();
    this.$untaggedFaces = [];
  }

  // disable caching dataset locally
  get shouldCache() {
    return false;
  }

  get faceManager() {
    return this.$faceManager;
  }

  get untaggedFaces() {
    return this.$untaggedFaces;
  }

  set untaggedFaces(val) {
    this.$untaggedFaces = val;
  }

  async transformDataset(data) {
    const modified = data;
    const faceIds = [];

    // should we lookup for celeb names?
    Object.keys(data)
      .forEach((x) => {
        if (AppUtils.validateUuid(x)) {
          faceIds.push(x);
        }
      });

    if (faceIds.length === 0) {
      return super.transformDataset(data);
    }

    this.untaggedFaces = [];

    const faces = await this.faceManager.batchGetFaces(faceIds);
    faces.forEach((face) => {
      if (face.celeb) {
        modified[face.faceId].label = face.celeb;
      } else {
        this.untaggedFaces.push(face);
      }
    });

    return super.transformDataset(modified);
  }

  async delayContentLoad(container) {
    await super.delayContentLoad(container);

    if (this.untaggedFaces.length > 0) {
      const faceTaggingSection = this.createFaceTaggingSection();
      container.prepend(faceTaggingSection);
    }
  }

  createFaceTaggingSection() {
    const container = $('<div/>')
      .addClass('col-12 mb-4 p-0 m-0');

    const text = Messages.FaceTaggingToolDesc
      .replace('{{FACE_TAGGING_TOOL}}', Buttons.FaceTaggingTool);

    const desc = $('<p/>')
      .addClass('lead-sm')
      .append(text);
    container.append(desc);

    const btnFaceTag = $('<button/>')
      .addClass('btn btn-sm btn-success')
      .addClass('mb-2')
      .append(Buttons.FaceTaggingTool);
    container.append(btnFaceTag);

    // event handling
    btnFaceTag.on('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();

      const changes = await this.showFaceTaggingModal(
        container,
        this.untaggedFaces,
        this.media.uuid
      );

      console.log('changes', changes);
      this.updateGraphData(changes);
    });

    return container;
  }

  async showFaceTaggingModal(container, untaggedFaces, uuid) {
    return new Promise((resolve) => {
      const modal = new FaceTaggingModal(
        container,
        untaggedFaces,
        uuid
      );

      container.on('facetagging:modal:hidden', async (event) => {
        container.off('facetagging:modal:hidden');
        const data = modal.destroy();
        resolve(data);
      });

      modal.show();
    });
  }

  updateGraphData(changes) {
    if (!changes) {
      return;
    }

    let datasets = this.scatterGraph.datasets;

    const total = (changes.deleted || []).length + (changes.updated || []).length;
    if (total === 0) {
      return;
    }

    const remapped = datasets
      .reduce((a0, c0) => ({
        ...a0,
        [c0.label]: c0,
      }), {});

    (changes.deleted || [])
      .forEach((item) => {
        // update untaggedFaces list
        const idx = this.untaggedFaces
          .findIndex((x) =>
            x.faceId === item.faceId);
        if (idx >= 0) {
          this.untaggedFaces.splice(idx, 1);
        }
        delete remapped[item.faceId];
      });

    (changes.updated || [])
      .forEach((item) => {
        // update untaggedFaces list
        const idx = this.untaggedFaces
          .findIndex((x) =>
            x.faceId === item.faceId);
        if (idx >= 0) {
          this.untaggedFaces.splice(idx, 1);
        }

        // move from faceId to celeb
        if (remapped[item.celeb] === undefined) {
          if (remapped[item.faceId] !== undefined) {
            remapped[item.celeb] = {
              ...remapped[item.faceId],
              label: item.celeb,
            };
            delete remapped[item.faceId];
            return;
          }
        }

        // merge datapoints
        if (remapped[item.celeb] !== undefined) {
          remapped[item.celeb] = _mergeGraphDatapoints(
            remapped[item.celeb],
            remapped[item.faceId]
          );
          delete remapped[item.faceId];
        }
      });

    datasets = Object.values(remapped);
    this.scatterGraph.updateGraphData(datasets);
  }
}
