/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */

/**
 * @class IotSubscriber
 * @description managing Iot subscription and pump messages from state machines to webapp
  */
class IotSubscriber {
  constructor(cognito, collection) {
    try {
      if (!cognito) {
        throw new Error('missing parameter, cognito');
      }

      if (!collection) {
        throw new Error('missing parameter, collection');
      }

      if (!SO0050 || !SO0050.IotHost || !SO0050.IotTopic) {
        throw new Error('solution-manifest is mis-configured');
      }

      this.$cognitoInstance = cognito;
      this.$collectionInstance = collection;
      this.$errorStatus = '#errorStatus';
      this.$iotInstance = undefined;
      this.$host = SO0050.IotHost;
      this.$topic = SO0050.IotTopic;
      this.$clientId = undefined;
    } catch (e) {
      e.message = `IotSubscriber.constructor: ${encodeURIComponent(e.message)}`;
      console.error(e.message);
      throw e;
    }
  }

  get cognito() {
    return this.$cognitoInstance;
  }

  get collection() {
    return this.$collectionInstance;
  }

  get iot() {
    return this.$iotInstance;
  }

  set iot(val) {
    this.$iotInstance = val;
  }

  get region() {
    return this.$region;
  }

  get host() {
    return this.$host;
  }

  set host(val) {
    this.$host = val;
  }

  get topic() {
    return this.$topic;
  }

  set topic(val) {
    this.$topic = val;
  }

  get clientId() {
    return this.$clientId;
  }

  set clientId(val) {
    this.$clientId = val;
  }

  get errorStatus() {
    return this.$errorStatus;
  }

  /**
   * @function reconnect
   * @description reconnect to Iot message broker
   */
  async reconnect() {
    try {
      const {
        accessKeyId = '',
        secretAccessKey = '',
        sessionToken = '',
      } = AWS.config.credentials || {};
      console.log(`reconnecting ${this.clientId} with temporary credential...`);

      await this.iot.updateWebSocketCredentials(accessKeyId, secretAccessKey, sessionToken);

      return this;
    } catch (e) {
      e.message = `IotSubscriber.reconnect: ${encodeURIComponent(e.message)}`;
      console.error(e.message);
      return this;
    }
  }

  /**
   * @function connect
   * @description connecto Iot message broker
   */
  async connect() {
    try {
      const user = this.cognito.user || {};

      const {
        accessKeyId = '',
        secretAccessKey: secretKey = '',
        sessionToken = '',
      } = AWS.config.credentials || {};

      this.clientId = `${user.username || 'anonymous'}-${(Math.floor((Math.random() * 100000) + 1))}`;

      this.iot = AWSIoTData.device({
        host: this.host,
        region: AWS.config.region,
        clienId: this.clientId,
        protocol: 'wss',
        debug: false,
        accessKeyId,
        secretKey,
        sessionToken,
      });
    } catch (e) {
      e.message = `IotSubscriber.connect: ${encodeURIComponent(e.message)}`;
      console.error(e.message);
      return this;
    }

    this.iot.on('connect', () => {
      console.log(`${this.clientId} connected to IoT`);
      this.iot.subscribe(this.topic);
    });

    this.iot.on('reconnect', () => {
      console.log(`${this.clientId} reconnecting...`);
      this.reconnect();
    });

    this.iot.on('message', (topic, payload) => {
      const status = JSON.parse(payload.toString());
      const bindFn = this.delegate.bind(this, status);

      setTimeout(() => {
        bindFn();
      }, 10);
    });
    return this;
  }

  /**
   * @function delegate
   * @description delegate messages to CardCollection
   * @param {object} status
   */
  async delegate(status) {
    if (this.collection && typeof this.collection.messageHook === 'function') {
      const {
        AWSomeNamespace: {
          StateMessage,
        },
      } = window;
      await this.collection.messageHook(new StateMessage(status));
    }
    return this;
  }
}
