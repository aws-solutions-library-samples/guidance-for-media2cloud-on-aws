// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import Localization from '../../../../../shared/localization.js';
import DescriptionList from '../../descriptionList.js';

export default class GeneralGroup {
  static createGroup(data) {
    if (!data) {
      return undefined;
    }
    const helper = new DescriptionList();
    const group = helper.createDetailGroup(Localization.Messages.GeneralGroup);
    const dl = helper.createTableList();
    const names = Object.keys(data).filter(x =>
      !(typeof data[x] === 'object' || Array.isArray(data[x]) || x === 'storageClass'));
    names.forEach(name =>
      helper.appendTableList(dl, data, name));
    return group.append(dl);
  }
}
