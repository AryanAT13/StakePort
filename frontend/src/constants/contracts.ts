import { parseAbi } from 'viem';

export const MOCK_USDC_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as const;
export const ASSET_FACTORY_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as const;

export const ASSET_FACTORY_ABI = parseAbi([
  "function createAsset(string _name, string _symbol, string _url, uint256 _valuation) external",
  "function getDeployedAssets() external view returns (address[])",
  "event AssetCreated(address indexed assetAddress, string name, address indexed owner)"
]);

export const REAL_WORLD_ASSET_ABI = parseAbi([

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


  "function approve(address spender, uint256 amount) returns (bool)", 
  "function buyTokens(uint256 usdcInput) external",
  "function sellTokens(uint256 tokenInput) external",
  "function addLiquidity(uint256 tokenAmount) external",
  "function initiateBuyout(uint256 _offerAmount) external",
  "function cashOut() external",


  "function buyoutProposed() view returns (bool)",
  "function buyoutPrice() view returns (uint256)"
]);

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function mint(address to, uint256 amount) external" 
]);