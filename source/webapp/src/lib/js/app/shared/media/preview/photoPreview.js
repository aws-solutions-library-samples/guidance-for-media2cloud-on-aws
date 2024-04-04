// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import BasePreview from './basePreview.js';
import {
  GetS3Utils,
} from '../../s3utils.js';
import {
  FaceManager,
} from '../../faceManager/index.js';
import AnalysisTypes from '../../analysis/analysisTypes.js';

const CANVAS_BASE_ZINDEX = 100;

export default class PhotoPreview extends BasePreview {
  constructor(media, optionalSearchResults) {
    super(media, optionalSearchResults);
    this.$imageView = undefined;
    this.$canvases = {};
    this.$canvasIndex = CANVAS_BASE_ZINDEX;
  }

  get imageView() {
    return this.$imageView;
  }

  set imageView(val) {
    this.$imageView = val;
  }

  get canvases() {
    return this.$canvases;
  }

  set canvases(val) {
    this.$canvases = val;
  }

  get canvasIndex() {
    return this.$canvasIndex;
  }

  set canvasIndex(val) {
    this.$canvasIndex = val;
  }

  getView() {
    return this.imageView;
  }

  getCanvasesByType(type) {
    return Object.keys(this.canvases)
      .map((key) => {
        if (this.canvases[key].type === type) {
          return this.canvases[key];
        }
        return undefined;
      })
      .filter((canvas) =>
        canvas !== undefined);
  }

  async load() {
    await this.unload();

    const container = $('<div/>')
      .addClass('col-9 p-0 m-0 mx-auto');
    this.container.append(container);

    const overlayContainer = $('<div/>')
      .addClass('overlay-container');
    container.append(overlayContainer);

    const image = $('<img/>')
      .addClass('h-600max w-100 img-contain')
      .attr('alt', this.media.basename);
    overlayContainer.append(image);

    image.ready(async () => {
      const src = await this.media.getProxyImage();
      image.attr('src', src);
    });
    this.imageView = image;

    const canvasContainer = $('<div/>')
      .addClass('canvas-list');
    overlayContainer.append(canvasContainer);

    canvasContainer.ready(async () => {
      const canvases = await this.createCanvases();
      canvasContainer.append(canvases);
    });

    return this;
  }

  async unload() {
    this.canvases = {};
    this.canvasIndex = CANVAS_BASE_ZINDEX;
    this.imageView = undefined;
    return super.unload();
  }

  async pause() {
    this.container.find('div.canvas-list')
      .addClass('collapse');
  }

  async unpause() {
    this.container.find('div.canvas-list')
      .removeClass('collapse');
  }

  async createCanvases() {
    const result = this.media.getRekognitionImageResults() || {};
    const types = Object.keys(result);

    let canvases = await Promise.all(types
      .map((type) => {
        if (!result[type].output) {
          return undefined;
        }
        return this.createCanvasesByType(
          type,
          result[type].output
        );
      }));
    canvases = canvases
      .filter((x) =>
        x !== undefined)
      .flat(1);

    return canvases;
  }

  async createCanvasesByType(type, key) {
    const s3utils = GetS3Utils();

    const response = await s3utils.getObject(
      this.media.getProxyBucket(),
      key
    ).catch(() =>
      undefined);

    if (!response) {
      return undefined;
    }

    const data = await response.Body.transformToString()
      .then((res) =>
        JSON.parse(res));

    if (data.CelebrityFaces) {
      return this.createCelebCanvas(data);
    }
    if (data.FaceDetails) {
      return this.createFaceCanvas(data);
    }
    if (data.FaceMatches) {
      return this.createFaceMatchCanvas(data);
    }
    if (data.Labels) {
      return this.createLabelCanvas(data);
    }
    if (data.ModerationLabels) {
      return this.createModerationCanvas(data);
    }
    if (data.TextDetections) {
      return this.createTextCanvas(data);
    }

    return undefined;
  }

  createCelebCanvas(data) {
    const items = [];
    while (data.CelebrityFaces.length) {
      const celeb = data.CelebrityFaces.shift();
      const canvasId = this.canvasRegister({
        type: AnalysisTypes.Rekognition.Celeb,
        name: celeb.Name,
        confidence: Number(Number(celeb.MatchConfidence).toFixed(2)),
        coord: {
          y: Number(Number(celeb.Face.BoundingBox.Top).toFixed(2)),
          x: Number(Number(celeb.Face.BoundingBox.Left).toFixed(2)),
          w: Number(Number(celeb.Face.BoundingBox.Width).toFixed(2)),
          h: Number(Number(celeb.Face.BoundingBox.Height).toFixed(2)),
        },
      });
      const canvas = $('<canvas/>')
        .addClass('image-canvas-overlay collapse')
        .attr('data-canvas-id', canvasId)
        .attr('data-init', false);
      items.push(canvas);
    }
    return items;
  }

  createFaceCanvas(data) {
    const items = [];
    let faceIdx = 0;
    while (data.FaceDetails.length) {
      const face = data.FaceDetails.shift();
      const canvasId = this.canvasRegister({
        type: AnalysisTypes.Rekognition.Face,
        name: `Face ${faceIdx++}`,
        confidence: Number(Number(face.Confidence).toFixed(2)),
        coord: {
          y: face.BoundingBox.Top,
          x: face.BoundingBox.Left,
          w: face.BoundingBox.Width,
          h: face.BoundingBox.Height,
        },
        gender: (face.Gender || {}).Value
          ? `${face.Gender.Value} (${Number(face.Gender.Confidence).toFixed(2)})`
          : undefined,
        ageRange: (face.AgeRange || {}).Value
          ? `${face.AgeRange.Low}/${face.AgeRange.High}`
          : undefined,
      });
      const canvas = $('<canvas/>')
        .addClass('image-canvas-overlay collapse')
        .attr('data-canvas-id', canvasId)
        .attr('data-init', false);
      items.push(canvas);
    }
    return items;
  }

  createFaceMatchCanvas(data) {
    const items = [];
    while (data.FaceMatches.length) {
      const match = data.FaceMatches.shift();
      const face = match.Face;

      // filter out datapoint that has marked as deleted
      if (face.MarkDeleted === true) {
        continue;
      }

      const faceId = face.FaceId;

      let name = face.Name;
      if (!name) {
        name = FaceManager.resolveExternalImageId(
          face.ExternalImageId,
          faceId
        );
      }

      const canvasId = this.canvasRegister({
        type: AnalysisTypes.Rekognition.FaceMatch,
        name,
        confidence: Number(Number(match.Similarity).toFixed(2)),
        coord: {
          y: Number(Number(data.SearchedFaceBoundingBox.Top).toFixed(2)),
          x: Number(Number(data.SearchedFaceBoundingBox.Left).toFixed(2)),
          w: Number(Number(data.SearchedFaceBoundingBox.Width).toFixed(2)),
          h: Number(Number(data.SearchedFaceBoundingBox.Height).toFixed(2)),
        },
      });
      const canvas = $('<canvas/>')
        .addClass('image-canvas-overlay collapse')
        .attr('data-canvas-id', canvasId)
        .attr('data-init', false);
      items.push(canvas);
    }
    return items;
  }

  createLabelCanvas(data) {
    const items = [];
    while (data.Labels.length) {
      const label = data.Labels.shift();
      let parents = label.Parents.map(x => x.Name);
      parents = (parents.length > 0) ? parents.join(', ') : '';
      if (label.Instances.length > 0) {
        let i = 0;
        while (label.Instances.length) {
          const instance = label.Instances.shift();
          const canvasId = this.canvasRegister({
            type: AnalysisTypes.Rekognition.Label,
            name: `${label.Name} ${i++}`,
            confidence: Number(Number(instance.Confidence).toFixed(2)),
            coord: {
              y: instance.BoundingBox.Top,
              x: instance.BoundingBox.Left,
              w: instance.BoundingBox.Width,
              h: instance.BoundingBox.Height,
            },
            parentName: parents,
          });
          const canvas = $('<canvas/>')
            .addClass('image-canvas-overlay collapse')
            .attr('data-canvas-id', canvasId)
            .attr('data-init', false);
          items.push(canvas);
        }
      } else {
        const canvasId = this.canvasRegister({
          type: AnalysisTypes.Rekognition.Label,
          name: label.Name,
          confidence: Number(Number(label.Confidence).toFixed(2)),
          coord: undefined,
          parentName: parents,
        });
        const canvas = $('<canvas/>')
          .addClass('image-canvas-overlay collapse')
          .attr('data-canvas-id', canvasId)
          .attr('data-init', false);
        items.push(canvas);
      }
    }
    return items;
  }

  createModerationCanvas(data) {
    const items = [];
    while (data.ModerationLabels.length) {
      const moderation = data.ModerationLabels.shift();
      const canvasId = this.canvasRegister({
        type: AnalysisTypes.Rekognition.Moderation,
        name: moderation.Name,
        confidence: Number(Number(moderation.Confidence).toFixed(2)),
        coord: undefined,
        parentName: moderation.ParentName,
      });
      const canvas = $('<canvas/>')
        .addClass('image-canvas-overlay collapse')
        .attr('data-canvas-id', canvasId)
        .attr('data-init', false);
      items.push(canvas);
    }
    return items;
  }

  createTextCanvas(data) {
    const items = [];
    while (data.TextDetections.length) {
      const text = data.TextDetections.shift();
      if (text.Type === 'WORD') {
        continue;
      }
      const canvasId = this.canvasRegister({
        type: AnalysisTypes.Rekognition.Text,
        name: text.DetectedText,
        confidence: Number(Number(text.Confidence).toFixed(2)),
        coord: {
          y: text.Geometry.BoundingBox.Top,
          x: text.Geometry.BoundingBox.Left,
          w: text.Geometry.BoundingBox.Width,
          h: text.Geometry.BoundingBox.Height,
        },
      });
      const canvas = $('<canvas/>')
        .addClass('image-canvas-overlay collapse')
        .attr('data-canvas-id', canvasId)
        .attr('data-init', false);
      items.push(canvas);
    }
    return items;
  }

  canvasRegister(attributes) {
    const id = `canvas-${this.canvasIndex++}`;
    this.canvases[id] = {
      ...attributes,
      id,
    };
    return id;
  }

  canvasUnregister(canvasId) {
    const canvas = this.container.find(`[data-canvas-id="${canvasId}"]`);
    canvas.remove();
    delete this.canvases[canvasId];
  }

  canvasToggle(canvasId, enabled, image) {
    const canvas = this.container.find(`[data-canvas-id="${canvasId}"]`);
    if (!enabled) {
      canvas.addClass('collapse');
    } else {
      if (canvas.data('init') === false) {
        this.canvasInit(canvas, this.canvases[canvasId], image);
      }
      canvas.removeClass('collapse');
    }
    return canvas;
  }

  canvasInit(canvas, data, image) {
    const canvasW = (image || this.imageView).width();
    const canvasH = (image || this.imageView).height();
    /* note: need to explicitly set the canvas width and height */
    const canvas0 = canvas[0];
    canvas0.width = canvasW;
    canvas0.height = canvasH;

    const ctx = canvas[0].getContext('2d');
    let w = 0;
    let h = 0;
    let x = 0;
    let y = 0;
    if (data.coord) {
      w = Math.floor(data.coord.w * canvasW);
      h = Math.floor(data.coord.h * canvasH);
      x = Math.floor(data.coord.x * canvasW);
      y = Math.floor(data.coord.y * canvasH);
    }

    const hasCoord = (w || h || x || y);
    if (hasCoord) {
      ctx.strokeStyle = '#ffffff'; // #ff9900
      ctx.moveTo(0, 0);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(x, y, w, h);
    }

    const text = [
      `${data.name} (${data.confidence}%)`,
      data.gender && `Gender: ${data.gender}`,
      data.ageRange && `Age: ${data.ageRange}`,
      data.parentName && `(${data.parentName})`,
    ].filter(x0 => x0);

    let fontSize;
    const lineSpace = 0;
    if (hasCoord) {
      fontSize = 14;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    } else {
      x = 0.5 * canvasW;
      y = 0.5 * canvasH;
      fontSize = 18;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    }
    ctx.font = `${fontSize}px sans-serif`;
    /* here to customize font color */
    switch (data.type) {
      case AnalysisTypes.Rekognition.Celeb:
      case AnalysisTypes.Rekognition.Label:
      case AnalysisTypes.Rekognition.Face:
      case AnalysisTypes.Rekognition.FaceMatch:
      case AnalysisTypes.Rekognition.Moderation:
      case AnalysisTypes.Rekognition.Text:
        ctx.fillStyle = '#ffffff';
        break;
      default:
        ctx.fillStyle = '#ffffff';
        break;
    }
    let y0 = Math.max((y - (text.length * (fontSize + lineSpace))), 2);
    while (text.length) {
      ctx.fillText(text.shift(), x, y0);
      y0 += (fontSize + lineSpace);
    }
    canvas.data('init', true);
    return canvas;
  }
}
