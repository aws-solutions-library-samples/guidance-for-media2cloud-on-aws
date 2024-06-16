/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/
const {
  Environment,
  AnalysisTypes,
  AIML,
  StateData,
  DB,
  CommonUtils,
  Retry,
  IotStatus,
  ApiOps,
  SNS,
  TimelineQ,
  WebVttCue,
  WebVttTrack,
  Metrics,
  ServiceAvailability,
  ServiceToken,
  SQL,
  EDLComposer,
  TimecodeUtils,
  TarStreamHelper,
  FrameCaptureMode,
  FrameCaptureModeHelper,
  AdmZip,
  Indexer,
  NodeWebVtt,
  ConfigurationError,
  IngestError,
  AnalysisError,
  IndexError,
  ChecksumError,
  RestoreError,
  JobStatusError,
  GroundTruthError,
  TranscodeError,
  NotImplError,
  FixityError,
} = require('core-lib'); 
const StringBuilder = require('node-stringbuilder');
const https = require('https');


const AWS = require('aws-sdk-mock');
const SDK = require('aws-sdk');
const { request } = require('http');
AWS.setSDKInstance(SDK);

const stateMachine = 'test-state-machine';
const accountId = '12345';
const context = {
  invokedFunctionArn: `arn:partition:service:region:${accountId}:resource-id`,
  getRemainingTimeInMillis: 1000
}

const testEvent = {
  "uuid": "b72fc9c0-58eb-83ef-42f2-dfceb342798f", 
  "stateMachine": stateMachine,
  "operation": "collect-transcribe-results", 
  "status": "NO_DATA", 
  "progress": 100, 
  "input": { 
    "testInputKey": "testInputVal"
  },
  "data": {
    "testDataKey": "testDataVal"
  }
}

const ddbQueryResponse = {
  Count: 1,
  Items: [
    {
      pkey: 'primarykey',
      skey: 'sortkey',
      att1: 'value1'
    }
  ],
  LastEvaluatedKey: 'lastKey'
}

const ddbScanIndexData = {
  Name: 'testTable',
  Key: 'pkey',
  Value: 'primarykey'
}

const edlData = {
  title: 'Test Title',
  events: [
    {
      startTime: '1',
      endTime: '10',
      reelName: 'testReel1',
      clipName: 'testClip1'
    }
  ]
}

const iotStatusMessage = {
  messageKey: "messageVal"
}


const item = {
  name: 'itemName',
  confidence: 2,
  begin: 1,
  end: 5,
  boundingBox: {
    Width: 10,
    Height: 9,
    Left: 0,
    Top: 11
  },
  parentName: 'itemParent',
  Timestamp: '111'
}
const celebrity = {
  Name: 'celebrityName',
  Confidence: 2,
  BoundingBox: {
    Width: 12,
    Height: 11,
    Left: 2,
    Top: 13
  }
}
const label = {
  Name: 'labelName',
  Parents: [
    {
      Name: 'parent1'
    },{
      Name: 'parent2'
    }
  ],
  Confidence: 3,
  Instances: [
    {
      BoundingBox: {
        Width: 4,
        Height: 13,
        Left: 4,
        Top: 15
      }
    }
  ]
}
const faceMatch = {
  Similarity: 0
}
const moderation = {
  ParentName: '',
  Name: '',
  Confidence: 8
}
const person = {
  Index: 7,
  Confidence: 4,
  BoundingBox: {
    Width: 6,
    Height: 15,
    Left: 6,
    Top: 17
  }
}
const face = {
  ExternalImageId: '',
  Gender: {
    Value: ''
  },
  AgeRange: {
    Low: 0,
    High: 100
  },
  Confidence: 4,
  Emotions: [],
  BoundingBox: {
    Width: 8,
    Height: 17,
    Left: 8,
    Top: 19
  }
}
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
      Top: 21
    }
  }
}
const textDetection = {
  Type: '',
  DetectedText: '',
  Confidence: 3,
  Geometry: {
    BoundingBox: {
      Width: 12,
      Height: 21,
      Left: 12,
      Top: 23
    }
  }
}

const celebItem = {...item};
celebItem.Celebrity = celebrity;

const moderationItem = {...item};
moderationItem.ModerationLabel = moderation;

const labelItem = {...item};
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
  position: 'center'
}
const cue2 = {
  begin: '5555',
  end: '77777',
  text: 'cue 2 text',
  position: 'center'
}
const cue3 = {
  begin: '88888',
  end: '999999',
  text: 'cue 3 text',
  position: 'center'
}



describe('Test StateData, StateMessage, States, Statuses', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  test('Test StateData and StateMessage constructors', () => {
    let stateObj = new StateData(stateMachine, testEvent, context);
    //StateMessage
    expect(stateObj.uuid).toBe(testEvent.uuid);
    expect(stateObj.stateMachine).toBe(stateMachine);
    expect(stateObj.operation).toBe(testEvent.operation);
    expect(stateObj.status).toBe(testEvent.status);
    expect(stateObj.progress).toBe(testEvent.progress);
    
    //StateData
    expect(stateObj.input).toStrictEqual(testEvent.input);
    expect(stateObj.data).toStrictEqual(testEvent.data);
    expect(stateObj.event).toStrictEqual(testEvent);
    expect(stateObj.accountId).toBe(accountId);
    expect(stateObj.getRemainingTime()).toBe(StateData.Constants.LambdaTimeoutThreshold * 2);
    
  });

  test('Test StateData get/set', () => {
    const testInput = 'test input val';
    const testOutput = 'test output val';
    let stateObj = new StateData(stateMachine, testEvent, context);

    stateObj.input = testInput;
    expect(stateObj.input).toBe(testInput);

    stateObj.output = testOutput;
    expect(stateObj.output).toBe(testOutput);

    stateObj.setData('transcribe', {
      startTime: 5
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
    let stateObj = new StateData(stateMachine, testEvent, context);

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
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
    AWS.mock('DynamoDB.DocumentClient', 'query', Promise.resolve(JSON.parse(JSON.stringify(ddbQueryResponse))));

    AWS.mock('DynamoDB.DocumentClient', 'scan', function(params, callback) {
      const response = JSON.parse(JSON.stringify(ddbQueryResponse));
      response.LastEvaluatedKey = undefined;
      callback(null, response);
    });

    AWS.mock('DynamoDB.DocumentClient', 'update', function(params, callback) {
      callback(null, params);
    });

    AWS.mock('DynamoDB.DocumentClient', 'delete', function(params, callback) {
      callback(null, params);
    });
  });

  afterEach(() => {
    AWS.restore('DynamoDB.DocumentClient');
  });

  test('Test constructor with missing parameters', () => {
    const constructor = () => {
      new DB({});
    };
    expect(constructor).toThrow(Error);
    expect(constructor).toThrow(`missing Table, PartitionKey`);
  });

  test('Test DB toStringTag', () => {
    const stringTag = Object.prototype.toString.call(
      new DB({
        Table: 'testTable',
        PartitionKey: 'testPartitionKey'
      })
    );
    expect(stringTag).toBe('[object DB]');
  });

  test('Test scanIndex', async () => {
    const db = new DB({
      Table: 'testTable',
      PartitionKey: 'pkey',
      SortKey: 'skey'
    });

    const response = await db.scanIndex(ddbScanIndexData);
    expect(response.Items).toStrictEqual(ddbQueryResponse.Items);

    await db.scanIndex({ Name: 'test' }).catch(error => {
      expect(error.message).toBe('scanIndex missing Key, Value');
    });
  });

  test('Test Scan', async () => {
    const db = new DB({
      Table: 'testTable',
      PartitionKey: 'pkey',
      SortKey: 'skey'
    });

    const response = await db.scan();
    expect(response).toStrictEqual(ddbQueryResponse.Items);
  });

  test('Test Update', async () => {
    const db = new DB({
      Table: 'testTable',
      PartitionKey: 'pkey',
      SortKey: 'skey'
    });
    const testPrimary = 'primarykey';
    const testSort = 'sortkey';
    const attributeKey = 'attributeKey';
    const attributeValue = 'attributeValue';

    const updated = await db.update(testPrimary, testSort, {
      attributeKey: attributeValue
    });
    expect(updated.Key.pkey).toBe(testPrimary);
    expect(updated.Key.skey).toBe(testSort);
    expect(updated.AttributeUpdates[attributeKey].Value).toBe(attributeValue);
  });

  test('Test dropColumns', async () => {
    const db = new DB({
      Table: 'testTable',
      PartitionKey: 'pkey',
      SortKey: 'skey'
    });
    const testPrimary = 'primarykey';
    const testSort = 'sortkey';
    const column = 'att1';

    let response = await db.dropColumns(testPrimary, testSort, column);
    expect(response).toStrictEqual([column]);

    response = await db.dropColumns(testPrimary, testSort, db.partitionKey);
    expect(response).toStrictEqual([]);
  });

  test('Test purge', async () => {
    const db = new DB({
      Table: 'testTable',
      PartitionKey: 'pkey',
      SortKey: 'skey'
    });
    const testPrimary = 'testPrimaryKey';
    const testSort = 'testSortKey';

    const response = await db.purge(testPrimary, testSort);
    expect(response.TableName).toBe(db.table);
    expect(response.Key[db.partitionKey]).toBe(testPrimary);
    expect(response.Key[db.sortKey]).toBe(testSort);
  });
});


describe('Test SNS', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
    AWS.mock('SNS', 'publish', Promise.resolve());
  });

  afterEach(() => {
    AWS.restore('SNS');
  });

  test('Test send success', async () => {
    const response = await SNS.send('subject', 'message');
    expect(response).toBe(true);
  });

  test('Test send fail', async () => {
    let response = await SNS.send('', '', '');
    expect(response).toBe(false);

    AWS.remock('SNS', 'publish', Promise.reject());
    response = await SNS.send('subject', 'message');
    expect(response).toBe(false);
  });

});


describe('Test EDLComposer', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
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
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  test('Test suggestFrameCaptureRate', () => {
    let response = FrameCaptureModeHelper.suggestFrameCaptureRate('a', '');
    expect(response).toStrictEqual([]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, 0);
    expect(response).toStrictEqual([]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1FPS);
    expect(response).toStrictEqual([1000,1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_ALL);
    expect(response).toStrictEqual([1000,1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_HALF_FPS);
    expect(response).toStrictEqual([500,1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1F_EVERY_2S);
    expect(response).toStrictEqual([500,1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1F_EVERY_5S);
    expect(response).toStrictEqual([200,1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1F_EVERY_10S);
    expect(response).toStrictEqual([100,1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1F_EVERY_30S);
    expect(response).toStrictEqual([33,1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1F_EVERY_1MIN);
    expect(response).toStrictEqual([16,1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1F_EVERY_2MIN);
    expect(response).toStrictEqual([8,1000]);

    response = FrameCaptureModeHelper.suggestFrameCaptureRate(1, FrameCaptureMode.MODE_1F_EVERY_5MIN);
    expect(response).toStrictEqual([3,1000]);
  });
});


describe('Test IotStatus', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
    AWS.mock('IotData', 'publish', function(params, callback) {
      callback(null, params);
    });
  });

  afterEach(() => {
    AWS.restore('IotData');
  });

  test('Test publish', async () => {
    const response = await IotStatus.publish(iotStatusMessage);
    expect(response.topic).toBe(Environment.Iot.Topic);
    expect(response.payload).toBe(JSON.stringify(iotStatusMessage));
  });
});


describe('Test Retry', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  test('Test run', async () => {
    jest.setTimeout(30000);

    const errorObject = {code: 'ProvisionedThroughputExceededException'};
    let fn = (params) => {
      throw errorObject;
    };
    expect(await Retry.run(fn, {})).toBe(undefined);
  });
});


describe('Test ServiceAvailability', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  test('Test probe', async () => {
    expect(await ServiceAvailability.probe('transcribe', 'us-east-1')).toBe(true);
    
    await ServiceAvailability.probe().catch(error => {
      expect(error.message).toBe('service must be provided');
    });

    expect(await ServiceAvailability.probe('invalid')).toBe(false);
  });
});


describe('Test ServiceToken', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache

    AWS.mock('DynamoDB.DocumentClient', 'query', Promise.resolve(JSON.parse(JSON.stringify(ddbQueryResponse))));

    AWS.mock('DynamoDB.DocumentClient', 'update', function(params, callback) {
      callback(null, params);
    });

    AWS.mock('DynamoDB.DocumentClient', 'delete', function(params, callback) {
      callback(null, params);
    });
  });

  afterEach(() => {
    AWS.restore('DynamoDB.DocumentClient');
  });

  test('Test register', async () => {
    const id = 'testId';
    const token = 'testToken';
    const service = 'testService';
    const api = 'testApi';
    const data = { testData: 'testDataVal'};
    const db = await ServiceToken.register(id, token, service, api, data);

    expect(db.TableName).toBe(Environment.DynamoDB.ServiceToken.Table);
    expect(db.Key[Environment.DynamoDB.ServiceToken.PartitionKey]).toBe(id);
    expect(db.Key[Environment.DynamoDB.ServiceToken.SortKey]).toBe(ServiceToken.Token.Name);
    expect(db.AttributeUpdates['token']['Value']).toBe(token);
    expect(db.AttributeUpdates['service']['Value']).toBe(service);
    expect(db.AttributeUpdates['api']['Value']).toBe(api);
    expect(db.AttributeUpdates['data']['Value']).toStrictEqual(data);
    expect(db.AttributeUpdates['ttl']['Value']).toBeGreaterThan(0);
  });

  test('Test getData', async () => {
    const response = await ServiceToken.getData('id');
    expect(response).toStrictEqual(ddbQueryResponse.Items[0]);
  });

  test('Test unregister', async () => {
    const id = 'testId';

    const response = await ServiceToken.unregister(id);
    expect(response.TableName).toBe(Environment.DynamoDB.ServiceToken.Table);
    expect(response.Key[Environment.DynamoDB.ServiceToken.PartitionKey]).toBe(id);
    expect(response.Key[Environment.DynamoDB.ServiceToken.SortKey]).toBe(ServiceToken.Token.Name);
  });
});


describe('Test TimelineQ', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  test('Test CelebItem', () => {
    const celebResponse = TimelineQ.createTypedItem(celebItem, {});
    expect(celebResponse['$name']).toBe(celebItem.Celebrity.Name);
    expect(celebResponse['$end']).toBe(celebItem.Timestamp);
    expect(celebResponse['$begin']).toBe(celebItem.Timestamp);
    expect(celebResponse['$boundingBox']).toStrictEqual(celebItem.Celebrity.BoundingBox);
    expect(celebResponse['$confidence']).toBe(celebItem.Celebrity.Confidence);
    expect(celebResponse.canUse()).toBe(true);
  });

  test('Test ModerationItem', () => {
    const moderationResponse = TimelineQ.createTypedItem(moderationItem, {});
    expect(moderationResponse['$name']).toBe(moderationItem.ModerationLabel.ParentName);
    expect(moderationResponse['$parentName']).toBe(moderationItem.ModerationLabel.Name);
    expect(moderationResponse['$confidence']).toBe(moderationItem.ModerationLabel.Confidence);
    expect(moderationResponse['$begin']).toBe(moderationItem.Timestamp);
    expect(moderationResponse['$end']).toBe(moderationItem.Timestamp);
    expect(moderationResponse.canUse()).toBe(false);
  });

  test('Test LabelItem', () => {
    const labelResponse = TimelineQ.createTypedItem(labelItem, {});
    expect(labelResponse['$name']).toBe(labelItem.Label.Name);
    expect(labelResponse['$confidence']).toBe(labelItem.Label.Confidence);
    expect(labelResponse['$begin']).toBe(labelItem.Timestamp);
    expect(labelResponse['$end']).toBe(labelItem.Timestamp);
    expect(labelResponse['$boundingBox']).toStrictEqual(labelItem.Label.Instances[0].BoundingBox);
    expect(labelResponse['$parentName']).toBe(labelItem.Label.Parents.map(x => x.Name).join(', '));
    expect(labelResponse.canUse()).toBe(true);
  });

  test('Test FaceMatchItem', () => {
    const faceMatchResponse = TimelineQ.createTypedItem(faceMatchItem, {});
    expect(faceMatchResponse['$name']).toBe(faceMatchItem.FaceMatches[0].Face.ExternalImageId);
    expect(faceMatchResponse['$confidence']).toBe(faceMatchItem.FaceMatches[0].Similarity);
    expect(faceMatchResponse['$begin']).toBe(faceMatchItem.Timestamp);
    expect(faceMatchResponse['$end']).toBe(faceMatchItem.Timestamp);
    expect(faceMatchResponse['$boundingBox']).toStrictEqual(faceMatchItem.Person.BoundingBox);
    expect(faceMatchResponse['$parentName']).toBe(`Index ${faceMatchItem.Person.Index}`);
    expect(faceMatchResponse.canUse()).toBe(false);
  });

  test('Test CustomLabelItem', () => {
    const customLabelResponse = TimelineQ.createTypedItem(customLabelItem, {});
    expect(customLabelResponse['$name']).toBe(customLabelItem.CustomLabel.Name);
    expect(customLabelResponse['$confidence']).toBe(customLabelItem.CustomLabel.Confidence);
    expect(customLabelResponse['$begin']).toBe(customLabelItem.Timestamp);
    expect(customLabelResponse['$end']).toBe(customLabelItem.Timestamp);
    expect(customLabelResponse['$boundingBox']).toStrictEqual(customLabelItem.CustomLabel.Geometry.BoundingBox);
    expect(customLabelResponse.canUse()).toBe(true);
    const cy = customLabelResponse['$cy'];
    const cx = customLabelResponse['$cx'];
    expect(customLabelResponse.cueAlignment).toBe(`align:center line:${Math.floor(cy * 100)}% position:${Math.floor(cx * 100)}% size:25%`);
    customLabelResponse['$cx'] = undefined;
    expect(customLabelResponse.cueAlignment).toBe('align:end line:0% position:100% size:25%');
  });

  test('Test PersonItem', () => {
    const personResponse = TimelineQ.createTypedItem(personItem, {});
    let expectParentName = [
      ((personItem.Person.Face || {}).Gender) ? personItem.Person.Face.Gender.Value : undefined,
      ((personItem.Person.Face || {}).AgeRange) ? `(${personItem.Person.Face.AgeRange.Low} - ${personItem.Person.Face.AgeRange.High})` : undefined,
    ].filter(x => x).join(' ');
    expect(personResponse['$name']).toBe(personItem.Person.Index.toString());
    expect(personResponse['$confidence']).toBe(personItem.Person.Confidence);
    expect(personResponse['$begin']).toBe(personItem.Timestamp);
    expect(personResponse['$end']).toBe(personItem.Timestamp);
    expect(personResponse['$boundingBox']).toStrictEqual(personItem.Person.BoundingBox);
    expect(personResponse['$parentName']).toBe(expectParentName);
    expect(personResponse.canUse()).toBe(true);
  });

  test('Test FaceItem', () => {
    const faceResponse = TimelineQ.createTypedItem(faceItem, {});
    expectParentName = [
      (faceItem.Face.AgeRange) ? `(${faceItem.Face.AgeRange.Low} - ${faceItem.Face.AgeRange.High})` : undefined,
      (faceItem.Face.Emotions.sort((a, b) => b.Confidence - a.Confidence)[0] || {}).Type,
    ].filter(x => x).join(' ');
    expect(faceResponse['$name']).toBe(faceItem.Face.Gender.Value);
    expect(faceResponse['$confidence']).toBe(faceItem.Face.Confidence);
    expect(faceResponse['$begin']).toBe(faceItem.Timestamp);
    expect(faceResponse['$end']).toBe(faceItem.Timestamp);
    expect(faceResponse['$boundingBox']).toStrictEqual(faceItem.Face.BoundingBox);
    expect(faceResponse.canUse()).toBe(false);
  });

  test('Test TextItem', () => {
    const textResponse = TimelineQ.createTypedItem(textItem, {});
    const expectName = (textItem.TextDetection.Type === 'LINE') ? textItem.TextDetection.DetectedText : undefined;
    expect(textResponse['$name']).toBe(expectName);
    expect(textResponse['$confidence']).toBe(textItem.TextDetection.Confidence);
    expect(textResponse['$end']).toBe(textItem.Timestamp);
    expect(textResponse['$begin']).toBe(textItem.Timestamp);
    expect(textResponse['$boundingBox']).toStrictEqual(textItem.TextDetection.Geometry.BoundingBox);
    expect(textResponse.canUse()).toBe(false);
  });

  test('Test createTypedItem fail', () => {
    try {
      TimelineQ.createTypedItem({});
    }
    catch(error) {
      expect(error.message).toBe('fail to create typed item');
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
      return values.reduce((a0, c0) => a0 * Math.pow(c0, power), 1);
    };

    const reduce = queue.reduceAll();
    expect(reduce['$name']).toBe(item1['$name']);
    expect(reduce['$confidence']).toBe(mean([item1['$confidence'], item2['$confidence']]));
    expect(reduce['$begin']).toBe(item1['$begin']);
    expect(reduce['$end']).toBe(item2['$end']);
    expect(reduce['$boundingBox'].Left).toBe(mean([item1['$boundingBox'].Left, item2['$boundingBox'].Left]));
    expect(reduce['$boundingBox'].Top).toBe(mean([item1['$boundingBox'].Top, item2['$boundingBox'].Top]));
    expect(reduce['$boundingBox'].Width).toBe(mean([item1['$boundingBox'].Width, item2['$boundingBox'].Width]));
    expect(reduce['$boundingBox'].Height).toBe(mean([item1['$boundingBox'].Height, item2['$boundingBox'].Height]));
    expect(reduce['$parentName']).toBe(item1['$parentName']);
    expect(reduce['$count']).toBe(2);

    queue.pop();
    expect(queue.reduceAll()).toBe(undefined);

    expect(TimelineQ.computeGeometricMean([])).toBe(undefined);
  });

  test('Test timeDriftExceedThreshold', () => {
    const item1 = TimelineQ.createTypedItem(personItem, {});
    const item2 = TimelineQ.createTypedItem(personItem, {});

    expect(TimelineQ.timeDriftExceedThreshold(item2, item1)).toBe(false);

    item1['$begin'] = 100;
    item1['$timeDriftThreshold'] = 5;
    item2['$end'] = 1;

    expect(TimelineQ.timeDriftExceedThreshold(item2, item1)).toBe(true);
    expect(TimelineQ.timeDriftExceedThreshold()).toBe(false);
  });

  test('Test positionDriftExceedThreshold', () => {
    const item1 = TimelineQ.createTypedItem(personItem, {});
    const item2 = TimelineQ.createTypedItem(personItem, {});

    expect(TimelineQ.positionDriftExceedThreshold(item2, item1)).toBe(false);

    item1['$cx'] = 1;
    item1['$cy'] = 1;
    item2['$cx'] = 5;
    item2['$cy'] = 5;
    item1['$positionDriftThreshold'] = 1;

    expect(TimelineQ.positionDriftExceedThreshold(item2, item1)).toBe(true);
    expect(TimelineQ.positionDriftExceedThreshold()).toBe(false);
  });
});


describe('Test WebVttTrack', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  test('Test cues operations', () => {
    const track = new WebVttTrack();
    expect(track.length).toBe(0);

    const firstCue = new WebVttCue(cue1.begin, cue1.end, cue1.text, cue1.position);
    track.push(firstCue);
    expect(track.length).toBe(1);

    track.addCue(cue2.begin, cue2.end, cue2.text, cue2.position);
    track.addCue(cue3.begin, cue3.end, cue3.text, cue3.position);
    const shiftCue = track.shift();
    const popCue = track.pop();
    expect(shiftCue).toStrictEqual(firstCue);
    expect(popCue['$text']).toBe(cue3.text);
  });

  test('Test track operations', () => {
    const track = new WebVttTrack();
    track.addCue(cue1.begin, cue1.end, cue1.text, cue1.position);
    track.addCue(cue2.begin, cue2.end, cue2.text, cue2.position);

    const parsed = WebVttTrack.parse(track.toString());
    expect(parsed['$cues'][0]['$text']).toBe(track.cues[0]['$text']);
    expect(parsed['$cues'][1]['$text']).toBe(track.cues[1]['$text']);

    let lines = track.toString().split('\n');
    expect(lines.shift()).toBe('WEBVTT');
    expect(lines.shift()).toBe('');
    expect(lines.shift()).toBe('0');
    expect(lines.shift()).toBe(`${track.cues[0].toTimeString(cue1.begin)} --> ${track.cues[0].toTimeString(cue1.end)} ${cue1.position}`);
    expect(lines.shift()).toBe(cue1.text);
    expect(lines.shift()).toBe('');
    expect(lines.shift()).toBe('1');
    expect(lines.shift()).toBe(`${track.cues[1].toTimeString(cue2.begin)} --> ${track.cues[1].toTimeString(cue2.end)} ${cue2.position}`);
    expect(lines.shift()).toBe(cue2.text);
    
    track.length = 5;
    expect(track.length).toBe(5);
  });

  test('Test convertToMilliseconds', () => {
    expect(WebVttTrack.convertToMilliseconds(['00', '11', '22', '000'])).toBeGreaterThan(0);
  });
});


describe('Test mxCommonUtils', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
    AWS.mock('S3', 'headObject', function(params, callback) {
      callback(null, params);
    });

    AWS.mock('S3', 'listObjectsV2', function(params, callback) {
      callback(null, params);
    });

    AWS.mock('S3', 'getObject', function(params, callback) {
      callback(null, params);
    });

    AWS.mock('S3', 'putObject', function(params, callback) {
      callback(null, params);
    });

    AWS.mock('S3', 'deleteObject', Promise.resolve());

    AWS.mock('S3', 'getObjectTagging', function(params, callback) {
      const response = params;
      response.TagSet = [
        {
          Key: 'tag1',
          Value: 'val1'
        }, {
          Key: 'tag3',
          Value: 'val3'
        }
      ];
      callback(null, response);
    });

    AWS.mock('S3', 'putObjectTagging', function(params, callback) {
      callback(null, params);
    });

    AWS.mock('S3', 'selectObjectContent', function(params, callback) {
      callback(new Error('error selectObjectContent'), null);
    });

    AWS.mock('S3', 'restoreObject', function(params, callback) {
      callback(null, params);
    });

    AWS.mock('S3', 'copyObject', function (params, callback) {
      callback(null, params);
    });
  });

  afterEach(() => {
    AWS.restore('S3');
  });

  test('Test unsignedUrl', () => {
    const bucket = 'bucketname';
    const key = 'key';
    expect(CommonUtils.unsignedUrl(bucket, key)).toMatch(new RegExp(`https://${bucket}.s3.*.amazonaws.com/${key}`));
  });

  test('Test headObject', async () => {
    const bucket = 'bucketname';
    const key = 'key';
    const response = await CommonUtils.headObject(bucket, key);
    expect(response.Bucket).toBe(bucket);
    expect(response.Key).toBe(key);
    expect(response.ExpectedBucketOwner).toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test listObjects', async () => {
    const bucket = 'bucketname';
    const prefix = 'pre';
    const response = await CommonUtils.listObjects(bucket, prefix, {});
    expect(response.Bucket).toBe(bucket);
    expect(response.Prefix).toBe(`${prefix}/`);
    expect(response.ExpectedBucketOwner).toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test download', async () => {
    const bucket = 'bucketname';
    const key = 'key';
    const response = await CommonUtils.download(bucket, key, false);
    expect(response.Bucket).toBe(bucket);
    expect(response.Key).toBe(key);
    expect(response.ExpectedBucketOwner).toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test upload', async () => {
    const params = {
      Bucket: 'bucketName',
      Key: 'key',
      Body: '{}',
      ContentType: 'test'
    };
    const response = await CommonUtils.upload(params);
    expect(response.Bucket).toBe(params.Bucket);
    expect(response.Key).toBe(params.Key);
    expect(response.ContentType).toBe(params.ContentType);
    expect(response.ExpectedBucketOwner).toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test uploadFile', async () => {
    const bucket = 'bucketname';
    const prefix = 'pre';
    const filename = 'file.txt';
    const response = await CommonUtils.uploadFile(bucket, prefix, filename, {});
    
    expect(response.Bucket).toBe(bucket);
    expect(response.Key).toBe(`${prefix}/${filename}`);
    expect(response.ExpectedBucketOwner).toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test deleteObject', async () => {
    const bucket = 'bucketname';
    const key = 'key';
    expect(await CommonUtils.deleteObject(bucket, key)).toBe(true);
  });

  test('Test getTags', async () => {
    const bucket = 'bucketname';
    const key = 'key';
    const response = await CommonUtils.getTags(bucket, key);

    expect(response.Bucket).toBe(bucket);
    expect(response.Key).toBe(key);
    expect(response.ExpectedBucketOwner).toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test tagObject', async () => {
    const bucket = 'bucketname';
    const key = 'key';
    const tagset = [
      {
        Key: 'tag1',
        Value: 'val1'
      }, {
        Key: 'tag2',
        Value: 'val2'
      }
    ];
    const response = await CommonUtils.tagObject(bucket, key, tagset);

    expect(response.Bucket).toBe(bucket);
    expect(response.Key).toBe(key);
    expect(response.ExpectedBucketOwner).toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
    expect(response.Tagging.TagSet).toContain(tagset[0]);
    expect(response.Tagging.TagSet).toContain(tagset[1]);
  });

  test('Test createReadStream', async () => {
    const stream = 'test stream';
    const bucket = 'bucketname';
    const key = 'key';
    AWS.remock('S3', 'getObject', Buffer.from(stream));
    const response = await CommonUtils.createReadStream(bucket, key, {});

    expect(response.read().toString()).toBe(stream);
  });

  test('Test selectS3Content', async () => {
    const bucket = 'bucketname';
    const key = 'key';

    await CommonUtils.selectS3Content(bucket, key, '').catch(error => {
      expect(error.message).toBe('error selectObjectContent');
    });
  });

  test('Test restoreObject', async () => {
    const bucket = 'bucketname';
    const key = 'key';
    const response = await CommonUtils.restoreObject(bucket, key, {});

    expect(response.Bucket).toBe(bucket);
    expect(response.Key).toBe(key);
    expect(response.ExpectedBucketOwner).toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test copyObject', async () => {
    const source = 'sourcename';
    const bucket = 'bucketname';
    const key = 'key';
    const response = await CommonUtils.copyObject(source, bucket, key, {});

    expect(response.CopySource).toBe(source);
    expect(response.Bucket).toBe(bucket);
    expect(response.Key).toBe(key);
    expect(response.ExpectedBucketOwner).toBe(process.env.ENV_EXPECTED_BUCKET_OWNER);
  });

  test('Test uuid4', () => {
    expect(CommonUtils.uuid4()).toBeTruthy();

    const str = 's';
    try {
      CommonUtils.uuid4(str);
    }
    catch(error) {
      expect(error.message).toBe(`failed to generate UUID from '${str}'`);
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
    expect(CommonUtils.toMD5String('test')).toMatch(new RegExp(/[0-9A-Fa-f]{6}/g));
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
    expect(parseInt(md5)).toBe(0);

    const accountId = CommonUtils.zeroAccountId();
    expect(accountId.length).toBe(12);
    expect(parseInt(accountId)).toBe(0);

    const uuid = CommonUtils.zeroUUID();
    expect(uuid.length).toBe(36);
    expect(parseInt(uuid)).toBe(0);
  });

  test('Test pause', async () => {
    expect(CommonUtils.pause(1000)).resolves.not.toThrow();
  });

  test('Test toISODateTime', () => {
    expect(CommonUtils.toISODateTime().length).toBeGreaterThan(0);
  });

  test('Test random', () => {
    let min = 3;
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

  test('Test Mime functions', () => {
    expect(CommonUtils.getMime('file.txt')).toBe('text/plain');
    expect(CommonUtils.getExtensionByMime('text/plain')).toBe('txt');
    expect(CommonUtils.parseMimeType('text/plain')).toBe('plain');
  });

  test('Test capitalize', () =>{
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
      expect(error.message).toBe('target must be Array object');
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


describe('Test mxNeat', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  test('Test neat', () => {
    const json = {
      key1: 'val1',
      key2: undefined
    };
    const neat = CommonUtils.neat(json);
    delete json['key2'];
    expect(neat).toStrictEqual(json);

    json['key1'] = undefined;
    expect(CommonUtils.neat(json)).toBe(undefined);
  });
});


describe('Test mxValidation', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  test('Test validateBucket', async () => {
    const bucketName = new StringBuilder('a');
    expect(CommonUtils.validateBucket(bucketName.toString())).toBe(false);

    bucketName.repeat(2); //aaa
    expect(CommonUtils.validateBucket(bucketName.toString())).toBe(true);

    bucketName.append('A'); //aaaA
    expect(CommonUtils.validateBucket(bucketName.toString())).toBe(false);

    bucketName.replace(3,4,'_'); //aaa_
    expect(CommonUtils.validateBucket(bucketName.toString())).toBe(false);

    bucketName.deleteCharAt(3);
    bucketName.repeat(22); //66 chars
    expect(CommonUtils.validateBucket(bucketName.toString())).toBe(false);
  });

  test('Test validateUuid', async () => {
    expect(CommonUtils.validateUuid('1234')).toBe(false);
    expect(CommonUtils.validateUuid('12345678-1234-1234-1234-123456789abc')).toBe(true);
  });

  test('Test validateCognitoIdentityId', () => {
    expect(CommonUtils.validateCognitoIdentityId(`us-east-1:${CommonUtils.zeroUUID()}`)).toBe(true);
    expect(CommonUtils.validateCognitoIdentityId()).toBe(false);
  });

  test('Test validateBase64JsonToken', () => {
    const json = {
      key1: 'val1'
    };
    const buf = Buffer.from(JSON.stringify(json));

    expect(CommonUtils.validateBase64JsonToken(buf)).toBe(true);
    expect(CommonUtils.validateBase64JsonToken()).toBe(false);
  });

  test('Test validateFaceCollectionId', () => {
    expect(CommonUtils.validateFaceCollectionId('a1._-')).toBe(true);
    expect(CommonUtils.validateFaceCollectionId('/')).toBe(false);
  });

  test('Test validateS3Uri', () => {
    expect(CommonUtils.validateS3Uri('s3://bucketname/key')).toBe(true);
    expect(CommonUtils.validateS3Uri('a3://bucketname/key')).toBe(false);
    expect(CommonUtils.validateS3Uri('s3://bu/key')).toBe(false);
  });
});

describe('Test Metrics', () => {
  const httpsCache = https;
  const requestWriteMock = jest.fn();
  const requestOnMock = jest.fn();
  const requestEndMock = jest.fn();

  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    https.request = jest.fn(() => ({
      write: requestWriteMock,
      on: requestOnMock,
      end: requestEndMock,
    }));
  });

  afterEach(() => {
    https.request = httpsCache.request;
    jest.resetModules() // Most important - it clears the cache
  })

  test('Test Constants', () => {
    const metricsConstants = Metrics.Constants;
    expect(metricsConstants.Host).toBe('metrics.awssolutionsbuilder.com');
    expect(metricsConstants.Path).toBe('/generic');
  });

  test('Test sendAnonymizedData', async () => {
    Metrics.sendAnonymizedData('this is a test data');
    expect(https.request.mock.calls.length).toBe(1);
    expect(https.request.mock.lastCall[0]).toEqual({
      hostname: Metrics.Constants.Host,
      port: 443,
      path: Metrics.Constants.Path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const parsedRequestWriteCallParam = JSON.parse(requestWriteMock.mock.lastCall[0]);
    expect(parsedRequestWriteCallParam.Data).toBe('this is a test data');
    expect(requestOnMock.mock.calls.length).toBe(1);
    expect(requestEndMock.mock.calls.length).toBe(1);
  });
});

describe('Test Errors', () => {
  test('Test ConfigurationError', () => {
    const error = new ConfigurationError();
    expect(error.name).toBe('ConfigurationError');
    expect(error.message).toBe('1000 - configuration error');
    expect(error.errorCode).toBe(1000);
  });

  test('Test IngestError', () => {
    const error = new IngestError();
    expect(error.name).toBe('IngestError');
    expect(error.message).toBe('1001 - unknown ingest error');
    expect(error.errorCode).toBe(1001);
  });

  test('Test AnalysisError', () => {
    const error = new AnalysisError();
    expect(error.name).toBe('AnalysisError');
    expect(error.message).toBe('1002 - unknown analysis error');
    expect(error.errorCode).toBe(1002);
  });

  test('Test IndexError', () => {
    const error = new IndexError();
    expect(error.name).toBe('IndexError');
    expect(error.message).toBe('1003 - unknown index error');
    expect(error.errorCode).toBe(1003);
  });

  test('Test ChecksumError', () => {
    const error = new ChecksumError();
    expect(error.name).toBe('ChecksumError');
    expect(error.message).toBe('1004 - unknown checksum error');
    expect(error.errorCode).toBe(1004);
  });

  test('Test RestoreError', () => {
    const error = new RestoreError();
    expect(error.name).toBe('RestoreError');
    expect(error.message).toBe('1005 - unknown restore error');
    expect(error.errorCode).toBe(1005);
  });

  test('Test JobStatusError', () => {
    const error = new JobStatusError();
    expect(error.name).toBe('JobStatusError');
    expect(error.message).toBe('1006 - unknown job status error');
    expect(error.errorCode).toBe(1006);
  });

  test('Test GroundTruthError', () => {
    const error = new GroundTruthError();
    expect(error.name).toBe('GroundTruthError');
    expect(error.message).toBe('1007 - unknown ground truth error');
    expect(error.errorCode).toBe(1007);
  });

  test('Test TranscodeError', () => {
    const error = new TranscodeError();
    expect(error.name).toBe('TranscodeError');
    expect(error.message).toBe('1008 - unknown transcode error');
    expect(error.errorCode).toBe(1008);
  });

  test('Test NotImplError', () => {
    const error = new NotImplError();
    expect(error.name).toBe('NotImplError');
    expect(error.message).toBe('1009 - not impl');
    expect(error.errorCode).toBe(1009);
  });

  test('Test FixityError', () => {
    const error = new FixityError();
    expect(error.name).toBe('FixityError');
    expect(error.message).toBe('1010 - unknown fixity error');
    expect(error.errorCode).toBe(1010);
  });
});


