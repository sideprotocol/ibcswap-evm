// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IAtomicSwap {
    function onReceivePacket(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external;

    enum MsgType {
        MAKESWAP,
        TAKESWAP,
        CANCELSWAP,
        PLACEBID,
        ACCEPBID
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

    enum PoolType {
        INCHAIN,
        INTERCHAIN
    }

    struct Coin {
        address token;
        uint256 amount;
    }

    struct AtomicSwapID {
        bytes32 id;
        uint16 srcChainID;
        uint16 dstChainID;
        PoolType poolType;
    }

    struct AtomicSwapOperators {
        address maker;
        address taker;
        address makerReceiver;
        address takerReceiver;
    }
    struct AtomicSwapStatus {
        Side side;
        Status status;
        uint256 createdAt;
        uint256 canceledAt;
        uint256 completedAt;
    }

    enum BidStatus {
        Initial,
        Failed,
        Cancelled,
        Executed,
        Placed
    }

    struct Bid {
        uint256 amount;
        bytes32 order;
        BidStatus status;
        address bidder;
        address bidderReceiver;
        uint256 receiveTimestamp;
        uint256 expireTimestamp;
    }

    struct MakeSwapMsg {
        Coin sellToken;
        Coin buyToken;
        address makerSender;
        address makerReceiver;
        address desiredTaker;
        uint256 expireAt;
        uint16 dstChainID;
        PoolType poolType;
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
    event AtomicSwapOrderTook(
        address indexed maker,
        address indexed taker,
        bytes32 indexed id
    );

    event AtomicSwapOrderCanceled(bytes32 indexed id);

    // Define errors
    error AlreadyExistPool();

    error NonExistPool();

    error NoPermissionToTake();

    error AlreadyCompleted();

    error NoPermissionToCancel();

    error NotAllowedAmount();

    error InvalidTokenPair();

    error ZeroTokenAddress();

    error NotOwnerOfToken();

    error InvalidBidAmount();

    error TokenTransferFailed();
}
