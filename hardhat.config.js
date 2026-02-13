// hardhat.config.js - OPTIMIZED FOR BNB CHAIN MAINNET

require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Optimized for lower deployment cost
      },
      viaIR: false, // Disabled for faster compilation
    },
  },
  
  networks: {
    // BNB Chain Mainnet (Your $1 deployment)
    bscMainnet: {
      url: process.env.RPC_URL || "https://bsc-dataseed1.binance.org/",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 3000000000, // 3 gwei (adjust if needed)
      gas: 3000000,
      timeout: 60000, // 60 seconds timeout
    },
    
    // BNB Testnet (for testing first - RECOMMENDED!)
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 10000000000, // 10 gwei for testnet
    },
    
    // Local hardhat network for testing
    hardhat: {
      chainId: 31337,
    },
  },
  
  // Contract verification on BSCScan
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
    },
  },
  
  // Path configuration
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  // Mocha test timeout
  mocha: {
    timeout: 40000
  }
};