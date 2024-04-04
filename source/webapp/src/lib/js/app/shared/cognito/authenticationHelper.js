// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import BigInteger from './bigInteger.js';

const {
  SHA256,
  HmacSHA256,
  lib: {
    WordArray,
  },
  enc: {
    Base64,
  },
} = CryptoJS;

const {
  Buffer,
} = window.Polyfill;

const INIT_N = [
  'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1',
  '29024E088A67CC74020BBEA63B139B22514A08798E3404DD',
  'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245',
  'E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED',
  'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D',
  'C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F',
  '83655D23DCA3AD961C62F356208552BB9ED529077096966D',
  '670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B',
  'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9',
  'DE2BCBF6955817183995497CEA956AE515D2261898FA0510',
  '15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64',
  'ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7',
  'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6B',
  'F12FFA06D98A0864D87602733EC86A64521F2B18177B200C',
  'BBE117577A615D6C770988C0BAD946E208E24FA074E5AB31',
  '43DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF',
].join('');

const INFOBITS = Buffer.from(
  'Caldera Derived Key',
  'utf8'
);

function randomBytes(bytes) {
  return Buffer.from(
    WordArray.random(bytes).toString(),
    'hex'
  );
}

export default class AuthenticationHelper {
  constructor(userPoolId) {
    this.$userPoolId = userPoolId;
    this.$userPoolName = userPoolId.split('_')[1];

    this.N = new BigInteger(INIT_N, 16);
    this.g = new BigInteger('2', 16);
    this.k = new BigInteger(
      this.hexHash(`00${this.N.toString(16)}0${this.g.toString(16)}`),
      16
    );
    this.a = this.randomizeSmallA();
    this.A = undefined;
  }

  get userPoolId() {
    return this.$userPoolId;
  }

  get userPoolName() {
    return this.$userPoolName;
  }

  hexHash(hash) {
    return this.hash(
      Buffer.from(hash, 'hex')
    );
  }

  hash(buf) {
    let str = buf;
    if (buf instanceof Buffer) {
      str = WordArray.create(buf);
    }

    const hashHex = SHA256(str).toString();
    return new Array(64 - hashHex.length).join('0') + hashHex;
  }

  /* generate a random small A that will be used to compute large A */
  randomizeSmallA() {
    const randomHex = randomBytes(128).toString('hex');
    const randomNum = new BigInteger(randomHex, 16);
    const a = randomNum.mod(this.N);
    return a;
  }

  /* Compute client public value A = g ** a % N */
  async calculateA() {
    if (this.A) {
      return this.A;
    }

    return new Promise((resolve, reject) => {
      this.g.modPow(this.a, this.N, (e, A) => {
        if (e) {
          reject(e);
          return;
        }
        if (A.mod(this.N).equals(BigInteger.ZERO)) {
          console.error(
            'ERR:',
            'calculateA:',
            'A mod N cannot be 0'
          );
          reject(new Error('A mod N cannot be 0'));
          return;
        }
        this.A = A;
        resolve(this.A);
      });
    });
  }

  async calculateU(A, B) {
    const UHash = this.hexHash(
      this.padHex(A) + this.padHex(B)
    );

    const U = new BigInteger(UHash, 16);
    return U;
  }

  async calculateS(U, X, B) {
    return new Promise((resolve, reject) => {
      const g = this.g;
      const k = this.k;
      const N = this.N;
      const a = this.a;

      g.modPow(X, N, (e, gPrime) => {
        if (e) {
          reject(e);
          return;
        }

        const interim = B.subtract(k.multiply(gPrime));
        interim.modPow(
          a.add(U.multiply(X)),
          N,
          (e2, S) => {
            if (e2) {
              reject(e2);
              return;
            }
            resolve(S.mod(N));
          }
        );
      });
    });
  }

  async calculateHKDF(
    ikm,
    salt
  ) {
    const infoBitsWordArray = WordArray.create(
      Buffer.concat([
        INFOBITS,
        Buffer.from(String.fromCharCode(1), 'utf8'),
      ])
    );

    let ikmWordArray = ikm;
    if (ikmWordArray instanceof Buffer) {
      ikmWordArray = WordArray.create(ikm);
    }

    let saltWordArray = salt;
    if (saltWordArray instanceof Buffer) {
      saltWordArray = WordArray.create(salt);
    }

    const prk = HmacSHA256(ikmWordArray, saltWordArray);
    const hmac = HmacSHA256(infoBitsWordArray, prk);

    return Buffer.from(hmac.toString(), 'hex')
      .slice(0, 16);
  }

  async computePasswordAuthenticationKey(
    username,
    password,
    B,
    salt
  ) {
    if (B.mod(this.N).equals(BigInteger.ZERO)) {
      console.error(
        'ERR:',
        'computePasswordAuthenticationKey:',
        'B mod N cannot be 0'
      );
      throw new Error('B mod N cannot be 0');
    }

    const U = await this.calculateU(
      this.A,
      B
    );

    if (U.equals(BigInteger.ZERO)) {
      console.error(
        'ERR:',
        'calculateU:',
        'U value is 0'
      );
      throw new Error('U cannot be 0');
    }

    const usernamePassword = `${this.userPoolName}${username}:${password}`;
    const usernamePasswordHash = this.hash(usernamePassword);

    const X = new BigInteger(
      this.hexHash(this.padHex(salt) + usernamePasswordHash),
      16
    );

    const S = await this.calculateS(
      U,
      X,
      B
    );

    const hkdf = await this.calculateHKDF(
      Buffer.from(this.padHex(S), 'hex'),
      Buffer.from(this.padHex(U.toString(16)), 'hex')
    );

    return hkdf;
  }

  passwordClaimSignature(
    hkdf,
    username,
    secretBlock,
    dateNow
  ) {
    const message = WordArray.create(
      Buffer.concat([
        Buffer.from(this.userPoolName, 'utf8'),
        Buffer.from(username, 'utf8'),
        Buffer.from(secretBlock, 'base64'),
        Buffer.from(dateNow, 'utf8'),
      ])
    );

    const key = WordArray.create(hkdf);
    const signature = HmacSHA256(message, key);

    return Base64.stringify(signature);
  }

  padHex(bigNum) {
    let sHash = bigNum.toString(16);
    if ((sHash.length % 2) === 1) {
      sHash = `0${sHash}`;
    } else if ('89ABCDEFabcdef'.indexOf(sHash[0]) >= 0) {
      sHash = `00${sHash}`;
    }

    return sHash;
  }

  static hex2BigInt(value) {
    return new BigInteger(value, 16);
  }
}

export const USER_ATTRIBUTES_PREFIX = 'userAttributes.';
