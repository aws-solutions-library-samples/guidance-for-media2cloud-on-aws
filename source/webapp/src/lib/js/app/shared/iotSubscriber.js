// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import CognitoConnector from './cognitoConnector.js';
import AppUtils from './appUtils.js';

const ID_DEMOAPP = '#demo-app';
const ID_IOTSUBSCRIBE = `iotsubscriber-${AppUtils.randomHexstring()}`;
const ON_RECEIVE_MESSAGE = 'iot:message:received';

export default class IotSubscriber {
  constructor() {
    this.$mqtt = undefined;
    this.$clientId = undefined;
    this.$connected = false;
    this.$eventSource = $('<div/>').attr('id', ID_IOTSUBSCRIBE);
    $(ID_DEMOAPP).append(this.$eventSource);
    this.$cognito = CognitoConnector.getSingleton();
    this.registerCognitoEvents();
  }

  static getSingleton() {
    if (!window.AWSomeNamespace.IotSubscriberSingleton) {
      window.AWSomeNamespace.IotSubscriberSingleton = new IotSubscriber();
    }
    return window.AWSomeNamespace.IotSubscriberSingleton;
  }

  static get Event() {
    return {
      Message: {
        Received: ON_RECEIVE_MESSAGE,
      },
    };
  }

  get mqtt() {
    return this.$mqtt;
  }

  set mqtt(val) {
    this.$mqtt = val;
  }

  get clientId() {
    return this.$clientId;
  }

  set clientId(val) {
    this.$clientId = val;
  }

  get eventSource() {
    return this.$eventSource;
  }

  get cognito() {
    return this.$cognito;
  }

  get connected() {
    return this.$connected;
  }

  set connected(val) {
    this.$connected = !!val;
  }

  /**
   * @function connect
   * @description connecto Iot message broker
   */
  async connect() {
    try {
      if (this.connected) {
        return;
      }
      const username = (this.cognito.user || {}).username || 'anonymous';
      this.clientId = `${username}-${AppUtils.randomHexstring()}`;
      this.mqtt = AWSIoTData.device({
        region: SolutionManifest.Region,
        host: SolutionManifest.IotHost,
        clientId: this.clientId,
        protocol: 'wss',
        maximumReconnectTimeMs: 8000,
        debug: true,
        accessKeyId: '',
        secretKey: '',
        sessionToken: '',
      });
    } catch (e) {
      e.message = `IotSubscriber.connect: ${encodeURIComponent(e.message)}`;
      console.error(e.message);
      return;
    }

    this.mqtt.on('connect', () => {
      console.log(`${this.clientId} connected to IoT`);
      this.mqtt.subscribe(SolutionManifest.IotTopic);
      this.connected = true;
    });

    this.mqtt.on('reconnect', () => {
      console.log(`reconnecting ${this.clientId}...`);
      this.reconnect();
    });

    this.mqtt.on('error', (e) => {
      console.log(`error: iot.error: ${e}`);
    });

    this.mqtt.on('message', (topic, payload) =>
      this.eventSource.trigger(IotSubscriber.Event.Message.Received, [JSON.parse(payload.toString())]));
  }

  /**
   * @function reconnect
   * @description reconnect to Iot message broker
   */
  async reconnect(credentials) {
    try {
      const {
        accessKeyId = '',
        secretAccessKey = '',
        sessionToken = '',
      } = credentials || AWS.config.credentials;
      await this.mqtt.updateWebSocketCredentials(accessKeyId, secretAccessKey, sessionToken);
    } catch (e) {
      e.message = `error: iot.reconnect: ${encodeURIComponent(e.message)}`;
      console.error(e.message);
    }
  }

  unsubscribe() {
    if (this.mqtt) {
      this.mqtt.unsubscribe(SolutionManifest.IotTopic, () => {});
    }
  }

  registerCognitoEvents() {
    this.cognito.eventSource.on(CognitoConnector.Events.Session.SignIn, async (event, credentials) =>
      this.connect());
    this.cognito.eventSource.on(CognitoConnector.Events.Session.Refresh, async (event, credentials) =>
      this.reconnect(credentials));
    this.cognito.eventSource.on(CognitoConnector.Events.Session.SignOut, async (event, username) =>
      this.unsubscribe());
  }
}
