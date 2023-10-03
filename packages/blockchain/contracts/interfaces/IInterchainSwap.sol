// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IInterchainSwap {
    function onReceivePacket(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external;
}
