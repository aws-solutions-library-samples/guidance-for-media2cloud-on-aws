// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Buffer,
} = require('buffer');
const {
  once,
} = require('events');
const {
  StandardRetryStrategy,
} = require('@smithy/util-retry');
const {
  S3Client,
  ChecksumAlgorithm,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const {
  Upload,
} = require('@aws-sdk/lib-storage');
const {
  getSignedUrl,
} = require('@aws-sdk/s3-request-presigner');
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  AuthFlowType,
  ChallengeNameType,
} = require('@aws-sdk/client-cognito-identity-provider');
const {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} = require('@aws-sdk/client-cognito-identity');
const {
  fromCognitoIdentity,
  fromCognitoIdentityPool,
} = require('@aws-sdk/credential-providers');
const {
  FetchHttpHandler,
  streamCollector,
} = require('@smithy/fetch-http-handler');
const {
  HttpRequest,
} = require('@smithy/protocol-http');
const {
  SignatureV4,
} = require('@smithy/signature-v4');
const {
  Sha256,
} = require('@aws-crypto/sha256-browser');
const {
  toUtf8,
} = require('@aws-sdk/util-utf8-browser');
const {
  iot: {
    WebsocketSigv4Config,
    AwsIotMqtt5ClientConfigBuilder,
  },
  mqtt5: {
    Mqtt5Client,
    QoS,
  },
} = require('aws-iot-device-sdk-v2');

/* polyfill node functions */
window.Polyfill = {
  Buffer,
};

/* wrapping aws-sdk-js-v3 */
window.AWSv3 = {
  StandardRetryStrategy,
  S3Client,
  ChecksumAlgorithm,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  Upload,
  getSignedUrl,

  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  AuthFlowType,
  ChallengeNameType,

  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,

  fromCognitoIdentity,
  fromCognitoIdentityPool,

  FetchHttpHandler,
  streamCollector,
  HttpRequest,
  SignatureV4,
  Sha256,
};

/* wrapping aws-iot-device-sdk-v2 */
window.AWSIotDeviceSDKv2 = {
  WebsocketSigv4Config,
  AwsIotMqtt5ClientConfigBuilder,
  Mqtt5Client,
  QoS,
  once,
  toUtf8,
};
