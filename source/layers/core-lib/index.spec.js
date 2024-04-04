// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  beforeAll,
  describe,
  expect,
} = require('@jest/globals');
const {
  S3Client,
  HeadObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectTaggingCommand,
  PutObjectTaggingCommand,
  RestoreObjectCommand,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');
const {
  SNSClient,
  PublishCommand,
} = require('@aws-sdk/client-sns');
const {
  IoTDataPlaneClient,
  PublishCommand: IotPublishCommand,
} = require('@aws-sdk/client-iot-data-plane');
const {
  mockClient,
} = require('aws-sdk-client-mock');
const StringBuilder = require('node-stringbuilder');
const {
  Blob,
} = require('node:buffer');
const {
  Duplex,
  Readable,
} = require('node:stream');
const {
  Environment,
  StateData,
  DB,
  CommonUtils,
  IotStatus,
  SNS,
  TimelineQ,
  WebVttCue,
  WebVttTrack,
  ServiceAvailability,
  ServiceToken,
  EDLComposer,
  FrameCaptureMode,
  FrameCaptureModeHelper,
  MimeTypeHelper,
  ValidationHelper,
} = require('core-lib');
const {
  marshall,
} = require('@aws-sdk/util-dynamodb');

const stateMachine = 'test-state-machine';
const accountId = '12345';
const context = {
  invokedFunctionArn: `arn:partition:service:region:${accountId}:resource-id`,
  getRemainingTimeInMillis: 1000,
};

const testEvent = {
  uuid: 'b72fc9c0-58eb-83ef-42f2-dfceb342798f',
  stateMachine,
  operation: 'collect-transcribe-results',
  status: 'NO_DATA',
  progress: 100,
  input: {
    testInputKey: 'testInputVal',
  },
  data: {
    testDataKey: 'testDataVal',
  },
};

const ddbQueryResponse = {
  Count: 1,
  Items: [
    {
      pkey: 'primarykey',
      skey: 'sortkey',
      att1: 'value1',
    },
  ],
  LastEvaluatedKey: '',
};

const ddbScanIndexData = {
  Name: 'testGSIndex',
  Key: 'pkey',
  Value: 'primarykey',
};

const edlData = {
  title: 'Test Title',
  events: [
    {
      startTime: '1',
      endTime: '10',
      reelName: 'testReel1',
      clipName: 'testClip1',
    },
  ],
};

const iotStatusMessage = {
  messageKey: 'messageVal',
};

const item = {
  name: 'itemName',
  confidence: 2,
  begin: 1,
  end: 5,
  boundingBox: {
    Width: 10,
    Height: 9,
    Left: 0,
    Top: 11,
  },
  parentName: 'itemParent',
  Timestamp: '111',
};
const celebrity = {
  Name: 'celebrityName',
  Confidence: 2,
  BoundingBox: {
    Width: 12,
    Height: 11,
    Left: 2,
    Top: 13,
  },
};
const label = {
  Name: 'labelName',
  Parents: [
    {
      Name: 'parent1',
    }, {
      Name: 'parent2',
    },
  ],
  Confidence: 3,
  Instances: [
    {
      BoundingBox: {
        Width: 4,
        Height: 13,
        Left: 4,
        Top: 15,
      },
    },
  ],
};
const faceMatch = {
  Similarity: 0,
};
const moderation = {
  ParentName: '',
  Name: '',
  Confidence: 8,
};
const person = {
  Index: 7,
  Confidence: 4,
  BoundingBox: {
    Width: 6,
    Height: 15,
    Left: 6,
    Top: 17,
  },
};
const face = {
  ExternalImageId: '',
  Gender: {
    Value: '',
  },
  AgeRange: {
    Low: 0,
    High: 100,
  },
  Confidence: 4,
  Emotions: [],
  BoundingBox: {
    Width: 8,
    Height: 17,
    Left: 8,
    Top: 19,
  },
};
person.Face = face;
celebrity.Face = face;
faceMatch.Face = face;
const customLabel = {
  Name: '',
  Confidence: 3,
  Geometry: {
    BoundingBox: {
      Width: 10,
      Height: 19,
      Left: 10,
      Top: 21,
    },
  },
};
const textDetection = {
  Type: '',
  DetectedText: '',
  Confidence: 3,
  Geometry: {
    BoundingBox: {
      Width: 12,
      Height: 21,
      Left: 12,
      Top: 23,
    },
  },
};

const celebItem = { ...item };
celebItem.Celebrity = celebrity;

const moderationItem = { ...item };
moderationItem.ModerationLabel = moderation;

const labelItem = { ...item };
labelItem.Label = label;

const faceMatchItem = { ...item };
faceMatchItem.FaceMatches = [faceMatch];
faceMatchItem.Person = person;

const customLabelItem = { ...item };
customLabelItem.CustomLabel = customLabel;

const personItem = { ...item };
personItem.Person = person;

const faceItem = { ...item };
faceItem.Face = face;

const textItem = { ...item };
textItem.TextDetection = textDetection;

const cue1 = {
  begin: '0',
  end: '3445',
  text: 'cue 1 text',
  position: 'center',
};
const cue2 = {
  begin: '5555',
  end: '77777',
  text: 'cue 2 text',
  position: 'center',
};
const cue3 = {
  begin: '88888',
  end: '999999',
  text: 'cue 3 text',
  position: 'center',
};

const ddbMock = mockClient(DynamoDBClient);
const snsMock = mockClient(SNSClient);
const iotMock = mockClient(IoTDataPlaneClient);
const s3Mock = mockClient(S3Client);

describe('Test StateData, StateMessage, States, Statuses', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
  });

  test('Test StateData and StateMessage constructors', () => {
    const stateObj = new StateData(stateMachine, testEvent, context);
    // StateMessage
    expect(stateObj.uuid).toBe(testEvent.uuid);
    expect(stateObj.stateMachine).toBe(stateMachine);
    expect(stateObj.operation).toBe(testEvent.operation);
    expect(stateObj.status).toBe(testEvent.status);
    expect(stateObj.progress).toBe(testEvent.progress);

    // StateData
    expect(stateObj.input).toStrictEqual(testEvent.input);
    expect(stateObj.data).toStrictEqual(testEvent.data);
    expect(stateObj.event).toStrictEqual(testEvent);
    expect(stateObj.accountId).toBe(accountId);
    expect(stateObj.getRemainingTime()).toBe(StateData.Constants.LambdaTimeoutThreshold * 2);
  });

  test('Test StateData get/set', () => {
    const testInput = 'test input val';
    const testOutput = 'test output val';
    const stateObj = new StateData(stateMachine, testEvent, context);

    stateObj.input = testInput;
    expect(stateObj.input).toBe(testInput);

    stateObj.output = testOutput;
    expect(stateObj.output).toBe(testOutput);

    stateObj.setData('transcribe', {
      startTime: 5,
    });
    expect(stateObj.data.transcribe.startTime).toBe(5);

    stateObj.resetData('transcribe');
    expect(stateObj.data).toStrictEqual(testEvent.data);

    stateObj.resetAllData();
    expect(stateObj.data).toBe(undefined);

    const response = stateObj.responseData;
    expect(response.stateMachine).toBe(stateMachine);
  });

  test('Test StateMessage get/set', () => {
    const testUuid = '12345';
    const testStateMachine = 'test new state machine';
    const testOperation = 'test operation';
    const testStatus = 'test status';
    const testErrorMessage = 'test error message';
    const testFailed = 'test failed';
    const stateObj = new StateData(stateMachine, testEvent, context);

    stateObj.uuid = testUuid;
    expect(stateObj.uuid).toBe(testUuid);

    stateObj.stateMachine = testStateMachine;
    expect(stateObj.stateMachine).toBe(testStateMachine);

    stateObj.operation = testOperation;
    expect(stateObj.operation).toBe(testOperation);

    stateObj.status = testStatus;
    expect(stateObj.status).toBe(testStatus);

    stateObj.progress = 7;
    expect(stateObj.progress).toBe(7);

    stateObj.errorMessage = testErrorMessage;
    expect(stateObj.errorMessage).toBe(testErrorMessage);

    stateObj.setStarted();
    expect(stateObj.status).toBe(StateData.Statuses.Started);
    expect(stateObj.progress).toBe(0);

    stateObj.setCompleted();
    expect(stateObj.status).toBe(StateData.Statuses.Completed);
    expect(stateObj.progress).toBe(100);

    stateObj.setProgress(12);
    expect(stateObj.status).toBe(StateData.Statuses.InProgress);
    expect(stateObj.progress).toBe(12);

    stateObj.setFailed(testFailed);
    expect(stateObj.status).toBe(StateData.Statuses.Error);
    expect(stateObj.errorMessage).toBe(testFailed);

    stateObj.setNoData();
    expect(stateObj.status).toBe(StateData.Statuses.NoData);
    expect(stateObj.progress).toBe(100);
  });
});

describe('Test DB', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    ddbMock.reset();
  });

  afterEach(() => {
  });

  test('Test scanIndex', async () => {
    const testScanIndex = {
      ...ddbQueryResponse,
      Items: ddbQueryResponse.Items
        .map((x) =>
          marshall(x)),
    };

    ddbMock.on(QueryCommand)
      .resolves(
        testScanIndex
      );

    const db = new DB({
      Table: 'testTable',
      PartitionKey: 'pkey',
      SortKey: 'skey',
    });

    let response;
    response = await db.scanIndex(ddbScanIndexData);
    expect(response.Items).toStrictEqual(ddbQueryResponse.Items);

    response = await db.scanIndex({ Name: 'test' })
      .catch((error) =>
        error);

    expect(response).toBeInstanceOf(Error);
    expect(response.message.length).toBeGreaterThan(0);
  });

  test('Test Scan', async () => {
    const testScan = {
      ...ddbQueryResponse,
      Items: ddbQueryResponse.Items
        .map((x) =>
          marshall(x)),
    };

    ddbMock.on(ScanCommand)
      .resolves(testScan);

    const db = new DB({
      Table: 'testTable',
      PartitionKey: 'pkey',
      SortKey: 'skey',
    });

    const response = await db.scan();
    expect(response).toStrictEqual(ddbQueryResponse.Items);
  });

  test('Test Update', async () => {
    const testUpdate = {
      Key: {
        pkey: 'primarykey',
        skey: 'sortkey',
      },
      AttributeUpdates: {
        attributeKey: {
          Value: 'attributeValue',
        },
      },
    };

    ddbMock.on(UpdateItemCommand)
      .resolves(testUpdate);

    const db = new DB({
      Table: 'testTable',
      PartitionKey: 'pkey',
      SortKey: 'skey',
    });

    const updated = await db.update(
      testUpdate.Key.pkey,
      testUpdate.Key.skey,
      testUpdate.AttributeUpdates,
      false
    );

    expect(updated.Key.pkey)
      .toBe(testUpdate.Key.pkey);

    expect(updated.Key.skey)
      .toBe(testUpdate.Key.skey);

    expect(updated.AttributeUpdates.attributeKey.Value)
      .toBe(testUpdate.AttributeUpdates.attributeKey.Value);
  });

  test('Test dropColumns', async () => {
    const testPrimary = 'primarykey';
    const testSort = 'sortkey';
    const column = 'att1';

    ddbMock.on(UpdateItemCommand)
      .resolves([column]);

    const db = new DB({
      Table: 'testTable',
      PartitionKey: 'pkey',
      SortKey: 'skey',
    });

    const response = await db.dropColumns(testPrimary, testSort, column);
    expect(response).toStrictEqual([column]);
  });

  test('Test purge', async () => {
    const testPurge = {
      TableName: 'testTable',
      Key: {
        pkey: 'testPrimaryKey',
        skey: 'testSortKey',
      },
    };

    ddbMock.on(DeleteItemCommand)
      .resolves(testPurge);

    const testPrimary = testPurge.Key.pkey;
    const testSort = testPurge.Key.skey;

    const db = new DB({
      Table: testPurge.TableName,
      PartitionKey: 'pkey',
      SortKey: 'skey',
    });

    const response = await db.purge(
      testPrimary,
      testSort
    );

    expect(response.TableName)
      .toBe(db.table);

    expect(response.Key[db.partitionKey])
      .toBe(testPrimary);

    expect(response.Key[db.sortKey])
      .toBe(testSort);
  });
});

describe('Test SNS', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    snsMock.reset();
  });

  afterEach(() => {
  });

  test('Test send success', async () => {
    snsMock.on(PublishCommand)
      .resolves();

    const response = await SNS.send('subject', 'message');

    expect(response)
      .toBe(true);
  });

  test('Test send fail', async () => {
    snsMock.on(PublishCommand)
      .resolves(false);

    const response = await SNS.send('', '', '');

    expect(response)
      .toBe(false);
  });
});

describe('Test EDLComposer', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
  });

  test('Test compose', () => {
    const edl = new EDLComposer(edlData);

    const response = edl.compose();
    expect(response.includes(`TITLE: ${edlData.title.toUpperCase()}`)).toBe(true);
  });
});

describe('Test FrameCaptureModeHelper', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
  });

  test('Test suggestFrameCaptureRate', () => {
    let response = FrameCaptureModeHelper.suggestFrameCaptureRate('a', '');
    expect(response).toStrictEqual([]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, 0);
    expect(response).toStrictEqual([]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1FPS);
    expect(response).toStrictEqual([FrameCaptureMode.MODE_1FPS, 1]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_ALL);
    expect(response).toStrictEqual([1000, 1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_HALF_FPS);
    expect(response).toStrictEqual([500, 1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1F_EVERY_2S);
    expect(response).toStrictEqual([5, 10]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1F_EVERY_5S);
    expect(response).toStrictEqual([2, 10]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(
      1,
      FrameCaptureMode.MODE_1F_EVERY_10S
    );
    expect(response).toStrictEqual([1, 10]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(
      1,
      FrameCaptureMode.MODE_1F_EVERY_30S
    );
    expect(response).toStrictEqual([1, 30]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(
      1,
      FrameCaptureMode.MODE_1F_EVERY_1MIN
    );
    expect(response).toStrictEqual([1, 60]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(
      1,
      FrameCaptureMode.MODE_1F_EVERY_2MIN
    );
    expect(response).toStrictEqual([1, 120]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(
      1,
      FrameCaptureMode.MODE_1F_EVERY_5MIN
    );
    expect(response).toStrictEqual([1, 300]);
  });
});

describe('Test IotStatus', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
  });

  afterEach(() => {
  });

  test('Test publish', async () => {
    iotMock.on(IotPublishCommand)
      .resolves({
        topic: Environment.Iot.Topic,
        payload: JSON.stringify(iotStatusMessage),
      });

    const response = await IotStatus.publish(iotStatusMessage);

    expect(response.topic)
      .toBe(Environment.Iot.Topic);

    expect(response.payload)
      .toBe(JSON.stringify(iotStatusMessage));
  });
});

describe('Test ServiceAvailability', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
  });

  test('Test probe', async () => {
    let response = await ServiceAvailability.probe(
      'transcribe',
      'us-east-1'
    );
    expect(response).toBe(true);

    response = await ServiceAvailability.probe('invalid');
    expect(response).toBe(false);

    response = await ServiceAvailability.probe()
      .catch((error) =>
        error);
    expect(response).toBeInstanceOf(Error);
  });
});

describe('Test ServiceToken', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    ddbMock.reset();
  });

  afterEach(() => {
  });

  test('Test register', async () => {
    const testRegister = {
      TableName: Environment.DynamoDB.ServiceToken.Table,
      Key: {
        [Environment.DynamoDB.ServiceToken.PartitionKey]: 'testId',
        [Environment.DynamoDB.ServiceToken.SortKey]: ServiceToken.Token.Name,
      },
      AttributeUpdates: {
        token: {
          Value: 'testToken',
        },
        service: {
          Value: 'testService',
        },
        api: {
          Value: 'testApi',
        },
        data: {
          Value: {
            testData: 'testDataVal',
          },
        },
        ttl: {
          Value: 1000,
        },
      },
    };

    ddbMock.on(UpdateItemCommand)
      .resolves(testRegister);

    const id = testRegister.Key[Environment.DynamoDB.ServiceToken.PartitionKey];
    const token = testRegister.AttributeUpdates.token.Value;
    const service = testRegister.AttributeUpdates.service.Value;
    const api = testRegister.AttributeUpdates.api.Value;
    const data = testRegister.AttributeUpdates.data.Value;

    const db = await ServiceToken.register(id, token, service, api, data);

    expect(db.TableName)
      .toBe(Environment.DynamoDB.ServiceToken.Table);

    expect(db.Key[Environment.DynamoDB.ServiceToken.PartitionKey])
      .toBe(id);

    expect(db.Key[Environment.DynamoDB.ServiceToken.SortKey])
      .toBe(ServiceToken.Token.Name);

    expect(db.AttributeUpdates.token.Value)
      .toBe(token);

    expect(db.AttributeUpdates.service.Value)
      .toBe(service);

    expect(db.AttributeUpdates.api.Value)
      .toBe(api);

    expect(db.AttributeUpdates.data.Value)
      .toStrictEqual(data);

    expect(db.AttributeUpdates.ttl.Value)
      .toBeGreaterThan(0);
  });

  test('Test getData', async () => {
    const responseGetData = {
      pkey: 'primarykey',
      skey: 'sortkey',
      att1: 'value1',
    };
    const testGetData = {
      Count: 1,
      Items: [
        marshall(responseGetData),
      ],
    };

    ddbMock.on(QueryCommand)
      .resolves(testGetData);

    const response = await ServiceToken.getData('id');

    expect(response)
      .toStrictEqual(responseGetData);
  });

  test('Test unregister', async () => {
    const testUnregister = {
      TableName: Environment.DynamoDB.ServiceToken.Table,
      Key: {
        [Environment.DynamoDB.ServiceToken.PartitionKey]: 'testId',
        [Environment.DynamoDB.ServiceToken.SortKey]: ServiceToken.Token.Name,
      },
    };

    ddbMock.on(DeleteItemCommand)
      .resolves(testUnregister);

    const id = testUnregister.Key[Environment.DynamoDB.ServiceToken.PartitionKey];
    const response = await ServiceToken.unregister(id);

    expect(response.TableName)
      .toBe(Environment.DynamoDB.ServiceToken.Table);

    expect(response.Key[Environment.DynamoDB.ServiceToken.PartitionKey])
      .toBe(id);

    expect(response.Key[Environment.DynamoDB.ServiceToken.SortKey])
      .toBe(ServiceToken.Token.Name);
  });
});

describe('Test TimelineQ', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
  });

  test('Test CelebItem', () => {
    const celebResponse = TimelineQ.createTypedItem(celebItem, {});

    expect(celebResponse.$name)
      .toBe(celebItem.Celebrity.Name);

    expect(celebResponse.$end)
      .toBe(celebItem.Timestamp);

    expect(celebResponse.$begin)
      .toBe(celebItem.Timestamp);

    expect(celebResponse.$boundingBox)
      .toStrictEqual(celebItem.Celebrity.BoundingBox);

    expect(celebResponse.$confidence)
      .toBe(celebItem.Celebrity.Confidence);

    expect(celebResponse.canUse())
      .toBe(true);
  });

  test('Test ModerationItem', () => {
    const moderationResponse = TimelineQ.createTypedItem(moderationItem, {});

    expect(moderationResponse.$name)
      .toBe(moderationItem.ModerationLabel.ParentName);

    expect(moderationResponse.$parentName)
      .toBe(moderationItem.ModerationLabel.Name);

    expect(moderationResponse.$confidence)
      .toBe(moderationItem.ModerationLabel.Confidence);

    expect(moderationResponse.$begin)
      .toBe(moderationItem.Timestamp);

    expect(moderationResponse.$end)
      .toBe(moderationItem.Timestamp);

    expect(moderationResponse.canUse())
      .toBe(false);
  });

  test('Test LabelItem', () => {
    const labelResponse = TimelineQ.createTypedItem(labelItem, {});

    expect(labelResponse.$name)
      .toBe(labelItem.Label.Name);

    expect(labelResponse.$confidence)
      .toBe(labelItem.Label.Confidence);

    expect(labelResponse.$begin)
      .toBe(labelItem.Timestamp);

    expect(labelResponse.$end)
      .toBe(labelItem.Timestamp);

    expect(labelResponse.$boundingBox)
      .toStrictEqual(labelItem.Label.Instances[0].BoundingBox);

    expect(labelResponse.$parentName)
      .toBe(labelItem.Label.Parents.map(x => x.Name).join(', '));

    expect(labelResponse.canUse())
      .toBe(true);
  });

  test('Test FaceMatchItem', () => {
    const faceMatchResponse = TimelineQ.createTypedItem(faceMatchItem, {});

    expect(faceMatchResponse.$name)
      .toBe(faceMatchItem.FaceMatches[0].Face.ExternalImageId);

    expect(faceMatchResponse.$confidence)
      .toBe(faceMatchItem.FaceMatches[0].Similarity);

    expect(faceMatchResponse.$begin)
      .toBe(faceMatchItem.Timestamp);

    expect(faceMatchResponse.$end)
      .toBe(faceMatchItem.Timestamp);

    expect(faceMatchResponse.$boundingBox)
      .toStrictEqual(faceMatchItem.Person.BoundingBox);

    expect(faceMatchResponse.$parentName)
      .toBe(`Index ${faceMatchItem.Person.Index}`);

    expect(faceMatchResponse.canUse())
      .toBe(false);
  });

  test('Test CustomLabelItem', () => {
    const customLabelResponse = TimelineQ.createTypedItem(customLabelItem, {});

    expect(customLabelResponse.$name)
      .toBe(customLabelItem.CustomLabel.Name);

    expect(customLabelResponse.$confidence)
      .toBe(customLabelItem.CustomLabel.Confidence);

    expect(customLabelResponse.$begin)
      .toBe(customLabelItem.Timestamp);

    expect(customLabelResponse.$end)
      .toBe(customLabelItem.Timestamp);

    expect(customLabelResponse.$boundingBox)
      .toStrictEqual(customLabelItem.CustomLabel.Geometry.BoundingBox);

    expect(customLabelResponse.canUse())
      .toBe(true);

    const cy = customLabelResponse.$cy;
    const cx = customLabelResponse.$cx;
    expect(customLabelResponse.cueAlignment)
      .toBe(`align:center line:${Math.floor(cy * 100)}% position:${Math.floor(cx * 100)}% size:25%`);

    customLabelResponse.$cx = undefined;
    expect(customLabelResponse.cueAlignment)
      .toBe('align:end line:0% position:100% size:25%');
  });

  test('Test PersonItem', () => {
    const personResponse = TimelineQ.createTypedItem(personItem, {});
    const expectParentName = [
      ((personItem.Person.Face || {}).Gender) ? personItem.Person.Face.Gender.Value : undefined,
      ((personItem.Person.Face || {}).AgeRange) ? `(${personItem.Person.Face.AgeRange.Low} - ${personItem.Person.Face.AgeRange.High})` : undefined,
    ].filter(x => x).join(' ');

    expect(personResponse.$name)
      .toBe(personItem.Person.Index.toString());

    expect(personResponse.$confidence)
      .toBe(personItem.Person.Confidence);

    expect(personResponse.$begin)
      .toBe(personItem.Timestamp);

    expect(personResponse.$end)
      .toBe(personItem.Timestamp);

    expect(personResponse.$boundingBox)
      .toStrictEqual(personItem.Person.BoundingBox);

    expect(personResponse.$parentName)
      .toBe(expectParentName);

    expect(personResponse.canUse())
      .toBe(true);
  });

  test('Test FaceItem', () => {
    const faceResponse = TimelineQ.createTypedItem(faceItem, {});
    const expectParentName = [
      (faceItem.Face.AgeRange) ? `(${faceItem.Face.AgeRange.Low} - ${faceItem.Face.AgeRange.High})` : undefined,
      (faceItem.Face.Emotions.sort((a, b) => b.Confidence - a.Confidence)[0] || {}).Type,
    ].filter(x => x).join(' ');

    expect(faceResponse.$name)
      .toBe(faceItem.Face.Gender.Value);

    expect(faceResponse.$confidence)
      .toBe(faceItem.Face.Confidence);

    expect(faceResponse.$begin)
      .toBe(faceItem.Timestamp);

    expect(faceResponse.$end)
      .toBe(faceItem.Timestamp);

    expect(faceResponse.$boundingBox)
      .toStrictEqual(faceItem.Face.BoundingBox);

    expect(faceResponse.canUse())
      .toBe(false);
  });

  test('Test TextItem', () => {
    const textResponse = TimelineQ.createTypedItem(textItem, {});
    const expectName = (textItem.TextDetection.Type === 'LINE') ? textItem.TextDetection.DetectedText : undefined;

    expect(textResponse.$name)
      .toBe(expectName);

    expect(textResponse.$confidence)
      .toBe(textItem.TextDetection.Confidence);

    expect(textResponse.$end)
      .toBe(textItem.Timestamp);

    expect(textResponse.$begin)
      .toBe(textItem.Timestamp);

    expect(textResponse.$boundingBox)
      .toStrictEqual(textItem.TextDetection.Geometry.BoundingBox);

    expect(textResponse.canUse())
      .toBe(false);
  });

  test('Test createTypedItem fail', () => {
    try {
      TimelineQ.createTypedItem({});
    } catch (error) {
      expect(error.message)
        .toBe('fail to create typed item');
    }
  });

  test('Test reduceAll', () => {
    const queue = new TimelineQ();
    const item1 = TimelineQ.createTypedItem(personItem, {});
    const item2 = TimelineQ.createTypedItem(personItem, {});

    item2.end = '222';
    item1.parentName = 'parent1';

    queue.push(item1);
    queue.push(item2);

    const mean = (values) => {
      const power = 1 / values.length;
      return values.reduce((a0, c0) => a0 * c0 ** power, 1);
    };

    const reduce = queue.reduceAll();

    expect(reduce.$name)
      .toBe(item1.$name);

    expect(reduce.$confidence)
      .toBe(mean([item1.$confidence, item2.$confidence]));

    expect(reduce.$begin)
      .toBe(item1.$begin);

    expect(reduce.$end)
      .toBe(item2.$end);

    expect(reduce.$boundingBox.Left)
      .toBe(mean([item1.$boundingBox.Left, item2.$boundingBox.Left]));

    expect(reduce.$boundingBox.Top)
      .toBe(mean([item1.$boundingBox.Top, item2.$boundingBox.Top]));

    expect(reduce.$boundingBox.Width)
      .toBe(mean([item1.$boundingBox.Width, item2.$boundingBox.Width]));

    expect(reduce.$boundingBox.Height)
      .toBe(mean([item1.$boundingBox.Height, item2.$boundingBox.Height]));

    expect(reduce.$parentName)
      .toBe(item1.$parentName);

    expect(reduce.$count)
      .toBe(2);

    queue.pop();

    expect(queue.reduceAll())
      .toBe(undefined);

    expect(TimelineQ.computeGeometricMean([]))
      .toBe(undefined);
  });

  test('Test timeDriftExceedThreshold', () => {
    const item1 = TimelineQ.createTypedItem(personItem, {});
    const item2 = TimelineQ.createTypedItem(personItem, {});

    expect(TimelineQ.timeDriftExceedThreshold(item2, item1))
      .toBe(false);

    item1.$begin = 100;
    item1.$timeDriftThreshold = 5;
    item2.$end = 1;

    expect(TimelineQ.timeDriftExceedThreshold(item2, item1))
      .toBe(true);

    expect(TimelineQ.timeDriftExceedThreshold())
      .toBe(false);
  });

  test('Test positionDriftExceedThreshold', () => {
    const item1 = TimelineQ.createTypedItem(personItem, {});
    const item2 = TimelineQ.createTypedItem(personItem, {});

    expect(TimelineQ.positionDriftExceedThreshold(item2, item1))
      .toBe(false);

    item1.$cx = 1;
    item1.$cy = 1;
    item2.$cx = 5;
    item2.$cy = 5;
    item1.$positionDriftThreshold = 1;

    expect(TimelineQ.positionDriftExceedThreshold(item2, item1))
      .toBe(true);

    expect(TimelineQ.positionDriftExceedThreshold())
      .toBe(false);
  });
});

describe('Test WebVttTrack', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
  });

  test('Test cues operations', () => {
    const track = new WebVttTrack();
    expect(track.length).toBe(0);

    const firstCue = new WebVttCue(cue1.begin, cue1.end, cue1.text, cue1.position);
    track.push(firstCue);
    expect(track.length)
      .toBe(1);

    track.addCue(cue2.begin, cue2.end, cue2.text, cue2.position);
    track.addCue(cue3.begin, cue3.end, cue3.text, cue3.position);
    const shiftCue = track.shift();
    const popCue = track.pop();

    expect(shiftCue)
      .toStrictEqual(firstCue);

    expect(popCue.$text)
      .toBe(cue3.text);
  });

  test('Test track operations', () => {
    const track = new WebVttTrack();
    track.addCue(cue1.begin, cue1.end, cue1.text, cue1.position);
    track.addCue(cue2.begin, cue2.end, cue2.text, cue2.position);

    const parsed = WebVttTrack.parse(track.toString());
    expect(parsed.$cues[0].$text)
      .toBe(track.cues[0].$text);

    expect(parsed.$cues[1].$text)
      .toBe(track.cues[1].$text);

    const lines = track.toString().split('\n');

    expect(lines.shift())
      .toBe('WEBVTT');

    expect(lines.shift())
      .toBe('');

    expect(lines.shift())
      .toBe('0');

    expect(lines.shift())
      .toBe(`${track.cues[0].toTimeString(cue1.begin)} --> ${track.cues[0].toTimeString(cue1.end)} ${cue1.position}`);

    expect(lines.shift())
      .toBe(cue1.text);

    expect(lines.shift())
      .toBe('');

    expect(lines.shift())
      .toBe('1');

    expect(lines.shift())
      .toBe(`${track.cues[1].toTimeString(cue2.begin)} --> ${track.cues[1].toTimeString(cue2.end)} ${cue2.position}`);

    expect(lines.shift())
      .toBe(cue2.text);

    track.length = 5;
    expect(track.length)
      .toBe(5);
  });

  test('Test convertToMilliseconds', () => {
    expect(WebVttTrack.convertToMilliseconds(['00', '11', '22', '000']))
      .toBeGreaterThan(0);
  });
});

describe('Test CommonUtils', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    s3Mock.reset();
  });

  afterEach(() => {
  });

  test('Test unsignedUrl', () => {
    const bucket = 'bucketname';
    const key = 'key';

    const unsigned = CommonUtils.unsignedUrl(bucket, key);

    expect(unsigned)
      .toMatch(new RegExp(`https://${bucket}.s3.*.amazonaws.com/${key}`));
  });

  test('Test headObject', async () => {
    const testHeadObject = {
      Bucket: 'bucketname',
      Key: 'key',
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
    };

    s3Mock.on(HeadObjectCommand)
      .resolves(testHeadObject);

    const bucket = testHeadObject.Bucket;
    const key = testHeadObject.Key;

    const response = await CommonUtils.headObject(bucket, key);

    expect(response.Bucket)
      .toBe(bucket);

    expect(response.Key)
      .toBe(key);

    expect(response.ExpectedBucketOwner)
      .toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test listObjects', async () => {
    const testListObjects = {
      Bucket: 'bucketname',
      Prefix: 'pre/',
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
    };

    s3Mock.on(ListObjectsV2Command)
      .resolves(testListObjects);

    const bucket = testListObjects.Bucket;
    const prefix = 'pre';

    const response = await CommonUtils.listObjects(bucket, prefix, {});

    expect(response.Bucket)
      .toBe(bucket);

    expect(response.Prefix)
      .toBe(`${prefix}/`);

    expect(response.ExpectedBucketOwner)
      .toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test download', async () => {
    const testDownload = {
      Bucket: 'bucketname',
      Key: 'key',
      Body: new Blob(['body']), // Readable | ReadableStream | Blob
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
    };

    s3Mock.on(GetObjectCommand)
      .resolves(testDownload);

    const bucket = testDownload.Bucket;
    const key = testDownload.Key;
    const response = await CommonUtils.download(bucket, key, false);

    expect(response.Bucket)
      .toBe(bucket);

    expect(response.Key)
      .toBe(key);

    expect(response.ExpectedBucketOwner)
      .toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);

    expect(response.Body).toBeInstanceOf(Blob);
  });

  test('Test upload', async () => {
    const testUpload = {
      Bucket: 'bucketname',
      Key: 'key',
      ContentType: 'test',
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
    };

    s3Mock.on(PutObjectCommand)
      .resolves(testUpload);

    const params = {
      ...testUpload,
      Body: '{}',
    };

    const response = await CommonUtils.upload(params);

    expect(response.Bucket)
      .toBe(params.Bucket);

    expect(response.Key)
      .toBe(params.Key);

    expect(response.ContentType)
      .toBe(params.ContentType);

    expect(response.ExpectedBucketOwner)
      .toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test uploadFile', async () => {
    const bucket = 'bucketname';
    const prefix = 'pre';
    const filename = 'file.txt';

    const testUploadFile = {
      Bucket: bucket,
      Key: `${prefix}/${filename}`,
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
    };

    s3Mock.on(PutObjectCommand)
      .resolves(testUploadFile);

    const response = await CommonUtils.uploadFile(bucket, prefix, filename, {});

    expect(response.Bucket)
      .toBe(bucket);

    expect(response.Key)
      .toBe(`${prefix}/${filename}`);

    expect(response.ExpectedBucketOwner)
      .toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test deleteObject', async () => {
    const bucket = 'bucketname';
    const key = 'key';

    const testDeleteObject = {
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
    };

    s3Mock.on(DeleteObjectCommand)
      .resolves(testDeleteObject);

    const response = await CommonUtils.deleteObject(bucket, key);

    expect(response)
      .toBe(true);
  });

  test('Test getTags', async () => {
    const bucket = 'bucketname';
    const key = 'key';

    const testGetTags = {
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
    };

    s3Mock.on(GetObjectTaggingCommand)
      .resolves(testGetTags);

    const response = await CommonUtils.getTags(bucket, key);

    expect(response.Bucket)
      .toBe(bucket);

    expect(response.Key)
      .toBe(key);

    expect(response.ExpectedBucketOwner)
      .toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test tagObject', async () => {
    const bucket = 'bucketname';
    const key = 'key';
    const tagset = [
      {
        Key: 'tag1',
        Value: 'val1',
      }, {
        Key: 'tag2',
        Value: 'val2',
      },
    ];

    const testGetTags = {
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
      TagSet: tagset,
    };

    const testPutTags = {
      ...testGetTags,
      TagSet: undefined,
      Tagging: {
        TagSet: tagset,
      },
    };

    s3Mock.on(GetObjectTaggingCommand)
      .resolves(testGetTags);

    s3Mock.on(PutObjectTaggingCommand)
      .resolves(testPutTags);
    const response = await CommonUtils.tagObject(bucket, key, tagset);

    expect(response.Bucket)
      .toBe(bucket);

    expect(response.Key)
      .toBe(key);

    expect(response.ExpectedBucketOwner)
      .toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);

    expect(response.Tagging.TagSet)
      .toContain(tagset[0]);

    expect(response.Tagging.TagSet)
      .toContain(tagset[1]);
  });

  test('Test createReadStream', async () => {
    const stream = 'test stream';
    const bucket = 'bucketname';
    const key = 'key';

    const readstream = () => {
      const duplex = new Duplex();
      duplex.push(Buffer.from('test'));
      duplex.push(null);
      return duplex;
    };

    const testCreateReadStream = {
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
      Body: readstream(),
    };

    s3Mock.on(GetObjectCommand)
      .resolves(testCreateReadStream);

    const response = await CommonUtils.createReadStream(bucket, key, {});

    expect(response).toBeInstanceOf(Readable);
  });

  test('Test restoreObject', async () => {
    const bucket = 'bucketname';
    const key = 'key';

    const testRestoreObject = {
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
    };

    s3Mock.on(RestoreObjectCommand)
      .resolves(testRestoreObject);

    const response = await CommonUtils.restoreObject(bucket, key, {});

    expect(response.Bucket)
      .toBe(bucket);

    expect(response.Key)
      .toBe(key);

    expect(response.ExpectedBucketOwner)
      .toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test copyObject', async () => {
    const source = 'sourcename';
    const bucket = 'bucketname';
    const key = 'key';

    const testCopyObject = {
      CopySource: source,
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: process.env.ENV_EXPECTED_BUCKET_OWNER,
    };

    s3Mock.on(CopyObjectCommand)
      .resolves(testCopyObject);

    const response = await CommonUtils.copyObject(source, bucket, key, {});

    expect(response.CopySource)
      .toBe(source);

    expect(response.Bucket)
      .toBe(bucket);

    expect(response.Key)
      .toBe(key);

    expect(response.ExpectedBucketOwner)
      .toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test uuid4', () => {
    expect(CommonUtils.uuid4())
      .toBeTruthy();

    const str = 's';
    try {
      CommonUtils.uuid4(str);
    } catch (error) {
      expect(error.message.length)
        .toBeGreaterThan(0);
    }
  });

  test('Test normalizeFileName', () => {
    const name = ',';
    expect(CommonUtils.normalizeFileName(name)).toBe('_');
  });

  test('Test escape/unescape S3Characters', () => {
    const key = 's s';
    const escape = CommonUtils.escapeS3Characters(key);
    expect(escape).toBe('s+s');
    expect(CommonUtils.unescapeS3Character(escape)).toBe(key);
  });

  test('Test toMD5String', () => {
    expect(CommonUtils.toMD5String('test')).toMatch(/[0-9A-Fa-f]{6}/g);
    expect(CommonUtils.toMD5String('test', 'base64')).toBe('test');
    expect(CommonUtils.toMD5String('')).toBe(undefined);
  });

  test('Test sanitizedKey/Path', () => {
    expect(CommonUtils.sanitizedKey('/s')).toBe('s');

    const dir = 'home/folder';
    const name = 'file';
    const ext = '.txt';
    const path = CommonUtils.sanitizedPath(`/${dir}/${name}${ext}`);
    expect(path.dir).toBe(dir);
    expect(path.base).toBe(`${name}${ext}`);
    expect(path.ext).toBe(ext);
    expect(path.name).toBe(name);
  });

  test('Test zero functions', () => {
    const md5 = CommonUtils.zeroMD5();
    expect(md5.length).toBe(32);
    expect(Number(md5)).toBe(0);

    const acctId = CommonUtils.zeroAccountId();
    expect(acctId.length).toBe(12);
    expect(Number(acctId)).toBe(0);

    const uuid = CommonUtils.zeroUUID();
    expect(uuid.length).toBe(36);
  });

  test('Test toISODateTime', () => {
    expect(CommonUtils.toISODateTime().length).toBeGreaterThan(0);
  });

  test('Test random', () => {
    const min = 3;
    let max = 4;
    expect(CommonUtils.random(min, max)).toBe(min);

    max = 20;
    const rand = CommonUtils.random(min, max);
    expect(rand).toBeGreaterThanOrEqual(min);
    expect(rand).toBeLessThan(max);
  });

  test('Test isJSON', () => {
    const json = { key: 'val' };
    expect(CommonUtils.isJSON('s')).toBe(false);
    expect(CommonUtils.isJSON(JSON.stringify(json))).toBe(true);
  });

  test('Test MimeTypeHelper class', () => {
    expect(MimeTypeHelper.getMime('file.txt')).toBe('text/plain');
    expect(MimeTypeHelper.getExtensionByMime('text/plain')).toBe('txt');
    expect(MimeTypeHelper.parseMimeType('text/plain')).toBe('plain');
  });

  test('Test capitalize', () => {
    expect(CommonUtils.capitalize('name')).toBe('Name');
  });

  test('Test timeToLiveInSecond', () => {
    expect(CommonUtils.timeToLiveInSecond(0)).toBeLessThan(CommonUtils.timeToLiveInSecond());
  });

  test('Test compress/decompressData', async () => {
    const target = 'target';
    const compressed = await CommonUtils.compressData(target);
    expect(compressed.length).toBeGreaterThan(0);

    const decompressed = await CommonUtils.decompressData(compressed);
    expect(decompressed.toString()).toBe(target);

    await CommonUtils.decompressData('').catch(error => {
      expect(error.message.length).toBeGreaterThan(0);
    });
  });

  test('Test flatten', () => {
    const arr = [1, 1, [2, 2, [3, 3]]];
    expect(CommonUtils.flatten(arr)).toStrictEqual([1, 1, 2, 2, [3, 3]]);
    expect(CommonUtils.flatten(arr, 2)).toStrictEqual([1, 1, 2, 2, 3, 3]);
  });

  test('Test makeSafeOutputPrefix', () => {
    expect(CommonUtils.makeSafeOutputPrefix('uuid', '/prefix/file')).toBe('uuid/prefix/');
  });
});

describe('Test ValidationHelper', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
  });

  test('Test validateBucket', async () => {
    const bucketName = new StringBuilder('a');
    expect(ValidationHelper.validateBucket(bucketName.toString())).toBe(false);

    bucketName.repeat(2); // aaa
    expect(ValidationHelper.validateBucket(bucketName.toString())).toBe(true);

    bucketName.append('A'); // aaaA
    expect(ValidationHelper.validateBucket(bucketName.toString())).toBe(false);

    bucketName.replace(3, 4, '_'); // aaa_
    expect(ValidationHelper.validateBucket(bucketName.toString())).toBe(false);

    bucketName.deleteCharAt(3);
    bucketName.repeat(22); // 66 chars
    expect(ValidationHelper.validateBucket(bucketName.toString())).toBe(false);
  });

  test('Test validateUuid', async () => {
    expect(ValidationHelper.validateUuid('0000')).toBe(false);
    expect(ValidationHelper.validateUuid('00000000-1111-1111-1111-000000000000')).toBe(true);
  });

  test('Test validateCognitoIdentityId', () => {
    expect(ValidationHelper.validateCognitoIdentityId(`us-east-1:${CommonUtils.zeroUUID()}`)).toBe(true);
    expect(ValidationHelper.validateCognitoIdentityId()).toBe(false);
  });

  test('Test validateBase64JsonToken', () => {
    const json = {
      key1: 'val1',
    };
    const buf = Buffer.from(JSON.stringify(json));

    expect(ValidationHelper.validateBase64JsonToken(buf)).toBe(true);
    expect(ValidationHelper.validateBase64JsonToken()).toBe(false);
  });

  test('Test validateFaceCollectionId', () => {
    expect(ValidationHelper.validateFaceCollectionId('a1._-')).toBe(true);
    expect(ValidationHelper.validateFaceCollectionId('/')).toBe(false);
  });

  test('Test validateS3Uri', () => {
    expect(ValidationHelper.validateS3Uri('s3://bucketname/key')).toBe(true);
    expect(ValidationHelper.validateS3Uri('a3://bucketname/key')).toBe(false);
    expect(ValidationHelper.validateS3Uri('s3://bu/key')).toBe(false);
  });
});
