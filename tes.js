const hardhatConfig = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      accounts: {
        mnemonic: 'dsfsdfs',
      },
    },
  }
}

console.log(
  "hardhat.config.js",
  `export default ${JSON.stringify(hardhatConfig)};`
);
