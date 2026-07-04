import { ethers, network } from "hardhat";
import { writeFileSync } from "fs";

/**
 * Deploys MockUSDC + AssetFactory, then prints a copy-paste-ready block of the
 * NEXT_PUBLIC_* env vars the frontend needs. Works on any network:
 *   local:   npx hardhat run scripts/deploy.ts --network localhost
 *   sepolia: npx hardhat run scripts/deploy.ts --network sepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`\nNetwork:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(bal)} ETH\n`);

  // 1. Fake USDC. mint() is public — it's the on-chain faucet the "Add Funds"
  //    widget calls. Fine for a testnet; swap for a gated token in mainnet.
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy(deployer.address);
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log(`MockUSDC     → ${usdcAddress}`);

  // 2. Factory, wired to the currency.
  const AssetFactory = await ethers.getContractFactory("AssetFactory");
  const assetFactory = await AssetFactory.deploy(usdcAddress);
  await assetFactory.waitForDeployment();
  const factoryAddress = await assetFactory.getAddress();
  console.log(`AssetFactory → ${factoryAddress}`);

  // 3. Seed the deployer with test USDC so you can trade immediately.
  await (await mockUSDC.mint(deployer.address, ethers.parseEther("1000000"))).wait();
  console.log(`Minted 1,000,000 mUSDC to deployer\n`);

  // 4. Emit the env block + persist to a file for reference.
  const chainId = network.config.chainId ?? 31337;
  const envBlock = [
    `NEXT_PUBLIC_CHAIN_ID=${chainId}`,
    `NEXT_PUBLIC_MOCK_USDC_ADDRESS=${usdcAddress}`,
    `NEXT_PUBLIC_ASSET_FACTORY_ADDRESS=${factoryAddress}`,
  ].join("\n");

  console.log("──────────── paste into frontend env ────────────");
  console.log(envBlock);
  console.log("─────────────────────────────────────────────────\n");

  writeFileSync(
    `deployed.${network.name}.json`,
    JSON.stringify(
      { network: network.name, chainId, mockUSDC: usdcAddress, assetFactory: factoryAddress, deployedAt: new Date().toISOString() },
      null,
      2
    )
  );
  console.log(`Saved deployed.${network.name}.json`);
  if (network.name === "sepolia") {
    console.log(`\nVerify with:`);
    console.log(`  npx hardhat verify --network sepolia ${usdcAddress} ${deployer.address}`);
    console.log(`  npx hardhat verify --network sepolia ${factoryAddress} ${usdcAddress}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
