// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IAtomicSwap {
    enum MsgType {
        MAKESWAP,
        TAKESWAP,
        CANCELSWAP
    }
    // Data types
    enum Side {
        NATIVE,
        REMOTE
    }
    enum Status {
        INITIAL,
        SYNC,
        CANCEL,
        FAILED,
        COMPLETE
    }
    struct AtomicSwapOrder {
        bytes32 id;
        Side side;
        Status status;
        address bridge;
        Coin sellToken;
        Coin buyToken;
        address makerSender;
        address makerReceiver;
        address desiredTaker;
        address taker;
        address takerReceivingAddress;
        uint createAt;
        uint cancelAt;
        uint completeAt;
        uint16 srcChainID;
        uint16 dstChainID;
    }

    struct Coin {
        address token;
        uint amount;
    }

    // Messages
    struct MakeSwapMsg {
        Coin sellToken;
        Coin buyToken;
        address makerSender;
        address makerReceiver;
        address desiredTaker;
        uint expireAt;
        uint16 dstChainID;
    }

    struct TakeSwapMsg {
        bytes32 orderID;
        Coin sellToken;
        address taker;
        address takerReceivingAddress;
        address createdAt;
    }

    struct CancelSwapMsg {
        bytes32 orderID;
        address maker;
        uint createdAt;
    }

    // events
    event PaymentReceived(
        address indexed payer,
        uint256 amount,
        uint256 daoShare,
        uint256 burned
    );

    // Define errors
    error AlreaydExistPool();

    // Events
    event CreatedAtomicSwapOrder(bytes32 indexed id);
}
