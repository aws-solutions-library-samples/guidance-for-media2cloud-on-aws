import Localization from '../../shared/localization.js';
import PhotoCategorySlideComponent from './photo/photoCategorySlideComponent.js';
import PhotoPreviewSlideComponent from './photo/photoPreviewSlideComponent.js';
import BaseMediaTab from './base/baseMediaTab.js';

export default class PhotoTab extends BaseMediaTab {
  constructor(defaultTab = false, plugins) {
    super(defaultTab, Localization.Messages.PhotoTab, plugins);
    this.$categorySlideComponent = new PhotoCategorySlideComponent();
    this.$previewSlideComponent = new PhotoPreviewSlideComponent();
  }
}
