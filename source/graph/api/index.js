// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  MethodNotAllowedException,
} = require('./lib/shared/exceptions');
const GraphOp = require('./lib/graphOp');

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);
  let processor;
  try {
    const op = (event.queryStringParameters || {}).op;
    if (GraphOp.opSupported(op)) {
      processor = new GraphOp(event, context);
    }

    if (processor) {
      if (event.httpMethod === 'OPTIONS') {
        return processor.onOPTIONS();
      }
      if (event.httpMethod === 'GET') {
        return processor.onGET();
      }
    }
    throw new MethodNotAllowedException();
  } catch (e) {
    if (processor) {
      return processor.onError(e);
    }
    console.log('CRITICAL', 'Exception not handled', e.errorCode || e.code, e.message);
    throw e;
  }
};
