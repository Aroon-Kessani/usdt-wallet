export { default } from "./src/wallet-manager-evm.js";
export { default as WalletAccountEvm } from "./src/wallet-account-evm.js";
export type EvmWalletConfig = import("./src/wallet-manager-evm.js").EvmWalletConfig;
export type KeyPair = import("./src/wallet-account-evm.js").KeyPair;
export type EvmTransaction = import("./src/wallet-account-evm.js").EvmTransaction;
