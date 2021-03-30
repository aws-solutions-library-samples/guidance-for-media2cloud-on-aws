import VideoPreview from './videoPreview.js';

export default class PodcastPreview extends VideoPreview {
  constructor(media) {
    super(media);
    this.$mediaType = 'audio/mp4';
  }

  async getProxyMedia() {
    return this.media.getProxyAudio();
  }
}
