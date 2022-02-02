/**
 * Sample code to start Editshare workflow on receiving analysis SNS notification
 * Convert and consolidate analysis result into a JSON format that Editshare can import to a project
 */
const URL = require('url');
const HTTPS = require('https');

/* Editshare RESTful API endpoint */
const EDITSHARE_ENDPOINT = 'https://<EDITSHARE_API>';

/* Editshare API Key (if any) */
const EDITSHARE_API_KEY = 'API_KEY';

/**
 *
 * @param {URL} url - Editshare URL
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
        apiKey: EDITSHARE_API_KEY,
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
 * @function handler
 * @description function to start Editshare workflow
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

  /* start Editshare */
  const endpoint = URL.parse(EDITSHARE_ENDPOINT);
  const response = await send(endpoint, message).catch((e) => {
    console.error(e);
    throw e;
  });

  console.log(`response = ${JSON.stringify(response, null, 2)}`);
  return response;
};
