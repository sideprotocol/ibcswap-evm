// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./oracles/IMedianizer.sol";
import "./oracles/IStdReference.sol";

interface ISideOracle {
    enum DataSourceType {
        chainlink,
        makedao,
        band
    }
    struct DataSource {
        DataSourceType source;
        address token;
        Feed feed;
    }
    struct Feed {
        string base;
        string quote;
        address oracle;
    }

    function getPrice(address token) external view returns (uint);
}
