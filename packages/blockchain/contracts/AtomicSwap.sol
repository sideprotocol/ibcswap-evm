// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IAtomicSwap.sol";
import "./lzApp/NonblockingLzAppUpgradeable.sol";

contract AtomicSwap is
    UUPSUpgradeable,
    IAtomicSwap,
    NonblockingLzAppUpgradeable
{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;

    EnumerableSetUpgradeable.Bytes32Set private swapOrderIDs;
    AtomicSwapOrder[] swapOrders;

    mapping(address => uint256) public nonces;

    uint16 chainID;

    function initialize(
        address admin,
        uint16 _chainID,
        address _endpoint
    ) external initializer {
        __Ownable_init_unchained();
        transferOwnership(admin);
        __NonblockingLzAppUpgradeable_init(_endpoint);
        chainID = _chainID;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function makeSwap(MakeSwapMsg calldata makeswap) external payable virtual {
        // Create atomic order
        bytes32 id = _generateNewAtomicSwapID(msg.sender, makeswap.dstChainID);
        if (swapOrderIDs.contains(id)) {
            revert AlreaydExistPool();
        }
        AtomicSwapOrder memory _order = _buildAtomicOrderFromMakeSwapMsg(
            id,
            makeswap
        );
        swapOrders.push(_order);
        bytes memory payload = abi.encode(MsgType.MAKESWAP, id, makeswap);
        _lzSendMsg(payload);
        emit CreatedAtomicSwapOrder(id);
    }

    // /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    // function takeSwap(TakeSwapMsg calldata takeswap) external payable virtual {
    //     //
    //     bytes memory payload = abi.encode(takeswap);
    //     _lzSendMsg(payload);
    // }

    // /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    // function cancelSwap(
    //     CancelSwapMsg calldata cancelswap
    // ) external payable virtual {
    //     //
    //     bytes memory payload = abi.encode(cancelswap);
    //     _lzSendMsg(payload);
    // }

    function _nonblockingLzReceive(
        uint16 _srcChainID,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) internal virtual override {
        MsgType msgType = abi.decode(_payload[:32], (MsgType));
        // MakeSwapMsg
        if (msgType == MsgType.MAKESWAP) {
            bytes32 id = bytes32(_payload[32:64]);
            MakeSwapMsg memory makeswap = abi.decode(
                _payload[64:],
                (MakeSwapMsg)
            );
            if (swapOrderIDs.contains(id)) {
                revert();
            }
            AtomicSwapOrder memory _order = _buildAtomicOrderFromMakeSwapMsg(
                id,
                makeswap
            );
            // Inverse chainID
            _order.srcChainID = chainID;
            _order.dstChainID = _srcChainID;
            // Set order side.
            _order.side = Side.REMOTE;
            // Save order.
            swapOrders.push(_order);
        }
    }

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

    function setOracle(uint16 dstChainId, address oracle) external onlyOwner {
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
            chainID,
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

    function _buildAtomicOrderFromMakeSwapMsg(
        bytes32 id,
        MakeSwapMsg memory makeswap
    ) internal view returns (AtomicSwapOrder memory) {
        return
            AtomicSwapOrder(
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
    }
}
