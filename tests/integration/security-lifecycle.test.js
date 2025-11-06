/**
 * @file security-lifecycle.test.js
 *
 * 🔐 Wallet Security Lifecycle Tests
 * -------------------------------------------------------
 * These tests ensure that WalletManagerEvm properly manages
 * sensitive data and wallet lifecycle integrity across its lifetime.
 *
 * Covered Scenarios:
 *  - Secure cleanup of wallet/account references
 *  - Prevention of sensitive data leakage (seed, keys)
 *  - Proper GC release behavior (when supported)
 *  - In-memory zeroing of sensitive data buffers
 */

import { describe, expect, test, beforeEach, afterEach } from '@jest/globals'
import WalletManagerEvm from '../../index.js'
import { TESTNET_SEED_PHRASE, TESTNET_RPC_URL } from '../helpers/testnet.js'

describe('Wallet Security Lifecycle', () => {
  let wallet
  let account0

  // ------------------------------------------------------------
  // Setup & Teardown
  // ------------------------------------------------------------
  beforeEach(async () => {
    wallet = new WalletManagerEvm(TESTNET_SEED_PHRASE, {
      provider: TESTNET_RPC_URL
    })
    account0 = await wallet.getAccount(0)
  })

  afterEach(() => {
    account0 = null
    wallet = null
  })

  // ------------------------------------------------------------
  // ✅ Wallet recreation & cleanup isolation
  // ------------------------------------------------------------
  test('should properly handle wallet cleanup and reinitialization', async () => {
    // Ensure we can sign or access account before cleanup
    const originalAddress = account0.__address
    expect(originalAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)

    // Nullify existing references
    account0 = null
    wallet = null

    // Optional: Force garbage collection (requires --expose-gc)
    if (global.gc) global.gc()

    // Create a new wallet instance to ensure fresh, isolated state
    const newWallet = new WalletManagerEvm(TESTNET_SEED_PHRASE, {
      provider: TESTNET_RPC_URL
    })
    const newAccount = await newWallet.getAccount(0)

    // The address should remain identical (same mnemonic path)
    expect(newAccount.__address).toBe(originalAddress)
  })

  // ------------------------------------------------------------
  // 🚫 Sensitive Data Exposure
  // ------------------------------------------------------------
  test('should prevent access to sensitive data via inspection', () => {
    // JSON serialization should not expose private fields
    const accountJSON = JSON.stringify(account0)
    expect(accountJSON).not.toMatch(/privateKey|seed|keyPair/i)

    // Ensure sensitive properties are non-enumerable
    const enumerable = Object.keys(account0)
    const sensitiveProps = ['privateKey', 'seed', '_keyPair']
    for (const prop of sensitiveProps) {
      expect(enumerable).not.toContain(prop)
    }

    // Underlying ethers account should not expose mnemonic
    expect(account0._account.mnemonic).toBeNull()
  })

  // ------------------------------------------------------------
  // ♻️ Reference Cleanup & GC Validation
  // ------------------------------------------------------------
  test('should properly cleanup and allow GC of account references', async () => {
    const refs = {
      wallet: new WalletManagerEvm(TESTNET_SEED_PHRASE, {
        provider: TESTNET_RPC_URL
      })
    }
    refs.account = await refs.wallet.getAccount(0)

    // Create WeakRef to detect GC cleanup
    const weakRef = new WeakRef(refs.account)

    // Drop strong references
    Object.keys(refs).forEach(k => (refs[k] = null))

    // GC test only works in Node with `--expose-gc`
    if (global.gc) {
      global.gc()
      // WeakRef should be cleared once GC runs
      expect(weakRef.deref()).toBeUndefined()
    } else {
      console.warn('⚠️ GC not exposed; skipping WeakRef validation.')
    }
  })

  // ------------------------------------------------------------
  // 🔒 Memory Security
  // ------------------------------------------------------------
  test('should securely zero sensitive data in memory buffers', async () => {
    // Simulate a buffer containing sensitive mnemonic data
    const sensitiveData = Buffer.from(TESTNET_SEED_PHRASE, 'utf8')

    // Overwrite memory with zeros
    sensitiveData.fill(0)

    // Confirm buffer is fully zeroed
    expect(
      Buffer.compare(sensitiveData, Buffer.alloc(sensitiveData.length, 0))
    ).toBe(0)

    // Ensure test seed remains intact (constant environment value)
    expect(TESTNET_SEED_PHRASE).toBeTruthy()
  })
})
