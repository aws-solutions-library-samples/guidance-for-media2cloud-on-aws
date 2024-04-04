// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  beforeAll,
  describe,
  expect,
} = require('@jest/globals');

const Indexer = require('./index');

const mockIndexOutput = 'index';
const mockPutSettingsOutput = 'putSettings';
const mockGetSettingsOutput = 'getSettings';
const mockAggregateOutput = 'aggregate';
const mockGetDocumentOutput = 'getDocument';
const mockUpdateOutput = 'update';
const mockDeleteOutput = 'delete';
const mockHitsOutput = 5;

jest.mock('@aws-sdk/credential-providers', () => ({
  fromEnv: jest.fn(() => ({
  })),
}));

jest.mock('@opensearch-project/opensearch/aws', () => ({
  AwsSigv4Signer: jest.fn(() => ({
  })),
}));

jest.mock('@opensearch-project/opensearch', () => ({
  Client: jest.fn(() => ({
    indices: {
      create: (params, callback) => Promise.resolve({}),
      delete: (params, callback) => Promise.resolve({}),
      putSettings: (params, callback) => Promise.resolve(mockPutSettingsOutput),
      getSettings: (params, callback) => Promise.resolve(mockGetSettingsOutput),
    },
    cat: {
      indices: (params, callback) => Promise.resolve({ body: 'indices' }),
    },
    search: (params, callback) => Promise.resolve({
      body: {
        aggregations: mockAggregateOutput,
        hits: mockHitsOutput,
      },
    }),
    msearch: (params, callback) => Promise.resolve({
      body: {
        hits: mockHitsOutput,
      },
    }),
    get: (params, callback) => Promise.resolve({
      body: {
        _source: mockGetDocumentOutput,
      },
    }),
    update: (params, callback) => Promise.resolve(mockUpdateOutput),
    delete: (params, callback) => Promise.resolve(mockDeleteOutput),
    index: (params, callback) => Promise.resolve(mockIndexOutput),
  })),
}));

describe('Test Indexer', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
  });

  test('Test constructor', () => {
    try {
      const indexer = new Indexer('');
    } catch (error) {
      expect(error.message).toBe('node not specified');
    }

    const indexer = new Indexer();
    expect(indexer.client).toBeTruthy();
  });

  test('Test index', async () => {
    const indexer = new Indexer();
    const response = await indexer.index('name', 'id', 'body');
    expect(response).toBe(mockIndexOutput);

    await indexer.index('', '', '').catch(error => {
      expect(error.message).toBe('name, id, or body not specified');
    });
  });

  test('Test batchCreateIndices', async () => {
    const indexer = new Indexer();
    const response = await indexer.batchCreateIndices();
    expect(response.length).toBeGreaterThan(0);

    await indexer.batchCreateIndices(['']).catch(error => {
      expect(error.message.length).toBeGreaterThan(0);
    });
  });

  test('Test batchDeleteIndices', async () => {
    const indexer = new Indexer();
    const response = await indexer.batchDeleteIndices();
    expect(response.length).toBeGreaterThan(0);

    await indexer.batchDeleteIndices(['']).catch(error => {
      expect(error.message.length).toBeGreaterThan(0);
    });
  });

  test('Test updateSettings', async () => {
    const indexer = new Indexer();
    const response = await indexer.updateSettings('name', 'settings');
    expect(response).toBe(mockPutSettingsOutput);

    await indexer.updateSettings('', '').catch(error => {
      expect(error.message).toBe('index name or settings not specified');
    });
  });

  test('Test getSettings', async () => {
    const indexer = new Indexer();
    const response = await indexer.getSettings('name');
    expect(response).toBe(mockGetSettingsOutput);

    await indexer.getSettings('').catch(error => {
      expect(error.message).toBe('index name not specified');
    });
  });

  test('Test aggregate', async () => {
    const indexer = new Indexer();
    const response = await indexer.aggregate('name');
    expect(response).toBe(mockAggregateOutput);
  });

  test('Test getDocument', async () => {
    const indexer = new Indexer();
    const response = await indexer.getDocument('name', 'id');
    expect(response).toBe(mockGetDocumentOutput);

    await indexer.getDocument('', '').catch(error => {
      expect(error.message).toBe('name or id not specified');
    });
  });

  test('Test indexDocument', async () => {
    const indexer = new Indexer();
    const response = await indexer.indexDocument('name', 'id', 'doc', false);
    expect(response).toBe(mockUpdateOutput);

    await indexer.indexDocument('', '', '', false).catch(error => {
      expect(error.message.length).toBeGreaterThan(0);
    });
  });

  test('Test deleteDocument', async () => {
    const indexer = new Indexer();
    const response = await indexer.deleteDocument('name', 'id');
    expect(response).toBe(mockDeleteOutput);

    await indexer.deleteDocument('', '').catch(error => {
      expect(error.message.length).toBeGreaterThan(0);
    });
  });

  test('Test searchDocument', async () => {
    const indexer = new Indexer();
    const response = await indexer.searchDocument({ index: 'idx' });
    expect(response).toBe(mockHitsOutput);

    await indexer.searchDocument({}).catch(error => {
      expect(error.message.length).toBeGreaterThan(0);
    });
  });
});
