/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
import SolutionManifest from '/solution-manifest.js';
import ServiceNames from './serviceNames.js';
import SettingStore from './localCache/settingStore.js';

const SERVICE_AVAILABILITY = 'service-availability';
const EXPIRATION_IN_DAYS = 7 * 24 * 60 * 60 * 1000;
const ALL_SERVICES = Object.values(ServiceNames);

export default class ServiceAvailability {
  /**
   * @static
   * @function createInstance
   * @description ServiceAvailability singleton
   */
  static createInstance() {
    return ServiceAvailability.getSingleton();
  }

  static getSingleton() {
    if (!(window.AWSomeNamespace || {}).ServiceAvailabilitySingleton) {
      window.AWSomeNamespace = {
        ...window.AWSomeNamespace,
        ServiceAvailabilitySingleton: new ServiceAvailability(),
      };
    }
    return window.AWSomeNamespace.ServiceAvailabilitySingleton;
  }

  /**
   * @async
   * @function detectServices
   * @description detect AIML service availability of the region
   */
  async detectServices(region = SolutionManifest.Region) {
    const id = `${SERVICE_AVAILABILITY}-${region}`;
    const store = SettingStore.getSingleton();
    let services = await store.getItem(id);
    if (!services) {
      const responses = await Promise.all(ALL_SERVICES.map(x =>
        this.probe(x, region).then((val) => ({
          [x]: val,
        })).catch(() => ({
          [x]: false,
        }))));
      services = responses.reduce((a0, c0) => ({
        ...a0,
        ...c0,
      }), {});
      await store.putItem(id, services, EXPIRATION_IN_DAYS)
        .catch(e => console.error(e));
    }
    return services;
  }

  /**
   * @async
   * @function probe
   * @description simple http request to check if service is available in this region.
   */
  async probe(service, region) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('HEAD', `https://${service}.${region}.amazonaws.com`, true);
      /* if is onerror, it means the service is unavailable in this region. */
      request.onerror = () => resolve(false);
      request.onabort = e => reject(e);
      /* if the request goes through, the service is available regardless of the status */
      request.onreadystatechange = () => {
        if (request.readyState === XMLHttpRequest.DONE && request.status !== 0) {
          resolve(true);
        }
      };
      return request.send();
    });
  }
}
