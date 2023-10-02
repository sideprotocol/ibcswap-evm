// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library AtomicSwapLib {
    enum MsgType {
        MAKESWAP,
        TAKESWAP,
        CANCELSWAP
    }

    struct AtomicSwapID {
        bytes32 id;
        uint16 srcChainID;
        uint16 dstChainID;
    }

    struct AtomicSwapParty {
        address maker;
        address makerReceiver;
        address desiredTaker;
        address taker;
        address takerReceivingAddress;
    }

    struct AtomicSwapTokens {
        Coin sellToken;
        Coin buyToken;
    }

    struct AtomicSwapStatus {
        Side side;
        Status status;
    }

    enum Side {
        NATIVE,
        REMOTE
    }

    enum Status {
        INITIAL,
        CREATED,
        FILLED,
        CANCELED
    }

    // Messages
    struct Coin {
        address token;
        uint amount;
    }
    struct MakeSwapMsg {
        Coin sellToken;
        Coin buyToken;
        address makerSender;
        address makerReceiver;
        address taker;
        address takerReceivingAddress;
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

    function buildAtomicOrderFromMakeSwapMsg(
        bytes32 id,
        uint16 chainID,
        MakeSwapMsg memory makeswap,
        address msgSender
    )
        internal
        pure
        returns (
            AtomicSwapID memory,
            AtomicSwapParty memory,
            AtomicSwapTokens memory,
            AtomicSwapStatus memory
        )
    {
        AtomicSwapID memory _swapOrderID = AtomicSwapID(
            id,
            chainID,
            makeswap.dstChainID
        );

        AtomicSwapParty memory _swapOrderParty = AtomicSwapParty(
            msgSender,
            makeswap.makerReceiver,
            makeswap.desiredTaker,
            makeswap.taker,
            makeswap.takerReceivingAddress
        );

        AtomicSwapTokens memory _swapOrderTokens = AtomicSwapTokens(
            makeswap.sellToken,
            makeswap.buyToken
        );

        AtomicSwapStatus memory _swapStatus = AtomicSwapStatus(
            Side.NATIVE,
            Status.INITIAL
        );

        return (_swapOrderID, _swapOrderParty, _swapOrderTokens, _swapStatus);
    }
}
