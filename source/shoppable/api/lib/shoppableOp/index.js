// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const BaseOp = require('../shared/baseOp');
const {
  InternalServerErrorException,
} = require('../shared/exceptions');

const OP_GETPRODUCTDETAILS = 'GetProductDetails';
const OP_PREVIEWORDERS = 'PreviewOrders';
const OP_CONFIRMORDERS = 'ConfirmOrders';

const ONE_DAY = 24 * 3600000;

class ShoppableOp extends BaseOp {
  static opSupported(op) {
    return [
      OP_GETPRODUCTDETAILS,
      OP_PREVIEWORDERS,
      OP_CONFIRMORDERS,
    ].includes(op);
  }

  async onGET(data) {
    let responseData;
    try {
      const qs = this.queryString;

      if (qs.op === OP_GETPRODUCTDETAILS) {
        responseData = await this.getProductDetails(qs);
      } else {
        throw new Error('type not supported');
      }

      return this.onSucceed(responseData);
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    } finally {
      console.log('finally... closing driver...');
    }
  }

  async onPOST(data) {
    let responseData;
    try {
      const qs = this.queryString;

      let body = this.request.body;
      if (body !== undefined) {
        body = JSON.parse(body);
      } else {
        body = {};
      }

      if (qs.op === OP_PREVIEWORDERS) {
        responseData = await this.postPreviewOrders(qs, body);
      } else if (qs.op === OP_CONFIRMORDERS) {
        responseData = await this.postConfirmOrders(qs, body);
      } else {
        throw new Error('type not supported');
      }

      return this.onSucceed(responseData);
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    } finally {
      console.log('finally... closing driver...');
    }
  }

  async getProductDetails(qs) {
    let asins = [];
    if (qs.asins) {
      asins = decodeURIComponent(qs.asins);
      asins = asins.split(',');
    } else if (qs.asin) {
      asins = [
        decodeURIComponent(qs.asin),
      ];
    } else {
      throw new Error('missing parameter');
    }

    const {
      url,
      apikey,
      ipAddress,
      languageCode,
      country,
      // clientid, // oauth2
      // clientsecret, // oauth2
    } = await this.getConfig();

    let promises = asins.map((asin) => {
      const _url = `${url}/products/details/${asin}?marketplaceId=${country}`;

      const headers = new Headers();
      headers.append('x-amz-customer-ip-address', ipAddress);
      headers.append('Accept-Language', languageCode);
      headers.append('Authorization', `ApiKey ${apikey}`);

      const options = {
        method: 'GET',
        headers,
        redirect: 'follow',
      };

      return this.invokeApi(_url, options);
    });

    promises = await Promise.all(promises);

    return promises;
  }

  async postPreviewOrders(qs, body) {
    // validate order request
    if (body.items === undefined || body.items.length === 0) {
      throw new Error('no item');
    }

    let chargeAmount = 0;
    let currencyCode;
    let purchaseId;
    const orders = [];
    for (let i = 0; i < body.items.length; i += 1) {
      const item = body.items[i];
      if (item.asin === undefined) {
        throw new Error('missing parameter');
      }
      if (item.offerId === undefined) {
        throw new Error('missing parameter');
      }
      if (item.merchantId === undefined) {
        throw new Error('missing parameter');
      }
      if (item.quantity === undefined || item.quantity <= 0) {
        throw new Error('incorrect quantity');
      }

      const details = await this.getProductDetails({
        asin: item.asin,
      }).then((res) =>
        res[0]);

      if (details.availability.type === 'OUT_OF_STOCK') {
        throw new Error('item out of stock');
      }

      let orderId = Buffer.from(details.title).toString('base64');
      orderId = orderId.toUpperCase().replace(/[^0-9A-Z]/, '');
      purchaseId = `amzn.aa.purchaseId.${orderId}`;
      orderId = `amzn.aa.orderId.${orderId}`;
      const order = {
        id: orderId,
        items: [
          {
            title: details.title,
            asin: item.asin,
            quantity: item.quantity,
            estimatedArrivalDate: Math.round((Date.now() + ONE_DAY) / 1000),
          },
        ],
      };
      orders.push(order);
      chargeAmount += details.price.value * item.quantity;
      currencyCode = details.price.currencyCode;
    }

    const previewOrder = {
      shippingAddress: {
        recipient: 'Amazon.com',
        street: '410 Terry Ave N',
        city: 'SEATTLE',
        zipCode: '98109',
      },
      paymentMethods: [
        {
          tail: '3690',
          type: 'CARD',
        },
      ],
      purchaseId,
      charges: [
        {
          chargeType: 'PURCHASE_TOTAL',
          chargeAmount: {
            value: chargeAmount,
            currencyCode,
          },
        },
      ],
      orders,
    };

    return previewOrder;
  }

  async postConfirmOrders(qs, body = {}) {
    let purchaseId = qs.purchaseId;

    if (purchaseId === undefined) {
      throw new Error('missing parameter');
    }

    purchaseId = decodeURIComponent(purchaseId);
    if (purchaseId.indexOf('amzn.aa.purchaseId.') !== 0) {
      throw new Error('invalid parameter');
    }

    // simply return whatever is given
    let confirmOrder = {
      purchaseId,
    };

    if (body.shippingAddress && body.paymentMethods
    && body.purchaseId && body.orders && body.charges) {
      confirmOrder = body;
    }

    return confirmOrder;
  }
}

module.exports = ShoppableOp;
