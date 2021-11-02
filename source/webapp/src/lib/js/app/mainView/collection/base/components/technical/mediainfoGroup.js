// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import Localization from '../../../../../shared/localization.js';
import DescriptionList from '../../descriptionList.js';

export default class MediaInfoGroup {
  static createGroup(mediainfo) {
    if (!mediainfo) {
      return undefined;
    }
    const helper = new DescriptionList({
      dt: 'col-sm-3',
      dd: 'col-sm-9',
    });
    const group = helper.createDetailGroup(Localization.Messages.MediaInfoGroup);
    const tracks = (mediainfo.media || {}).track || [];
    tracks.forEach((track) => {
      const subGroup = helper.createDetailGroup(track.$.type, 1);
      const dl = helper.createTableList();
      const names = Object.keys(track).filter(x =>
        !(typeof track[x] === 'object' || Array.isArray(track[x]) || x === 'storageClass'));
      names.forEach(name =>
        helper.appendTableList(dl, track, name));
      subGroup.append(dl);
      group.append(subGroup);
    });
    return group;
  }
}
