/**
 * Sample code to start Level Beyond ReachEngine workflow on receiving analysis SNS notification
 * Convert and consolidate analysis result into a JSON format that ReachEngine can import to a project
 */
const AWS = require('aws-sdk');
const URL = require('url');
const PATH = require('path');
const HTTPS = require('https');

/* Refer to Comprehend Entity types */
/* https://docs.aws.amazon.com/comprehend/latest/dg/API_Entity.html */
const ENTITY_MAP = {
  PERSON: 'Persons',
  LOCATION: 'Locations',
  ORGANIZATION: 'Organizations',
  COMMERCIAL_ITEM: 'CommercialItems',
  EVENT: 'Events',
  DATE: 'Dates',
  QUANTITY: 'Quantities',
  TITLE: 'Titles',
  OTHER: 'Others',
};

/* Minimum confidence level */
const MIN_CONFIDENCE = 80;

/* ReachEngine RESTful API endpoint */
const REACHENGINE_ENDPOINT = 'https://<REARCHENGINE_URL>/reachengine/api/workflows/m2cIngest/start';

/* ReachEngine API Key */
const REACHENGINE_API_KEY = 'API_KEY';

/**
 *
 * @param {URL} url - ReachEngine URL
 * @param {object} content - JSON object
 */
async function send(url, content) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(content);
    const options = {
      method: 'POST',
      protocol: url.protocol,
      hostname: url.hostname,
      path: url.path,
      port: url.port,
      headers: {
        apiKey: REACHENGINE_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const buffers = [];
    const request = HTTPS.request(options, (response) => {
      response.on('data', chunk => buffers.push(chunk));
      response.on('end', () => resolve(Buffer.concat(buffers).toString()));
    });
    request.on('error', e => reject(e));
    request.write(body);
    request.end();
  });
}

/**
 * @async
 * @function downloadFile
 * @description helper function to download analysis results
 */
async function downloadFile(bucket, key, bodyOnly = true) {
  const s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    computeChecksums: true,
    signatureVersion: 'v4',
    s3DisableBodySigning: false,
  });

  return s3.getObject({
    Bucket: bucket,
    Key: key,
  }).promise()
    .then(data =>
      ((bodyOnly) ? data.Body.toString() : data))
    .catch((e) => {
      throw new Error(`${e.statusCode} ${e.code} ${bucket}/${key}`);
    });
}

/**
 * @async
 * @function uploadFile
 * @description helper function to upload RE-specific analysis output to proxy bucket
 */
async function uploadFile(bucket, prefix, name, data) {
  const s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    computeChecksums: true,
    signatureVersion: 'v4',
    s3DisableBodySigning: false,
  });

  return s3.putObject({
    Bucket: bucket,
    Key: PATH.join(prefix, name),
    ContentType: 'application/json',
    ContentDisposition: `attachment; filename="${name}"`,
    ServerSideEncryption: 'AES256',
    Body: (typeof data === 'string') ? data : JSON.stringify(data, null, 2),
  }).promise().catch((e) => {
    throw new Error(`${e.statusCode} ${e.code} ${bucket}/${prefix}/${name}`);
  });
}

/**
 * @async
 * @function computeGeometricMean
 * @description averaging confidence score
 */
function computeGeometricMean(items) {
  const filtered = items.filter(x => x !== undefined);
  if (!filtered.length) {
    return undefined;
  }
  const power = 1 / filtered.length;
  return filtered.reduce((a0, c0) => a0 * Math.pow(c0, power), 1);
}

/**
 * @async
 * @function formatTimelineItem
 * @description formating timeline items to RE-specific format
 */
function formatTimelineItem(data) {
  const count = data.reduce((a0, c0) => a0 + c0.count, 0);
  const confidence = computeGeometricMean(data.map(x => x.confidence));
  const timelines = data.map(x => ({
    In: x.begin,
    Out: x.end,
  }));
  return {
    Count: count,
    Confidence: Number.parseFloat(Number(confidence).toFixed(2)),
    Timelines: timelines,
  };
}

/**
 * @async
 * @function getRekognitionResults
 * @description download and process Rekognition typed analysis results
 */
async function getRekognitionResults(type, bucket, data) {
  const rekognition = (data.video || {}).rekognition || {};
  if (!(rekognition[type] || {}).output || !(rekognition[type] || {}).metadata) {
    return undefined;
  }

  const response = {};
  const names = Object.keys(JSON.parse(await downloadFile(bucket, rekognition[type].output)));

  while (names.length) {
    const name = names.shift();
    const key = PATH.join(rekognition[type].metadata, `${name.toLowerCase().replace(/\s/g, '_')}.json`);
    let results = await downloadFile(bucket, key).catch(() => undefined);
    if (!results) {
      continue;
    }
    results = JSON.parse(results).filter(x => x.confidence > MIN_CONFIDENCE);
    if (results.length) {
      response[name.replace(/_/g, ' ')] = formatTimelineItem(results);
    }
  }

  return (Object.keys(response).length === 0)
    ? undefined
    : response;
}

/**
 * @async
 * @function getComprehendResults
 * @description download and process Comprehend typed analysis results
 */
async function getComprehendResults(type, bucket, data) {
  if (!((data.audio.comprehend || {})[type] || {}).metadata) {
    return undefined;
  }

  const results = JSON.parse(await downloadFile(bucket, data.audio.comprehend[type].metadata)).filter(x =>
    x.confidence > MIN_CONFIDENCE);

  if (!results.length) {
    return undefined;
  }

  if (type !== 'entity') {
    return results.reduce((a0, c0) => ({
      ...a0,
      [c0.text]: {
        Count: 1,
        Confidence: c0.confidence,
        Timelines: [{
          In: c0.begin,
          Out: c0.end,
        }],
      },
    }), {});
  }

  /* special handling for entity detection, we need to group the results by cateogry */
  const entities = {};
  while (results.length) {
    const result = results.shift();
    const category = ENTITY_MAP[result.type] || 'Unknown';
    entities[category] = {
      ...entities[category],
      [result.text]: {
        Count: 1,
        Confidence: result.confidence,
        Timelines: [{
          In: result.begin,
          Out: result.end,
        }],
      },
    };
  }
  return entities;
}

/**
 * @async
 * @function getVideoAnalysisResult
 * @description process video analysis results, different Rekognition categories
 */
async function getVideoAnalysisResult(bucket, data) {
  const [
    celeb,
    facematch,
    label,
  ] = await Promise.all([
    getRekognitionResults('celeb', bucket, data),
    getRekognitionResults('facematch', bucket, data),
    getRekognitionResults('label', bucket, data),
  ]);

  return {
    Labels: label || {},
    Celebrities: {
      ...celeb,
      ...facematch,
    },
  };
}

/**
 * @async
 * @function getAudioAnalysisResult
 * @description process audio analysis results, different Comprehend categories
 */
async function getAudioAnalysisResult(bucket, data) {
  const [
    entity,
    keyphrase,
  ] = await Promise.all([
    getComprehendResults('entity', bucket, data),
    getComprehendResults('keyphrase', bucket, data),
  ]);

  return {
    ...entity,
    KeyPhrases: keyphrase || {},
  };
}

/**
 * @async
 * @function parseAnalysisResults
 * @description process all analysis results
 */
async function parseAnalysisResults(bucket, data) {
  const [
    video,
    audio,
  ] = await Promise.all([
    getVideoAnalysisResult(bucket, data),
    getAudioAnalysisResult(bucket, data),
  ]);

  return {
    ...video,
    ...audio,
  };
}

/**
 * @async
 * @function makeReachEngineParams
 * @description process all analysis results and compile RE-specific params to start RE workflow
 */
async function makeReachEngineParams(payload) {
  const src = payload.data.src;
  const proxy = payload.input.video;

  const prefix = proxy.baseDir;
  const name = 'output_reachengine.json';
  const parsed = await parseAnalysisResults(proxy.bucket, payload.data);
  await uploadFile(proxy.bucket, prefix, name, parsed);

  console.log(JSON.stringify(parsed, null, 2));

  return {
    sourceS3Path: `s3://${src.bucket}/${src.key}`,
    proxyS3Path: `s3://${proxy.bucket}/${proxy.key}`,
    subtitleS3Path: `s3://${proxy.bucket}/${payload.data.audio.transcribe.vtt}`,
    metadataJsonS3Path: `s3://${proxy.bucket}/${prefix}/${name}`,
  };
}

/**
 * @function handler
 * @description function to start ReachEngine workflow
 */
exports.handler = async (event, context) => {
  /* parse SNS message */
  const message = JSON.parse(event.Records[0].Sns.Message);
  console.log(`message = ${JSON.stringify(message, null, 2)}`);

  /* look for 'stateMachine' key and make sure the value suffix is 'analysis' */
  /* ie. SO0050-<stack-name>-analysis */
  if (message.stateMachine.split('-').pop() !== 'analysis') {
    return undefined;
  }

  /* only handle 'video' */
  if (message.data.src.type !== 'video') {
    return undefined;
  }

  /* parse analysis result and prepare params for starting RE workflow */
  const params = await makeReachEngineParams(message);
  console.log(`params = ${JSON.stringify(params, null, 2)}`);

  /* start RE */
  const endpoint = URL.parse(REACHENGINE_ENDPOINT);
  const response = await send(endpoint, params).catch((e) => {
    console.error(e);
    throw e;
  });

  console.log(`response = ${JSON.stringify(response, null, 2)}`);
  return response;
};
