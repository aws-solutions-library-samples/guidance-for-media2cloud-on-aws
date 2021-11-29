// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const {
  BacklogTableStream,
} = require('service-backlog-lib');

exports.handler = async (event, context) => {
  console.log(`\
  event = ${JSON.stringify(event, null, 2)};\n\
  context = ${JSON.stringify(context, null, 2)};\
  `);
  const stream = new BacklogTableStream(event, context);
  return stream.process();
};
