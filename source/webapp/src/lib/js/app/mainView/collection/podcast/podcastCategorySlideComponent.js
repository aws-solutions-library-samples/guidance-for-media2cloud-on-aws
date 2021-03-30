import MediaTypes from '../../../shared/media/mediaTypes.js';
import BaseCategorySlideComponent from '../base/baseCategorySlideComponent.js';

export default class PodcastCategorySlideComponent extends BaseCategorySlideComponent {
  constructor() {
    super(MediaTypes.Podcast, {
      objectFit: 'cover',
    });
  }
}
