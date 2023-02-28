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
const BacklogTableStream = require('./index.js');

const AWS = require('aws-sdk-mock');
const SDK = require('aws-sdk');
AWS.setSDKInstance(SDK);

const eventInsert = {
  Records: [
    {
      eventName: 'INSERT',
      eventSource: 'aws:dynamodb',
      dynamodb: {
        Keys: 'keys',
        OldImage: 'oldimage',
        NewImage: 'newimage'
      }
    }
  ]
};
const eventModify = {
  Records: [
    {
      eventName: 'MODIFY',
      eventSource: 'aws:dynamodb',
      dynamodb: {
        Keys: 'keys',
        OldImage: 'oldimage',
        NewImage: 'newimage'
      }
    }
  ]
};
const eventRemove = {
  Records: [
    {
      eventName: 'REMOVE',
      eventSource: 'aws:dynamodb',
      dynamodb: {
        Keys: 'keys',
        OldImage: 'oldimage',
        NewImage: 'newimage'
      }
    }
  ]
};


describe('Test BacklogTableStream', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
    AWS.mock('DynamoDB.Converter', 'unmarshall', Promise.resolve({ serviceApi: 'test' }));
  });

  afterEach(() => {
    AWS.restore('DynamoDB.Converter');
  });

  test('Test Event Insert', async () => {
    const backlog = new BacklogTableStream(eventInsert, {});

    expect(await backlog.process()).toBe(undefined);
    expect(backlog.eventName).toBe(eventInsert.Records[0]['eventName']);
  });

  test('Test Event Modify', async () => {
    const backlog = new BacklogTableStream(eventModify, {});

    expect(await backlog.process()).toBe(undefined);
    expect(backlog.eventName).toBe(eventModify.Records[0]['eventName']);
  });

  test('Test Event Remove', async () => {
    const backlog = new BacklogTableStream(eventRemove, {});

    expect(await backlog.process()).toBe(undefined);
  });

  test('Test Event Invalid', async () => {
    eventModify.Records[0]['eventName'] = 'invalid';
    const backlog = new BacklogTableStream(eventModify, {});

    await backlog.process().catch(error => {
      expect(error.message).toBe(`invalid event, ${eventModify.Records[0]['eventName']}`);
    });
  });
});


