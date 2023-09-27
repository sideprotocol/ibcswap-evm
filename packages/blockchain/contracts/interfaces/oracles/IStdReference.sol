// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStdReference {
    function getReferenceData(
        string calldata _base,
        string calldata _quote
    ) external view returns (ReferenceData memory);

    struct ReferenceData {
        uint256 rate; // base/quote exchange rate, multiplied by 1e18.
        uint256 lastUpdatedBase;
        uint256 lastUpdatedQuote;
    }
}
