import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy the Fake Money (MockUSDC)
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy(deployer.address);
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  
  console.log(`MockUSDC deployed to: ${usdcAddress}`);

  // 2. Deploy the Asset Factory (and tell it which currency to use)
  const AssetFactory = await ethers.getContractFactory("AssetFactory");
  const assetFactory = await AssetFactory.deploy(usdcAddress);
  await assetFactory.waitForDeployment();
  const factoryAddress = await assetFactory.getAddress();

  console.log(`AssetFactory deployed to: ${factoryAddress}`);

  // 3. Mint some initial fake money to yourself for testing (e.g. $1,000,000)
  const mintAmount = ethers.parseUnits("1000000", 18);
  await mockUSDC.mint(deployer.address, mintAmount);
  console.log(`Minted $1,000,000 MockUSDC to deployer wallet`);
}

// Handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});