import { describe, expect, test } from '@jest/globals'
import WalletManagerEvm from '../../index.js'
import { generateMnemonic } from 'bip39'
import { TESTNET_RPC_URL, TESTNET_SEED_PHRASE, RECEIVER } from '../helpers/testnet.js'

const hasNetwork = !!TESTNET_RPC_URL
const hasReceiver = !!RECEIVER

describe('Error handling tests', () => {
  test('malformed seed should throw during wallet creation', () => {
    const badSeed = 'this is not a valid seed phrase'
    expect(() => new WalletManagerEvm(badSeed, { provider: TESTNET_RPC_URL })).toThrow(/invalid|seed/i)
  })

  ;(hasNetwork ? test : test.skip)('invalid network provider should reject fee rate retrieval', async () => {
    // Use an unreachable RPC URL to simulate invalid network
    const wallet = new WalletManagerEvm(TESTNET_SEED_PHRASE || generateMnemonic(), { provider: 'http://127.0.0.1:9999' })
    await expect(wallet.getFeeRates()).rejects.toThrow()
  })

  ;(hasNetwork && hasReceiver ? test : test.skip)('insufficient balance should reject sendTransaction', async () => {
    // Create a fresh wallet with a random mnemonic (likely unfunded)
    const freshSeed = generateMnemonic()
    const wallet = new WalletManagerEvm(freshSeed, { provider: TESTNET_RPC_URL })
    const account = await wallet.getAccount(0)

    // Attempt to send a tiny amount; expect insufficient funds error from provider/ethers
    await expect(account.sendTransaction({ to: RECEIVER, value: 1n })).rejects.toThrow(/insufficient funds|intrinsic gas|gas cost/i)
  })
})
