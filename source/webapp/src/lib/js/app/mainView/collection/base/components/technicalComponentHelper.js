// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import GeneralGroup from './technical/generalGroup.js';
import ProxyGroup from './technical/proxyGroup.js';
import MediaInfoGroup from './technical/mediainfoGroup.js';
import EXIFGroup from './technical/exifGroup.js';
import PDFGroup from './technical/pdfGroup.js';

export default class TechnicalComponentHelper {
  static createContents(media) {
    if (!media) {
      return undefined;
    }
    const container = $('<div/>').addClass('col-12 p-0 m-4');
    const title = $('<h5/>').addClass('lead my-2 text-left')
      .html(`${media.basename} (${media.readableDuration || media.readableFileSize})`);
    container.append($('<div/>').addClass('col-12 p-0 m-0')
      .append(title));
    const generalGroup = GeneralGroup.createGroup(media.data);
    if (generalGroup) {
      container.append($('<div/>').addClass('col-12 p-0 my-2 mx-0')
        .append(generalGroup));
    }
    const proxyGroup = ProxyGroup.createGroup(media.data.proxies);
    if (proxyGroup) {
      container.append($('<div/>').addClass('col-12 p-0 my-2 mx-0')
        .append(proxyGroup));
    }
    const mediainfoGroup = MediaInfoGroup.createGroup(media.data.mediainfo);
    if (mediainfoGroup) {
      container.append($('<div/>').addClass('col-12 p-0 my-2 mx-0')
        .append(mediainfoGroup));
    }
    const exifGroup = EXIFGroup.createGroup(media.data.imageinfo);
    if (exifGroup) {
      container.append($('<div/>').addClass('col-12 p-0 my-2 mx-0')
        .append(exifGroup));
    }
    const pdfGroup = PDFGroup.createGroup(media.data.docinfo);
    if (pdfGroup) {
      container.append($('<div/>').addClass('col-12 p-0 my-2 mx-0')
        .append(pdfGroup));
    }
    return container;
  }
}
