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
const Indexer = require('./index.js');

const mockIndexOutput = 'index';
const mockPutSettingsOutput = 'putSettings';
const mockGetSettingsOutput = 'getSettings';
const mockAggregateOutput = 'aggregate';
const mockGetDocumentOutput = 'getDocument';
const mockUpdateOutput = 'update';
const mockDeleteOutput = 'delete';
const mockHitsOutput = 5;

jest.mock('@elastic/elasticsearch', () => {
  return {
    Client: jest.fn(() => {
      return {
        indices: {
          create: (params, callback) => { return Promise.resolve(); },
          delete: (params, callback) => { return Promise.resolve(); },
          putSettings: (params, callback) => { return Promise.resolve(mockPutSettingsOutput); },
          getSettings: (params, callback) => { return Promise.resolve(mockGetSettingsOutput); }
        },
        cat: {
          indices: (params, callback) => { return Promise.resolve({ body: 'indices' }); }
        },
        search: (params, callback) => {
          return Promise.resolve({
            body: {
              aggregations: mockAggregateOutput,
              hits: mockHitsOutput
            }
          });
        },
        get: (params, callback) => {
          return Promise.resolve({
            body: {
              _source: mockGetDocumentOutput
            }
          });
        },
        update: (params, callback) => { return Promise.resolve(mockUpdateOutput); },
        delete: (params, callback) => { return Promise.resolve(mockDeleteOutput); },
        index: (params, callback) => { return Promise.resolve(mockIndexOutput); }
      }
    })
  };
});


jest.mock('aws-elasticsearch-connector', () => {
  return jest.fn();
});

describe('Test Indexer', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  test('Test constructor', () => {
    try {
      const indexer = new Indexer('');
    }
    catch(error) {
      expect(error.message).toBe('endpoint not specified');
    }

    const indexer = new Indexer();
    expect(indexer.client).toBeTruthy();
  });

  test('Test index', async () => {
    const indexer = new Indexer();
    let response = await indexer.index('name', 'id', 'body');
    expect(response).toBe(mockIndexOutput);

    await indexer.index('', '', '').catch(error => {
      expect(error.message).toBe('name, id, or body not specified');
    });
  });

  test('Test batchCreateIndices', async () => {
    const indexer = new Indexer();
    let response = await indexer.batchCreateIndices();
    expect(response.length).toBeGreaterThan(0);

    await indexer.batchCreateIndices(['']).catch(error => {
      expect(error.message).toBe('');
    });
  });

  test('Test batchDeleteIndices', async () => {
    const indexer = new Indexer();
    let response = await indexer.batchDeleteIndices();
    expect(response.length).toBeGreaterThan(0);

    await indexer.batchDeleteIndices(['']).catch(error => {
      expect(error.message).toBe('');
    });
  });

  test('Test describeAllIndices', async () => {
    const indexer = new Indexer();
    const response = await indexer.describeAllIndices();
    expect(response.length).toBeGreaterThan(0);
  });

  test('Test describeIndex', async () => {
    const indexer = new Indexer();
    const response = await indexer.describeIndex('name');
    expect(response.length).toBeGreaterThan(0);

    await indexer.describeIndex('').catch(error => {
      expect(error.message).toBe('index name not specified');
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
    const response = await indexer.indexDocument('name', 'id', 'doc');
    expect(response).toBe(mockUpdateOutput);

    await indexer.indexDocument('', '', '').catch(error => {
      expect(error.message).toBe('name, id, or doc not specified');
    });
  });

  test('Test deleteDocument', async () => {
    const indexer = new Indexer();
    const response = await indexer.deleteDocument('name', 'id');
    expect(response).toBe(mockDeleteOutput);

    await indexer.deleteDocument('', '').catch(error => {
      expect(error.message).toBe('name or id not specified');
    });
  });

  test('Test searchDocument', async () => {
    const indexer = new Indexer();
    const response = await indexer.searchDocument({ index: 'idx'} );
    expect(response).toBe(mockHitsOutput);

    await indexer.searchDocument({}).catch(error => {
      expect(error.message).toBe('index not specified');
    });
  });

});