/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/**
 * @description definitions of transcode output types
 * * 'prod' - create production output
 * * 'aiml' - create proxies for AIML processing (include audio only output)
 * * 'proxy' - create proxies for web and frame capture outputs
 * * 'all' - create production, proxy, and aiml proxies
 * * 'none' - don't create any proxy but run mediainfo only
 * Usage:
 *   concat type(s) of output to process, comma separator
 *   ie., 'prod' to create just production output
 *   ie., 'proxy,aiml' to create both proxy and aiml outputs
 *   ie., 'all' shorthand to create all outputs
 *   ie., 'none' don't create any output
 */
module.exports = {
  Template: {
    Prefix: 'media2cloud/transcode/template/',
  },
  Types: {
    Prod: 'prod',
    Proxy: 'proxy',
    Aiml: 'aiml',
    All: 'all',
    None: 'none',
  },
};
