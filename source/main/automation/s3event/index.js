// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SFNClient,
  StartExecutionCommand,
} = require('@aws-sdk/client-sfn');
const PATH = require('path');
const CRYPTO = require('crypto');
const OS = require('os');
const FS = require('fs/promises');
const {
  CommonUtils,
  MimeTypeHelper,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const {
  FileMagic,
  MagicFlags,
} = require('core-lib/node_modules/@npcz/magic');

const PROXY_BUCKET = process.env.ENV_PROXY_BUCKET;
const RESOURCE_PREFIX = process.env.ENV_RESOURCE_PREFIX;
const MIME_MAJOR_TYPES = [
  'video',
  'audio',
  'image',
];
const MIME_MINOR_TYPES = [
  'pdf',
  'mxf',
  'gxf',
];

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;

function randomGenerateUuid() {
  const random = CRYPTO.randomBytes(16).toString('hex');
  const matched = random.match(/([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{12})/);
  if (!matched) {
    throw new M2CException(`failed to generate UUID from '${random}'`);
  }

  matched.shift();

  return matched.join('-').toLowerCase();
}

function makeSafePrefix(uuid, key) {
  /* compatible with transcribe requirement */
  let safeKey = (!(/^[a-zA-Z0-9_.!*'()/-]{1,1024}$/.test(key)))
    ? key.replace(/[^a-zA-Z0-9_.!*'()/-]/g, '_')
    : key;
  if (safeKey[0] === '/') {
    safeKey = safeKey.slice(1);
  }
  const parsed = PATH.parse(safeKey);
  // eslint-disable-next-line
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  return PATH.join(uuid, parsed.dir, '/');
}

async function getMagicInstance() {
  return new Promise((resolve, reject) => {
    const magicPath = require.resolve('core-lib/node_modules/@npcz/magic');
    console.log(`core-lib/node_modules/@npcz/magic: ${magicPath}`);
    FileMagic.magicFile = PATH.join(PATH.parse(magicPath).dir, 'magic.mgc');
    if (process.platform === 'darwin' || process.platform === 'linux') {
      FileMagic.defaulFlags = MagicFlags.MAGIC_PRESERVE_ATIME;
    }
    FileMagic.getInstance()
      .then((instance) =>
        resolve(instance))
      .catch((e) => {
        console.error(e);
        FileMagic.close();
        return resolve(undefined);
      });
  });
}

async function readBytes(bucket, key, byteLength = 512) {
  return CommonUtils.getByteRange(
    bucket,
    key,
    0,
    byteLength
  );
}

async function runMagic(magic, buf) {
  const random = `magic-${CRYPTO.randomBytes(8).toString('hex')}`;
  const tmpFile = PATH.join(OS.tmpdir(), random);
  await FS.writeFile(tmpFile, buf);
  const mime = magic.detect(tmpFile, magic.flags | MagicFlags.MAGIC_MIME);
  const flags = magic.detect(tmpFile);
  await FS.unlink(tmpFile);
  return {
    mime,
    flags,
  };
}

async function getMagic(bucket, key) {
  try {
    const magic = await getMagicInstance();
    if (!magic) {
      console.error('fail to load magic instance');
      return undefined;
    }
    console.log(`magic version: ${magic.version()}`);
    const bytes = await readBytes(bucket, key);
    const magicInfo = await runMagic(magic, bytes);
    console.log(JSON.stringify(magicInfo, null, 2));
    return magicInfo;
  } catch (e) {
    return undefined;
  } finally {
    FileMagic.close();
  }
}

function typeSupported(mime) {
  if (!mime) {
    return false;
  }

  const parsed = mime
    .split(';')
    .shift()
    .trim();

  const [
    type,
    subtype,
  ] = parsed
    .split('/')
    .map((x) =>
      x.toLowerCase());

  return MIME_MAJOR_TYPES.includes(type)
    || MIME_MINOR_TYPES.includes(subtype);
}

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}\ncontext = ${JSON.stringify(context, null, 2)}`);
  try {
    if (!PROXY_BUCKET) {
      throw new M2CException('PROXY_BUCKET not specified');
    }
    if (!RESOURCE_PREFIX) {
      throw new M2CException('RESOURCE_PREFIX not specified');
    }
    const accountId = context.invokedFunctionArn.split(':')[4];
    if (!accountId) {
      throw new M2CException('accountId not found');
    }

    const bucket = event.detail.bucket.name;
    /* unescape 'space' character */
    const key = event.detail.object.key;
    const size = event.detail.object.size;

    /* zero byte size (ie. folder), skip */
    if (size === 0) {
      return undefined;
    }

    /* check Metadata field */
    const metadata = await CommonUtils.headObject(
      bucket,
      key
    ).then((res) =>
      res.Metadata);

    /* web uploaded content */
    if (metadata.webupload) {
      return undefined;
    }

    /* check magic number and mime type */
    const mime = MimeTypeHelper.getMime(key);
    const magic = await getMagic(bucket, key);
    if ((magic && !typeSupported(magic.mime)) && !typeSupported(mime)) {
      return undefined;
    }

    /* create uuid */
    const uuid = metadata.uuid || randomGenerateUuid();

    /* start main state machine */
    const stateMachineArn = [
      'arn:aws:states',
      process.env.AWS_REGION,
      accountId,
      'stateMachine',
      `${RESOURCE_PREFIX}-main`,
    ].join(':');

    const params = {
      input: {
        uuid,
        bucket,
        key,
        destination: {
          bucket: PROXY_BUCKET,
          prefix: makeSafePrefix(uuid, key),
        },
      },
    };

    const stepfunctionClient = xraysdkHelper(new SFNClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new StartExecutionCommand({
      input: JSON.stringify(params),
      stateMachineArn,
    });

    return stepfunctionClient.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  } catch (e) {
    console.error(
      'ERR:',
      e.$metadata.httpStatusCode,
      e.name,
      e.message
    );

    return undefined;
  }
};
