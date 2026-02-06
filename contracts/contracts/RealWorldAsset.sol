// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; // Import interface for MockUSDC

contract RealWorldAsset is ERC20, Ownable {
    
    // Asset Metadata
    string public assetName;
    string public assetUrl;
    uint256 public valuation;
    
    // The Currency used to pay (Address of your MockUSDC)
    IERC20 public paymentToken;

    // Buyout State
    bool public buyoutProposed;
    uint256 public buyoutPrice;
    address public buyoutBuyer;
    bool public sold; 

    event BuyoutProposed(address indexed buyer, uint256 amount);
    event CashedOut(address indexed tokenHolder, uint256 amount);

    constructor(
        string memory _name, 
        string memory _symbol, 
        string memory _url,
        uint256 _valuation,
        address _initialOwner,
        address _paymentTokenAddress // NEW: We pass the fake money address
    ) ERC20(_name, _symbol) Ownable(_initialOwner) {
        assetName = _name;
        assetUrl = _url;
        valuation = _valuation;
        paymentToken = IERC20(_paymentTokenAddress);
        
        // Mint 1000 shares to seller
        _mint(_initialOwner, 1000 * 10**decimals());
    }

    // --- THE BUYOUT MECHANIC (Updated for USDC) ---

    function initiateBuyout(uint256 _offerAmount) external {
        require(!sold, "Asset already sold");
        require(!buyoutProposed, "Buyout already pending");
        
        // Rule: Offer must be at least 10% higher than valuation
        uint256 requiredAmount = valuation * 110 / 100; 
        require(_offerAmount >= requiredAmount, "Offer too low");

        // NEW: Transfer Fake USDC from Whale to Contract
        // The User must "Approve" this transfer first in the Frontend
        require(paymentToken.transferFrom(msg.sender, address(this), _offerAmount), "Transfer failed");

        buyoutProposed = true;
        buyoutPrice = _offerAmount;
        buyoutBuyer = msg.sender;
        sold = true;

        emit BuyoutProposed(msg.sender, _offerAmount);
    }

    function cashOut() external {
        require(sold, "Asset not sold yet");
        uint256 userBalance = balanceOf(msg.sender);
        require(userBalance > 0, "No tokens to cash out");

        // Calculate share of the USDC pot
        uint256 share = (userBalance * buyoutPrice) / totalSupply();

        // Burn the asset tokens
        _burn(msg.sender, userBalance);

        // Send the Fake USDC to the user
        require(paymentToken.transfer(msg.sender, share), "Transfer failed");

        emit CashedOut(msg.sender, share);
    }
}