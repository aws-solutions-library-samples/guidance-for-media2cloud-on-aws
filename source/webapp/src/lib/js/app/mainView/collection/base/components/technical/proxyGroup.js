// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../../../../../shared/localization.js';
import DescriptionList from '../../descriptionList.js';

export default class ProxyGroup {
  static createGroup(proxies) {
    if (!proxies && !proxies.length) {
      return undefined;
    }
    const helper = new DescriptionList();
    const group = helper.createDetailGroup(Localization.Messages.ProxyGroup);
    proxies.forEach((proxy) => {
      const display = proxy.key.substring(proxy.key.lastIndexOf('/') + 1);
      const subGroup = helper.createDetailGroup(display, 1);
      subGroup.find('span.text-capitalize').removeClass('text-capitalize');
      const dl = helper.createTableList();
      const names = Object.keys(proxy).filter(x =>
        !(typeof proxy[x] === 'object' || Array.isArray(proxy[x]) || x === 'storageClass'));
      names.forEach(name =>
        helper.appendTableList(dl, proxy, name));
      subGroup.append(dl);
      group.append(subGroup);
    });
    return group;
  }
}
