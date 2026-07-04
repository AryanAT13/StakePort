import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// Read deploy credentials from env. We DON'T hard-fail when they're missing so
// local `npx hardhat test` / `hardhat node` keep working with zero setup —
// the sepolia network just won't be usable until you fill these in.
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Local Hardhat node (default) — unchanged.
    hardhat: {},
    // Sepolia public testnet. Fund the deployer with test ETH from a faucet
    // (https://cloud.google.com/application/web3/faucet/ethereum/sepolia).
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  // Enables `npx hardhat verify` so the contract source shows on Etherscan.
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};

export default config;
