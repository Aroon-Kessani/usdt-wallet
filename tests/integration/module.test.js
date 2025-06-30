import hre from 'hardhat'

import { ContractFactory } from 'ethers'

import * as bip39 from 'bip39'

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import WalletManagerEvm, { WalletAccountEvm } from '../../index.js'

import TestToken from './../abis/TestToken.json' with { type: 'json' }

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const INVALID_SEED_PHRASE = 'invalid seed phrase'

const SEED = bip39.mnemonicToSeedSync(SEED_PHRASE)

const ACCOUNT0 = {
  index: 0,
  path: "m/44'/60'/0'/0/0",
  address: '0x405005C7c4422390F4B334F64Cf20E0b767131d0',
  keyPair: {
    privateKey: '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f',
    publicKey: '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'
  }
}

const ACCOUNT1 = {
  index: 1,
  path: "m/44'/60'/0'/0/1",
  address: '0xcC81e04BadA16DEf9e1AFB027B859bec42BE49dB',
  keyPair: {
    privateKey: 'ba3d34b786d909f83be1422b75ea18005843ff979862619987fb0bab59580158',
    publicKey: '02f8d04c3de44e53e5b0ef2f822a29087e6af80114560956518767c64fec6b0f69'
  }
}

async function deployTestToken () {
  const [signer] = await hre.ethers.getSigners()

  const factory = new ContractFactory(TestToken.abi, TestToken.bytecode, signer)
  const contract = await factory.deploy()
  const transaction = await contract.deploymentTransaction()

  await transaction.wait()

  return contract
}

describe('Integration tests', () => {
  let testToken,
      account

  beforeEach(async () => {
    await hre.network.provider.send('hardhat_reset')

    testToken = await deployTestToken()

    account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
      provider: hre.network.provider
    })
  })

  afterEach(() => {
    account.dispose()
  })

// a) Creates a wallet, derives account at index 0, 
// quotes the cost of sending x ethers to another address, 
// sends x ethers to another address, 
// checks that the fees match, 
// checks that the balance of the account has decreased by x + fee.
  describe('Sending Eth while checking fees', () => {

    let wallet;
    let account0, account1;

    let txAmount = 1_000;
    let estimatedFee;

    test('should create a wallet and derive 2 accounts using path', async () => {
        wallet = new WalletManagerEvm(SEED_PHRASE, {
            provider: hre.network.provider
        })

        account0 = await wallet.getAccountByPath("0'/0/0")

        account1 = await wallet.getAccountByPath("0'/0/1")

        expect(account0.index).toBe(ACCOUNT0.index)

        expect(account0.path).toBe(ACCOUNT0.path)

        expect(account0.keyPair).toEqual({
            privateKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.privateKey, 'hex')),
            publicKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.publicKey, 'hex'))
        })

        expect(account1.index).toBe(ACCOUNT1.index)

        expect(account1.path).toBe(ACCOUNT1.path)

        expect(account1.keyPair).toEqual({
            privateKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.privateKey, 'hex')),
            publicKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.publicKey, 'hex'))
        })
    })

    test('should quote the cost of sending eth to from account0 to account1 and check the fee', async () => {
        
        const TRANSACTION = {
            to: await account1.getAddress(),
            value: txAmount
        }

        const EXPECTED_FEE = 57_752_750_000_000

        const { fee } = await account0.quoteSendTransaction(TRANSACTION)

        expect(fee).toBe(EXPECTED_FEE)
        estimatedFee = fee
    })

    test('should execute transaction and verify balances', async () => {
      const TRANSACTION = {
        to: await account1.getAddress(),
        value: txAmount
      }

      // Get initial balances
      const startBalance0 = await account0.getBalance()
      const startBalance1 = await account1.getBalance()

      // Execute transaction
      const { hash, fee } = await account0.sendTransaction(TRANSACTION)
      const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

      // Verify fee matches estimation
      expect(fee).toBe(estimatedFee)
      expect(receipt.status).toBe(1)
      
      await new Promise(resolve => setTimeout(resolve, 200))

      // Check final balances
      const endBalance0 = await account0.getBalance()
      const endBalance1 = await account1.getBalance()

      const expectedBalance0 = startBalance0 - txAmount - parseInt(receipt.fee)
      expect(endBalance0).toEqual(expectedBalance0)

      expect(endBalance1).toEqual(startBalance1 + txAmount)
    })

  })

// b) Creates a wallet, 
// derives account at index 0 and 1, 
// sends x ethers from account 0 to 1, 
// checks that the balance of account 1 has increased by x.
describe('Sending Eth to another account', () => {

    let wallet;
    let account0, account1;

    let txAmount = 1_000;

    test('should create a wallet and derive 2 accounts using path', async () => {
        wallet = new WalletManagerEvm(SEED_PHRASE, {
            provider: hre.network.provider
        })

        account0 = await wallet.getAccountByPath("0'/0/0")

        account1 = await wallet.getAccountByPath("0'/0/1")

        expect(account0.index).toBe(ACCOUNT0.index)

        expect(account0.path).toBe(ACCOUNT0.path)

        expect(account0.keyPair).toEqual({
            privateKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.privateKey, 'hex')),
            publicKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.publicKey, 'hex'))
        })

        expect(account1.index).toBe(ACCOUNT1.index)

        expect(account1.path).toBe(ACCOUNT1.path)

        expect(account1.keyPair).toEqual({
            privateKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.privateKey, 'hex')),
            publicKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.publicKey, 'hex'))
        })
    })

   

    test('should execute transaction', async () => {
      const TRANSACTION = {
        to: await account1.getAddress(),
        value: txAmount
      }

      const startBalance1 = await account1.getBalance()

      const { hash } = await account0.sendTransaction(TRANSACTION)
      const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

      expect(receipt.status).toBe(1)

      // Wait for the transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 200))

      const endBalance1 = await account1.getBalance()

      expect(endBalance1).toEqual(startBalance1 + txAmount)
    })

  })




// c) Creates a wallet, 
// derives account at path "0'/0/0", 
// quotes the cost of transferring x test tokens to another address, 
// transfers x test tokens to another address, 
// checks that the fees match, 
// checks that the balance of the account has decreased by fee and the token balance has decreased by x.

// d) Creates a wallet, 
// derives account at path "0'/0/0", and "0'/0/1", 
// transfers x test tokens from account 0 to 1, 
// checks that the token balance of account 1 has increased by x.

// e) Creates a wallet, 
// derives account at index 0 and 1, 
// sends a tx from account 0 to the test token contract to approve x tokens to account 1, 
// sends a tx from account 1 to the test token contract to transfer x tokens from account 0, 
// checks that the token balance of account 0 has decreased by x and the token balance of account 1 has increased by x.

// f) Creates a wallet, 
// derives account at index 0, 
// signs a message and verifies its signature.

// g) Creates a wallet, 
// derives account at index 0, 
// disposes the wallet, 
// checks that the private key is undefined and the sign, 
// send transaction and transfer methods all throw errors.

// h) Creates a wallet with a low transfer max fee, 
// derives account at index 0, 
// transfers some tokens and expects the method to throw an error.
})