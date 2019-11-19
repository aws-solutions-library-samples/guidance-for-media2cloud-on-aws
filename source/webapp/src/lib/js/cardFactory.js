/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-plusplus */
/* eslint-disable no-alert */

/**
 * @class CardFactory
 * @description helper class to create either image, video, audio, document card
 */
class CardFactory {
  static createCard(data, parent) {
    let card;
    switch (data.type) {
      case 'video':
      case 'mxf':
        card = new VideoCard(data, parent);
        break;
      case 'image':
        card = new ImageCard(data, parent);
        break;
      case 'audio':
      default:
        console.error(`CardFactory.createCard: ${encodeURIComponent(data.type)} not supported`);
        break;
    }
    return card;
  }
}
