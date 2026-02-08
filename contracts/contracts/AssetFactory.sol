// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TradeableAsset.sol";
import "./MockUSDC.sol"; // Import MockUSDC

contract AssetFactory {
    TradeableAsset[] public assets;
    address public paymentTokenAddress; // The address of our Fake Money

    event AssetCreated(address indexed assetAddress, string name, address indexed owner);

    // We set the MockUSDC address when we deploy the Factory
    constructor(address _paymentTokenAddress) {
        paymentTokenAddress = _paymentTokenAddress;
    }

    function createAsset(
        string memory _name,
        string memory _symbol,
        string memory _url,
        uint256 _valuation
    ) external {
        TradeableAsset newAsset = new TradeableAsset(
            _name,
            _symbol,
            _url,
            _valuation,
            msg.sender,
            paymentTokenAddress // Pass the currency address
        );

        assets.push(newAsset);
        emit AssetCreated(address(newAsset), _name, msg.sender);
    }

    function getDeployedAssets() external view returns (TradeableAsset[] memory) {
        return assets;
    }
}