// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const EXPIRE_IN_7DAYS = 7 * 24 * 60 * 60 * 1000;

const StoreDefinitions = {
  Stores: {
    Images: 'local-images',
    Settings: 'settings',
    Dataset: 'dataset',
    Faces: 'faces',
  },
  TimeToLive: {
    Name: 'ttl',
    Value: EXPIRE_IN_7DAYS,
  },
};
export default StoreDefinitions;
