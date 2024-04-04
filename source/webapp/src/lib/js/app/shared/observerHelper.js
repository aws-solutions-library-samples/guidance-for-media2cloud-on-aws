// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import Localization from './localization.js';

const {
  Messages: {
    SolutionName,
  },
} = Localization;

export default class ObserverHelper {
  static setHashOnVisible(
    element,
    hashtag,
    threshold = [0.1]
  ) {
    if (!element || !hashtag) {
      return undefined;
    }

    const options = {
      root: null,
      rootMargin: '0px',
      threshold,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio >= options.threshold[0]) {
          console.log(
            'setHashOnVisible',
            'entry.intersectionRatio',
            entry.intersectionRatio,
            hashtag
          );

          const hash = document.location.hash.slice(1);
          if (hash === hashtag) {
            return;
          }

          const url = new URL(document.location);
          url.hash = hashtag;
          history.pushState(
            undefined,
            undefined,
            url
          );

          const titles = hashtag.split('/');
          titles.unshift(SolutionName);
          document.title = titles.join(' > ');
        }
      });
    }, options);

    observer.observe(element[0]);

    return observer;
  }
}
