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

const BIP_44_ETH_DERIVATION_PATH_BASE = "m/44'/60'"

/**
 * @typedef {Object} EvmWalletConfig
 * @property {string} [rpcUrl] - The url of the rpc provider.
 */

export default class WalletManagerEvm {
  #wallet

  /**
   * Creates a new wallet manager for evm blockchains.
   *
   * @param {string} seedPhrase - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  constructor (seedPhrase, config = {}) {
    const { rpcUrl } = config

    if (!WalletManagerEvm.isValidSeedPhrase(seedPhrase)) {
      throw new Error('Seed phrase is invalid.')
    }

    this.#wallet = HDNodeWallet.fromPhrase(seedPhrase, undefined, BIP_44_ETH_DERIVATION_PATH_BASE)

    if (rpcUrl) {
      const provider = new JsonRpcProvider(rpcUrl)

      this.#wallet = this.#wallet.connect(provider)
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
    return this.#wallet.mnemonic.phrase
  }

  /**
   * Returns the wallet account at a specific BIP-44 derivation path.
   *
   * @param {string} path - The derivation path (e.g. "0'/0/0").
   * @returns {Promise<WalletAccountEvm>} The account.
   */
  async getAccountByPath (path) {
    const account = this.#wallet.derivePath(path)

    return new WalletAccountEvm(account)
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
}
