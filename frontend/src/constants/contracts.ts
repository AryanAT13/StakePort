export const MOCK_USDC_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const ASSET_FACTORY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export const ASSET_FACTORY_ABI = [
  "function createAsset(string _name, string _symbol, string _url, uint256 _valuation) external",
  "function getDeployedAssets() external view returns (address[])",
  "event AssetCreated(address indexed assetAddress, string name, address indexed owner)"
];

export const REAL_WORLD_ASSET_ABI = [
  "function assetName() view returns (string)",
  "function assetUrl() view returns (string)",
  "function valuation() view returns (uint256)",
  "function buyoutProposed() view returns (bool)",
  "function buyoutPrice() view returns (uint256)",
  "function initiateBuyout(uint256 _offerAmount) external",
  "function cashOut() external",
  "function balanceOf(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function mint(address to, uint256 amount) external" // Only for MockUSDC
];