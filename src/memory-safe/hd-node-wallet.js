import { assert, assertArgument, computeHmac, getBytes, getNumber, HDNodeWallet, hexlify, isBytesLike } from "ethers"

import MemorySafeSigningKey from "./signing-key.js";

const MasterSecret = new Uint8Array([ 66, 105, 116, 99, 111, 105, 110, 32, 115, 101, 101, 100 ]);

const HardenedBit = 0x80000000;

const N = Buffer.from("fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141", 'hex');

const _guard = { };

function ser_I(index, chainCode, publicKey, privateKeyBuffer) {
    const data = new Uint8Array(37);

    if (index & HardenedBit) {
        assert(privateKeyBuffer != null, "cannot derive child of neutered node", "UNSUPPORTED_OPERATION", {
            operation: "deriveChild"
        });

        data.set(getBytes(privateKeyBuffer), 1);
    } else {
        data.set(getBytes(publicKey));
    }

    for (let i = 24; i >= 0; i -= 8) { data[33 + (i >> 3)] = ((index >> (24 - i)) & 0xff); }
    const I = getBytes(computeHmac("sha512", chainCode, data));

    return { IL: I.slice(0, 32), IR: I.slice(32) };
}

export default class MemorySafeHDNodeWallet extends HDNodeWallet {
  constructor (guard, signingKey, parentFingerprint, chainCode, path, index, depth, mnemonic, provider) {
    super(guard, signingKey, parentFingerprint, chainCode, path, index, depth, mnemonic, provider)
  }

  get privateKeyBuffer () {
    return this.signingKey.privateKeyBuffer
  }

  deriveChild(_index) {
    const index = getNumber(_index, "index");
    assertArgument(index <= 0xffffffff, "invalid index", "index", index);

    let path = this.path;
    if (path) {
      path += "/" + (index & ~HardenedBit);
      if (index & HardenedBit) { path += "'"; }
    }

    const { IR, IL } = ser_I(index, this.chainCode, this.publicKey, this.privateKeyBuffer);

    const buffer = new Uint8Array(32)

    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = IL[i] + this.privateKeyBuffer[i] % N[i]
    }

    const ki = new MemorySafeSigningKey(buffer);

    return new MemorySafeHDNodeWallet(_guard, ki, this.fingerprint, hexlify(IR),
      path, index, this.depth + 1, this.mnemonic, this.provider);
  }

  dispose () {
    this.signingKey.dispose()
  }

  static fromSeed(seed) {
      return MemorySafeHDNodeWallet.#fromSeed(seed, null);
  }

  static fromExtendedKey(extendedKey) {
    throw new Error('Method not supported.')
  }

  static #fromSeed(_seed, mnemonic) {
    assertArgument(isBytesLike(_seed), "invalid seed", "seed", "[REDACTED]");

    const seed = getBytes(_seed, "seed");
    assertArgument(seed.length >= 16 && seed.length <= 64, "invalid seed", "seed", "[REDACTED]");

    const I = getBytes(computeHmac("sha512", MasterSecret, seed));
    const signingKey = new MemorySafeSigningKey(I.slice(0, 32));

    return new MemorySafeHDNodeWallet(_guard, signingKey, "0x00000000", hexlify(I.slice(32)),
      "m", 0, 0, mnemonic, null);
  }
}
