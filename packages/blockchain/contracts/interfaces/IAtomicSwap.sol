// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IAtomicSwap {
    enum MsgType {
        MAKESWAP,
        TAKESWAP,
        CANCELSWAP
    }
    enum Side {
        REMOTE,
        NATIVE
    }
    enum Status {
        SYNC,
        INITIAL,
        CANCEL,
        FAILED,
        COMPLETE
    }

    struct Coin {
        address token;
        uint256 amount;
    }

    struct AtomicSwapID {
        bytes32 id;
        uint16 srcChainID;
        uint16 dstChainID;
    }

    struct AtomicSwapOperators {
        address maker;
        address taker;
        address makerReceiver;
        address takerReceiver;
    }

    struct AtomicSwapTokens {
        Coin sellToken;
        Coin buyToken;
    }

    struct AtomicSwapStatus {
        Side side;
        Status status;
        uint256 createdAt;
        uint256 canceledAt;
        uint256 completedAt;
    }

    struct AtomicSwapBid {
        Coin bid;
    }

    struct MakeSwapMsg {
        Coin sellToken;
        Coin buyToken;
        address makerSender;
        address makerReceiver;
        address desiredTaker;
        uint256 expireAt;
        uint16 dstChainID;
    }

    struct TakeSwapMsg {
        bytes32 orderID;
        address takerReceiver;
    }

    struct CancelSwapMsg {
        bytes32 orderID;
    }

    // Events
    event PaymentReceived(
        address indexed payer,
        uint256 amount,
        uint256 daoShare,
        uint256 burned
    );
    event AtomicSwapOrderCreated(bytes32 indexed id);

    // Define errors
    error AlreadyExistPool();

    error NonExistPool();

    error NoPermissionToTake();

    error AlreadyCompleted();

    error NoPermissionToCancel();
}
