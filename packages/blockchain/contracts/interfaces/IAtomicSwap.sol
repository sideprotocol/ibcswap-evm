// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IAtomicSwap {
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
        MakeSwapMsg maker;
        Status status;
        TakeSwapMsg taker;
        address bridge;
        uint create_at;
        uint cancel_at;
        uint complete_at;
    }

    struct Coin {
        address token;
        address amount;
    }

    // Messages
    struct MakeSwapMsg {
        Coin sell_token;
        Coin buy_token;
        address maker_sender;
        address maker_receiver;
        address desired_taker;
        uint created_at;
        uint expire_at;
    }

    struct TakeSwapMsg {
        bytes32 order_id;
        Coin sell_token;
        address taker;
        address taker_receiving_address;
        address created_at;
    }

    struct CancelSwapMsg {
        bytes32 order_id;
        address maker;
        uint created_at;
    }

    // events
    event PaymentReceived(
        address indexed payer,
        uint256 amount,
        uint256 daoShare,
        uint256 burned
    );
}
