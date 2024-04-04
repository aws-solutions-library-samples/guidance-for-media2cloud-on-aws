// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  beforeAll,
  describe,
  expect,
} = require('@jest/globals');

const BacklogTableStream = require('./index');

const eventInsert = {
  Records: [
    {
      eventName: 'INSERT',
      eventSource: 'aws:dynamodb',
      dynamodb: {
        Keys: {},
        OldImage: {},
        NewImage: {},
      },
    },
  ],
};

const eventModify = {
  Records: [
    {
      eventName: 'MODIFY',
      eventSource: 'aws:dynamodb',
      dynamodb: {
        Keys: {},
        OldImage: {},
        NewImage: {},
      },
    },
  ],
};

const eventRemove = {
  Records: [
    {
      eventName: 'REMOVE',
      eventSource: 'aws:dynamodb',
      dynamodb: {
        Keys: {},
        OldImage: {},
        NewImage: {},
      },
    },
  ],
};

describe('Test BacklogTableStream', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
  });

  afterEach(() => {
  });

  test('Test Event Insert', async () => {
    const backlog = new BacklogTableStream(eventInsert, {});

    expect(await backlog.process()).toBe(undefined);
    expect(backlog.eventName).toBe(eventInsert.Records[0].eventName);
  });

  test('Test Event Modify', async () => {
    const backlog = new BacklogTableStream(eventModify, {});

    expect(await backlog.process()).toBe(undefined);
    expect(backlog.eventName)
      .toBe(eventModify.Records[0].eventName);
  });

  test('Test Event Remove', async () => {
    const backlog = new BacklogTableStream(eventRemove, {});

    expect(await backlog.process())
      .toBe(undefined);
  });

  test('Test Event Invalid', async () => {
    eventModify.Records[0].eventName = 'invalid';
    const backlog = new BacklogTableStream(eventModify, {});

    await backlog.process().catch(error => {
      expect(error.message)
        .toBe(`invalid event, ${eventModify.Records[0].eventName}`);
    });
  });
});
