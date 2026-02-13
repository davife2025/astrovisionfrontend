// scripts/deploy-bnb-mainnet.js
// OPTIMIZED FOR $1 BNB BUDGET

const hre = require("hardhat");

async function main() {
  console.log("\n🚀 DEPLOYING TO BNB CHAIN MAINNET");
  console.log("=====================================\n");
  
  console.log("⚠️  WARNING: This is REAL MONEY!");
  console.log("⚠️  You are deploying to BNB Chain Mainnet");
  console.log("⚠️  Gas fees will be deducted from your wallet\n");

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceBNB = parseFloat(hre.ethers.formatEther(balance));
  console.log("💰 Balance:", balanceBNB.toFixed(6), "BNB");
  
  if (balanceBNB < 0.003) {
    console.log("\n❌ INSUFFICIENT BNB!");
    console.log(`   You have: ${balanceBNB.toFixed(6)} BNB`);
    console.log("   Minimum needed: 0.003 BNB ($0.90)");
    console.log("   Recommended: 0.005 BNB ($1.50)\n");
    process.exit(1);
  }
  
  if (balanceBNB < 0.005) {
    console.log("⚠️  Low balance warning!");
    console.log("   You have enough to deploy, but it's tight.");
    console.log("   If gas spikes, deployment may fail.\n");
  }
  
  console.log("✅ Sufficient BNB for deployment\n");

  // Estimate gas
  console.log("📊 Estimating deployment cost...");
  const AstroDAO = await hre.ethers.getContractFactory("AstroDAO");
  const deployTransaction = await AstroDAO.getDeployTransaction();
  
  let gasEstimate;
  try {
    gasEstimate = await hre.ethers.provider.estimateGas(deployTransaction);
  } catch (error) {
    console.log("⚠️  Could not estimate gas, using default");
    gasEstimate = BigInt(3000000); // Default 3M gas
  }
  
  const gasPrice = BigInt(3000000000); // 3 gwei
  const estimatedCost = gasEstimate * gasPrice;
  const estimatedCostBNB = parseFloat(hre.ethers.formatEther(estimatedCost));
  
  console.log(`   Estimated gas: ${gasEstimate.toString()}`);
  console.log(`   Gas price: 3 gwei`);
  console.log(`   Estimated cost: ${estimatedCostBNB.toFixed(6)} BNB (~$${(estimatedCostBNB * 300).toFixed(2)})`);
  console.log(`   Remaining after: ${(balanceBNB - estimatedCostBNB).toFixed(6)} BNB\n`);
  
  // Deploy
  console.log("🚀 Deploying AstroDAO contract...");
  console.log("   This may take 30-60 seconds...\n");
  
  const dao = await AstroDAO.deploy();
  await dao.waitForDeployment();
  
  const daoAddress = await dao.getAddress();
  console.log("✅ AstroDAO deployed to:", daoAddress);
  
  // Check actual cost
  const newBalance = await hre.ethers.provider.getBalance(deployer.address);
  const actualCost = balance - newBalance;
  const actualCostBNB = parseFloat(hre.ethers.formatEther(actualCost));
  
  console.log(`💸 Actual cost: ${actualCostBNB.toFixed(6)} BNB (~$${(actualCostBNB * 300).toFixed(2)})`);
  console.log(`💰 Remaining balance: ${hre.ethers.formatEther(newBalance)} BNB\n`);
  
  // Verify deployment
  console.log("🔍 Verifying deployment...");
  const proposalCount = await dao.proposalCount();
  const votingPeriod = await dao.votingPeriod();
  const maxRep = await dao.MAX_REPUTATION();
  
  console.log("   Proposal Count:", proposalCount.toString());
  console.log("   Voting Period:", Number(votingPeriod) / 86400, "days");
  console.log("   Max Reputation:", maxRep.toString());
  console.log("   Current Week:", (await dao.currentWeek()).toString());
  console.log("");
  
  // Save deployment info
  const deploymentInfo = {
    network: "BNB Chain Mainnet",
    chainId: 56,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contract: {
      address: daoAddress,
      name: "AstroDAO",
      version: "1.0.0-mainnet",
    },
    deployment: {
      estimatedCost: estimatedCostBNB.toFixed(6) + " BNB",
      actualCost: actualCostBNB.toFixed(6) + " BNB",
      gasUsed: gasEstimate.toString(),
    },
    links: {
      bscscan: `https://bscscan.com/address/${daoAddress}`,
      verify: `https://bscscan.com/address/${daoAddress}#code`,
      write: `https://bscscan.com/address/${daoAddress}#writeContract`,
    },
  };

  console.log("📄 Deployment Summary:");
  console.log("=====================================");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("=====================================\n");

  // Save to file
  const fs = require('fs');
  fs.writeFileSync(
    'deployment-mainnet.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("✅ Deployment info saved to deployment-mainnet.json\n");

  // Update .env instructions
  console.log("📝 NEXT STEPS:\n");
  console.log("1. Update your frontend .env file:");
  console.log(`   REACT_APP_DAO_CONTRACT_ADDRESS=${daoAddress}`);
  console.log(`   REACT_APP_NETWORK=mainnet`);
  console.log(`   REACT_APP_CHAIN_ID=56\n`);
  
  console.log("2. Verify contract on BSCScan (RECOMMENDED):");
  console.log(`   npx hardhat verify --network bscMainnet ${daoAddress}\n`);
  
  console.log("3. Award yourself initial reputation:");
  console.log(`   Visit: ${deploymentInfo.links.write}`);
  console.log(`   Call: awardReputation(YOUR_ADDRESS, 100)\n`);
  
  console.log("4. Test the contract:");
  console.log("   - Create a test proposal");
  console.log("   - Vote on it");
  console.log("   - Finalize and execute\n");
  
  // Auto-verify if we have API key
  if (process.env.BSCSCAN_API_KEY && process.env.BSCSCAN_API_KEY !== "your_bscscan_api_key_here") {
    console.log("⏳ Waiting for block confirmations before verification...");
    await dao.deploymentTransaction().wait(5);
    
    console.log("\n🔍 Verifying contract on BSCScan...");
    try {
      await hre.run("verify:verify", {
        address: daoAddress,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on BSCScan!");
      console.log(`   View at: ${deploymentInfo.links.verify}\n`);
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ Contract already verified!\n");
      } else {
        console.log("⚠️  Auto-verification failed:", error.message);
        console.log("   You can verify manually later using:");
        console.log(`   npx hardhat verify --network bscMainnet ${daoAddress}\n`);
      }
    }
  } else {
    console.log("⚠️  No BSCScan API key found");
    console.log("   To verify, get API key from https://bscscan.com/myapikey");
    console.log(`   Then run: npx hardhat verify --network bscMainnet ${daoAddress}\n`);
  }

  console.log("🎉 DEPLOYMENT COMPLETE!\n");
  console.log("Your AstroDAO is now LIVE on BNB Chain Mainnet! 🚀");
  console.log(`Contract: ${daoAddress}`);
  console.log(`BSCScan: ${deploymentInfo.links.bscscan}\n`);
  console.log("Total spent:", actualCostBNB.toFixed(6), "BNB\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ DEPLOYMENT FAILED:");
    console.error(error);
    process.exit(1);
  });