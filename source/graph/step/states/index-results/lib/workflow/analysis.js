// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData: {
    Statuses: {
      AnalysisCompleted,
    },
  },
  AnalysisTypes: {
    Rekognition,
    Comprehend,
  },
  AdBreak,
  AutoFaceIndexer,
  Shoppable,
  Scene,
  GraphDefs,
  CommonUtils,
  FaceIndexer,
} = require('core-lib');

const BaseWorkflow = require('./base');
const Vertex = require('../vertex');
const Edge = require('../edge');

const {
  Vertices: {
    Asset,
    Celeb,
    Label,
    Keyword,
  },
  Edges: {
    HasCeleb,
    HasLabel,
    HasModerationLabel,
    HasKeyword,
  },
} = GraphDefs; // require('../constants');

const MIN_CONFIDENCE = 70.0;
const MIN_APPEARANCE_IN_MS = 1000;
const ANALYSIS_COMPLETED = 'ANALYSIS_COMPLETED';
const TYPE_VIDEO = 'video';
const TYPE_AUDIO = 'audio';
const TYPE_IMAGE = 'image';
const TYPE_DOCUMENT = 'document';
const CATEGORY_VIDEO_REKOGNITION = 'rekognition';
const CATEGORY_IMAGE_REKOGNITION = 'rekog-image';
const CATEGORY_COMPREHEND = 'comprehend';

const REGEX_FACEID = /^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/;
const REGEX_HEXSTR = /^[a-f0-9]{6,}$/;
const IGNORE_TYPES = [
  AdBreak,
  AutoFaceIndexer,
  Shoppable,
  Scene,
];

class AnalysisWorkflow extends BaseWorkflow {
  static isSupported(status) {
    return (status === AnalysisCompleted);
  }

  parseVideoAnalysis(assetV, type, duration, data = {}) {
    let collectionId;
    if (type === Rekognition.FaceMatch) {
      collectionId = this.output.input.aiOptions.faceCollectionId || '';
    }

    const results = [];

    if (IGNORE_TYPES.includes(type)) {
      return [];
    }

    Object.keys(data)
      .forEach((x) => {
        if (!Array.isArray(data[x])) {
          return;
        }
        const filtered = data[x]
          .filter((x0) =>
            x0.confidence >= MIN_CONFIDENCE);

        const appearanceInMsecs = filtered
          .reduce((a0, c0) =>
            a0 + (c0.end - c0.begin), 0);
        if (appearanceInMsecs < MIN_APPEARANCE_IN_MS) {
          return;
        }

        let avgConfidence = filtered
          .reduce((a0, c0) =>
            a0 + c0.confidence, 0);
        avgConfidence = Number(((avgConfidence / filtered.length) / 100).toFixed(2));

        let name = x;
        let id;

        // if has faceId, use faceId and strip '-' character
        if (filtered[0].faceId !== undefined) {
          id = name.replaceAll('-', '');
        } else {
          name = FaceIndexer.resolveExternalImageId(name, true);
          id = Buffer.from(name.toLowerCase()).toString('hex');
        }

        const props = {
          name,
        };

        let nodeType;
        let edgeType;
        if ([Rekognition.Celeb, Rekognition.FaceMatch].includes(type)) {
          nodeType = Celeb;
          edgeType = HasCeleb;
          id = `${id}-${Celeb}`;
          /* specific to FaceMatch */
          if (collectionId) {
            props.collectionId = collectionId;
          }
          if (filtered[0].faceId) {
            props.faceId = filtered[0].faceId;
          }
        } else if ([Rekognition.Label, Rekognition.Moderation].includes(type)) {
          nodeType = Label;
          edgeType = HasLabel;
          id = `${id}-${Label}`;
        } else {
          return;
        }

        const rekV = new Vertex(id, nodeType, props);

        /* E: asset -> rekV */
        const showrate = Number((appearanceInMsecs / duration).toFixed(2));
        const edge = Edge.fromVertices(edgeType, assetV, rekV);
        edge.setProperty('confidence', avgConfidence);
        edge.setProperty('showrate', showrate);

        results.push({
          v: rekV,
          e: edge,
        });
      });

    return results;
  }

  async processVideoAnalysis(assetV) {
    const proxyBucket = this.output.input.destination.bucket;
    const duration = this.output.input.duration;
    const data = (this.output.data.video || {})[CATEGORY_VIDEO_REKOGNITION] || {};

    const responses = (await Promise.all(Object.keys(data)
      .map((type) => {
        if (data[type].metadata !== undefined) {
          return CommonUtils.download(
            proxyBucket,
            data[type].metadata
          ).then((res) => {
            const parsed = JSON.parse(res);
            return this.parseVideoAnalysis(assetV, type, duration, parsed);
          });
        }
        return [];
      })))
      .flat(1);

    /* https://docs.aws.amazon.com/neptune/latest/userguide/gremlin-efficient-upserts.html
      200 records per batch, roughtly 40 vertices and edges together */
    while (responses.length > 0) {
      const batch = responses.splice(0, 40);

      let chained = this.graph;
      batch.forEach((x) => {
        console.log('vertex', x.v.id);
        chained = x.v.upsert(chained);
      });
      batch.forEach((x) => {
        console.log('edge', x.e.id);
        chained = x.e.upsert(chained);
      });

      const response = await chained.iterate();
      console.log('== chained', JSON.stringify(response));
    }

    return responses;
  }

  parseAudioAnalysis(assetV, category, duration, data = []) {
    const ignoreTypes = [
      'DATE',
      'OTHER',
      'QUANTITY',
    ];
    const keywords = [];

    if ([Comprehend.Entity, Comprehend.CustomEntity].includes(category)) {
      data
        .filter((x) =>
          !ignoreTypes.includes(x))
        .forEach((x) => {
          /* make sure it doesn't collide with label or celeb names */
          const id = [
            Buffer.from(x.text.toLowerCase()).toString('hex'),
            Keyword,
          ].join('-');

          const found = keywords
            .find((x0) =>
              x0.v.id === id);

          if (found) {
            /* update edge properties */
            let showrate = found.e.getProperty('showrate');
            showrate += (x.end - x.begin) / duration;
            showrate = Number(Math.max(1, showrate).toFixed(2));
            found.e.setProperty('showrate', showrate);

            let confidence = found.e.getProperty('confidence');
            confidence = Math.max(confidence, x.confidence / 100);
            found.e.setProperty('confidence', confidence);

            return;
          }

          const props = {
            name: x.text,
          };
          const keywordV = new Vertex(id, Keyword, props);

          /* E: asset -> keyword */
          const confidence = Number((x.confidence / 100).toFixed(2));
          const showrate = Number(((x.end - x.begin) / duration).toFixed(2));
          const edge = Edge.fromVertices(HasKeyword, assetV, keywordV);
          edge.setProperty('confidence', confidence);
          edge.setProperty('showrate', showrate);

          keywords.push({
            v: keywordV,
            e: edge,
          });
        });
    }

    return keywords;
  }

  async processAudioAnalysis(assetV) {
    const proxyBucket = this.output.input.destination.bucket;
    const duration = this.output.input.duration;
    const data = (this.output.data.audio || {})[CATEGORY_COMPREHEND] || {};

    const responses = (await Promise.all(Object.keys(data)
      .map((type) => {
        if (data[type].metadata !== undefined) {
          return CommonUtils.download(
            proxyBucket,
            data[type].metadata
          ).then((res) => {
            const parsed = JSON.parse(res);
            return this.parseAudioAnalysis(assetV, type, duration, parsed);
          });
        }
        return [];
      })))
      .flat(1);

    /* https://docs.aws.amazon.com/neptune/latest/userguide/gremlin-efficient-upserts.html
      200 records per batch, roughtly 40 vertices and edges together */
    while (responses.length > 0) {
      const batch = responses.splice(0, 40);

      let chained = this.graph;
      batch.forEach((x) => {
        console.log('vertex', x.v.id);
        chained = x.v.upsert(chained);
      });
      batch.forEach((x) => {
        console.log('edge', x.e.id);
        chained = x.e.upsert(chained);
      });

      const response = await chained.iterate();
      console.log('== chained', JSON.stringify(response));
    }

    return responses;
  }

  parseImageKnownFaces(assetV, data) {
    const knownFaces = [];

    if (data.FaceMatches) {
      data.FaceMatches
        .forEach((x) => {
          if (!x.Face.FaceId) {
            return;
          }

          const faceId = x.Face.FaceId;
          const externalImageId = x.Face.ExternalImageId;
          let name = x.Face.Name;
          if (!name) {
            name = FaceIndexer.resolveExternalImageId(
              x.Face.ExternalImageId,
              faceId
            );
          }

          /* V: celeb */
          /* force to store id w/ lowercase name and convert to hex string */
          const id = [
            faceId,
            Celeb,
          ].join('-');
          const props = {
            name,
            faceId,
            externalImageId,
          };
          const celebV = new Vertex(id, Celeb, props);

          /* E: asset -> celeb */
          const confidence = Number((x.Similarity / 100).toFixed(2));
          const showrate = 1.0;
          const edge = Edge.fromVertices(HasCeleb, assetV, celebV);
          edge.setProperty('confidence', confidence);
          edge.setProperty('showrate', showrate);

          knownFaces.push({
            v: celebV,
            e: edge,
          });
        });
    }

    if (data.CelebrityFaces) {
      data.CelebrityFaces
        .forEach((x) => {
          /* V: celeb */
          const id = [
            Buffer.from(x.Name.toLowerCase()).toString('hex'),
            Celeb,
          ].join('-');

          /* only create vertex if it is not already in FaceMatches */
          const found = knownFaces
            .find((x0) =>
              x0.v.id === id);
          if (found) {
            return;
          }

          const props = {
            name: x.Name,
          };
          if (x.Urls && x.Urls[0]) {
            props.url = x.Urls[0];
          }
          const celebV = new Vertex(id, Celeb, props);

          /* E: asset -> celeb */
          const confidence = Number((x.MatchConfidence / 100).toFixed(2));
          const showrate = 1.0;
          const edge = Edge.fromVertices(
            HasCeleb,
            assetV,
            celebV
          );
          edge.setProperty('confidence', confidence);
          edge.setProperty('showrate', showrate);

          knownFaces.push({
            v: celebV,
            e: edge,
          });
        });
    }

    return knownFaces;
  }

  parseImageLabels(assetV, data) {
    const labels = [];
    if (data.Labels) {
      data.Labels
        .forEach((x) => {
          if (x.Confidence < MIN_CONFIDENCE) {
            return;
          }
          /* V: label */
          /* force to store id w/ lowercase name and convert to hex string */
          const id = [
            Buffer.from(x.Name.toLowerCase()).toString('hex'),
            Label,
          ].join('-');

          const props = {
            name: x.Name,
          };
          const labelV = new Vertex(id, Label, props);

          /* E: asset -> label */
          const confidence = Number((x.Confidence / 100).toFixed(2));
          const showrate = 1.0;
          const edge = Edge.fromVertices(HasLabel, assetV, labelV);
          edge.setProperty('confidence', confidence);
          edge.setProperty('showrate', showrate);

          labels.push({
            v: labelV,
            e: edge,
          });
        });
    }

    if (data.ModerationLabels) {
      data.ModerationLabels
        .forEach((x) => {
          if (x.Confidence < MIN_CONFIDENCE) {
            return;
          }
          if (!x.ParentName) {
            return;
          }
          /* V: label */
          const name = `${x.Name}, ${x.ParentName}`;
          /* force to store id w/ lowercase name and convert to hex string */
          const id = [
            Buffer.from(name.toLowerCase()).toString('hex'),
            Label,
          ].join('-');

          const props = {
            name: x.Name,
          };
          const labelV = new Vertex(id, Label, props);

          /* E: asset -> label */
          const confidence = Number((x.Confidence / 100).toFixed(2));
          const showrate = 1.0;
          const edge = Edge.fromVertices(HasModerationLabel, assetV, labelV);
          edge.setProperty('confidence', confidence);
          edge.setProperty('showrate', showrate);

          labels.push({
            v: labelV,
            e: edge,
          });
        });
    }

    return labels;
  }

  parseImageAnalysis(assetV, data = {}) {
    const knownFaces = this.parseImageKnownFaces(assetV, data);
    const labels = this.parseImageLabels(assetV, data);

    return knownFaces.concat(labels);
  }

  async processImageAnalysis(assetV) {
    const proxyBucket = this.output.input.destination.bucket;
    const data = (this.output.data.image || {})[CATEGORY_IMAGE_REKOGNITION] || {};

    const responses = (await Promise.all(Object.keys(data)
      .map((type) => {
        if (data[type].output !== undefined) {
          return CommonUtils.download(
            proxyBucket,
            data[type].output
          ).then((res) => {
            const parsed = JSON.parse(res);
            return this.parseImageAnalysis(assetV, parsed);
          });
        }
        return [];
      })))
      .flat(1);

    /* https://docs.aws.amazon.com/neptune/latest/userguide/gremlin-efficient-upserts.html
      200 records per batch, roughtly 40 vertices and edges together */
    while (responses.length > 0) {
      const batch = responses.splice(0, 40);

      let chained = this.graph;
      batch.forEach((x) => {
        console.log('vertex', x.v.id);
        chained = x.v.upsert(chained);
      });
      batch.forEach((x) => {
        console.log('edge', x.e.id);
        chained = x.e.upsert(chained);
      });

      const response = await chained.iterate();
      console.log('== chained', JSON.stringify(response));
    }

    return responses;
  }

  async processDocumentAnalysis(assetV) {
    return undefined;
  }

  async process() {
    const promises = [];
    const data = this.output.data;

    if (this.output.status !== AnalysisCompleted) {
      return undefined;
    }

    /* asset node should have already been created from the ingest side.
       this node is just to be used as a reference to build the edges and relationships */
    const uuid = this.output.uuid;
    const assetV = new Vertex(uuid, Asset);
    if (data[TYPE_VIDEO]) {
      promises.push(this.processVideoAnalysis(assetV));
    }
    if (data[TYPE_AUDIO]) {
      promises.push(this.processAudioAnalysis(assetV));
    }
    if (data[TYPE_IMAGE]) {
      promises.push(this.processImageAnalysis(assetV));
    }
    if (data[TYPE_DOCUMENT]) {
      promises.push(this.processDocumentAnalysis(assetV));
    }

    const response = await Promise.all(promises);

    /* update status */
    const status = this.output.status;
    await assetV.update(this.graph, 'status', status);

    /* debug: dump graph structure */
    const dbg = await assetV.dump(this.graph);
    console.log('== analysis - dump graph', assetV.id);
    dbg.forEach((x) => {
      console.log(`${x[0].name[0]} (${x[0].label}) -> ${x[1].label} -> ${x[2].name[0]} (${x[2].label})`);
    });
    console.log('Total connections', dbg.length);

    return response;
  }
}

module.exports = AnalysisWorkflow;
