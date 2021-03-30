import Localization from '../../shared/localization.js';
import PodcastCategorySlideComponent from './podcast/podcastCategorySlideComponent.js';
import PodcastPreviewSlideComponent from './podcast/podcastPreviewSlideComponent.js';
import BaseMediaTab from './base/baseMediaTab.js';

export default class PodcastTab extends BaseMediaTab {
  constructor(defaultTab = false, plugins) {
    super(defaultTab, Localization.Messages.PodcastTab, plugins);
    this.$categorySlideComponent = new PodcastCategorySlideComponent();
    this.$previewSlideComponent = new PodcastPreviewSlideComponent();
  }
}
