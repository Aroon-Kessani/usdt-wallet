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

import { HDNodeWallet, Mnemonic, JsonRpcProvider } from 'ethers'

import WalletAccountEvm from './wallet-account-evm.js'

const FEE_RATE_NORMAL_MULTIPLIER = 1.1,
      FEE_RATE_FAST_MULTIPLIER = 2.0

/** @typedef {import('./wallet-account-evm.js').EvmWalletConfig} EvmWalletConfig */

export default class WalletManagerEvm {
  #seedPhrase
  #provider

  /**
   * Creates a new wallet manager for evm blockchains.
   *
   * @param {string} seedPhrase - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  constructor (seedPhrase, config = {}) {
    if (!WalletManagerEvm.isValidSeedPhrase(seedPhrase)) {
      throw new Error('The seed phrase is invalid.')
    }

    this.#seedPhrase = seedPhrase

    const { rpcUrl } = config

    if (rpcUrl) {
      this.#provider = new JsonRpcProvider(rpcUrl)
    }
  }

  /**
   * Returns a random [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   *
   * @returns {string} The seed phrase.
   */
  static getRandomSeedPhrase () {
    const wallet = HDNodeWallet.createRandom()

    return wallet.mnemonic.phrase
  }

  /**
   * Checks if a seed phrase is valid.
   *
   * @param {string} seedPhrase - The seed phrase.
   * @returns {boolean} True if the seed phrase is valid.
   */
  static isValidSeedPhrase (seedPhrase) {
    return Mnemonic.isValidMnemonic(seedPhrase)
  }

  /**
   * The seed phrase of the wallet.
   *
   * @type {string}
   */
  get seedPhrase () {
    return this.#seedPhrase
  }

  /**
   * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @example
   * // Returns the account with derivation path m/44'/60'/0'/0/1
   * const account = await wallet.getAccount(1);
   * @param {number} [index] - The index of the account to get (default: 0).
   * @returns {Promise<WalletAccountEvm>} The account.
   */
  async getAccount (index = 0) {
    return await this.getAccountByPath(`0'/0/${index}`)
  }

  /**
   * Returns the wallet account at a specific BIP-44 derivation path.
   *
   * @example
   * // Returns the account with derivation path m/44'/60'/0'/0/1
   * const account = await wallet.getAccountByPath("0'/0/1");
   * @param {string} path - The derivation path (e.g. "0'/0/0").
   * @returns {Promise<WalletAccountEvm>} The account.
   */
  async getAccountByPath (path) {
    const { url } = this.#provider._getConnection()

    return new WalletAccountEvm(this.#seedPhrase, path, {
      rpcUrl: url
    })
  }

  /**
   * Returns the current fee rates.
   *
   * @returns {Promise<{ normal: number, fast: number }>} The fee rates (in weis).
   */
  async getFeeRates () {
    if (!this.#provider) {
      throw new Error('The wallet must be connected to a provider to get fee rates.')
    }

    const feeData = await this.#provider.getFeeData()
    
    const maxFeePerGas = Number(feeData.maxFeePerGas)

    return {
      normal: Math.round(maxFeePerGas * FEE_RATE_NORMAL_MULTIPLIER),
      fast: maxFeePerGas * FEE_RATE_FAST_MULTIPLIER
    }
  }
}
