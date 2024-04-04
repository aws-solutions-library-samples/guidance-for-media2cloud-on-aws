// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import AppUtils from './appUtils.js';
import ApiHelper from './apiHelper.js';
import {
  GetUserSession,
  RegisterUserSessionEvent,
  SESSION_SIGNIN,
  SESSION_SIGNOUT,
  SESSION_TOKEN_REFRESHED,
} from './cognito/userSession.js';

const {
  AwsIotMqtt5ClientConfigBuilder,
  Mqtt5Client,
  QoS,
  once,
} = window.AWSIotDeviceSDKv2;

const REGION = SolutionManifest.Region;
const IOT_HOST = SolutionManifest.IotHost;
const IOT_TOPIC = SolutionManifest.IotTopic;

/* singleton implementation */
let _singleton;

/* receive update event on iot message received */
const _receivers = {};

const _onMessageReceived = (message) => {
  setTimeout(async () => {
    const names = Object.keys(_receivers);
    try {
      await Promise.all(
        names.map((name) =>
          _receivers[name](message)
            .catch((e) => {
              console.error(
                'ERR:',
                `_onMessageReceived.${name}:`,
                e.message
              );
              return undefined;
            }))
      );

      console.log(
        'INFO:',
        '_onMessageReceived:',
        `${names.length} receivers:`,
        names.join(', ')
      );
    } catch (e) {
      console.error(
        'ERR:',
        '_onMessageReceived:',
        e
      );
    }
  }, 10);
};

class IotSubscriber {
  constructor() {
    _singleton = this;
    this.$id = AppUtils.randomHexstring();

    this.$client = undefined;
    this.$cachedCredentials = undefined;
    this.$lastReceivedMessage = undefined;

    RegisterUserSessionEvent(
      'iotsubscriber',
      this.onUserSessionChangeEvent.bind(this)
    );
  }

  get id() {
    return this.$id;
  }

  getCredentials() {
    return this.$cachedCredentials;
  }

  async refreshCredentials() {
    return this.getCredentials();
  }

  setCredentials(creds = {}) {
    this.$cachedCredentials = {
      aws_region: REGION,
      aws_access_id: creds.accessKeyId,
      aws_secret_key: creds.secretAccessKey,
      aws_sts_token: creds.sessionToken,
      // expiration: creds.expiration,
    };
  }

  get lastReceivedMessage() {
    return this.$lastReceivedMessage;
  }

  set lastReceivedMessage(val) {
    this.$lastReceivedMessage = val;
  }

  async onUserSessionChangeEvent(
    event,
    session
  ) {
    console.log(
      '=== IotSubscriber.onUserSessionChangeEvent ==='
    );

    if (event === SESSION_SIGNOUT) {
      return this.unsubscribe();
    }

    if (event === SESSION_SIGNIN) {
      return this.connect();
    }

    const credentials = await session.fromCredentials();
    this.setCredentials(credentials);

    return this.reconnect();
  }

  get client() {
    return this.$client;
  }

  set client(val) {
    this.$client = val;
  }

  /**
   * @function connect
   * @description connecto Iot message broker
   */
  async connect() {
    try {
      if (this.client) {
        return;
      }

      const session = GetUserSession();

      /* attach iot policy to the user */
      await ApiHelper.attachIot();

      console.log(
        'INFO:',
        'iot.connect:',
        `permission granted to ${session.username}`
      );

      const credentials = await session.fromCredentials();
      this.setCredentials(credentials);

      const wsConfig = {
        credentialsProvider: this,
        region: REGION,
      };

      const builder = AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth(
        IOT_HOST,
        wsConfig
      );

      const decoder = new TextDecoder('utf-8');

      const client = new Mqtt5Client(builder.build());

      client.on('error', (error) => {
        console.error(
          'ERR:',
          'Mqtt5Client.error:',
          error
        );
      });

      client.on('messageReceived', (data) => {
        const decoded = decoder.decode(data.message.payload);
        if (this.lastReceivedMessage === decoded) {
          console.log(
            '[DUPLICATED]',
            'INFO:',
            'Mqtt5Client.messageReceived:',
            data,
            decoded
          );
          return;
        }

        this.lastReceivedMessage = decoded;

        console.log(
          'INFO:',
          'Mqtt5Client.messageReceived:',
          data,
          decoded
        );

        _onMessageReceived(JSON.parse(decoded));
      });

      client.on('attemptingConnect', (data) => {
        console.log(
          'INFO:',
          'Mqtt5Client.attemptingConnect:',
          data
        );
      });

      client.on('connectionSuccess', (data) => {
        console.log(
          'INFO:',
          'Mqtt5Client.connectionSuccess:',
          data
        );
      });

      client.on('connectionFailure', (data) => {
        console.log(
          'INFO:',
          'Mqtt5Client.connectionFailure:',
          data
        );
      });

      client.on('disconnection', (data) => {
        console.log(
          'INFO:',
          'Mqtt5Client.disconnection:',
          data
        );
      });

      client.on('stopped', (data) => {
        console.log(
          'INFO:',
          'Mqtt5Client.stopped:',
          data
        );
      });

      const promises = [
        once(client, 'attemptingConnect'),
        once(client, 'connectionSuccess'),
      ];

      client.start();
      await Promise.all(promises);

      const subscribed = await client.subscribe({
        subscriptions: [
          {
            qos: QoS.AtLeastOnce,
            topicFilter: IOT_TOPIC,
          },
        ],
      });

      console.log(
        'INFO:',
        'client.subscribe:',
        subscribed
      );

      this.client = client;
    } catch (e) {
      console.error(
        'ERR:',
        'IotSubscriber.connect',
        e
      );
      throw e;
    }
  }

  /**
   * @function reconnect
   * @description reconnect to Iot message broker
   */
  async reconnect() {
    try {
      await this.unsubscribe();

      const client = this.client;

      const promises = [
        once(client, 'attemptingConnect'),
        once(client, 'connectionSuccess'),
      ];

      client.start();

      /* attemptingConnect may not fire on reconnection */
      await Promise.any(promises);

      const subscribed = await client.subscribe({
        subscriptions: [
          {
            qos: QoS.AtLeastOnce,
            topicFilter: IOT_TOPIC,
          },
        ],
      });
      console.log(
        'RECONNECT: client.subscribe',
        subscribed
      );
    } catch (e) {
      console.error(
        'ERR:',
        'IotSubscriber.reconnect',
        e
      );
      throw e;
    }
  }

  async unsubscribe() {
    try {
      const client = this.client;

      const unsubscribed = await client.unsubscribe({
        topicFilters: [
          IOT_TOPIC,
        ],
      });
      console.log(
        'RECONNECT: client.unsubscribe',
        unsubscribed
      );

      const promises = [
        once(client, 'disconnection'),
        once(client, 'stopped'),
      ];

      client.stop();
      await Promise.all(promises);
    } catch (e) {
      console.error(
        'ERR:',
        'IotSubscriber.unsubscribe',
        e
      );
      throw e;
    }
  }
}

const GetIotSubscriber = () => {
  if (_singleton === undefined) {
    const notused_ = new IotSubscriber();
  }

  return _singleton;
};

const RegisterIotMessageEvent = (name, target) => {
  if (!name || typeof target !== 'function') {
    return false;
  }

  _receivers[name] = target;
  return true;
};

const UnregisterIotMessageEvent = (name) => {
  delete _receivers[name];
};

export {
  GetIotSubscriber,
  RegisterIotMessageEvent,
  UnregisterIotMessageEvent,
};
