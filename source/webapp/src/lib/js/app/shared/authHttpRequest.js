// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import {
  GetUserSession,
} from './cognito/userSession.js';

const {
  FetchHttpHandler,
  streamCollector,
  HttpRequest,
  SignatureV4,
  Sha256,
} = window.AWSv3;

/* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#encoding_for_rfc3986 */
function encodeRFC3986URIComponent(str) {
  return encodeURIComponent(str)
    .replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    );
}

function sanitizeQS(query = {}) {
  const sanitized = {};

  const searchParams = new URLSearchParams(query);

  for (const [key, value] of searchParams.entries()) {
    if (value !== undefined && value !== 'undefined') {
      sanitized[key] = encodeRFC3986URIComponent(value);
    }
  }

  return sanitized;
}

export default class AuthHttpRequest {
  async send(
    method,
    endpoint,
    query = {},
    body = '',
    headers = {}
  ) {
    const sanitizedQS = sanitizeQS(query);

    let stringifiedBody = body;
    if (typeof body !== 'string') {
      stringifiedBody = JSON.stringify(body);
    }

    const url = new URL(endpoint);
    const params = {
      method,
      protocol: url.protocol,
      hostname: url.hostname,
      path: url.pathname,
      query: sanitizedQS,
      body: stringifiedBody,
      headers: {
        'Content-Type': 'application/json',
        host: url.hostname,
        ...headers,
      },
    };

    const request = new HttpRequest(params);

    const session = GetUserSession();
    const signer = new SignatureV4({
      region: SolutionManifest.Region,
      service: 'execute-api',
      sha256: Sha256,
      credentials: session.fromCredentials(),
      // applyChecksum: false,
      uriEscapePath: false,
    });

    const signedRequest = await signer.sign(request);

    const client = new FetchHttpHandler();
    const streamPromise = await client.handle(signedRequest)
      .then((res) =>
        streamCollector(res.response.body));

    const decoder = new TextDecoder('utf-8');

    const parsed = JSON.parse(
      decoder.decode(
        await streamPromise
      )
    );

    // make sure the response is not an error
    if (parsed.errorCode !== undefined) {
      console.error('AuthHttpRequest.send', parsed);

      const e = new Error(`${parsed.errorCode} - ${parsed.errorMessage}`);
      e.name = parsed.errorName || parsed.errorCode;
      e.code = parsed.errorCode;
      throw e;
      // throw new Error(`${parsed.errorCode} - ${parsed.errorMessage}`);
    }

    return parsed;
  }
}
