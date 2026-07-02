// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TradeableAsset is ERC20, Ownable {

    // Asset Metadata
    string public assetName;
    string public assetUrl;
    uint256 public valuation;
    IERC20 public paymentToken; // MockUSDC

    // Buyout State
    bool public buyoutProposed;
    uint256 public buyoutPrice;
    address public buyoutBuyer;
    bool public sold;
    uint256 public finalCashPerToken;

    // --- AMM STATE (This was missing!) ---
    bool public tradingActive;

    // --- PHASE 9: AMM SWAP FEE -----------------------------------------------
    // 2% fee on every buy/sell, expressed in basis points (200 / 10000 = 2%).
    // The fee is NOT skimmed to a dev wallet — the full input amount stays in
    // the pool while only (100% - fee) is credited to the swap math. The
    // uncredited slice deepens the reserves on every trade, which (a) makes
    // the pool progressively harder to move and (b) taxes high-frequency
    // arbitrage bots that round-trip the curve.
    uint256 public constant SWAP_FEE_BPS = 200;       // 2.00%
    uint256 private constant BPS_DENOMINATOR = 10000;

    // --- PHASE 9: CREATOR VESTING / ANTI-RUG ---------------------------------
    // The creator keeps 500 shares after seeding the pool. Without a lock they
    // could dump those onto retail the moment the price pumps. We freeze the
    // creator's ability to call sellTokens() for a fixed window measured from
    // market initialization. A hostile buyout is unaffected: liquidation runs
    // through cashOut(), not sellTokens(), so locked creators still claim their
    // USDC payout when a whale takes the asset.
    uint256 public constant CREATOR_LOCKUP = 60 days;
    uint256 public liquidityInitializedAt; // 0 until addLiquidity() is called

    // Events
    event LiquidityAdded(uint256 tokens, uint256 usdc);
    event Traded(address indexed user, string action, uint256 amountIn, uint256 amountOut, uint256 newPrice);
    event BuyoutProposed(address indexed buyer, uint256 amount);
    event CashedOut(address indexed tokenHolder, uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _url,
        uint256 _valuation,
        address _initialOwner,
        address _paymentTokenAddress
    ) ERC20(_name, _symbol) Ownable(_initialOwner) {
        assetName = _name;
        assetUrl = _url;
        valuation = _valuation;
        paymentToken = IERC20(_paymentTokenAddress);

        // Mint 1000 shares to seller
        _mint(_initialOwner, 1000 * 10**decimals());
    }

    // --- 1. INITIALIZE TRADING (The IPO) ---
    function addLiquidity(uint256 tokenAmount) external {
        require(msg.sender == owner(), "Only owner can add liquidity");
        require(!tradingActive, "Trading already active");

        // Creator sends Tokens to the contract (The Pool)
        _transfer(msg.sender, address(this), tokenAmount);

        // Creator must also approve and send matching USDC
        // We calculate required USDC based on valuation
        uint256 usdcRequired = (valuation * tokenAmount) / totalSupply();
        require(paymentToken.transferFrom(msg.sender, address(this), usdcRequired), "USDC Transfer failed");

        tradingActive = true;

        // Stamp the moment trading went live — the creator lockup counts from
        // here, not from contract deployment, so the clock starts when the
        // creator's shares actually become liquid.
        liquidityInitializedAt = block.timestamp;

        emit LiquidityAdded(tokenAmount, usdcRequired);
    }

    // --- 2. GET CURRENT PRICE ---
    function getPrice() public view returns (uint256) {
        uint256 tokenReserve = balanceOf(address(this));
        uint256 usdcReserve = paymentToken.balanceOf(address(this));

        if (tokenReserve == 0) return 0;
        return (usdcReserve * 10**decimals()) / tokenReserve;
    }

    // --- PHASE 9 HELPERS ------------------------------------------------------

    // Timestamp at which the creator's shares unlock for selling. Returns 0
    // before the market is initialized (lock not yet armed).
    function creatorUnlockTime() public view returns (uint256) {
        if (liquidityInitializedAt == 0) return 0;
        return liquidityInitializedAt + CREATOR_LOCKUP;
    }

    // True while the creator is still inside the lockup window. Used by the UI
    // to disable the creator's Sell button and show a countdown.
    function isCreatorLocked() public view returns (bool) {
        if (liquidityInitializedAt == 0) return false;
        return block.timestamp < liquidityInitializedAt + CREATOR_LOCKUP;
    }

    // --- 3. BUY TOKENS (Swap USDC -> Asset Token) ---
    function buyTokens(uint256 usdcInput) external {
        require(tradingActive, "Trading not active");
        require(!sold, "Asset sold via buyout");

        uint256 tokenReserve = balanceOf(address(this));
        uint256 usdcReserve = paymentToken.balanceOf(address(this));

        // FEE: only (100% - 2%) of the input drives the curve. The full
        // usdcInput is still pulled into the pool below, so the 2% remainder
        // becomes permanent reserve depth rather than buyer-bought tokens.
        uint256 usdcInputAfterFee = (usdcInput * (BPS_DENOMINATOR - SWAP_FEE_BPS)) / BPS_DENOMINATOR;

        // Constant Product Formula (x * y = k)
        uint256 k = tokenReserve * usdcReserve;
        uint256 newUsdcReserve = usdcReserve + usdcInputAfterFee;
        uint256 newTokensReserve = k / newUsdcReserve;
        uint256 tokensOut = tokenReserve - newTokensReserve;

        require(tokensOut > 0, "Insufficent liquidity");

        // Execute Trade — the FULL usdcInput enters the pool (fee included).
        require(paymentToken.transferFrom(msg.sender, address(this), usdcInput), "USDC transfer failed");
        _transfer(address(this), msg.sender, tokensOut);

        emit Traded(msg.sender, "BUY", usdcInput, tokensOut, getPrice());
    }

    // --- 4. SELL TOKENS (Swap Asset Token -> USDC) ---
    function sellTokens(uint256 tokenInput) external {
        require(tradingActive, "Trading not active");
        require(!sold, "Asset sold via buyout");

        // CREATOR VESTING: the creator cannot sell their founder bag until the
        // lockup elapses. Everyone else trades freely. (cashOut on buyout is a
        // separate path and is intentionally never gated by this.)
        if (msg.sender == owner()) {
            require(!isCreatorLocked(), "Creator shares locked (anti-rug vesting)");
        }

        uint256 tokenReserve = balanceOf(address(this));
        uint256 usdcReserve = paymentToken.balanceOf(address(this));

        // FEE: only 98% of the tokens sold drive the curve; the full tokenInput
        // is still parked in the pool, deepening token-side reserves.
        uint256 tokenInputAfterFee = (tokenInput * (BPS_DENOMINATOR - SWAP_FEE_BPS)) / BPS_DENOMINATOR;

        // Calculate USDC Out
        uint256 k = tokenReserve * usdcReserve;
        uint256 newTokenReserve = tokenReserve + tokenInputAfterFee;
        uint256 newUsdcReserve = k / newTokenReserve;
        uint256 usdcOut = usdcReserve - newUsdcReserve;

        require(usdcOut > 0, "Insufficent liquidity");

        // Execute Trade — the FULL tokenInput enters the pool (fee included).
        _transfer(msg.sender, address(this), tokenInput);
        require(paymentToken.transfer(msg.sender, usdcOut), "USDC transfer failed");

        emit Traded(msg.sender, "SELL", tokenInput, usdcOut, getPrice());
    }

    // --- EXISTING BUYOUT LOGIC ---

    mapping(address => uint256) public buyoutShare;

    function initiateBuyout(uint256 _offerAmount) external {
        require(msg.sender != owner(), "Creator cannot initiate buyout");
        require(!sold, "Asset already sold");
        require(!buyoutProposed, "Buyout pending");

        // --- 1. DYNAMIC PRICE CHECK ---
        uint256 baseValuation = valuation;

        // Calculate Current Market Cap (Price * Total Supply)
        // If trading is active, use the AMM price. If not, use initial valuation.
        if (tradingActive && totalSupply() > 0) {
            uint256 currentPrice = getPrice(); // Price per token (1e18 precision)
            // Market Cap = (Price * Total Supply) / 1e18
            uint256 marketCap = (currentPrice * totalSupply()) / 1e18;

            // If the market cap is higher than initial valuation, use that as the base
            if (marketCap > baseValuation) {
                baseValuation = marketCap;
            }
        }

        // Require 25% Premium on the HIGHER of (Valuation vs Market Cap)
        uint256 requiredAmount = (baseValuation * 125) / 100;

        require(_offerAmount >= requiredAmount, "Offer too low (Must cover Market Cap + 25%)");

        // Transfer money in
        require(paymentToken.transferFrom(msg.sender, address(this), _offerAmount), "Transfer failed");

        buyoutProposed = true;
        buyoutPrice = _offerAmount;
        buyoutBuyer = msg.sender;
        sold = true;
        tradingActive = false;

        // --- 2. PAYOUT LOGIC (The "Everything Pot") ---

        // The Total Pot is simply ALL the money in the contract now.
        // This includes:
        // 1. The Buyout Money ($62.5k+)
        // 2. The Liquidity Pool Cash (e.g., $192k from your example)
        uint256 totalPot = paymentToken.balanceOf(address(this));

        // We distribute this pot to ALL Token Holders proportional to their share.
        // Total Supply = 1000.
        // Value Per Token = Total Pot / 1000.

        finalCashPerToken = (totalPot * 1e18) / totalSupply();

        // 3. OWNER LIQUIDITY FIX
        // The Contract itself holds tokens (the liquidity reserve).
        // Since the Owner provided this liquidity, the Owner gets the value of these tokens.
        uint256 contractTokenBalance = balanceOf(address(this));

        if (contractTokenBalance > 0) {
            uint256 liquidityValue = (contractTokenBalance * finalCashPerToken) / 1e18;
            buyoutShare[owner()] = liquidityValue;

            // Burn the contract tokens so they don't count as a "user" later
            _burn(address(this), contractTokenBalance);
        }

        emit BuyoutProposed(msg.sender, _offerAmount);
    }

    function cashOut() external {
        require(sold, "Asset not sold");
        uint256 userBalance = balanceOf(msg.sender);

        // 1. Calculate Standard Share (Held Tokens)
        uint256 share = 0;
        if (userBalance > 0) {
            share = (userBalance * finalCashPerToken) / 1e18;
            _burn(msg.sender, userBalance);
        }

        // 2. Add Special Liquidity Share (If user is Owner)
        if (buyoutShare[msg.sender] > 0) {
            share += buyoutShare[msg.sender];
            buyoutShare[msg.sender] = 0; // Prevent double claim
        }

        require(share > 0, "Nothing to cash out");
        require(paymentToken.transfer(msg.sender, share), "Transfer failed");

        emit CashedOut(msg.sender, share);
    }
}
