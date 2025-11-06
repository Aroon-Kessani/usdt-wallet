/**
 * @file error-handling.test.js
 *
 * 🧩 Error Handling Test Suite
 * -------------------------------------------------------
 * These tests validate how WalletManagerEvm handles various
 * invalid or failure scenarios — such as malformed mnemonics,
 * unreachable RPCs, and insufficient balances.
 *
 * Each test is isolated and designed to ensure that:
 *  - Proper errors are thrown early (no silent failures)
 *  - Errors from ethers.js or providers are gracefully propagated
 *  - Network-dependent tests auto-skip when environment variables are missing
 */

import { describe, expect, test } from '@jest/globals'
import WalletManagerEvm from '../../index.js'
import { generateMnemonic } from 'bip39'
import {
  TESTNET_RPC_URL,
  TESTNET_SEED_PHRASE,
  RECEIVER
} from '../helpers/testnet.js'

// ------------------------------------------------------------
// Environment Guards
// ------------------------------------------------------------
const hasNetwork = !!TESTNET_RPC_URL
const hasReceiver = !!RECEIVER

// ------------------------------------------------------------
// Root Suite — Error Handling
// ------------------------------------------------------------
describe('Error handling tests', () => {

  // --------------------------------------------------------
  // ❌ Malformed Mnemonic
  // --------------------------------------------------------
  test('malformed seed should throw during wallet creation', () => {
    const badSeed = 'this is not a valid seed phrase'

    // WalletManagerEvm should reject invalid BIP39 mnemonics
    // immediately upon construction or validation
    expect(() =>
      new WalletManagerEvm(badSeed, { provider: TESTNET_RPC_URL })
    ).toThrow(/invalid|seed/i)
  })

  // --------------------------------------------------------
  // ❌ Invalid RPC Provider
  // --------------------------------------------------------
  ;(hasNetwork ? test : test.skip)(
    'invalid network provider should reject fee rate retrieval',
    async () => {
      // Simulate unreachable RPC (invalid port)
      const wallet = new WalletManagerEvm(
        TESTNET_SEED_PHRASE || generateMnemonic(),
        { provider: 'http://127.0.0.1:9999' }
      )

      // Expect provider or ethers to throw a connection-related error
      await expect(wallet.getFeeRates()).rejects.toThrow(/network|ECONNREFUSED|fetch/i)
    }
  )

  // --------------------------------------------------------
  // ❌ Insufficient Balance
  // --------------------------------------------------------
  ;(hasNetwork && hasReceiver ? test : test.skip)(
    'insufficient balance should reject sendTransaction',
    async () => {
      // Generate a fresh wallet with no known balance (unfunded)
      const freshSeed = generateMnemonic()
      const wallet = new WalletManagerEvm(freshSeed, { provider: TESTNET_RPC_URL })
      const account = await wallet.getAccount(0)

      // Attempt to send minimal ETH (1 wei)
      // Expect provider or EVM to reject with insufficient funds
      await expect(
        account.sendTransaction({ to: RECEIVER, value: 1n })
      ).rejects.toThrow(/insufficient funds|intrinsic gas|gas cost|could not coalesce/i)
    }
  )
})
