// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IAtomicSwap.sol";
import "./lzApp/NonblockingLzAppUpgradeable.sol";
import "hardhat/console.sol";

contract AtomicSwap is
    OwnableUpgradeable,
    IAtomicSwap,
    NonblockingLzAppUpgradeable
{
    mapping(bytes32 => AtomicSwapID) public swapOrderID;
    mapping(bytes32 => AtomicSwapStatus) public swapOrderStatus;
    mapping(bytes32 => AtomicSwapTokens) public swapOrderTokens;
    mapping(bytes32 => AtomicSwapOperators) public swapOrderOperators;

    uint256 swapOrderCounter;
    uint16 chainID;

    modifier onlyExist(bytes32 id) {
        if (swapOrderID[id].id == bytes32(0x0)) {
            revert NonExistPool();
        }
        _;
    }

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

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function makeSwap(MakeSwapMsg calldata makeswap) external payable virtual {
        bytes32 id = _generateNewAtomicSwapID(msg.sender, makeswap.dstChainID);
        _addNewSwapOrder(id, msg.sender, makeswap, Side.NATIVE, 0x0);
        bytes memory payload = abi.encode(MsgType.MAKESWAP, id, makeswap);
        _lzSendMsg(payload);
        emit AtomicSwapOrderCreated(id);
    }

    // /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function takeSwap(
        TakeSwapMsg calldata takeswap
    ) external payable virtual onlyExist(takeswap.orderID) {
        AtomicSwapOperators memory _operators = swapOrderOperators[
            takeswap.orderID
        ];
        AtomicSwapStatus memory _orderStatus = swapOrderStatus[
            takeswap.orderID
        ];

        if (_operators.taker == address(0) || _operators.taker != msg.sender) {
            revert NoPermissionToTake();
        }

        if (_orderStatus.status == Status.COMPLETE) {
            revert AlreadyCompleted();
        }

        swapOrderStatus[takeswap.orderID].status = Status.COMPLETE;
        bytes memory payload = abi.encode(MsgType.TAKESWAP, takeswap);
        _lzSendMsg(payload);
    }

    // /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function cancelSwap(
        CancelSwapMsg calldata cancelswap
    ) external payable virtual onlyExist(cancelswap.orderID) {
        AtomicSwapOperators memory _operators = swapOrderOperators[
            cancelswap.orderID
        ];
        if (_operators.maker != msg.sender) {
            revert NoPermissionToCancel();
        }

        swapOrderStatus[cancelswap.orderID].status = Status.CANCEL;
        bytes memory payload = abi.encode(
            MsgType.CANCELSWAP,
            cancelswap.orderID
        );
        _lzSendMsg(payload);
    }

    function _nonblockingLzReceive(
        uint16 _srcChainID,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) internal virtual override {
        MsgType msgType = abi.decode(_payload[:32], (MsgType));
        if (msgType == MsgType.MAKESWAP) {
            bytes32 id = bytes32(_payload[32:64]);
            MakeSwapMsg memory makeswap = abi.decode(
                _payload[64:],
                (MakeSwapMsg)
            );
            _addNewSwapOrder(
                id,
                bytesToAddress(_srcAddress),
                makeswap,
                Side.REMOTE,
                _srcChainID
            );
        } else if (msgType == MsgType.TAKESWAP) {
            TakeSwapMsg memory takeswap = abi.decode(
                _payload[32:],
                (TakeSwapMsg)
            );
            swapOrderStatus[takeswap.orderID].status = Status.COMPLETE;
        } else if (msgType == MsgType.CANCELSWAP) {
            bytes32 id = bytes32(_payload[32:]);
            swapOrderStatus[id].status = Status.CANCEL;
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
    ) internal returns (bytes32 id) {
        id = keccak256(
            abi.encode(chainID, dstChainID, sender, swapOrderCounter)
        );
        swapOrderCounter++;
    }

    // Refactored functions
    function _addNewSwapOrder(
        bytes32 id,
        address sender,
        MakeSwapMsg memory makeswap,
        Side side,
        uint16 _srcChainID
    ) private {
        if (swapOrderID[id].id != bytes32(0x0)) {
            revert AlreadyExistPool();
        }

        AtomicSwapID memory _orderID = AtomicSwapID(
            id,
            chainID,
            makeswap.dstChainID
        );

        AtomicSwapTokens memory _orderTokens = AtomicSwapTokens(
            makeswap.sellToken,
            makeswap.buyToken
        );

        AtomicSwapStatus memory _orderStatus = AtomicSwapStatus(
            side,
            Status.INITIAL,
            block.timestamp,
            0,
            0
        );

        AtomicSwapOperators memory _orderOperators = AtomicSwapOperators(
            sender,
            makeswap.desiredTaker,
            makeswap.makerReceiver,
            address(0)
        );

        if (side == Side.REMOTE) {
            _orderID.srcChainID = chainID;
            _orderID.dstChainID = _srcChainID;
            swapOrderOperators[id].taker = _orderOperators.taker;
        } else {
            swapOrderOperators[id] = _orderOperators;
            swapOrderStatus[id] = _orderStatus;
        }

        swapOrderID[id] = _orderID;
        swapOrderTokens[id] = _orderTokens;

        emit AtomicSwapOrderCreated(id);
    }

    function bytesToAddress(
        bytes memory bys
    ) private pure returns (address addr) {
        assembly {
            addr := mload(add(bys, 20))
        }
    }
}
