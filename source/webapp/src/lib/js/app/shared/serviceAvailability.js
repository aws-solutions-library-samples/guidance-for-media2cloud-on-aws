// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import ServiceNames from './serviceNames.js';
import {
  GetSettingStore,
} from './localCache/index.js';

const REGION = SolutionManifest.Region;

const SERVICE_AVAILABILITY = 'service-availability';
const EXPIRATION_IN_DAYS = 7 * 24 * 60 * 60 * 1000;
const ALL_SERVICES = Object.values(ServiceNames);
const WHILTELIST_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ap-south-1',
  'ap-northeast-1', /* Textract not in Tokyo region */
  'ap-northeast-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ca-central-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
];
const HTTP_TIMEOUT = 1000; // 1500;

/* singleton implementation */
let _singleton;

class ServiceAvailability {
  constructor() {
    _singleton = this;
  }

  /**
   * @async
   * @function detectServices
   * @description detect AIML service availability of the region
   */
  async detectServices(
    region = REGION
  ) {
    const id = `${SERVICE_AVAILABILITY}-${region}`;

    const store = GetSettingStore();
    let services = await store.getItem(id);

    if (!services) {
      const responses = await Promise.all(ALL_SERVICES
        .map((service) =>
          this.probe(service, region)
            .then((val) => ({
              [service]: val,
            })).catch(() => ({
              [service]: false,
            }))));

      services = responses.reduce((a0, c0) => ({
        ...a0,
        ...c0,
      }), {});

      await store.putItem(
        id,
        services,
        EXPIRATION_IN_DAYS
      ).catch(() =>
        undefined);
    }

    return services;
  }

  /**
   * @async
   * @function probe
   * @description simple http request to check if service is available in this region.
   */
  async probe(
    service,
    region
  ) {
    if (WHILTELIST_REGIONS.includes(region)) {
      return true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() =>
      controller.abort(), HTTP_TIMEOUT);

    const url = `https://${service}.${region}.amazonaws.com`;
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    }).then(() =>
      true)
      .catch(() =>
        false);

    clearTimeout(timeoutId);

    return response;
  }
}

const GetServiceAvailability = () => {
  if (_singleton === undefined) {
    const notused_ = new ServiceAvailability();
  }

  return _singleton;
};

export {
  ServiceAvailability,
  GetServiceAvailability,
};
