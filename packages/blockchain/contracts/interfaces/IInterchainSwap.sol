// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IInterchainSwap {
    struct Tier {
        string name;
        uint256 price;
    }

    struct Payment {
        address payer;
        address token;
        uint256 tierIndex;
        uint256 nonce;
    }

    struct Subscribe {
        address payer;
        uint256 tierIndex;
        uint256 startAt;
        uint256 expireAt;
    }
    // events
    event PaymentReceived(
        address indexed payer,
        uint256 amount,
        uint256 daoShare,
        uint256 burned
    );
}
