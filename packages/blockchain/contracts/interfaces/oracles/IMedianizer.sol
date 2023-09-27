// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMedianizer {
    function read() external view returns (bytes32);

    function peek() external view returns (bytes32, bool);
}
