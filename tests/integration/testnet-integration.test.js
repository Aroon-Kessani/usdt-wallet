/**
 * @file testnet-integration.test.js
 *
 * 🔍 Integration Test Suite (Sepolia Fork)
 * -------------------------------------------------------
 * This suite performs full-stack EVM integration tests using
 * a locally forked Sepolia network (Hardhat or Foundry fork).
 *
 * It verifies end-to-end WalletManagerEvm functionality:
 *  - ETH transfers
 *  - WETH wrapping/unwrapping
 *  - Token transfers, approvals, and reverts
 *  - Fee handling and transaction safety checks
 *
 * 💡 Notes:
 *  - The provider and wallet are configured using testnet helpers.
 *  - All timing-sensitive tests include small delays to account for
 *    state propagation in local or forked RPC environments.
 *  - Each test uses deterministic BigInt values to avoid precision loss.
 */

import { describe, expect, test, beforeAll, afterAll } from '@jest/globals'
import WalletManagerEvm from '../../index.js'
import {
    CONFIG,
    getProvider,
    makeWallet,
    createWethContract,
    TESTNET_SEED_PHRASE,
    TESTNET_RPC_URL,
    TEST_TOKEN_ADDRESS,
} from '../helpers/testnet.js'

// --------------------------------------------------------
// Root Suite — Integration Testing on Sepolia Fork
// --------------------------------------------------------
describe('Integration Tests on Sepolia', () => {
    let wallet
    let provider
    let wethContract
    const cfg = CONFIG

    // --------------------------------------------------------
    // Global Setup (runs once before all tests)
    // --------------------------------------------------------
    beforeAll(async () => {
        provider = getProvider()

        // Initialize wallet and attach provider
        wallet = makeWallet()
        wethContract = createWethContract(provider)

        // Verify WETH contract connectivity
        const name = await wethContract.name()
        const symbol = await wethContract.symbol()
        console.log(`Connected to ${name} (${symbol}) at ${cfg.TEST_TOKEN_ADDRESS}`)
    }, CONFIG.timeout)

    // --------------------------------------------------------
    // Nested Suite — Core Wallet Operations
    // --------------------------------------------------------
    describe('Test Operations', () => {
        let account0
        let account1

        // --------------------------------------------------------
        // Setup test accounts before running test cases
        // --------------------------------------------------------
        beforeAll(async () => {
            account0 = await wallet.getAccount(0)
            account1 = await wallet.getAccount(1)

            // Ensure provider binding for accounts (handles edge cases where
            // the WalletManagerEvm instance doesn't auto-connect accounts)
            for (const acct of [account0, account1]) {
                if (!acct._provider) {
                    const prov = getProvider()
                    acct._provider = prov
                    if (acct._account && typeof acct._account.connect === 'function') {
                        acct._account = acct._account.connect(prov)
                    }
                }
            }

            console.log('Testing with accounts:', await account0.getAddress(), await account1.getAddress())
        })

        // --------------------------------------------------------
        // ✅ ETH Transfer Test
        // --------------------------------------------------------
        test('should send ETH to configured receiver', async () => {
            const account = await wallet.getAccount(0)
            const receiver = cfg.RECEIVER

            const beforeReceiver = await provider.getBalance(receiver)
            const amount = 1_000_000_000_000_000n // 0.001 ETH

            const tx = { to: receiver, value: amount }
            await account.sendTransaction(tx)

            // Wait briefly to ensure provider state updates (important for forked networks)
            await new Promise(res => setTimeout(res, 2000))

            const afterReceiver = await provider.getBalance(receiver)
            expect(afterReceiver).toBe(beforeReceiver + amount)
        }, CONFIG.timeout)

        // --------------------------------------------------------
        // ✅ WETH Deposit (Wrap ETH)
        // --------------------------------------------------------
        test('should wrap ETH to WETH', async () => {
            const wrapAmount = 1_000_000_000_000_000n // 0.001 ETH

            const initialEthBalance = await account0.getBalance()
            const initialWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)

            // Construct deposit() calldata for WETH
            const depositTx = {
                to: TEST_TOKEN_ADDRESS,
                value: wrapAmount,
                data: wethContract.interface.encodeFunctionData('deposit', [])
            }

            await account0.sendTransaction(depositTx)
            await new Promise(res => setTimeout(res, 2000))

            const finalWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            expect(finalWethBalance).toBe(initialWethBalance + wrapAmount)
        }, CONFIG.timeout)

        // --------------------------------------------------------
        // ✅ WETH Transfer Between Accounts
        // --------------------------------------------------------
        test('should transfer WETH between accounts', async () => {
            const transferAmount = 500_000_000_000_000n // 0.0005 ETH worth of WETH

            const initialBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const initialBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)

            const transfer = {
                token: TEST_TOKEN_ADDRESS,
                recipient: await account1.getAddress(),
                amount: transferAmount
            }

            await account0.transfer(transfer)

            const finalBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const finalBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)

            expect(finalBalance0).toBe(initialBalance0 - transferAmount)
            expect(finalBalance1).toBe(initialBalance1 + transferAmount)
        }, CONFIG.timeout)

        // --------------------------------------------------------
        // ✅ Unwrap (Withdraw) WETH to ETH
        // --------------------------------------------------------
        test('should unwrap WETH to ETH', async () => {
            const unwrapAmount = 100_000_000_000_000n // 0.0001 ETH

            const initialEthBalance = await account0.getBalance()
            const initialWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)

            // Withdraw WETH back to ETH
            const withdrawTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('withdraw', [unwrapAmount])
            }

            const result = await account0.sendTransaction(withdrawTx)
            await new Promise(res => setTimeout(res, 2000))

            const finalEthBalance = await account0.getBalance()
            const finalWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)

            expect(finalWethBalance).toBe(initialWethBalance - unwrapAmount)
            expect(finalEthBalance).toBeGreaterThan(initialEthBalance - result.fee)
        }, CONFIG.timeout)

        // --------------------------------------------------------
        // ✅ Approve + transferFrom Flow
        // --------------------------------------------------------
        test('should handle WETH approval and transferFrom', async () => {
            const approveAmount = 1_000_000_000_000_000n // 0.001 ETH worth of WETH

            // Approve spender (account1)
            const approveTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('approve', [
                    await account1.getAddress(),
                    approveAmount
                ])
            }

            await account0.sendTransaction(approveTx)
            await new Promise(res => setTimeout(res, 2000))

            // Verify allowance
            const allowance = await wethContract.allowance(
                await account0.getAddress(),
                await account1.getAddress()
            )
            expect(allowance).toBe(approveAmount)

            // Setup transferFrom
            const desiredAmount = 500_000_000_000_000n
            const initialBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const initialBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)
            const maxAllowed = allowance < initialBalance0 ? allowance : initialBalance0
            const transferAmount = desiredAmount <= maxAllowed ? desiredAmount : maxAllowed

            if (transferAmount === 0n)
                throw new Error('No transferable WETH available for transferFrom test.')

            const transferFromTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('transferFrom', [
                    await account0.getAddress(),
                    await account1.getAddress(),
                    transferAmount
                ])
            }

            // Ensure account1 has ETH to pay gas
            const gasEstimate = await provider.estimateGas({ from: await account1.getAddress(), ...transferFromTx })
            const feeEstimate = await account1.quoteSendTransaction(transferFromTx)
            const balance1 = await account1.getBalance()

            if (balance1 < feeEstimate.fee * 2n) {
                const topUp = feeEstimate.fee * 3n
                console.log('Topping up account1 with', topUp, 'wei for gas')
                await account0.sendTransaction({ to: await account1.getAddress(), value: topUp })
            }

            // Execute and verify
            await account1.sendTransaction(transferFromTx)
            const finalBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const finalBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)

            expect(finalBalance0).toBe(initialBalance0 - transferAmount)
            expect(finalBalance1).toBe(initialBalance1 + transferAmount)
        }, CONFIG.timeout)

        // --------------------------------------------------------
        // ❌ Negative Test — Max Fee Too Low
        // --------------------------------------------------------
        test('should reject transfer if configured transferMaxFee too low', async () => {
            const lowFeeWallet = new WalletManagerEvm(TESTNET_SEED_PHRASE, {
                provider: TESTNET_RPC_URL,
                transferMaxFee: 1n // unrealistic fee cap
            })

            const lowFeeAccount = await lowFeeWallet.getAccount(0)
            const wethBal = await lowFeeAccount.getTokenBalance(TEST_TOKEN_ADDRESS)

            if (wethBal === 0n) {
                console.log('Skipping low-fee transfer test: no WETH balance')
                return
            }

            const transfer = {
                token: TEST_TOKEN_ADDRESS,
                recipient: await account1.getAddress(),
                amount: 1n
            }

            await expect(lowFeeAccount.transfer(transfer))
                .rejects.toThrow(/Exceeded maximum fee|max fee/i)
        }, CONFIG.timeout)

        // --------------------------------------------------------
        // ❌ Negative Test — Withdraw Above Balance
        // --------------------------------------------------------
        test('should revert withdraw when amount exceeds WETH balance', async () => {
            const bal = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)
            const overdraw = bal + 1n

            const withdrawTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('withdraw', [overdraw])
            }

            // Expect both estimateGas and sendTransaction to fail
            await expect(provider.estimateGas({ from: await account1.getAddress(), ...withdrawTx }))
                .rejects.toMatchObject({ code: 'CALL_EXCEPTION' })

            await expect(account1.sendTransaction(withdrawTx))
                .rejects.toThrow(/revert|CALL_EXCEPTION/i)
        }, CONFIG.timeout)

        // --------------------------------------------------------
        // ❌ Negative Test — transferFrom Without Allowance
        // --------------------------------------------------------
        test('should fail transferFrom when allowance insufficient', async () => {
            // Reset allowance to zero
            const zeroApproveTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('approve', [
                    await account1.getAddress(),
                    0n
                ])
            }

            await account0.sendTransaction(zeroApproveTx)
            const allowanceAfter = await wethContract.allowance(
                await account0.getAddress(),
                await account1.getAddress()
            )
            expect(allowanceAfter).toBe(0n)

            // Ensure account1 has gas
            const account1Bal = await account1.getBalance()
            if (account1Bal === 0n) {
                const fundTx = { to: await account1.getAddress(), value: 1_000_000_000_000_000n } // 0.001 ETH
                await account0.sendTransaction(fundTx)
            }

            // Attempt invalid transferFrom
            const transferFromTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('transferFrom', [
                    await account0.getAddress(),
                    await account1.getAddress(),
                    1n
                ])
            }

            await expect(account1.sendTransaction(transferFromTx)).rejects.toThrow()
        }, CONFIG.timeout)
    })

    // --------------------------------------------------------
    // Global Teardown — Clean up listeners
    // --------------------------------------------------------
    afterAll(async () => {
        try {
            for (const target of [provider, wallet?._provider, account0?._provider, account1?._provider]) {
                if (target && typeof target.removeAllListeners === 'function') target.removeAllListeners()
            }
        } catch (e) {
            console.log('Teardown cleanup error (ignored):', e?.message)
        }
    })
})
