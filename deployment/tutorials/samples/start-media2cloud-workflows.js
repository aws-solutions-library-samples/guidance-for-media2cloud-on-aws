const AWS = require('aws-sdk');
const CRYPTO = require('crypto');
const HTTPS = require('https');

/**
 * @class SigV4
 * @description sign HTTPS request with AWS Signature Version 4
 * Credits to Jay V (jayair)
 * @see https://github.com/AnomalyInnovations/sigV4Client/blob/master/sigV4Client.js
 */
class SigV4 {
  constructor(params = {}) {
    const credential = new AWS.EnvironmentCredentials('AWS');

    this.$accessKey = params.accessKey || credential.accessKeyId;
    this.$secretKey = params.secretKey || credential.secretAccessKey;
    this.$sessionToken = params.sessionToken || credential.sessionToken;
    this.$region = params.region || process.env.AWS_REGION || 'us-east-1';
    this.$serviceName = params.serviceName || 'execute-api';
    this.$defaultAcceptType = params.defaultAcceptType || 'application/json';
    this.$defaultContentType = params.defaultContentType || 'application/json';
    this.$endpoint = params.endpoint;

    if (!this.accessKey || !this.secretKey) {
      throw new Error('missing credential');
    }
    if (!this.region) {
      throw new Error('missing region');
    }
  }

  static get Constants() {
    return {
      AWS_SHA_256: 'AWS4-HMAC-SHA256',
      AWS4_REQUEST: 'aws4_request',
      AWS4: 'AWS4',
      X_AMZ_DATE: 'x-amz-date',
      X_AMZ_SECURITY_TOKEN: 'x-amz-security-token',
      HOST: 'host',
      AUTHORIZATION: 'Authorization',
    };
  }

  get accessKey() {
    return this.$accessKey;
  }

  get secretKey() {
    return this.$secretKey;
  }

  get sessionToken() {
    return this.$sessionToken;
  }

  get region() {
    return this.$region;
  }

  get serviceName() {
    return this.$serviceName;
  }

  get defaultAcceptType() {
    return this.$defaultAcceptType;
  }

  get defaultContentType() {
    return this.$defaultContentType;
  }

  get endpoint() {
    return this.$endpoint;
  }

  hash(value) {
    return CRYPTO.createHash('sha256')
      .update(value)
      .digest();
  }

  hmac(secret, value) {
    return CRYPTO.createHmac('sha256', secret)
      .update(value)
      .digest();
  }

  hexEncode(value) {
    return value.toString('hex');
  }

  buildCanonicalRequest(method, path, queryParams, headers, payload) {
    return `${method}\n${this.buildCanonicalUri(path)}\n${this.buildCanonicalQueryString(queryParams)}\n${this.buildCanonicalHeaders(headers)}\n${this.buildCanonicalSignedHeaders(headers)}\n${this.hexEncode(this.hash(payload))}`;
  }

  hashCanonicalRequest(request) {
    return this.hexEncode(this.hash(request));
  }

  buildCanonicalUri(uri) {
    return encodeURI(uri);
  }

  buildCanonicalQueryString(queryParams) {
    if (Object.keys(queryParams).length < 1) {
      return '';
    }

    const sortedQueryParams = Object.keys(queryParams).sort();
    let canonicalQueryString = '';
    for (let i = 0; i < sortedQueryParams.length; i += 1) {
      canonicalQueryString =
        `${canonicalQueryString}${sortedQueryParams[i]}=${encodeURIComponent(queryParams[sortedQueryParams[i]])}&`;
    }
    return canonicalQueryString.substr(0, canonicalQueryString.length - 1);
  }

  buildCanonicalHeaders(headers) {
    let canonicalHeaders = '';
    const sortedKeys = Object.keys(headers).sort();

    for (let i = 0; i < sortedKeys.length; i += 1) {
      canonicalHeaders =
        `${canonicalHeaders}${sortedKeys[i].toLowerCase()}:${headers[sortedKeys[i]]}\n`;
    }
    return canonicalHeaders;
  }

  buildCanonicalSignedHeaders(headers) {
    const sortedKeys = Object.keys(headers).map(x => x.toLowerCase()).sort();
    return sortedKeys.join(';');
  }

  buildStringToSign(datetime, credentialScope, hashedCanonicalRequest) {
    return `${SigV4.Constants.AWS_SHA_256}\n${datetime}\n${credentialScope}\n${hashedCanonicalRequest}`;
  }

  buildCredentialScope(datetime, region, service) {
    return `${datetime.substr(0, 8)}/${region}/${service}/${SigV4.Constants.AWS4_REQUEST}`;
  }

  calculateSigningKey(secretKey, datetime, region, service) {
    return this.hmac(
      this.hmac(
        this.hmac(this.hmac(`${SigV4.Constants.AWS4}${secretKey}`, datetime.substr(0, 8)), region),
        service
      ),
      SigV4.Constants.AWS4_REQUEST
    );
  }

  calculateSignature(key, stringToSign) {
    return this.hexEncode(this.hmac(key, stringToSign));
  }

  extractHostname(url) {
    const hostname = (url.indexOf('://') > -1)
      ? url.split('/')[2]
      : url.split('/')[0];

    return hostname
      .split(':').shift()
      .split('?').shift();
  }

  buildAuthorizationHeader(accessKey, credentialScope, headers, signature) {
    return `${SigV4.Constants.AWS_SHA_256} Credential=${accessKey}/${credentialScope}, SignedHeaders=${this.buildCanonicalSignedHeaders(headers)}, Signature=${signature}`;
  }

  signRequest(request) {
    const endpoint = /(^https?:\/\/[^/]+)/g.exec(this.endpoint)[1];
    const pathComponent = this.endpoint.substring(endpoint.length);
    const path = `${pathComponent}${request.path}`;
    const verb = request.method.toUpperCase();
    const queryParams = Object.assign({}, request.queryParams);
    const headers = Object.assign({}, request.headers);

    headers['Content-Type'] = headers['Content-Type'] || this.defaultContentType;
    headers.Accept = headers.Accept || this.defaultAcceptType;

    const body = (request.body === undefined || verb === 'GET')
      ? ''
      : request.body;

    if (!body) {
      delete headers['Content-Type'];
    }

    const datetime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:-]|\.\d{3}/g, '');
    headers[SigV4.Constants.X_AMZ_DATE] = datetime;
    headers[SigV4.Constants.HOST] = this.extractHostname(endpoint);

    const canonicalRequest =
      this.buildCanonicalRequest(verb, path, queryParams, headers, body);

    const hashedCanonicalRequest =
      this.hashCanonicalRequest(canonicalRequest);

    const credentialScope =
      this.buildCredentialScope(datetime, this.region, this.serviceName);

    const stringToSign =
      this.buildStringToSign(datetime, credentialScope, hashedCanonicalRequest);

    const signingKey =
      this.calculateSigningKey(this.secretKey, datetime, this.region, this.serviceName);

    const signature = this.calculateSignature(signingKey, stringToSign);

    headers[SigV4.Constants.AUTHORIZATION] =
      this.buildAuthorizationHeader(this.accessKey, credentialScope, headers, signature);

    if (this.sessionToken) {
      headers[SigV4.Constants.X_AMZ_SECURITY_TOKEN] = this.sessionToken;
    }
    delete headers[SigV4.Constants.HOST];

    let url = `${endpoint}${path}`;
    const queryString = this.buildCanonicalQueryString(queryParams);
    if (queryString) {
      url = `${url}?${queryString}`;
    }

    headers['Content-Type'] = headers['Content-Type'] || this.defaultContentType;

    return {
      headers,
      url,
    };
  }
}


function ignoreAccessLogFiles(event) {
  return isS3Event(event) && event.Records[0].s3.object.key.indexOf('access_log') >= 0;
}

function isS3Event(event) {
  try {
    return event.Records[0].s3 !== undefined;
  } catch (e) {
    return false;
  }
}

function isSNSEvent(event) {
  try {
    return event.Records[0].Sns !== undefined;
  } catch (e) {
    return false;
  }
}

/**
 * TODO#1: Find your Media2Cloud RESTful API from CloudFormation stack
 * Tips: Review Tutorial #2, Using Media2Cloud RESTful API
 */
function getMedia2CloudEndpoint() {
  return '#YOUR_MEDIA2CLOUD_API_ENDPOINT';
}

/**
 * TODO#2: Parse the bucket name from S3 Event payload
 * Tips: https://docs.aws.amazon.com/AmazonS3/latest/dev/notification-content-structure.html 
 */
function getBucketNameFromS3Event(event) {
  return '#deconstruct S3 Event JSON object to return bucket name';
}

/**
 * TODO#3: Parse the object key from S3 Event payload
 * Tips: https://docs.aws.amazon.com/AmazonS3/latest/dev/notification-content-structure.html 
 */
function getObjectKeyFromS3Event(event) {
  return '#deconstruct S3 Event JSON object to return the object key';
}

/**
 * TODO#4: What should the HTTP method be for starting ingest process?
 * Tips: Review Tutorial #2, Using Media2Cloud RESTful API
 */
function getIngestHttpMethod() {
  return '#HTTP_METHOD';
}

/**
 * TODO#5: What is the path for starting ingest process?
 * Tips: Review Tutorial #2, Using Media2Cloud RESTful API
 */
function getIngestHttpPath() {
  return '#INGEST_PATH';
}

/**
 * TODO#6: What should the HTTP method be for starting analysis process?
 * Tips: Review Tutorial #2, Using Media2Cloud RESTful API
 */
function getAnalysisHttpMethod() {
  return '#HTTP_METHOD';
}

/**
 * TODO#7: What should the HTTP method be for starting analysis process?
 * Tips: Review Tutorial #2, Using Media2Cloud RESTful API
 */
function getAnalysisHttpPath() {
  return '#ANALYSIS_PATH';
}

function getUuidFromSnsEvent(event) {
  const message = JSON.parse(event.Records[0].Sns.Message);
  return  (message.operation === 'job-completed' && message.stateMachine.indexOf('-ingest') > 0)
    ? message.uuid
    : undefined;
}


exports.handler = async (event, context) => {
  let body = {};
  let method;
  let path;

  if (ignoreAccessLogFiles(event)) {
    return;
  }

  if (isS3Event(event)) {
    body.bucket = getBucketNameFromS3Event(event);
    body.key = getObjectKeyFromS3Event(event);

    method = getIngestHttpMethod();
    path = getIngestHttpPath();
  } else if (isSNSEvent(event)) {

    const uuid = getUuidFromSnsEvent(event);
    if (!uuid) {
      return;
    }
    body.uuid = uuid;

    method = getAnalysisHttpMethod();
    path = getAnalysisHttpPath();
  } else {
    throw new Error('event not supported');
  }

  const signer = new SigV4({
    endpoint: getMedia2CloudEndpoint(),
  });

  const signed = signer.signRequest({
    method,
    path,
    body: JSON.stringify(body),
  });

  const response = await new Promise((resolve, reject) => {
    const data = [];
    const request = HTTPS.request(signed.url, {
      method,
      headers: signed.headers,
    }, (res) => {
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`${res.statusCode} ${res.statusMessage}`));
        } else {
          resolve(JSON.parse(Buffer.concat(data)));
        }
      });
    });
    request.on('error', e => reject(e));
    request.write(JSON.stringify(body));
    request.end();
  });

  console.log(JSON.stringify(response, null, 2));
  return response;
};
