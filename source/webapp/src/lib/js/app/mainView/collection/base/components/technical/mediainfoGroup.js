// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Localization from '../../../../../shared/localization.js';
import DescriptionList from '../../descriptionList.js';

const {
  Messages: {
    MediaInfoGroup: GROUP_TITLE,
  },
} = Localization;

export default class MediaInfoGroup {
  static createGroup(mediainfo) {
    if (!mediainfo) {
      return undefined;
    }

    const helper = new DescriptionList({
      dt: 'col-sm-3',
      dd: 'col-sm-9',
    });

    const group = helper.createDetailGroup(GROUP_TITLE);
    const tracks = (mediainfo.media || {}).track || [];

    tracks.forEach((track) => {
      const subGroup = helper.createDetailGroup(track.$.type, 1);
      const dl = helper.createTableList();

      Object.keys(track).forEach((name) => {
        if (
          (typeof track[name] === 'object') ||
          (Array.isArray(track[name])) ||
          (name === 'storageClass')
        ) {
          return;
        }

        // converting duration to millisecond format
        const _track = track;
        if (name === 'duration' || name === 'sourceDuration') {
          _track[name] *= 1000;
        }

        helper.appendTableList(dl, _track, name);
      });

      subGroup.append(dl);
      group.append(subGroup);
    });
    return group;
  }
}
