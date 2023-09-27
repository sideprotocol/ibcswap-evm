// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./presets/OwnablePausableUpgradeable.sol";
import "./interfaces/IAtomicSwap.sol";

contract AtomicSwap is
    UUPSUpgradeable,
    EIP712Upgradeable,
    OwnablePausableUpgradeable,
    IAtomicSwap
{
    using ECDSAUpgradeable for bytes32;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Set;

    EnumerableSetUpgradeable.Set private swap_order_ids;
    AtomicSwapOrder[] swap_orders;

    // EIP-712
    bytes32 public DOMAIN_SEPARATOR;
    string public constant EIP712_DOMAIN_TYPEHASH =
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

    bytes32 public constant PAYMENT_TYPEHASH =
        keccak256(
            "Payment(address payer,address tierIndex,uint256 tierIndex,uint256 nonce)"
        );

    mapping(address => uint256) public nonces;

    function initialize(address _admin) external initializer {
        __OwnablePausableUpgradeable_init(_admin);
        __EIP712_init("ATOMICSWAP", "1");
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function makeSwap(
        MakeSwapMsg calldata makeswap
    ) external payable virtual whenNotPaused {
        //
    }

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function takeSwap(
        TakeSwapMsg calldata makeswap
    ) external payable virtual whenNotPaused {
        //
    }

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function cancelSwap(
        CancelSwapMsg calldata makeswap
    ) external payable virtual whenNotPaused {
        //
    }
}
