import { describe, test, expect } from '@jest/globals'

import { wordlists } from 'ethers'

import WalletManagerEvm from './wallet-manager-evm.js'
import WalletAccountEvm from './wallet-account-evm.js'

const RPC_URL = 'https://example-rpc-url'

const VALID_SEED_PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const INVALID_SEED_PHRASE = 'invalid seed phrase'

describe('WalletManagerEvm', () => {
  test('should initialize successfully with rpcUrl provided', async () => {
    const wallet = new WalletManagerEvm(VALID_SEED_PHRASE, { rpcUrl: RPC_URL })
    expect(wallet).toBeInstanceOf(WalletManagerEvm)
  })

  describe('static getRandomSeedPhrase', () => {
    test('generates a valid 12-word seed phrase', () => {
      const seedPhrase = WalletManagerEvm.getRandomSeedPhrase()
      const words = seedPhrase.trim().split(/\s+/)

      expect(words).toHaveLength(12)

      words.forEach(word => expect(wordlists.en.getWordIndex(word)).not.toBe(-1))
    })

    test('validates a valid seed phrase', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(VALID_SEED_PHRASE))
        .toBe(true)
    })

    test('invalidates an invalid seed phrase', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(INVALID_SEED_PHRASE))
        .toBe(false)
    })
  })

  describe('static isValidSeedPhrase', () => {
    test('returns false for an invalid mnemonic', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(VALID_SEED_PHRASE)).toBe(true)
    })

    test('should return false if if mnemonic is not valid', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(INVALID_SEED_PHRASE)).toBe(false)
    })

    test('returns false for empty string', () => {
      expect(WalletManagerEvm.isValidSeedPhrase('')).toBe(false)
    })

    test('returns false for null', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(null)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(undefined)).toBe(false)
    })

    test('returns false for non-string input (number)', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(12345)).toBe(false)
    })
  })

  describe('seedPhrase getter', () => {
    test('returns the original seed phrase used during construction', () => {
      const wallet = new WalletManagerEvm(VALID_SEED_PHRASE)
      expect(wallet.seedPhrase).toBe(VALID_SEED_PHRASE)
    })

    test('throws if constructed with an invalid seed phrase', () => {
      expect(() => new WalletManagerEvm(INVALID_SEED_PHRASE)).toThrow()
    })
  })

  describe('getAccount', () => {
    test('returns an instance of WalletAccountEvm for index 0 by default', () => {
      const walletManager = new WalletManagerEvm(VALID_SEED_PHRASE)

      const account = walletManager.getAccount()

      expect(account).toBeInstanceOf(WalletAccountEvm)
      expect(account.index).toBe(0)
    })

    test('returns different accounts for different indices', () => {
      const walletManager = new WalletManagerEvm(VALID_SEED_PHRASE)

      const account0 = walletManager.getAccount(0)
      const account1 = walletManager.getAccount(1)

      expect(account0.index).toBe(0)
      expect(account1.index).toBe(1)

      expect(account0.address).not.toBe(account1.address)
    })

    test('throws if index is negative', () => {
      const walletManager = new WalletManagerEvm(VALID_SEED_PHRASE)

      expect(() => walletManager.getAccount(-1)).toThrow()
    })

    test('returns same account for same index consistently', () => {
      const walletManager = new WalletManagerEvm(VALID_SEED_PHRASE)

      const accountA = walletManager.getAccount(5)
      const accountB = walletManager.getAccount(5)

      expect(accountA.address).toBe(accountB.address)
    })
  })
})
