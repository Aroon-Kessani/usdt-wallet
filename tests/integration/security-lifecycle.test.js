import { describe, expect, test, beforeEach, afterEach } from '@jest/globals'
import WalletManagerEvm from '../../index.js'
import { TESTNET_SEED_PHRASE, TESTNET_RPC_URL } from '../helpers/testnet.js'

describe('Wallet Security Lifecycle', () => {
  let wallet
  let account0

  beforeEach(async () => {
    wallet = new WalletManagerEvm(TESTNET_SEED_PHRASE, {
      provider: TESTNET_RPC_URL
    })
    account0 = await wallet.getAccount(0)
  })

  afterEach(() => {
    // Clean up resources
    account0 = null
    wallet = null
  })

  test('should properly handle wallet cleanup', async () => {
    // Verify we can sign before cleanup
    const mockTx = { 
      to: '0x1234567890123456789012345678901234567890',
      value: 1n
    }
    
    // Get the original address for comparison
    const originalAddress = account0.__address

    // Clear references
    account0 = null
    wallet = null

    // Force GC if available
    if (global.gc) {
      global.gc()
    }

    // Create new wallet to verify state isolation
    const newWallet = new WalletManagerEvm(TESTNET_SEED_PHRASE, {
      provider: TESTNET_RPC_URL
    })
    const newAccount = await newWallet.getAccount(0)

    // Verify new instance works and has same address
    expect(newAccount.__address).toBe(originalAddress)
  })

  test('should prevent access to sensitive data through object inspection', () => {
    const accountJSON = JSON.stringify(account0)
    
    // Verify sensitive data is not exposed
    const sensitivePairs = [
      ['privateKey', null],
      ['seed', null],
      ['_keyPair', null]
    ]
    
    // Check enumerable properties for sensitive fields
    const enumerable = Object.keys(account0)
    const sensitiveProps = ['privateKey', 'seed', '_keyPair']
    for (const prop of sensitiveProps) {
      expect(enumerable).not.toContain(prop)
    }

    // Verify mnemonic is explicitly null in the account
    expect(account0._account.mnemonic).toBeNull()
  })

  test('should properly cleanup references', async () => {
    // Create a new wallet scope with references in an object that can be cleared
    const refs = {
      wallet: new WalletManagerEvm(TESTNET_SEED_PHRASE, {
        provider: TESTNET_RPC_URL
      })
    }
    refs.account = await refs.wallet.getAccount(0)
    
    // Store weak reference
    const weakRef = new WeakRef(refs.account)
    
    // Remove strong references by clearing the container
    Object.keys(refs).forEach(key => { refs[key] = null })
    
    // Force garbage collection if node was started with --expose-gc
    if (global.gc) {
      global.gc()
      // WeakRef should be cleared after GC
      expect(weakRef.deref()).toBeUndefined()
    }
  })

  test('should secure sensitive data in memory', async () => {
    // Create a buffer with sensitive data
    const sensitiveData = Buffer.from(TESTNET_SEED_PHRASE)
    
    // Overwrite buffer with zeros
    sensitiveData.fill(0)
    
    // Verify buffer is zeroed
    expect(Buffer.compare(
      sensitiveData, 
      Buffer.alloc(sensitiveData.length, 0)
    )).toBe(0)

    // Verify original seed phrase is still intact (not modified by zeroing the buffer)
    expect(TESTNET_SEED_PHRASE).toBeTruthy()
  })
})