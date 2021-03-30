/**
 * @class SigV4Client
 * @description modify sigV4Client open source code to be ES6 and pure browser javascript
 * @see https://github.com/AnomalyInnovations/sigV4Client/blob/master/sigV4Client.js
 */
export default class SigV4Client {
  constructor(params = {}) {
    const missing = [
      'accessKey',
      'secretKey',
      'endpoint',
      // 'sessionToken',
      // 'region',
      // 'serviceName',
      // 'defaultAcceptType',
      // 'defaultContentType',
    ].filter(x => params[x] === undefined);

    if (missing.length) {
      throw new Error(`missing params, ${missing.join(', ')}`);
    }
    this.$accessKey = params.accessKey;
    this.$secretKey = params.secretKey;
    this.$sessionToken = params.sessionToken;
    this.$region = params.region || 'us-east-1';
    this.$serviceName = params.serviceName || 'execute-api';
    this.$defaultAcceptType = params.defaultAcceptType || 'application/json';
    this.$defaultContentType = params.defaultContentType || 'application/json';
    this.$endpoint = params.endpoint;
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
    return CryptoJS.SHA256(value);
  }

  hexEncode(value) {
    return value.toString(CryptoJS.encHex);
  }

  hmac(secret, value) {
    return CryptoJS.HmacSHA256(value, secret, {
      asBytes: true,
    });
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
    return `${SigV4Client.Constants.AWS_SHA_256}\n${datetime}\n${credentialScope}\n${hashedCanonicalRequest}`;
  }

  buildCredentialScope(datetime, region, service) {
    return `${datetime.substr(0, 8)}/${region}/${service}/${SigV4Client.Constants.AWS4_REQUEST}`;
  }

  calculateSigningKey(secretKey, datetime, region, service) {
    return this.hmac(
      this.hmac(
        this.hmac(this.hmac(`${SigV4Client.Constants.AWS4}${secretKey}`, datetime.substr(0, 8)), region),
        service
      ),
      SigV4Client.Constants.AWS4_REQUEST
    );
  }

  calculateSignature(key, stringToSign) {
    return this.hexEncode(this.hmac(key, stringToSign));
  }

  extractHostname(url) {
    const hostname = (url.indexOf('://') > -1)
      ? url.split('/')[2]
      : url.split('/')[0];

    // hostname = hostname.split(':')[0];
    // hostname = hostname.split('?')[0];

    return hostname
      .split(':').shift()
      .split('?').shift();
  }

  buildAuthorizationHeader(accessKey, credentialScope, headers, signature) {
    return `${SigV4Client.Constants.AWS_SHA_256} Credential=${accessKey}/${credentialScope}, SignedHeaders=${this.buildCanonicalSignedHeaders(headers)}, Signature=${signature}`;
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
    headers[SigV4Client.Constants.X_AMZ_DATE] = datetime;
    headers[SigV4Client.Constants.HOST] = this.extractHostname(endpoint);

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

    headers[SigV4Client.Constants.AUTHORIZATION] =
      this.buildAuthorizationHeader(this.accessKey, credentialScope, headers, signature);

    if (this.sessionToken) {
      headers[SigV4Client.Constants.X_AMZ_SECURITY_TOKEN] = this.sessionToken;
    }
    delete headers[SigV4Client.Constants.HOST];

    let url = `${endpoint}${path}`;
    const queryString = this.buildCanonicalQueryString(queryParams);
    if (queryString) {
      url = `${url}?${queryString}`;
    }

    // Need to re-attach Content-Type if it is not specified at this point
    headers['Content-Type'] = headers['Content-Type'] || this.defaultContentType;

    return {
      headers,
      url,
    };
  }
}
