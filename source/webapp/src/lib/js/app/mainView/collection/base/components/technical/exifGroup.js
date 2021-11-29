// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../../../../../shared/localization.js';
import SettingStore from '../../../../../shared/localCache/settingStore.js';
import GoogleMap from '../../../../../shared/googleMap.js';
import DescriptionList from '../../descriptionList.js';

const OPT_MAPAPIKEY = 'mapApiKey';
const DATA_INIT = 'data-initialized';
const DATA_LAT = 'data-lat';
const DATA_LNG = 'data-lng';
const DATA_ROLE = 'data-role';
const ROLE_MAP = 'map';
const ATTRB_BASIC = [
  'Make',
  'Model',
  'ImageSize',
  'ImageHeight',
  'ImageWidth',
  'Orientation',
  'ColorSpace',
  'XResolution',
  'YResolution',
  'CreateDate',
];

export default class EXIFGroup {
  static createGroup(exif) {
    if (!exif) {
      return undefined;
    }
    const helper = new DescriptionList({
      dt: 'col-sm-3',
      dd: 'col-sm-9',
    });
    const group = helper.createDetailGroup(Localization.Messages.EXIFGroup);

    const basicAttrs = {};
    const gpsAttrs = {};
    const othersAttrs = {};
    Object.keys(exif).forEach((key) => {
      if (ATTRB_BASIC.indexOf(key) >= 0) {
        basicAttrs[key] = exif[key];
      } else if (key.indexOf('GPS') === 0) {
        gpsAttrs[key] = exif[key];
      } else {
        othersAttrs[key] = exif[key];
      }
    });

    let names = Object.keys(basicAttrs);
    if (names.length) {
      const basicGroup = helper.createDetailGroup(Localization.Messages.BasicGroup, 1);
      const dl = helper.createTableList();
      names.forEach(name =>
        helper.appendTableList(dl, basicAttrs, name));
      basicGroup.append(dl);
      group.append(basicGroup);
    }

    names = Object.keys(gpsAttrs);
    if (names.length) {
      const gpsGroup = helper.createDetailGroup(Localization.Messages.GPSGroup, 1);
      const dl = helper.createTableList();
      names.forEach(name =>
        helper.appendTableList(dl, gpsAttrs, name));
      gpsGroup.append(dl);
      if (gpsAttrs.GPSLongitude && gpsAttrs.GPSLatitude) {
        const map = EXIFGroup.createMap(gpsAttrs.GPSLongitude, gpsAttrs.GPSLatitude);
        gpsGroup.prepend(map);
      }
      group.append(gpsGroup);
    }

    names = Object.keys(othersAttrs);
    if (names.length) {
      const othersGroup = helper.createDetailGroup(Localization.Messages.OthersGroup, 1);
      const dl = helper.createTableList();
      names.forEach(name =>
        helper.appendTableList(dl, othersAttrs, name));
      othersGroup.append(dl);
      group.append(othersGroup);
    }
    return group;
  }

  static createMap(longitude, latitude) {
    const map = $('<div/>').addClass('collapse ml-4 mb-2 h-400')
      .attr(DATA_ROLE, ROLE_MAP)
      .attr(DATA_INIT, false)
      .attr(DATA_LAT, latitude)
      .attr(DATA_LNG, longitude)
      .css('width', '90%');
    const input = $('<input/>').attr('type', 'checkbox');
    input.off('click').on('click', async (event) =>
      EXIFGroup.showMap(map, input.prop('checked')));

    const label = $('<label/>').addClass('xs-switch')
      .append(input)
      .append($('<span/>').addClass('xs-slider round'));
    const toggle = $('<div/>').addClass('form-group ml-4 mb-2')
      .append($('<div/>').addClass('input-group')
        .append(label)
        .append($('<span/>').addClass('lead-sm ml-2')
          .html(Localization.Messages.ShowMap)));

    return $('<div/>').append(toggle)
      .append(map);
  }

  static async showMap(map, enabled) {
    if (!enabled) {
      return map.addClass('collapse');
    }
    map.removeClass('collapse');
    if (map.data('initialized') === true) {
      return map;
    }
    const lat = map.data('lat');
    const lng = map.data('lng');
    const apiKey = await (SettingStore.getSingleton()).getItem(OPT_MAPAPIKEY);
    const gMap = await GoogleMap.getSingleton(apiKey);
    if (gMap) {
      gMap.render(map[0], lat, lng);
      map.prop(DATA_INIT, true);
    }
    return map;
  }
}
