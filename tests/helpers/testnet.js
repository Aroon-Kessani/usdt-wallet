/**
 * @file testnet.js
 *
 * 🧩 EVM Testnet Helper Utilities
 * -------------------------------------------------------------------
 * This module provides configuration, provider factories, and utilities
 * for integration tests that run against Sepolia or locally forked testnets.
 *
 * It ensures:
 *  - Secure environment variable handling (.env)
 *  - Consistent provider/wallet initialization
 *  - Retry + confirmation helpers for transaction reliability
 *  - Minimal test-only ABI for WETH contract interaction
 */

import dotenv from 'dotenv'
import { JsonRpcProvider, ethers } from 'ethers'
import WalletManagerEvm from '../../index.js'

// -----------------------------------------------------------------------------
// 🧱 Environment Configuration
// -----------------------------------------------------------------------------

// Load variables from .env (if present)
dotenv.config()

// Enforce testnet environment presence to avoid unintentional live network use
if (!process.env.TESTNET_RPC_URL || !process.env.TESTNET_SEED_PHRASE) {
  throw new Error(
    '❌ Missing required environment variables.\n' +
    'Please copy `.env.example` to `.env` and set:\n' +
    '  TESTNET_RPC_URL, TESTNET_SEED_PHRASE'
  )
}

// Exported environment-based test configuration
export const TESTNET_RPC_URL = process.env.TESTNET_RPC_URL || ''
export const TESTNET_SEED_PHRASE = process.env.TESTNET_SEED_PHRASE || ''
export const TEST_TOKEN_ADDRESS = process.env.TEST_TOKEN_ADDRESS || ''
export const RECEIVER = process.env.RECEIVER || ''

// Core test settings with sane defaults for CI environments
export const CONFIG = {
  TESTNET_RPC_URL,
  TESTNET_SEED_PHRASE,
  TEST_TOKEN_ADDRESS,
  RECEIVER,
  confirmations: Number(process.env.TEST_CONFIRMATIONS || 2),
  maxRetries: Number(process.env.TEST_MAX_RETRIES || 3),
  retryDelay: Number(process.env.TEST_RETRY_DELAY || 5000), // ms
  timeout: Number(process.env.TEST_TIMEOUT || 180000) // ms (3 min)
}

// -----------------------------------------------------------------------------
// 💧 Minimal WETH ABI (for wrapping/unwrapping ETH in tests)
// -----------------------------------------------------------------------------
export const WETH_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint)',
  'function transfer(address dst, uint wad) returns (bool)',
  'function approve(address guy, uint wad) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function deposit() payable',
  'function withdraw(uint wad)',
  'function totalSupply() view returns (uint)',
  'function transferFrom(address src, address dst, uint wad) returns (bool)'
]

// -----------------------------------------------------------------------------
// ⚙️ Provider + Wallet Factories
// -----------------------------------------------------------------------------

/**
 * Returns a connected JSON-RPC provider.
 * Used to ensure all test instances share a consistent provider.
 */
export function getProvider () {
  return new JsonRpcProvider(CONFIG.TESTNET_RPC_URL)
}

/**
 * Returns a WalletManagerEvm instance configured for testnet.
 * This is preferred over directly using ethers.Wallet for consistency.
 */
export function makeWallet () {
  return new WalletManagerEvm(CONFIG.TESTNET_SEED_PHRASE, {
    provider: CONFIG.TESTNET_RPC_URL,
    // Transfer fee limit (1e15 wei ≈ 0.001 ETH) for test safety
    transferMaxFee: 1_000_000_000_000_000n
  })
}

/**
 * Instantiates a WETH contract interface bound to a provider.
 * Used for deposit/withdraw and allowance-based token tests.
 */
export function createWethContract (provider) {
  return new ethers.Contract(CONFIG.TEST_TOKEN_ADDRESS, WETH_ABI, provider)
}

// -----------------------------------------------------------------------------
// 🔁 Utility Helpers (retry logic + confirmations)
// -----------------------------------------------------------------------------

/**
 * Waits for a transaction to confirm on-chain.
 * Retries automatically on transient errors.
 */
export async function waitForConfirmation (
  provider,
  txHash,
  confirmations = CONFIG.confirmations
) {
  let retries = 0
  while (retries < CONFIG.maxRetries) {
    try {
      const receipt = await provider.waitForTransaction(
        txHash,
        confirmations,
        CONFIG.timeout
      )
      if (receipt && receipt.status === 0) {
        throw new Error(`Transaction reverted: ${txHash}`)
      }
      return receipt
    } catch (err) {
      retries++
      if (retries >= CONFIG.maxRetries) throw err
      await new Promise(res => setTimeout(res, CONFIG.retryDelay))
    }
  }
}

/**
 * Retries a provided async operation up to maxRetries times.
 * Useful for flaky RPC operations under load.
 */
export async function retry (operation, maxRetries = CONFIG.maxRetries) {
  let lastError
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (err) {
      lastError = err
      await new Promise(res => setTimeout(res, CONFIG.retryDelay))
    }
  }
  throw lastError
}
