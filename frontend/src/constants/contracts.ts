import { parseAbi } from "viem";
import { publicEnv } from "@/lib/env";

/**
 * Single source of truth for on-chain integration.
 *
 * Addresses now come from env so we can swap network without recompiling. The
 * ABIs stay in code — they're the contract surface we depend on, and pinning
 * them prevents a silent breakage if someone redeploys with a different
 * signature.
 */

export const MOCK_USDC_ADDRESS = publicEnv.mockUsdcAddress;
export const ASSET_FACTORY_ADDRESS = publicEnv.assetFactoryAddress;

export const ASSET_FACTORY_ABI = parseAbi([
  "function createAsset(string _name, string _symbol, string _url, uint256 _valuation) external",
  "function getDeployedAssets() external view returns (address[])",
  "event AssetCreated(address indexed assetAddress, string name, address indexed owner)",
]);

export const REAL_WORLD_ASSET_ABI = parseAbi([
  // --- reads ---
  "function assetName() view returns (string)",
  "function symbol() view returns (string)",
  "function assetUrl() view returns (string)",
  "function valuation() view returns (uint256)",
  "function getPrice() view returns (uint256)",
  "function tradingActive() view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function sold() view returns (bool)",
  "function owner() view returns (address)",
  // --- Phase 9: vesting + buyout/vault reads ---
  "function isCreatorLocked() view returns (bool)",
  "function creatorUnlockTime() view returns (uint256)",
  "function liquidityInitializedAt() view returns (uint256)",
  "function buyoutBuyer() view returns (address)",
  "function buyoutPrice() view returns (uint256)",
  "function finalCashPerToken() view returns (uint256)",
  "function buyoutShare(address) view returns (uint256)",
  "function SWAP_FEE_BPS() view returns (uint256)",
  // --- writes ---
  "function approve(address spender, uint256 amount) returns (bool)",
  "function buyTokens(uint256 usdcInput) external",
  "function sellTokens(uint256 tokenInput) external",
  "function addLiquidity(uint256 tokenAmount) external",
  "function initiateBuyout(uint256 _offerAmount) external",
  "function cashOut() external",
  // --- buyout state ---
  "function buyoutProposed() view returns (bool)",
  // --- events (used by the chart + activity feed) ---
  "event Traded(address indexed user, string action, uint256 amountIn, uint256 amountOut, uint256 newPrice)",
]);

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function mint(address to, uint256 amount) external",
]);
