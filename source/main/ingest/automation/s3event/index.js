/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  Environment,
  StateMessage,
  IotStatus,
  SNS,
} = require('core-lib');
const {
  FileType,
  S3Event,
} = require('./lib');

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}\ncontext = ${JSON.stringify(context, null, 2)}`);

  const responseData = new StateMessage({
    stateMachine: Environment.StateMachines.Ingest,
    operation: StateMessage.States.S3,
  });

  try {
    const s3e = new S3Event(event, context);

    if (s3e.type === FileType.Folder) {
      return undefined;
    }

    if (s3e.type === FileType.Unknown) {
      console.error(`onObjectCreated: file not supported, ${responseData.data.url}`);
      return undefined;
    }

    if (s3e.type === FileType.Media) {
      await s3e.onMediaFileArrival();
      responseData.setStarted();
    } else {
      await s3e.onJsonFileArrival();
      responseData.setCompleted();
    }
    responseData.uuid = s3e.uuid;

    return IotStatus.publish(responseData.toJSON());
  } catch (e) {
    console.error(e);
    responseData.setFailed(e);

    return Promise.all([
      SNS.send(`Ingest error: ${responseData.uuid}`, responseData.toJSON()),
      IotStatus.publish(responseData.toJSON()),
    ]);
  }
};
