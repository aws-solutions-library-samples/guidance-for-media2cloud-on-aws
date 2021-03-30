import BaseMedia from './baseMedia.js';

const DEFAULT_IMAGE = './images/podcast.png';

export default class PodcastMedia extends BaseMedia {
  get defaultImage() {
    return DEFAULT_IMAGE;
  }
}
