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
import "./lzApp/NonblockingLzAppUpgradeable.sol";

contract AtomicSwap is
    UUPSUpgradeable,
    EIP712Upgradeable,
    IAtomicSwap,
    OwnablePausableUpgradeable,
    NonblockingLzAppUpgradeable
{
    using ECDSAUpgradeable for bytes32;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;

    EnumerableSetUpgradeable.Bytes32Set private swapOrderIDs;
    AtomicSwapOrder[] swapOrders;

    // EIP-712
    bytes32 public DOMAIN_SEPARATOR;
    string public constant EIP712_DOMAIN_TYPEHASH =
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

    bytes32 public constant PAYMENT_TYPEHASH =
        keccak256(
            "Payment(address payer,address tierIndex,uint256 tierIndex,uint256 nonce)"
        );

    mapping(address => uint256) public nonces;

    uint16 chainID;

    function initialize(
        address _admin,
        uint16 _chainID,
        address _endpoint
    ) external initializer {
        __OwnablePausableUpgradeable_init(_admin);
        __EIP712_init("ATOMICSWAP", "1");
        __NonblockingLzAppUpgradeable_init(_endpoint);
        chainID = _chainID;
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function makeSwap(
        MakeSwapMsg calldata makeswap
    ) external payable virtual whenNotPaused {
        // Create atomic order
        bytes32 id = _generateNewAtomicSwapID(msg.sender, makeswap.dstChainID);
        if (swapOrderIDs.contains(id)) {
            revert AlreaydExistPool();
        }

        AtomicSwapOrder memory _order = AtomicSwapOrder(
            id,
            Side.NATIVE,
            Status.INITIAL,
            address(0x0),
            makeswap.sellToken,
            makeswap.buyToken,
            msg.sender,
            makeswap.makerReceiver,
            makeswap.desiredTaker,
            address(0x0),
            address(0x0),
            block.timestamp,
            0,
            0,
            chainID,
            makeswap.dstChainID
        );

        swapOrders.push(_order);
        bytes memory payload = abi.encode(makeswap);
        _lzSendMsg(payload);
    }

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function takeSwap(
        TakeSwapMsg calldata takeswap
    ) external payable virtual whenNotPaused {
        //
        bytes memory payload = abi.encode(takeswap);
        _lzSendMsg(payload);
    }

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function cancelSwap(
        CancelSwapMsg calldata cancelswap
    ) external payable virtual whenNotPaused {
        //
        bytes memory payload = abi.encode(cancelswap);
        _lzSendMsg(payload);
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal virtual override {}

    function estimateFee(
        uint16 _dstChainId,
        bool _useZro,
        bytes calldata _adapterParams,
        bytes calldata _payload
    ) public view returns (uint nativeFee, uint zroFee) {
        return
            lzEndpoint.estimateFees(
                _dstChainId,
                address(this),
                _payload,
                _useZro,
                _adapterParams
            );
    }

    function setOracle(uint16 dstChainId, address oracle) external onlyAdmin {
        uint TYPE_ORACLE = 6;
        // set the Oracle
        lzEndpoint.setConfig(
            lzEndpoint.getSendVersion(address(this)),
            dstChainId,
            TYPE_ORACLE,
            abi.encode(oracle)
        );
    }

    function _lzSendMsg(bytes memory payload) private {
        _lzSend(
            1,
            payload,
            payable(msg.sender),
            address(0x0),
            bytes(""),
            msg.value
        );
    }

    // Generate AtomicOrder ID
    function _generateNewAtomicSwapID(
        address sender,
        uint16 dstChainID
    ) internal view returns (bytes32 id) {
        id = keccak256(abi.encode(chainID, dstChainID, sender, nonces[sender]));
    }
}
