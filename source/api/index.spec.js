// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  beforeAll,
  describe,
  expect,
} = require('@jest/globals');
const {
  mockClient,
} = require('aws-sdk-client-mock');
const {
  SFNClient,
  StartExecutionCommand,
} = require('@aws-sdk/client-sfn');
const {
  ComprehendClient,
  ListEntityRecognizersCommand,
} = require('@aws-sdk/client-comprehend');
const {
  IoTClient,
  AttachPolicyCommand,
} = require('@aws-sdk/client-iot');
const {
  RekognitionClient,
  ListCollectionsCommand,
  DescribeCollectionCommand,
  CreateCollectionCommand,
  DeleteCollectionCommand,
  ListFacesCommand,
  IndexFacesCommand,
  DeleteFacesCommand,
  DescribeProjectsCommand,
  DescribeProjectVersionsCommand,
} = require('@aws-sdk/client-rekognition');
const {
  TranscribeClient,
  ListLanguageModelsCommand,
  ListVocabulariesCommand,
} = require('@aws-sdk/client-transcribe');
const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const {
  CommonUtils,
  DB,
  Indexer,
} = require('core-lib');

const AnalysisOp = require('./lib/operations/analysisOp');
const AssetOp = require('./lib/operations/assetOp');
const IotOp = require('./lib/operations/iotOp');
const SearchOp = require('./lib/operations/searchOp');
const RekognitionOp = require('./lib/operations/rekognitionOp');
const TranscribeOp = require('./lib/operations/transcribeOp');
const ComprehendOp = require('./lib/operations/comprehendOp');
const StatsOp = require('./lib/operations/statsOp');
const UsersOp = require('./lib/operations/usersOp');
const SettingsOp = require('./lib/operations/settingsOp');
const ApiRequest = require('./lib/apiRequest');

const stepMock = mockClient(SFNClient);
const comprehendMock = mockClient(ComprehendClient);
const iotMock = mockClient(IoTClient);
const rekogMock = mockClient(RekognitionClient);
const transcribeMock = mockClient(TranscribeClient);
const cognitoIdpMock = mockClient(CognitoIdentityProviderClient);

const context = {
  invokedFunctionArn: 'arn:aws:service:region:account:resourceid',
  getRemainingTimeInMillis: 1000,
};

describe('Test API /assets', () => {
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules();
    stepMock.reset();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /assets', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    const uuid = 'testuuid';
    const ingestResponses = [{
      uuid,
      basename: 'basename',
      bucket: 'testbucket',
      key: 'testkey',
      destination: {
        bucket: 'testbucket',
        prefix: 'prefix',
      },
      schemaVersion: 1,
      overallStatus: 'COMPLETED',
      status: 'ANALYSIS_COMPLETED',
      type: 'video',
      mediainfo: [],
      proxies: [],
      analysis: [
        'video',
      ],
      aiOptions: {},
    }];

    jest.spyOn(DB.prototype, 'scanIndex')
      .mockImplementation((params) =>
        Promise.resolve(ingestResponses));

    const request = new ApiRequest({
      path: '/assets',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'assets',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const assetOp = new AssetOp(request);
    const response = await assetOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).length)
      .toBe(ingestResponses.length);
  });

  test('GET /assets/testuuid', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    const uuid = 'testuuid';
    const ingestResponse = {
      uuid,
      basename: 'basename',
      bucket: 'testbucket',
      key: 'testkey',
      destination: {
        bucket: 'testbucket',
        prefix: 'prefix',
      },
      schemaVersion: 1,
      overallStatus: 'COMPLETED',
      status: 'ANALYSIS_COMPLETED',
      type: 'video',
      mediainfo: [],
      proxies: [],
      analysis: [
        'video',
      ],
      aiOptions: {},
    };

    jest.spyOn(DB.prototype, 'fetch')
      .mockImplementation((key, skey, attrs) =>
        Promise.resolve(ingestResponse));

    const request = new ApiRequest({
      path: '/assets/testuuid',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'assets',
        uuid,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const assetOp = new AssetOp(request);
    const response = await assetOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).uuid)
      .toBe(uuid);
  });

  test('GET /assets?overallStatus=COMPLETED', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    const uuid = 'testuuid';
    const overallStatus = 'COMPLETED';
    const ingestResponses = [{
      uuid,
      basename: 'basename',
      bucket: 'testbucket',
      key: 'testkey',
      destination: {
        bucket: 'testbucket',
        prefix: 'prefix',
      },
      schemaVersion: 1,
      overallStatus: 'COMPLETED',
      status: 'ANALYSIS_COMPLETED',
      type: 'video',
      mediainfo: [],
      proxies: [],
      analysis: [
        'video',
      ],
      aiOptions: {},
    }];

    jest.spyOn(DB.prototype, 'scanIndex')
      .mockImplementation((params) =>
        Promise.resolve(ingestResponses));

    const request = new ApiRequest({
      path: '/assets',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'assets',
      },
      queryStringParameters: {
        overallStatus,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const assetOp = new AssetOp(request);
    const response = await assetOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).length)
      .toBe(ingestResponses.length);
  });

  test('GET /assets?type=video', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    const uuid = 'testuuid';
    const type = 'video';
    const ingestResponses = [{
      uuid,
      basename: 'basename',
      bucket: 'testbucket',
      key: 'testkey',
      destination: {
        bucket: 'testbucket',
        prefix: 'prefix',
      },
      schemaVersion: 1,
      overallStatus: 'COMPLETED',
      status: 'ANALYSIS_COMPLETED',
      type: 'video',
      mediainfo: [],
      proxies: [],
      analysis: [
        'video',
      ],
      aiOptions: {},
    }];

    jest.spyOn(DB.prototype, 'scanIndex')
      .mockImplementation((params) =>
        Promise.resolve(ingestResponses));

    const request = new ApiRequest({
      path: '/assets',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'assets',
      },
      queryStringParameters: {
        type,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const assetOp = new AssetOp(request);
    const response = await assetOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).length)
      .toBe(ingestResponses.length);
  });

  test('POST /assets', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    CommonUtils.headObject = jest.fn()
      .mockImplementation(() =>
        Promise.resolve({}));

    jest.spyOn(DB.prototype, 'fetch')
      .mockImplementation(() =>
        Promise.resolve({}));

    const sfnResponse = {
      executionArn: 'arn:aws:mock:sfn',
    };
    stepMock.on(StartExecutionCommand)
      .resolves(sfnResponse);

    const uuid = 'testuuid';
    const body = {
      input: {
        uuid,
        bucket: 'testbucket',
        key: 'test.mp4',
        group: 'testgroup',
      },
    };

    const request = new ApiRequest({
      path: '/assets',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'assets',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body,
      isBase64Encoded: false,
    }, context);

    const assetOp = new AssetOp(request);
    const response = await assetOp.onPOST();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).uuid)
      .toBe(uuid);

    expect(JSON.parse(response.body).executionArn)
      .toBe(sfnResponse.executionArn);
  });

  test('DELETE /assets should throw error', async () => {
    const request = new ApiRequest({
      path: '/assets',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'assets',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const assetOp = new AssetOp(request);
    await assetOp.onDELETE()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid uuid');
      });
  });

  test('DELETE /assets/testuuid', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    jest.spyOn(DB.prototype, 'purge')
      .mockImplementation(() =>
        Promise.resolve({}));

    const uuid = 'testuuid';
    const request = new ApiRequest({
      path: '/assets/testuuid',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'assets',
        uuid,
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const assetOp = new AssetOp(request);
    const response = await assetOp.onDELETE();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).uuid)
      .toBe(uuid);

    expect(JSON.parse(response.body).status)
      .toBe('REMOVED');
  });
});

describe('Test API /analysis', () => {
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules();
    stepMock.reset();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /analysis/testuuid', async () => {
    const uuid = 'testuuid';

    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    const ingestResponse = {
      uuid,
      analysis: [
        'video',
      ],
    };
    const analysisResponse = {
      uuid,
      type: 'video',
      rekognition: {
        celeb: {
          output: 'test-celeb-output',
        },
      },
    };
    jest.spyOn(DB.prototype, 'fetch')
      .mockImplementation((key, skey, attrs) => {
        if (attrs === 'analysis') {
          return Promise.resolve(ingestResponse);
        }
        return Promise.resolve(analysisResponse);
      });

    const request = new ApiRequest({
      path: '/analysis/testuuid',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'analysis',
        uuid,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const analysisOp = new AnalysisOp(request);
    const response = await analysisOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(response.body)
      .toStrictEqual(JSON.stringify([analysisResponse]));
  });

  test('POST /analysis/testuuid', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    const uuid = 'testuuid';
    const ingestResponse = {
      uuid,
      bucket: 'testbucket',
      key: 'testkey',
      destination: {
        bucket: 'testbucket',
        prefix: 'prefix',
      },
      aiOptions: {},
    };
    jest.spyOn(DB.prototype, 'fetch')
      .mockImplementation((key, skey, attrs) =>
        Promise.resolve(ingestResponse));

    jest.spyOn(DB.prototype, 'dropColumns')
      .mockImplementation((key, skey, attrs) =>
        Promise.resolve({}));

    jest.spyOn(DB.prototype, 'update')
      .mockImplementation((key, skey, attrs) =>
        Promise.resolve({}));

    const sfnResponse = {
      executionArn: 'arn:aws:mock:sfn',
    };
    stepMock.on(StartExecutionCommand)
      .resolves(sfnResponse);

    const request = new ApiRequest({
      path: '/analysis/testuuid',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'analysis',
        uuid,
      },
      requestContext: {},
      body: JSON.stringify({
        input: {
          uuid,
        },
      }),
      isBase64Encoded: false,
    }, context);

    const analysisOp = new AnalysisOp(request);
    const response = await analysisOp.onPOST();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(response.body)
      .toStrictEqual(JSON.stringify({
        uuid,
        status: 'STARTED',
        ...sfnResponse,
      }));
  });

  test('DELETE /analysis/testuuid', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    jest.spyOn(DB.prototype, 'dropColumns')
      .mockImplementation(() =>
        Promise.resolve({}));

    const uuid = 'testuuid';
    const request = new ApiRequest({
      path: '/analysis/testuuid',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'analysis',
        uuid,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const analysisOp = new AnalysisOp(request);
    const response = await analysisOp.onDELETE();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(response.body)
      .toStrictEqual(JSON.stringify({
        uuid,
        status: 'REMOVED',
      }));
  });
});

describe('Test API /attach-policy', () => {
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules();
    iotMock.reset();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /attach-policy should throw error', async () => {
    const request = new ApiRequest({
      path: '/attach-policy',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'attach-policy',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const iotOp = new IotOp(request);
    await iotOp.onGET()
      .catch((error) => {
        expect(error.message)
          .toBe('IotOp.onGET not impl');
      });
  });

  test('DELETE /attach-policy should throw error', async () => {
    const request = new ApiRequest({
      path: '/attach-policy',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'attach-policy',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const iotOp = new IotOp();
    await iotOp.onDELETE()
      .catch((error) => {
        expect(error.message)
          .toBe('IotOp.onDELETE not impl');
      });
  });

  test('POST /attach-policy', async () => {
    CommonUtils.validateCognitoIdentityId = jest.fn()
      .mockReturnValue(true);

    iotMock.on(AttachPolicyCommand)
      .resolves({});

    const apiRequest = new ApiRequest({
      path: '/attach-policy',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'attach-policy',
      },
      queryStringParameters: {
      },
      requestContext: {
        identity: {
          cognitoIdentityId: 'testid',
        },
      },
      body: null,
      isBase64Encoded: false,
    }, context);

    const iotOp = new IotOp(apiRequest);
    const response = await iotOp.onPOST();

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).status)
      .toBe('COMPLETED');
  });
});

describe('Test API /stats', () => {
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /stats (overall stats)', async () => {
    const ingestStatsResponse = {
      body: {
        aggregations: {
          groupByType: {
            buckets: [
              {
                key: 'video',
                doc_count: 1,
                totalDuration: {
                  value: 1,
                },
                minDuration: {
                  value: 1,
                },
                totalSize: {
                  value: 1,
                },
                avgSize: {
                  value: 1,
                },
                minSize: {
                  value: 1,
                },
                maxSize: {
                  value: 1,
                },
                maxDuration: {
                  value: 1,
                },
                avgDuration: {
                  value: 1,
                },
              },
            ],
          },
          groupByOverallStatus: {
            buckets: [
              {
                key: 'COMPLETED',
                doc_count: 1,
                count: {
                  value: 1,
                },
              },
            ],
          },
        },
      },
    };
    const recentlyIngestStatsResponse = {
      body: {
        hits: {
          hits: [
            {
              _id: 'testuuid',
              _source: {
                duration: 1,
                basename: 'basename',
                fileSize: 1,
                lastModified: 1,
                type: 'video',
                timestamp: 1,
              },
            },
          ],
        },
      },
    };
    jest.spyOn(Indexer.prototype, 'search')
      .mockImplementation((query) => {
        if (query.body.aggs !== undefined) {
          return Promise.resolve(ingestStatsResponse);
        }
        return Promise.resolve(recentlyIngestStatsResponse);
      });

    const request = new ApiRequest({
      path: '/stats',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'stats',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const statsOp = new StatsOp(request);
    const response = await statsOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    const body = JSON.parse(response.body);

    expect(body)
      .toHaveProperty('stats');

    expect(body)
      .toHaveProperty('recents');
  });

  test('GET /stats?aggregate=celeb', async () => {
    const aggResponse = {
      celeb: {
        buckets: [
          {
            key: 'Andy Jassy',
            doc_count: 1,
          },
        ],
      },
    };

    jest.spyOn(Indexer.prototype, 'aggregate')
      .mockImplementation((name, size) =>
        Promise.resolve(aggResponse));

    const request = new ApiRequest({
      path: '/stats',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'stats',
      },
      queryStringParameters: {
        aggregate: 'celeb',
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const statsOp = new StatsOp(request);
    const response = await statsOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    const body = JSON.parse(response.body);

    expect(body.aggregations.celeb)
      .toBeTruthy();

    expect(body.aggregations.celeb.length)
      .toBe(1);
  });
});

describe('Test API /search', () => {
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules();
    rekogMock.reset();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /search?query=base64str', async () => {
    const hit = {
      _index: 'content',
      _id: 'testuuid',
      _score: 1,
      _source: {
        type: 'video',
      },
      highlight: {
        'celeb.name': [
          '<em>Andy Jassy</em>',
        ],
      },
    };
    const searchResponse = {
      body: {
        took: 1,
        hits: {
          total: {
            value: 1,
          },
          hits: [
            hit,
          ],
        },
      },
    };
    jest.spyOn(Indexer.prototype, 'search')
      .mockImplementation((doc) =>
        Promise.resolve(searchResponse));

    const mgetResponse = {
      body: {
        docs: [
          {
            _index: 'content',
            _id: 'testuuid',
            _source: {
              celeb: [
                {
                  name: 'Andy Jassy',
                  timecodes: [
                    {
                      end: 0,
                      begin: 0,
                    },
                    {
                      end: 10,
                      begin: 10,
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };
    jest.spyOn(Indexer.prototype, 'mget')
      .mockImplementation((doc) =>
        Promise.resolve(mgetResponse));

    const query = '"andy jassy"';
    const request = new ApiRequest({
      path: '/search',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'search',
      },
      queryStringParameters: {
        query: Buffer.from(query).toString('base64'),
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const searchOp = new SearchOp(request);
    const response = await searchOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).hits.length)
      .toBe(1);
  });
});

describe('Test API /settings/aioptions', () => {
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules();
    rekogMock.reset();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /settings/aioptions', async () => {
    CommonUtils.download = jest.fn()
      .mockImplementation(() =>
        Promise.resolve(''));

    const request = new ApiRequest({
      path: '/settings/aioptions',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'search',
        uuid: 'aioptions',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const settingOp = new SettingsOp(request);
    const response = await settingOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    const body = JSON.parse(response.body);

    expect(body)
      .toHaveProperty('celeb');

    expect(body)
      .toHaveProperty('face');

    expect(body)
      .toHaveProperty('facematch');

    expect(body)
      .toHaveProperty('label');

    expect(body)
      .toHaveProperty('moderation');

    expect(body)
      .toHaveProperty('segment');
  });

  test('POST /settings/aioptions', async () => {
    CommonUtils.upload = jest.fn()
      .mockImplementation(() =>
        Promise.resolve({}));

    const aioptions = {
      celeb: true,
      face: true,
      label: true,
      facematch: false,
    };

    const request = new ApiRequest({
      path: '/settings/aioptions',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'search',
        uuid: 'aioptions',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: JSON.stringify(aioptions),
      isBase64Encoded: false,
    }, context);

    const settingOp = new SettingsOp(request);
    const response = await settingOp.onPOST();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');
  });

  test('DELETE /settings/aioptions', async () => {
    CommonUtils.deleteObject = jest.fn()
      .mockImplementation(() =>
        Promise.resolve({}));

    const request = new ApiRequest({
      path: '/settings/aioptions',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'search',
        uuid: 'aioptions',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const settingOp = new SettingsOp(request);

    const response = await settingOp.onPOST();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');
  });
});

describe('Test API /users', () => {
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules();
    cognitoIdpMock.reset();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /users', async () => {
    const userResponse = {
      Users: [
        {
          Username: 'testuser',
          UserLastModifiedDate: Date.now(),
          UserStatus: 'CONFIRMED',
          Enabled: true,
          Attributes: [
            {
              Name: 'email',
              Value: 'testemail',
            },
          ],
        },
      ],
    };
    cognitoIdpMock.on(ListUsersCommand)
      .resolves(userResponse);

    const groupResponse = {
      Groups: [
        {
          GroupName: 'testgroup',
          Precedence: 1,
        },
      ],
    };
    cognitoIdpMock.on(AdminListGroupsForUserCommand)
      .resolves(groupResponse);

    const request = new ApiRequest({
      path: '/users',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'users',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const userOp = new UsersOp(request);
    const response = await userOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    const body = JSON.parse(response.body);

    expect(body[0].username)
      .toBe(userResponse.Users[0].Username);

    expect(body[0].group)
      .toBe(groupResponse.Groups[0].GroupName);
  });

  test('POST /users', async () => {
    CommonUtils.validateEmailAddress = jest.fn()
      .mockReturnValue(true);

    const users = [
      {
        email: 'testemail',
        username: 'testuser',
        group: 'testgroup',
      },
    ];

    const userResponse = {
      User: {
        Enabled: true,
        UserCreateDate: Date.now(),
        UserLastModifiedDate: Date.now(),
        Username: users[0].username,
        UserStatus: 'FORCE_CHANGE_PASSWORD',
        Attributes: [
          {
            Name: 'email',
            Value: users[0].email,
          },
        ],
      },
    };
    cognitoIdpMock.on(AdminCreateUserCommand)
      .resolves(userResponse);

    cognitoIdpMock.on(AdminAddUserToGroupCommand)
      .resolves({});

    const request = new ApiRequest({
      path: '/users',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'users',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: JSON.stringify(users),
      isBase64Encoded: false,
    }, context);

    const userOp = new UsersOp(request);
    const response = await userOp.onPOST();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    const body = JSON.parse(response.body);

    expect(body[0].username)
      .toBe(userResponse.User.Username);

    expect(body[0].group)
      .toBe(users[0].group);
  });

  test('DELETE /users?user=testuser', async () => {
    const user = 'testuser';

    cognitoIdpMock.on(AdminDeleteUserCommand)
      .resolves({});

    const request = new ApiRequest({
      path: '/users',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'users',
      },
      queryStringParameters: {
        user,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const userOp = new UsersOp(request);
    const response = await userOp.onDELETE();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    const body = JSON.parse(response.body);

    expect(body.user)
      .toBe(user);

    expect(body.status)
      .toBe('removed');
  });
});

describe('Test API /rekognition', () => {
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules();
    rekogMock.reset();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /rekognition should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/rekognition',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onGET()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('POST /rekognition should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/rekognition',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onPOST()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('DELETE /rekognition should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/rekognition',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onDELETE()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('GET /rekognition/face-collections', async () => {
    const collectionResponses = {
      CollectionIds: [
        'collectionA',
        'collectionB',
      ],
    };
    rekogMock.on(ListCollectionsCommand)
      .resolves(collectionResponses);

    const describeResponse = {
      FaceCount: 1,
      FaceModelVersion: '0',
      CreationTimestamp: Date.now(),
    };
    rekogMock.on(DescribeCollectionCommand)
      .resolves(describeResponse);

    const request = new ApiRequest({
      path: '/rekognition/face-collections',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face-collections',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    const response = await rekognitionOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).length)
      .toBe(collectionResponses.CollectionIds.length);
  });

  test('POST /rekognition/face-collections should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/rekognition/face-collections',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face-collections',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onPOST()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('DELETE /rekognition/face-collections should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/rekognition/face-collections',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face-collections',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onDELETE()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('GET /rekognition/face-collection should throw invalid collection id', async () => {
    const request = new ApiRequest({
      path: '/rekognition/face-collection',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face-collection',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onGET()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid collection id');
      });
  });

  test('GET /rekognition/face-collection?collectionId=collectionA', async () => {
    const describeResponse = {
      FaceCount: 1,
      FaceModelVersion: '0',
      CreationTimestamp: Date.now(),
    };
    rekogMock.on(DescribeCollectionCommand)
      .resolves(describeResponse);

    const collectionId = 'collectionA';
    const request = new ApiRequest({
      path: '/rekognition/face-collection',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face-collection',
      },
      queryStringParameters: {
        collectionId,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    const response = await rekognitionOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).name)
      .toBe(collectionId);
  });

  test('POST /rekognition/face-collection', async () => {
    const createResponse = {
      FaceModelVersion: '0',
    };
    rekogMock.on(CreateCollectionCommand)
      .resolves(createResponse);

    const collectionId = 'collectionA';
    const request = new ApiRequest({
      path: '/rekognition/face-collection',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face-collection',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: JSON.stringify({
        collectionId,
      }),
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    const response = await rekognitionOp.onPOST();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).name)
      .toBe(collectionId);
  });

  test('DELETE /rekognition/face-collection should throw invalid collection id', async () => {
    const request = new ApiRequest({
      path: '/rekognition/face-collection',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face-collection',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onDELETE()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid collection id');
      });
  });

  test('DELETE /rekognition/face-collection?collectionId=collectionA', async () => {
    const deleteResponse = {
      FaceModelVersion: '0',
    };
    rekogMock.on(DeleteCollectionCommand)
      .resolves(deleteResponse);

    const collectionId = 'collectionA';
    const request = new ApiRequest({
      path: '/rekognition/face-collection',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face-collection',
      },
      queryStringParameters: {
        collectionId,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    const response = await rekognitionOp.onDELETE();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();
  });

  test('GET /rekognition/faces should throw invalid collection id', async () => {
    const request = new ApiRequest({
      path: '/rekognition/faces',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'faces',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onGET()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid collection id');
      });
  });

  test('GET /rekognition/faces?collectionId=collectionA', async () => {
    const facesResponse = {
      Faces: [
        {
          FaceId: 'faceid',
          BoundingBox: {},
          ImageId: 'imageid',
          ExternalImageId: 'externalid',
          Confidence: 0,
          IndexFacesModelVersion: '0',
        },
      ],
    };
    rekogMock.on(ListFacesCommand)
      .resolves(facesResponse);

    CommonUtils.headObject = jest.fn()
      .mockImplementation(() =>
        Promise.resolve({}));

    const collectionId = 'collectionA';
    const request = new ApiRequest({
      path: '/rekognition/faces',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'faces',
      },
      queryStringParameters: {
        collectionId,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    const response = await rekognitionOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).faces.length)
      .toBe(facesResponse.Faces.length);
  });

  test('POST /rekognition/faces should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/rekognition/faces',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'faces',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onPOST()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('DELETE /rekognition/faces should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/rekognition/faces',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'faces',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onDELETE()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('GET /rekognition/face should throw invalid collection id', async () => {
    const request = new ApiRequest({
      path: '/rekognition/face',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onGET()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid collection id');
      });
  });

  test('GET /rekognition/face?collectionId=collectionA should throw invalid face id', async () => {
    const collectionId = 'collectionA';
    const request = new ApiRequest({
      path: '/rekognition/face',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face',
      },
      queryStringParameters: {
        collectionId,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onGET()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid face id');
      });
  });

  test('GET /rekognition/face?collectionId=collectionA&faceId=faceA', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    CommonUtils.headObject = jest.fn()
      .mockImplementation(() =>
        Promise.resolve({
          Key: 'mock/key',
        }));

    const collectionId = 'collectionA';
    const faceId = 'faceA';
    const facesResponse = {
      Faces: [
        {
          FaceId: faceId,
          BoundingBox: {},
          ImageId: 'imageid',
          ExternalImageId: 'externalid',
          Confidence: 0,
          IndexFacesModelVersion: '0',
        },
      ],
    };
    rekogMock.on(ListFacesCommand)
      .resolves(facesResponse);

    const request = new ApiRequest({
      path: '/rekognition/face',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face',
      },
      queryStringParameters: {
        collectionId,
        faceId,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    const response = await rekognitionOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).faceId)
      .toBe(faceId);
  });

  test('POST /rekognition/face', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    CommonUtils.validateImageBlob = jest.fn()
      .mockReturnValue(true);

    CommonUtils.uploadFile = jest.fn()
      .mockImplementation(() =>
        Promise.resolve({}));

    const collectionId = 'collectionA';
    const faceId = 'faceid';
    const externalImageId = 'externalid';
    const blob = 'blob';
    const indexResponse = {
      FaceRecords: [
        {
          Face: {
            FaceId: faceId,
            BoundingBox: {},
            ImageId: 'imageid',
            ExternalImageId: externalImageId,
            Confidence: 0,
            IndexFacesModelVersion: '0',
          },
        },
      ],
    };
    rekogMock.on(IndexFacesCommand)
      .resolves(indexResponse);

    const request = new ApiRequest({
      path: '/rekognition/face',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: JSON.stringify({
        collectionId,
        externalImageId,
        blob,
      }),
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    const response = await rekognitionOp.onPOST();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).faceId)
      .toBe(faceId);

    expect(JSON.parse(response.body).externalImageId)
      .toBe(externalImageId);
  });

  test('DELETE /rekognition/face?collectionId=collectionA&faceId=faceA', async () => {
    CommonUtils.validateUuid = jest.fn()
      .mockReturnValue(true);

    CommonUtils.deleteObject = jest.fn()
      .mockImplementation(() =>
        Promise.resolve({}));

    const collectionId = 'collectionA';
    const faceId = 'faceA';

    rekogMock.on(DeleteFacesCommand)
      .resolves({});

    const request = new ApiRequest({
      path: '/rekognition/face',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'face',
      },
      queryStringParameters: {
        collectionId,
        faceId,
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    const response = await rekognitionOp.onDELETE();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).faceId)
      .toBe(faceId);
  });

  test('GET /rekognition/custom-label-models', async () => {
    const projectResponse = {
      ProjectDescriptions: [
        {
          ProjectArn: 'projectarn',
          Status: 'CREATED',
          Datasets: [],
          CreationTimestamp: Date.now(),
        },
      ],
    };
    rekogMock.on(DescribeProjectsCommand)
      .resolves(projectResponse);

    const projectVersionResponse = {
      ProjectVersionDescriptions: [
        {
          ProjectVersionArn: 'projectversionarn',
          Status: 'STOPPED',
        },
      ],
    };
    rekogMock.on(DescribeProjectVersionsCommand)
      .resolves(projectVersionResponse);

    const request = new ApiRequest({
      path: '/rekognition/custom-label-models',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'custom-label-models',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    const response = await rekognitionOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body)[0].name)
      .toBe(projectResponse.ProjectDescriptions[0].ProjectArn);
  });

  test('POST /rekognition/custom-label-models should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/rekognition/custom-label-models',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'custom-label-models',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onPOST()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('DELETE /rekognition/custom-label-models should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/rekognition/custom-label-models',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'rekognition',
        uuid: 'custom-label-models',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const rekognitionOp = new RekognitionOp(request);
    await rekognitionOp.onDELETE()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });
});

describe('Test API /transcribe', () => {
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules();
    transcribeMock.reset();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /transcribe/custom-vocabularies', async () => {
    const vocabResponse = {
      Vocabularies: [
        {
          VocabularyName: 'testvocab',
          LanguageCode: 'en-US',
        },
      ],
    };
    transcribeMock.on(ListVocabulariesCommand)
      .resolves(vocabResponse);

    const request = new ApiRequest({
      path: '/transcribe/custom-vocabularies',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'transcribe',
        uuid: 'custom-vocabularies',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const transcribeOp = new TranscribeOp(request);
    const response = await transcribeOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body)[0].name)
      .toBe(vocabResponse.Vocabularies[0].VocabularyName);
  });

  test('POST /transcribe/custom-vocabularies should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/transcribe/custom-vocabularies',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'transcribe',
        uuid: 'custom-vocabularies',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const transcribeOp = new TranscribeOp(request);
    await transcribeOp.onPOST()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('DELETE /transcribe/custom-vocabularies should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/transcribe/custom-vocabularies',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'transcribe',
        uuid: 'custom-vocabularies',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const transcribeOp = new TranscribeOp(request);
    await transcribeOp.onDELETE()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('GET /transcribe/custom-language-models', async () => {
    const modelResponse = {
      Models: [
        {
          ModelName: 'testmodel',
          LanguageCode: 'en-US',
        },
      ],
    };
    transcribeMock.on(ListLanguageModelsCommand)
      .resolves(modelResponse);

    const request = new ApiRequest({
      path: '/transcribe/custom-language-models',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'transcribe',
        uuid: 'custom-language-models',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const transcribeOp = new TranscribeOp(request);
    const response = await transcribeOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body)[0].name)
      .toBe(modelResponse.Models[0].ModelName);
  });

  test('POST /transcribe/custom-language-models should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/transcribe/custom-language-models',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'transcribe',
        uuid: 'custom-language-models',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const transcribeOp = new TranscribeOp(request);
    await transcribeOp.onPOST()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('DELETE /transcribe/custom-language-models should throw invalid operation', async () => {
    const request = new ApiRequest({
      path: '/transcribe/custom-language-models',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'transcribe',
        uuid: 'custom-language-models',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const transcribeOp = new TranscribeOp(request);
    await transcribeOp.onDELETE()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });
});

describe('Test API /comprehend', () => {
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules();
    comprehendMock.reset();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /comprehend should throw error', async () => {
    const request = new ApiRequest({
      path: '/comprehend',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'comprehend',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const comprehendOp = new ComprehendOp(request);
    await comprehendOp.onGET()
      .catch((error) => {
        expect(error.message)
          .toBe('invalid operation');
      });
  });

  test('GET /comprehend/custom-entity-recognizers', async () => {
    const recognizers = [1, 2]
      .map((idx) => ({
        EntityRecognizerArn: `arn:aws:mock:region:acc:entity-recognizer/mock/version/${idx}`,
        LanguageCode: 'en',
        Status: 'TRAINED',
        SubmitTime: '0',
        EndTime: '0',
        TrainingStartTime: '0',
        TrainingEndTime: '0',
        InputDataConfig: {},
        RecognizerMetadata: {},
        DataAccessRoleArn: 'role',
        VersionName: `${idx}`,
      }));

    const comprehendResponse = {
      EntityRecognizerPropertiesList: recognizers,
    };

    comprehendMock.on(ListEntityRecognizersCommand)
      .resolves(comprehendResponse);

    const request = new ApiRequest({
      path: '/comprehend/custom-entity-recognizers',
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'comprehend',
        uuid: 'custom-entity-recognizers',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const comprehendOp = new ComprehendOp(request);
    const response = await comprehendOp.onGET();

    expect(response.statusCode)
      .toEqual(200);

    expect(response.headers)
      .toBeTruthy();

    expect(response.headers['Content-Type'])
      .toStrictEqual('application/json');

    expect(response.body)
      .toBeTruthy();

    expect(JSON.parse(response.body).length)
      .toBe(2);
  });

  test('POST /comprehend/custom-entity-recognizers should throw', async () => {
    const request = new ApiRequest({
      path: '/comprehend/custom-entity-recognizers',
      httpMethod: 'POST',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'comprehend',
        uuid: 'custom-entity-recognizers',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const comprehendOp = new ComprehendOp(request);
    await comprehendOp.onPOST()
      .catch((error) => {
        expect(error)
          .toBeInstanceOf(Error);

        expect(error.message)
          .toBe('ComprehendOp.onPOST not impl');
      });
  });

  test('DELETE /comprehend/custom-entity-recognizers should throw', async () => {
    const request = new ApiRequest({
      path: '/comprehend/custom-entity-recognizers',
      httpMethod: 'DELETE',
      headers: {
        origin: 'http://localhost',
      },
      pathParameters: {
        operation: 'comprehend',
        uuid: 'custom-entity-recognizers',
      },
      queryStringParameters: {
      },
      requestContext: {},
      body: null,
      isBase64Encoded: false,
    }, context);

    const comprehendOp = new ComprehendOp(request);
    await comprehendOp.onDELETE()
      .catch((error) => {
        expect(error)
          .toBeInstanceOf(Error);

        expect(error.message)
          .toBe('ComprehendOp.onDELETE not impl');
      });
  });
});
