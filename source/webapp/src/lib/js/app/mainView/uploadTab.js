// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../shared/localization.js';
import AppUtils from '../shared/appUtils.js';
import mxAlert from '../mixins/mxAlert.js';
import DropzoneSlideComponent from './upload/dropzoneSlideComponent.js';
import AttributeSlideComponent from './upload/attributeSlideComonent.js';
import AnalysisSlideComponent from './upload/analysisSlideComponent.js';
import FinalizeSlideComponent from './upload/finalizeSlideComponent.js';
import BaseTab from '../shared/baseTab.js';

export default class UploadTab extends mxAlert(BaseTab) {
  constructor(defaultTab = false) {
    super(Localization.Messages.UploadTab, {
      selected: defaultTab,
    });
    this.$ids = {
      ...super.ids,
      carousel: {
        container: `upload-${AppUtils.randomHexstring()}`,
        slides: {
          dropzone: `upload-slide-${AppUtils.randomHexstring()}`,
          attributes: `upload-slide-${AppUtils.randomHexstring()}`,
          analysis: `upload-slide-${AppUtils.randomHexstring()}`,
          finalize: `upload-slide-${AppUtils.randomHexstring()}`,
        },
      },
    };
    this.$dropzoneComponent = new DropzoneSlideComponent();
    this.$attributeComponent = new AttributeSlideComponent();
    this.$analysisComponent = new AnalysisSlideComponent();
    this.$finalizeComponent = new FinalizeSlideComponent();
  }

  get ids() {
    return this.$ids;
  }

  get dropzoneComponent() {
    return this.$dropzoneComponent;
  }

  get attributeComponent() {
    return this.$attributeComponent;
  }

  get analysisComponent() {
    return this.$analysisComponent;
  }

  get finalizeComponent() {
    return this.$finalizeComponent;
  }

  async show() {
    if (!this.initialized) {
      const row = $('<div/>').addClass('row no-gutters')
        .append(await this.createCarousel());
      this.tabContent.append(row);
    }
    return super.show();
  }

  async hide() {
    await this.clearComponentData();
    return super.hide();
  }

  async createCarousel() {
    const slides = [
      await this.createDropzoneSlide(),
      await this.createAttributeSlide(),
      await this.createAnalysisSlide(),
      await this.createFinalizeSlide(),
    ];
    const inner = $('<div/>').addClass('carousel-inner');
    for (let i = 0; i < slides.length; i++) {
      const [
        id,
        el,
      ] = slides[i];
      const classes = (i === 0) ? 'carousel-item active' : 'carousel-item';
      inner.append($('<div/>').addClass(classes)
        .attr('id', id)
        .append(el));
    }

    const carousel = $('<div/>').addClass('carousel slide')
      .attr('data-ride', false)
      .attr('data-interval', false)
      .attr('id', this.ids.carousel.container)
      .append(inner);

    /*
    carousel.on('slide.bs.carousel', async (event) => {
      const id = $(event.relatedTarget).prop('id');
      if (id === this.analysisComponent.slideId) {
        this.analysisComponent.reloadAnalysisSettings();
      }
      return true;
    });
    */

    return $('<div/>').addClass('col-9 col-sm-9 col-md-9 mx-auto mt-4')
      .append(carousel);
  }

  async createDropzoneSlide() {
    const slide = await this.dropzoneComponent.createSlide();
    slide.on(DropzoneSlideComponent.Controls.StartOver, async (event) => {
      await this.clearComponentData();
      return true;
    });

    slide.on(DropzoneSlideComponent.Controls.QuickUpload, async (event) => {
      await this.dropzoneComponent.saveData();
      await this.slideToFinalize();
      return true;
    });

    slide.on(DropzoneSlideComponent.Controls.Next, async (event) => {
      await this.dropzoneComponent.saveData();
      this.slideTo(this.attributeComponent.slideId);
      return true;
    });

    return [
      this.dropzoneComponent.slideId,
      slide,
    ];
  }

  async createAttributeSlide() {
    const slide = await this.attributeComponent.createSlide();
    slide.on(AttributeSlideComponent.Controls.Back, async (event) => {
      this.slideTo(this.dropzoneComponent.slideId);
      return true;
    });

    slide.on(AttributeSlideComponent.Controls.QuickUpload, async (event) => {
      await this.slideToFinalize();
      return true;
    });

    slide.on(AttributeSlideComponent.Controls.Next, async (event) => {
      this.slideTo(this.analysisComponent.slideId);
      return true;
    });

    return [
      this.attributeComponent.slideId,
      slide,
    ];
  }

  async createAnalysisSlide() {
    const slide = await this.analysisComponent.createSlide();
    slide.on(AnalysisSlideComponent.Controls.Back, async (event) => {
      this.slideTo(this.attributeComponent.slideId);
      return true;
    });

    slide.on(AnalysisSlideComponent.Controls.Next, async (event) => {
      await this.slideToFinalize();
      return true;
    });

    return [
      this.analysisComponent.slideId,
      slide,
    ];
  }

  async createFinalizeSlide() {
    const slide = await this.finalizeComponent.createSlide();
    slide.on(FinalizeSlideComponent.Controls.Cancel, async (event) => {
      await this.clearComponentData();
      this.slideTo(this.dropzoneComponent.slideId);
      return true;
    });

    slide.on(FinalizeSlideComponent.Controls.Done, async (event) => {
      await this.clearComponentData();
      this.slideTo(this.dropzoneComponent.slideId);
      return true;
    });

    return [
      this.finalizeComponent.slideId,
      slide,
    ];
  }

  async slideToFinalize() {
    const dropzoneData = await this.dropzoneComponent.getData();
    const attributeData = await this.attributeComponent.getData();
    const analysisData = await this.analysisComponent.getData();
    dropzoneData.forEach((x) => {
      x.setAttributes(attributeData);
      x.setAnalysis(analysisData);
    });
    this.finalizeComponent.addList(dropzoneData);
    return this.slideTo(this.finalizeComponent.slideId);
  }

  slideTo(id) {
    const carousel = this.tabContent.find(`#${this.ids.carousel.container}`).first();
    const idx = carousel.find(`#${id}`).index();
    carousel.carousel(idx);
  }

  async showAlert(message, duration) {
    return super.showMessage(this.tabContent, 'danger', Localization.Alerts.Oops, message, duration);
  }

  async clearComponentData() {
    return Promise.all([
      this.dropzoneComponent.clearData(),
      this.attributeComponent.clearData(),
      this.analysisComponent.clearData(),
      this.finalizeComponent.clearData(),
    ]);
  }
}
