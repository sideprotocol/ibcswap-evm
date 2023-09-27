// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./presets/OwnablePausableUpgradeable.sol";
import "./interfaces/IInterchainSwap.sol";

contract InterchainSwap is
    UUPSUpgradeable,
    EIP712Upgradeable,
    OwnablePausableUpgradeable,
    IInterchainSwap
{
    function initialize(address _admin) external initializer {
        __OwnablePausableUpgradeable_init(_admin);
        __EIP712_init("INTERCHAINSWAP", "1");
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
