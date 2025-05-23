require("@nomicfoundation/hardhat-ethers");

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  networks: {
    hardhat: {
      accounts: {
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 3,
        accountsBalance: '1000000000000000000'
      }
    }
  }
}