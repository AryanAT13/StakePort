// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Mock USD Coin", "mUSDC") Ownable(initialOwner) {}

    // Function to give users fake money (The "Stripe" webhook will call this)
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
    
    // Allow decimals to match real USDC (usually 6, but we'll stick to 18 for simplicity)
}