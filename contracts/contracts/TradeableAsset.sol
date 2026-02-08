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

    // --- AMM STATE (This was missing!) ---
    bool public tradingActive;
    
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
        emit LiquidityAdded(tokenAmount, usdcRequired);
    }

    // --- 2. GET CURRENT PRICE ---
    function getPrice() public view returns (uint256) {
        uint256 tokenReserve = balanceOf(address(this));
        uint256 usdcReserve = paymentToken.balanceOf(address(this));
        
        if (tokenReserve == 0) return 0;
        return (usdcReserve * 10**decimals()) / tokenReserve;
    }

    // --- 3. BUY TOKENS (Swap USDC -> Asset Token) ---
    function buyTokens(uint256 usdcInput) external {
        require(tradingActive, "Trading not active");
        require(!sold, "Asset sold via buyout");

        uint256 tokenReserve = balanceOf(address(this));
        uint256 usdcReserve = paymentToken.balanceOf(address(this));

        // Constant Product Formula (x * y = k)
        uint256 k = tokenReserve * usdcReserve;
        uint256 newUsdcReserve = usdcReserve + usdcInput;
        uint256 newTokensReserve = k / newUsdcReserve;
        uint256 tokensOut = tokenReserve - newTokensReserve;

        require(tokensOut > 0, "Insufficent liquidity");

        // Execute Trade
        require(paymentToken.transferFrom(msg.sender, address(this), usdcInput), "USDC transfer failed");
        _transfer(address(this), msg.sender, tokensOut);

        emit Traded(msg.sender, "BUY", usdcInput, tokensOut, getPrice());
    }

    // --- 4. SELL TOKENS (Swap Asset Token -> USDC) ---
    function sellTokens(uint256 tokenInput) external {
        require(tradingActive, "Trading not active");
        require(!sold, "Asset sold via buyout");

        uint256 tokenReserve = balanceOf(address(this));
        uint256 usdcReserve = paymentToken.balanceOf(address(this));

        // Calculate USDC Out
        uint256 k = tokenReserve * usdcReserve;
        uint256 newTokenReserve = tokenReserve + tokenInput;
        uint256 newUsdcReserve = k / newTokenReserve;
        uint256 usdcOut = usdcReserve - newUsdcReserve;

        require(usdcOut > 0, "Insufficent liquidity");

        // Execute Trade
        _transfer(msg.sender, address(this), tokenInput);
        require(paymentToken.transfer(msg.sender, usdcOut), "USDC transfer failed");

        emit Traded(msg.sender, "SELL", tokenInput, usdcOut, getPrice());
    }

    // --- EXISTING BUYOUT LOGIC ---
    function initiateBuyout(uint256 _offerAmount) external {
        require(!sold, "Asset already sold");
        require(!buyoutProposed, "Buyout already pending");
        uint256 requiredAmount = valuation * 110 / 100; 
        require(_offerAmount >= requiredAmount, "Offer too low");
        require(paymentToken.transferFrom(msg.sender, address(this), _offerAmount), "Transfer failed");

        buyoutProposed = true;
        buyoutPrice = _offerAmount;
        buyoutBuyer = msg.sender;
        sold = true;
        tradingActive = false; // Stop AMM

        emit BuyoutProposed(msg.sender, _offerAmount);
    }

    function cashOut() external {
        require(sold, "Asset not sold yet");
        uint256 userBalance = balanceOf(msg.sender);
        require(userBalance > 0, "No tokens to cash out");
        uint256 share = (userBalance * buyoutPrice) / totalSupply();
        _burn(msg.sender, userBalance);
        require(paymentToken.transfer(msg.sender, share), "Transfer failed");
        emit CashedOut(msg.sender, share);
    }
}