import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TradeableAsset — Phase 9", () => {
  async function deploy() {
    const [creator, retail, whale] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await USDC.deploy(creator.address);
    await usdc.waitForDeployment();

    const Asset = await ethers.getContractFactory("TradeableAsset");
    const asset = await Asset.deploy(
      "Patek Nautilus", "PPN", "ipfs://x",
      ethers.parseEther("50000"),       
      creator.address,
      await usdc.getAddress()
    );
    await asset.waitForDeployment();


    for (const s of [creator, retail, whale]) {
      await usdc.mint(s.address, ethers.parseEther("1000000"));
    }

    await usdc.connect(creator).approve(await asset.getAddress(), ethers.MaxUint256);
    await asset.connect(creator).addLiquidity(ethers.parseEther("500"));

    return { asset, usdc, creator, retail, whale };
  }

  it("retains the 2% swap fee inside the pool (k grows on a buy)", async () => {
    const { asset, usdc, retail } = await deploy();
    const assetAddr = await asset.getAddress();

    const tokenReserveBefore = await asset.balanceOf(assetAddr);
    const usdcReserveBefore = await usdc.balanceOf(assetAddr);
    const kBefore = tokenReserveBefore * usdcReserveBefore;

    await usdc.connect(retail).approve(assetAddr, ethers.MaxUint256);
    await asset.connect(retail).buyTokens(ethers.parseEther("1000"));

    const tokenReserveAfter = await asset.balanceOf(assetAddr);
    const usdcReserveAfter = await usdc.balanceOf(assetAddr);
    const kAfter = tokenReserveAfter * usdcReserveAfter;


    expect(kAfter).to.be.greaterThan(kBefore);
    // Full USDC input landed in the pool (fee included).
    expect(usdcReserveAfter - usdcReserveBefore).to.equal(ethers.parseEther("1000"));
  });

  it("blocks the creator from selling during the lockup", async () => {
    const { asset, creator } = await deploy();
    expect(await asset.isCreatorLocked()).to.equal(true);
    await expect(
      asset.connect(creator).sellTokens(ethers.parseEther("100"))
    ).to.be.revertedWith("Creator shares locked (anti-rug vesting)");
  });

  it("lets the creator sell once the lockup elapses", async () => {
    const { asset, creator } = await deploy();
    await time.increase(61 * 24 * 60 * 60); // 61 days
    expect(await asset.isCreatorLocked()).to.equal(false);
    await expect(asset.connect(creator).sellTokens(ethers.parseEther("100"))).to.not.be.reverted;
  });

  it("lets a non-creator sell freely during the creator lockup", async () => {
    const { asset, usdc, retail } = await deploy();
    const assetAddr = await asset.getAddress();
    await usdc.connect(retail).approve(assetAddr, ethers.MaxUint256);
    await asset.connect(retail).buyTokens(ethers.parseEther("5000"));
    // retail now holds tokens; selling must work even though creator is locked.
    await expect(asset.connect(retail).sellTokens(ethers.parseEther("10"))).to.not.be.reverted;
  });

  it("EXCEPTION: a hostile buyout still liquidates the locked creator", async () => {
    const { asset, usdc, creator, whale } = await deploy();
    const assetAddr = await asset.getAddress();

    // Creator is still locked at this point.
    expect(await asset.isCreatorLocked()).to.equal(true);

    // Whale executes the buyout (needs 125% of max(valuation, marketCap)).
    const offer = ethers.parseEther("100000"); // comfortably over 125% of 50k
    await usdc.connect(whale).approve(assetAddr, ethers.MaxUint256);
    await asset.connect(whale).initiateBuyout(offer);

    expect(await asset.sold()).to.equal(true);

    // The creator — though sale-locked — must still cash out their payout.
    const balBefore = await usdc.balanceOf(creator.address);
    await expect(asset.connect(creator).cashOut()).to.not.be.reverted;
    const balAfter = await usdc.balanceOf(creator.address);
    expect(balAfter).to.be.greaterThan(balBefore);
  });
});
