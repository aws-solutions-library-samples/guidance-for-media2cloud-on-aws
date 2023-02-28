// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const NODE_IP = 'IP';
const NODE_TRANSIENT_ID = 'transientId';
const NODE_PERSISTENT_ID = 'persistentId';
const NODE_IDENTITY_GROUP = 'identityGroup';
const NODE_WEBSITE = 'website';
const NODE_WEBSITE_GROUP = 'websiteGroup';

const NODE_SIZE_BY_TYPE = {
  [NODE_IDENTITY_GROUP]: 45,
  [NODE_PERSISTENT_ID]: 30,
  [NODE_TRANSIENT_ID]: 20,
  [NODE_WEBSITE]: 10,
  [NODE_WEBSITE_GROUP]: 20,
  [NODE_IP]: 10,
};
const NODE_NAME_BY_TYPE = {
  [NODE_IDENTITY_GROUP]: 'Household',
  [NODE_PERSISTENT_ID]: 'User',
  [NODE_TRANSIENT_ID]: 'Device',
  [NODE_WEBSITE]: 'Website',
  [NODE_WEBSITE_GROUP]: 'IAB Category',
  [NODE_IP]: 'IP',
};

const NodeTypes = {
  NODE_SIZE_BY_TYPE,
  NODE_NAME_BY_TYPE,
  NODE_IDENTITY_GROUP,
  NODE_PERSISTENT_ID,
  NODE_TRANSIENT_ID,
  NODE_WEBSITE,
  NODE_WEBSITE_GROUP,
  NODE_IP,
};

export default NodeTypes;
