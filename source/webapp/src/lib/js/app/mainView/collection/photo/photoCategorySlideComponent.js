import MediaTypes from '../../../shared/media/mediaTypes.js';
import BaseCategorySlideComponent from '../base/baseCategorySlideComponent.js';

export default class PhotoCategorySlideComponent extends BaseCategorySlideComponent {
  constructor() {
    super(MediaTypes.Photo, {
      objectFit: 'cover',
    });
  }
}
