// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
