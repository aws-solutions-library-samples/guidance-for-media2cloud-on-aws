import MediaTypes from '../../../shared/media/mediaTypes.js';
import BaseCategorySlideComponent from '../base/baseCategorySlideComponent.js';

export default class VideoCategorySlideComponent extends BaseCategorySlideComponent {
  constructor() {
    super(MediaTypes.Video, {
      objectFit: 'cover',
    });
  }
}
