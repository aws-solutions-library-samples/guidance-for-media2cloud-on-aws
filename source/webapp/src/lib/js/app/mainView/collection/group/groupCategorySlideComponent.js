import MediaTypes from '../../../shared/media/mediaTypes.js';
import BaseCategorySlideComponent from '../base/baseCategorySlideComponent.js';

export default class GroupCategorySlideComponent extends BaseCategorySlideComponent {
  constructor() {
    super(MediaTypes.Group, {
      objectFit: 'cover',
    });
  }
}
