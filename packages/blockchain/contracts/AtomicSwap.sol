// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IAtomicSwap.sol";
import "./lzApp/NonblockingLzAppUpgradeable.sol";
import "hardhat/console.sol";
import "./interfaces/ISideLzAppUpgradable.sol";

contract AtomicSwap is
    OwnableUpgradeable,
    IAtomicSwap,
    ReentrancyGuardUpgradeable
{
    ISideLzAppUpgradable public bridge;

    mapping(bytes32 => AtomicSwapID) public swapOrderID;
    mapping(bytes32 => AtomicSwapStatus) public swapOrderStatus;
    mapping(bytes32 => AtomicSwapOperators) public swapOrderOperators;
    mapping(bytes32 => Coin) public swapOrderSellToken;
    mapping(bytes32 => Coin) public swapOrderBuyToken;

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
        address _bridge
    )
        external
        //address _endpoint
        initializer
    {
        __Ownable_init_unchained();
        transferOwnership(admin);
        bridge = ISideLzAppUpgradable(_bridge);
        chainID = _chainID;
    }

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function makeSwap(MakeSwapMsg calldata makeswap) external payable virtual {
        // Validate msg basically
        if (
            makeswap.sellToken.token != address(0) &&
            makeswap.sellToken.token == makeswap.buyToken.token
        ) {
            revert InvalidTokenPair();
        }

        if (makeswap.makerSender != msg.sender) {
            revert NotOwnerOfToken();
        }
        uint nativeFee = msg.value;
        // Lock token to smart contract.
        if (makeswap.sellToken.token == address(0)) {
            require(
                msg.value > makeswap.sellToken.amount,
                "Ether amount must be greater than sell token amount"
            );
            nativeFee = nativeFee - makeswap.sellToken.amount;
        } else {
            IERC20 sellToken = IERC20(makeswap.sellToken.token);
            if (
                sellToken.allowance(msg.sender, address(this)) <
                makeswap.sellToken.amount
            ) {
                revert NotAllowedAmount();
            }

            require(
                sellToken.transferFrom(
                    msg.sender,
                    address(this),
                    makeswap.sellToken.amount
                ),
                "Failed in Lock token"
            );
        }

        // Generate ID
        bytes32 id = _generateNewAtomicSwapID(msg.sender, makeswap.dstChainID);
        _addNewSwapOrder(id, msg.sender, makeswap, Side.NATIVE, 0x0);
        bytes memory payload = abi.encode(0, MsgType.MAKESWAP, id, makeswap);

        // Send Interchain message.

        if (makeswap.poolType == PoolType.INTERCHAIN) {
            bridge.sendLzMsg{value: nativeFee}(
                chainID,
                payable(msg.sender),
                payload
            );
        }

        emit AtomicSwapOrderCreated(id);
    }

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function takeSwap(
        TakeSwapMsg calldata takeswap
    ) external payable virtual nonReentrant onlyExist(takeswap.orderID) {
        AtomicSwapOperators storage _operators = swapOrderOperators[
            takeswap.orderID
        ];
        AtomicSwapStatus storage _orderStatus = swapOrderStatus[
            takeswap.orderID
        ];

        require(_operators.taker == msg.sender, "NoPermissionToTake");
        require(_orderStatus.status != Status.COMPLETE, "AlreadyCompleted");

        Coin storage _buyToken = swapOrderBuyToken[takeswap.orderID];
        uint nativeFee = msg.value;
        if (_buyToken.token == address(0)) {
            require(msg.value > _buyToken.amount, "Not enough funds to buy");
            payable(_operators.makerReceiver).transfer(_buyToken.amount);
            nativeFee = msg.value - _buyToken.amount;
        } else {
            IERC20 _token = IERC20(_buyToken.token);
            require(
                _token.transferFrom(
                    msg.sender,
                    _operators.makerReceiver,
                    _buyToken.amount
                ),
                "Failed in token transfer"
            );
        }

        if (swapOrderID[takeswap.orderID].poolType == PoolType.INTERCHAIN) {
            bytes memory payload = abi.encode(0, MsgType.TAKESWAP, takeswap);

            bridge.sendLzMsg{value: nativeFee}(
                chainID,
                payable(msg.sender),
                payload
            );
        }
        _orderStatus.status = Status.COMPLETE;

        emit AtomicSwapOrderTook(
            _operators.maker,
            _operators.taker,
            takeswap.orderID
        );
    }

    /// @dev will updated with EIP 1193 later to improve user redability about tx msg.
    function cancelSwap(
        CancelSwapMsg calldata cancelswap
    ) external payable virtual nonReentrant onlyExist(cancelswap.orderID) {
        bytes32 id = cancelswap.orderID;
        AtomicSwapOperators memory _operators = swapOrderOperators[id];
        if (_operators.maker != msg.sender) {
            revert NoPermissionToCancel();
        }

        swapOrderStatus[id].status = Status.CANCEL;
        bytes memory payload = abi.encode(0, MsgType.CANCELSWAP, id);

        if (swapOrderID[id].poolType == PoolType.INTERCHAIN) {
            _removeAtomicSwapOrder(id);
            bridge.sendLzMsg{value: msg.value}(
                chainID,
                payable(msg.sender),
                payload
            );
        }

        // unlock token
        uint256 amount = swapOrderBuyToken[id].amount;
        if (swapOrderSellToken[id].token == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20 sellToken = IERC20(swapOrderSellToken[id].token);
            _removeAtomicSwapOrder(id);
            sellToken.transfer(msg.sender, amount);
        }

        emit AtomicSwapOrderCanceled(id);
    }

    function onReceivePacket(
        uint16 _srcChainID,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) public virtual override {
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
            _removeAtomicSwapOrder(id);
        }
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
            makeswap.dstChainID,
            makeswap.poolType
        );

        AtomicSwapOperators memory _operators = AtomicSwapOperators(
            sender,
            makeswap.desiredTaker,
            makeswap.makerReceiver,
            makeswap.desiredTaker
        );

        AtomicSwapStatus memory _orderStatus = AtomicSwapStatus(
            side,
            Status.INITIAL,
            block.timestamp,
            0,
            0
        );

        if (side == Side.REMOTE) {
            _orderID.srcChainID = chainID;
            _orderID.dstChainID = _srcChainID;
            swapOrderOperators[id].taker = _operators.taker;
            swapOrderOperators[id].makerReceiver = _operators.makerReceiver;
        } else {
            swapOrderOperators[id] = _operators;
            swapOrderSellToken[id] = makeswap.sellToken;
            swapOrderStatus[id] = _orderStatus;
        }

        swapOrderID[id] = _orderID;
        swapOrderBuyToken[id] = makeswap.buyToken;
        emit AtomicSwapOrderCreated(id);
    }

    function _removeAtomicSwapOrder(bytes32 id) internal {
        delete (swapOrderID[id]);
    }

    function bytesToAddress(
        bytes memory bys
    ) private pure returns (address addr) {
        assembly {
            addr := mload(add(bys, 20))
        }
    }
}
