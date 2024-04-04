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

    const container = $('<div/>')
      .addClass('col-12 p-0 m-4');

    const titleContainer = $('<div/>')
      .addClass('col-12 p-0 m-0');
    container.append(titleContainer);

    const title = $('<h5/>')
      .addClass('lead my-2 text-left')
      .html(`${media.basename} (${media.readableDuration || media.readableFileSize})`);
    titleContainer.append(title);

    /* general group */
    if (media.data) {
      const generalGroupContainer = $('<div/>')
        .addClass('col-12 p-0 my-2 mx-0');
      container.append(generalGroupContainer);

      const generalGroup = GeneralGroup.createGroup(media.data);
      generalGroupContainer.append(generalGroup);
    }

    /* proxy group */
    if (media.data.proxies
      && media.data.proxies.length > 0) {
      const proxyGroupContainer = $('<div/>')
        .addClass('col-12 p-0 my-2 mx-0');
      container.append(proxyGroupContainer);

      const proxyGroup = ProxyGroup.createGroup(media.data.proxies);
      proxyGroupContainer.append(proxyGroup);
    }

    /* mediainfo */
    if (media.data.mediainfo) {
      const mediainfoGroupContainer = $('<div/>')
        .addClass('col-12 p-0 my-2 mx-0');
      container.append(mediainfoGroupContainer);

      mediainfoGroupContainer.ready(async () => {
        const mediainfo = await media.loadMediaInfo();
        const mediainfoGroup = MediaInfoGroup.createGroup(mediainfo);
        mediainfoGroupContainer.append(mediainfoGroup);
      });
    }

    /* EXIF */
    if (media.data.imageinfo) {
      const exifGroupContainer = $('<div/>')
        .addClass('col-12 p-0 my-2 mx-0');
      container.append(exifGroupContainer);

      exifGroupContainer.ready(async () => {
        const exif = await media.loadImageInfo();
        const exifGroup = EXIFGroup.createGroup(exif);
        exifGroupContainer.append(exifGroup);
      });
    }

    /* PDF */
    if (media.data.docinfo) {
      const pdfGroupContainer = $('<div/>')
        .addClass('col-12 p-0 my-2 mx-0');
      container.append(pdfGroupContainer);

      const pdfInfo = media.data.docinfo;
      const pdfGroup = PDFGroup.createGroup(pdfInfo);
      pdfGroupContainer.append(pdfGroup);
    }

    return container;
  }
}
