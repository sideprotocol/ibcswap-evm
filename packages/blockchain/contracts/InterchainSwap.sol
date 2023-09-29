// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IInterchainSwap.sol";

contract InterchainSwap is UUPSUpgradeable, IInterchainSwap {
    function initialize(address _admin) external initializer {}

    function _authorizeUpgrade(address) internal override {}
}
