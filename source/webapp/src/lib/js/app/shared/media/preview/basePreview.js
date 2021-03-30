import AppUtils from '../../appUtils.js';

export default class BasePreview {
  constructor(media) {
    this.$ids = {
      container: `preview-${AppUtils.randomHexstring()}`,
    };
    this.$container = $('<div/>').addClass('p-0 m-0 w-100')
      .attr('id', this.$ids.container)
      .attr('data-media-type', media.type);
    this.$media = media;
    this.$preloaded = false;
  }

  get ids() {
    return this.$ids;
  }

  get container() {
    return this.$container;
  }

  get media() {
    return this.$media;
  }

  get preloaded() {
    return this.$preloaded;
  }

  set preloaded(val) {
    this.$preloaded = val;
  }

  getView() {
    return undefined;
  }

  async preload() {
    return this;
  }

  async load() {
    return this;
  }

  async unload() {
    this.preloaded = false;
    this.container.children().remove();
    return this;
  }

  async beforeViewHide() {
    return this;
  }

  async viewHidden() {
    return this;
  }

  getContainerDimensions() {
    return {
      width: this.container.outerWidth(),
      height: this.container.outerHeight(),
    };
  }
}
