// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { sha512 } from '@noble/hashes/sha512'
import * as secp256k1 from '@noble/secp256k1'

import { assertArgument, dataLength, getBytesCopy, Signature, SigningKey, toBeHex } from 'ethers'

import { sodium_memzero } from 'sodium-universal'

secp256k1.etc.hmacSha256Sync = (k, ...m) => hmac(sha256, k, secp256k1.etc.concatBytes(...m))

const NULL = '0x0000000000000000000000000000000000000000000000000000000000000000'

const MASTER_KEY_SECRET = Buffer.from('Bitcoin seed')

const DERIVATION_PATH_BUFFER_OFFSET = 0x80000000

function encodeUInt32BE (value) {
  const buffer = new Uint8Array(4)

  buffer[0] = (value >> 24) & 0xff
  buffer[1] = (value >> 16) & 0xff
  buffer[2] = (value >> 8) & 0xff
  buffer[3] = value & 0xff

  return buffer
}

function compareWithCurveOrder (buffer, offset = 0) {
  for (let i = 0; i < 32; i++) {
    const curveOrderByte = Number((secp256k1.CURVE.n >> BigInt(8 * (31 - i))) & 0xffn)

    if (buffer[offset + i] > curveOrderByte) {
      return 1
    }

    if (buffer[offset + i] < curveOrderByte) {
      return -1
    }
  }

  return 0
}

function sumPrivateKeys (a, b) {
  let carry = 0

  for (let i = 31; i >= 0; i--) {
    const sum = a[i] + b[i] + carry
    a[i] = sum & 0xff
    carry = sum >> 8
  }

  return carry > 0
}

function subtractFromPrivateKey (privateKey) {
  let carry = 0

  for (let i = 31; i >= 0; i--) {
    const curveOrderByte = Number((secp256k1.CURVE.n >> BigInt(8 * (31 - i))) & 0xffn)

    const diff = privateKey[i] - curveOrderByte - carry
    privateKey[i] = diff < 0 ? diff + 256 : diff
    carry = diff < 0 ? 1 : 0
  }
}

function isBufferZero (buffer) {
  return buffer.every(byte => byte === 0)
}

export default class MemorySafeSigningKey extends SigningKey {
  #privateKeyBuffer

  constructor(privateKeyBuffer) {
    if (!(privateKeyBuffer instanceof Uint8Array)) {
      throw new Error('The private key must be a uint8 array.')
    }
    if (privateKeyBuffer.length !== 32) {
      throw new Error('The private key must be 32 bytes long.')
    }

    super(NULL)

    this.#privateKeyBuffer = privateKeyBuffer
  }

  get publicKey() {
    return SigningKey.computePublicKey(this.#privateKeyBuffer)
  }

  get compressedPublicKey() {
    return SigningKey.computePublicKey(this.#privateKeyBuffer, true);
  }

  get privateKeyBuffer() {
    return this.#privateKeyBuffer
  }

  get publicKeyBuffer() {
    return secp256k1.getPublicKey(this.#privateKeyBuffer, false)
  }

  sign(digest) {
    assertArgument(dataLength(digest) === 32, 'invalid digest length', 'digest', digest)

    const sig = secp256k1.sign(getBytesCopy(digest), this.#privateKeyBuffer, {
      lowS: true
    })

    return Signature.from({
      r: toBeHex(sig.r, 32),
      s: toBeHex(sig.s, 32),
      v: (sig.recovery ? 0x1c : 0x1b)
    })
  }

  computeSharedSecret(other) {
    const pubKey = SigningKey.computePublicKey(other)
    return hexlify(secp256k1.getSharedSecret(this.#privateKeyBuffer, getBytes(pubKey), false))
  }

  dispose() {
    sodium_memzero(this.#privateKeyBuffer)

    this.#privateKeyBuffer = null
  }

  static from(seed, path) {
    const privateKeyBuffer = new Uint8Array(32),
          masterKeyBuffer = new Uint8Array(64),
          derivationPathBuffer = new Uint8Array(37)

    masterKeyBuffer.set(hmac(sha512, MASTER_KEY_SECRET, seed))

    privateKeyBuffer.set(masterKeyBuffer.subarray(0, 32))

    const chainCode = masterKeyBuffer.subarray(32)

    const indexes = path.split('/')
                        .map(index => +index.replace('\'', ''))

    for (const index of indexes) {
      if (index >= DERIVATION_PATH_BUFFER_OFFSET) {
        derivationPathBuffer[0] = 0x0

        derivationPathBuffer.set(privateKeyBuffer, 1)
      } else {
        derivationPathBuffer.set(secp256k1.getPublicKey(privateKeyBuffer, true))
      }

      derivationPathBuffer.set(encodeUInt32BE(index), 33)

      masterKeyBuffer.set(hmac(sha512, chainCode, derivationPathBuffer))

      if (compareWithCurveOrder(masterKeyBuffer) >= 0) {
        continue
      }

      const hasOverflow = sumPrivateKeys(privateKeyBuffer, masterKeyBuffer)

      if (hasOverflow || compareWithCurveOrder(privateKeyBuffer) >= 0) {
        subtractFromPrivateKey(privateKeyBuffer)
      }

      if (isBufferZero(privateKeyBuffer)) {
        continue
      }

      chainCode.set(masterKeyBuffer.subarray(32))
    }

    sodium_memzero(masterKeyBuffer)

    sodium_memzero(derivationPathBuffer)

    return new MemorySafeSigningKey(privateKeyBuffer)
  }
}
