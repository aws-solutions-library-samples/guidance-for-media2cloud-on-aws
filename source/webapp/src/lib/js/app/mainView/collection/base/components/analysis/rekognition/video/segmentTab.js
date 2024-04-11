// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../../../shared/localization.js';
import AnalysisTypes from '../../../../../../../shared/analysis/analysisTypes.js';
import MapData from '../../../../../../../shared/analysis/mapData.js';
import BaseRekognitionTab from './baseRekognitionTab.js';

const {
  Rekognition: {
    Segment,
  },
  Scene,
} = AnalysisTypes;
const {
  Messages: {
    NoData: MSG_NO_DATA,
    DownloadEDLDesc: MSG_DOWNLOAD_EDL_DESC,
    SceneListTitle: MSG_SCENE_LIST,
    SceneDetailTitle: MSG_SCENE_DETAIL_TITLE,
    SceneDetailDesc: MSG_SCENE_DETAIL_DESC,
  },
  Buttons: {
    DownloadEDL: BTN_DOWNLOAD_DESC,
  },
} = Localization;

const DEFAULT_OUTPUT = '00000000.json';

export default class SegmentTab extends BaseRekognitionTab {
  constructor(previewComponent, data) {
    super(Segment, previewComponent, data);
    this.$scenechange = undefined;
  }

  get scenechange() {
    return this.$scenechange;
  }

  set scenechange(val) {
    this.$scenechange = val;
  }

  async createContent() {
    const container = $('<div/>')
      .addClass('col-9 m-0 p-0 max-h36r');

    let promises = [];
    const data = this.media.getRekognitionResults()[Scene];
    if (data !== undefined && data.vtt !== undefined && data.metadata !== undefined) {
      promises.push(this.downloadJson(data.vtt));
      promises.push(this.downloadJson(data.metadata));
    }

    const [
      sceneVtt,
      sceneMetadata,
    ] = await Promise.all(promises);

    promises = [];
    promises.push(this.createButtonList(sceneVtt));
    promises.push(this.createEDLButton());
    promises.push(this.createSceneSection(sceneMetadata));

    promises = await Promise.all(promises);
    container.append(promises);

    return container;
  }

  async createButtonList(sceneVtt) {
    const container = $('<div/>')
      .addClass('col-12 m-0 p-0 my-4');

    const tracks = await this.createTrackButtons(this.category);
    if (!(tracks || []).length) {
      return container.html(MSG_NO_DATA);
    }

    if (sceneVtt !== undefined) {
      const btnScene = await this.createSceneTrackButton(sceneVtt);
      if (btnScene) {
        tracks.push(btnScene);
      }
    }

    const enableAll = this.createEnableAll(tracks);
    container.append(enableAll);

    tracks.forEach((btn) =>
      container.append(btn));

    return container;
  }

  async createEDLButton() {
    const edl = (this.data || {}).edl;
    if (!edl) {
      return undefined;
    }

    const container = $('<div/>')
      .addClass('col-12 m-0 p-0 my-4');

    const edlDesc = $('<p/>')
      .addClass('lead-sm')
      .append(MSG_DOWNLOAD_EDL_DESC);
    container.append(edlDesc);

    const bucket = this.media.getProxyBucket();
    let name = `${Segment}.zip`;
    let key = `${edl}${name}`;
    if (/zip$/.test(edl)) {
      name = edl.substring(edl.lastIndexOf('/') + 1);
      key = edl;
    }

    const href = await this.media.getUrl(bucket, key);
    const btnEdl = $('<a/>')
      .addClass('btn btn-sm btn-success text-capitalize mb-1 ml-1')
      .attr('href', href)
      .attr('target', '_blank')
      .attr('download', `${this.media.basename}-${name}`)
      .attr('role', 'button')
      .append(BTN_DOWNLOAD_DESC);
    container.append(btnEdl);

    return container;
  }

  async createSceneTrackButton(sceneVtt) {
    let _blob = new Blob([sceneVtt.scene], {
      type: 'text/vtt',
    });
    _blob = URL.createObjectURL(_blob);

    this.previewComponent.trackRegister('scene', _blob);

    return this.createButton('scene');
  }

  async createSceneSection(sceneData) {
    if (((sceneData || {}).scene || []).length === 0) {
      return undefined;
    }

    const section = $('<section/>')
      .addClass('col-12 m-0 p-0 my-4');

    const details = $('<details/>');
    section.append(details);

    const summary = $('<summary/>')
      .addClass('my-4');
    details.append(summary);

    let title = MSG_SCENE_LIST
      .replace('{{SCENES}}', sceneData.scene.length);
    title = $('<span/>')
      .addClass('lead ml-2')
      .html(title);
    summary.append(title);

    details.on('click', async () => {
      try {
        this.loading();

        const wasOpen = details.prop('open');
        const rendered = details.data('rendered');

        if (!rendered && !wasOpen) {
          const carousel = await this.buildSceneFrameList(sceneData);
          details.append(carousel);

          details.data('rendered', true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        this.loading(false);
      }
    });

    section.ready(async () => {
    });

    return section;
  }

  async downloadJson(key) {
    const data = await this.download(key);

    if (data) {
      return data.Body.transformToString()
        .then((res) =>
          JSON.parse(res));
    }

    return undefined;
  }

  buildSceneFrameList(data) {
    const container = $('<div/>')
      .addClass('col-12 p-0 m-0')
      .css('aspect-ratio', '7/2');

    const scenes = data[Scene];
    if ((scenes || []).length === 0) {
      const noData = $('<p/>')
        .addClass('lead-s text-muted')
        .append(MSG_NO_DATA);

      container.append(noData);
      return container;
    }

    const proxyBucket = this.media.getProxyBucket();

    // frame list
    const frameListContainer = $('<div/>')
      .addClass('no-gutters d-flex overflow-auto');
    container.append(frameListContainer);

    // scene information
    const sceneInfoContainer = $('<div/>')
      .addClass('row no-gutters mt-4');
    container.append(sceneInfoContainer);

    const imageContainers = scenes.map((item) => {
      const imageContainer = $('<div/>')
        .addClass('thumbnail opacity10 d-inline-flex m-3')
        .addClass('image-container')
        .css('aspect-ratio', '16/9')
        .data('item', item);

      const image = $('<img/>')
        .addClass('w-100');
      imageContainer.append(image);

      const overlay = $('<div/>')
        .addClass('overlay-top-left');
      imageContainer.append(overlay);

      let text = `#${item.sceneNo}`;
      text = $('<span/>')
        .addClass('badge badge-dark border-radius-none')
        .addClass('lead-sm b-200')
        .append(text);
      overlay.append(text);

      // event handlings
      image.ready(async () => {
        let key = item.keyStart || item.keyEnd;
        key = `${data.framePrefix}/${key}`;

        const src = await this.media.getNamedImageUrl(
          proxyBucket,
          key
        );
        image.attr('src', src.url);
      });

      imageContainer.on('click', async (event) => {
        event.preventDefault();
        this.previewComponent.seek(item.timeStart / 1000);

        sceneInfoContainer.children().remove();

        // scene description
        const sceneDescView = $('<div/>')
          .addClass('col-6 m-0 p-0')
          .addClass('lead-s');
        sceneInfoContainer.append(sceneDescView);

        const title = $('<p/>')
          .addClass('b-400')
          .append(MSG_SCENE_DETAIL_TITLE);
        sceneDescView.append(title);

        const descText = MSG_SCENE_DETAIL_DESC
          .replace('{{SCENE_NO}}', item.sceneNo)
          .replace('{{SMPTE_START}}', item.smpteStart)
          .replace('{{SMPTE_END}}', item.smpteEnd)
          .replace('{{DURATION}}', (item.duration / 1000).toFixed(2))
          .replace('{{SHOTS}}', item.shotEnd - item.shotStart + 1)
          .replace('{{SHOT_START}}', item.shotStart)
          .replace('{{SHOT_END}}', item.shotEnd);

        let desc = $('<p/>')
          .addClass('b-300 mr-4')
          .append(descText);
        sceneDescView.append(desc);

        // taxonomy
        if (item.details && item.details.length > 0) {
          const sectionContextual = $('<section/>');
          sceneDescView.append(sectionContextual);

          desc = $('<p/>')
            .addClass('b-400 mr-4')
            .append('Contextual information');
          sectionContextual.append(desc);

          const ulContextual = $('<ul/>')
            .addClass('lead-s b-300');
          sectionContextual.append(ulContextual);

          const sectionIABTaxonomy = $('<section/>');
          sceneDescView.append(sectionIABTaxonomy);

          desc = $('<p/>')
            .addClass('b-400 mr-4')
            .append('IAB Content Taxonomy');
          sectionIABTaxonomy.append(desc);

          const ulIABTaxonomy = $('<ul/>')
            .addClass('lead-s b-300');
          sectionIABTaxonomy.append(ulIABTaxonomy);

          const sectionGARMTaxonomy = $('<section/>');
          sceneDescView.append(sectionGARMTaxonomy);

          desc = $('<p/>')
            .addClass('b-400 mr-4')
            .append('GARM Taxonomy');
          sectionGARMTaxonomy.append(desc);

          const ulGARMTaxonomy = $('<ul/>')
            .addClass('lead-s b-300');
          sectionGARMTaxonomy.append(ulGARMTaxonomy);

          const sectionSentiment = $('<section/>');
          sceneDescView.append(sectionSentiment);

          desc = $('<p/>')
            .addClass('b-400 mr-4')
            .append('Sentiment');
          sectionSentiment.append(desc);

          const ulSentiment = $('<ul/>')
            .addClass('lead-s b-300');
          sectionSentiment.append(ulSentiment);

          // brand and logos
          const sectionBrandAndLogos = $('<section/>');
          sceneDescView.append(sectionBrandAndLogos);

          desc = $('<p/>')
            .addClass('b-400 mr-4')
            .append('Brands and Logos');
          sectionBrandAndLogos.append(desc);

          const ulBrandAndLogos = $('<ul/>')
            .addClass('lead-s b-300');
          sectionBrandAndLogos.append(ulBrandAndLogos);

          // tags
          const sectionTags = $('<section/>');
          sceneDescView.append(sectionTags);

          desc = $('<p/>')
            .addClass('b-400 mr-4')
            .append('Top 5 relevant tags');
          sectionTags.append(desc);

          const ulTags = $('<ul/>')
            .addClass('lead-s b-300');
          sectionTags.append(ulTags);

          item.details.forEach((x) => {
            let li;
            if ((x.description || {}).text) {
              li = $('<li/>')
                .append(x.description.text);
              ulContextual.append(li);
            }
            if ((x.sentiment || {}).text) {
              li = $('<li/>')
                .append(`${x.sentiment.text} (${x.sentiment.score}%)`);
              ulSentiment.append(li);
            }
            if ((x.garmTaxonomy || {}).text) {
              li = $('<li/>')
                .append(`${x.garmTaxonomy.text} (${x.garmTaxonomy.score}%)`);
              ulGARMTaxonomy.append(li);
            }
            if ((x.iabTaxonomy || {}).text) {
              li = $('<li/>')
                .append(`${x.iabTaxonomy.id} - ${x.iabTaxonomy.text} (${x.iabTaxonomy.score}%)`);
              ulIABTaxonomy.append(li);
            }

            // brands and logos can be {} or []
            if ((x.brandAndLogos !== undefined)) {
              let array = x.brandAndLogos;

              if (!Array.isArray(array)) {
                array = [x.brandAndLogos];
              }

              array.forEach((_item) => {
                if (_item.text) {
                  li = $('<li/>')
                    .append(`${_item.text} (${_item.score}%)`);
                  ulBrandAndLogos.append(li);
                }
              });
            }

            // tags
            if ((x.tags || []).length > 0) {
              x.tags.forEach((_item) => {
                if (_item.text) {
                  li = $('<li/>')
                    .append(`${_item.text} (${_item.score}%)`);
                  ulTags.append(li);
                }
              });
            }
          });
        }

        // json view
        const sceneJsonView = $('<div/>')
          .addClass('col-6 m-0 p-0 bg-dark');
        sceneInfoContainer.append(sceneJsonView);

        const jsonData = $('<pre/>')
          .addClass('lead-xs text-white p-2')
          .append(JSON.stringify(item, null, 2));
        sceneJsonView.append(jsonData);
      });

      return imageContainer;
    });
    frameListContainer.append(imageContainers);

    return container;
  }

  onRender(tabContent) {
    tabContent.ready(async () => {
      console.log('SegmentTab.onReady');

      const bucket = this.media.getProxyBucket();
      const mapFile = this.data.output;
      if (/json$/.test(mapFile)) {
        this.mapData = await MapData.loadFromKey(
          bucket,
          mapFile
        );
      } else {
        this.mapData = await MapData.loadFromPrefix(
          bucket,
          this.data.vtt
        );
        this.mapData.files = [
          DEFAULT_OUTPUT,
        ];
      }
    });
  }
}
