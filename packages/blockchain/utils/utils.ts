import {
  appendFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "fs";

import { ethers, upgrades } from "hardhat";
import { LZEndpointMock, AtomicSwap } from "@sideprotocol/contracts-typechain";
export const ERC20_MINT_AMOUNT = 100000000;
// stable coins
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

const ETH_USDC = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

export const saveDeployedAddress = async (
  sweeper: string,
  tokens: string[]
) => {
  const settingInfo: {
    sweeperAddress: string;
    erc20Tokens: string[];
  } = {
    sweeperAddress: "",
    erc20Tokens: [],
  };
  settingInfo.sweeperAddress = sweeper;
  settingInfo.erc20Tokens = tokens;

  const settingsPath = "../contracts-typechain/settings";
  if (!existsSync(settingsPath)) {
    mkdirSync(settingsPath, { recursive: true });
  } else {
    const rawData = readFileSync(`${settingsPath}/settings.json`);
    const data = JSON.parse(rawData.toString());
  }
  const json = JSON.stringify(settingInfo);
  writeFileSync(`${settingsPath}/settings.json`, json, "utf-8");
};

export const Utils = {
  prepareTest: async function () {
    //import users
    const [owner] = await ethers.getSigners();
    //deploy contracts
    // create a LayerZero Endpoint mock for testing
    const chainID = 123;
    const LayerZeroEndpointMock = await ethers.getContractFactory(
      "LZEndpointMock"
    );
    const lzEndpointMock = await LayerZeroEndpointMock.deploy(chainID);

    // AtomicSwap contract deploy
    const atomicSwapFactory = await ethers.getContractFactory("AtomicSwap");
    const atomicSwapA = await upgrades.deployProxy(
      atomicSwapFactory,
      [owner.address, chainID, lzEndpointMock.address],
      {
        kind: "uups",
      }
    );
    const atomicSwapB = await upgrades.deployProxy(
      atomicSwapFactory,
      [owner.address, chainID, lzEndpointMock.address],
      {
        kind: "uups",
      }
    );

    // Setup layerzero endpoint
    await lzEndpointMock.setDestLzEndpoint(
      atomicSwapA.address,
      lzEndpointMock.address
    );
    await lzEndpointMock.setDestLzEndpoint(
      atomicSwapB.address,
      lzEndpointMock.address
    );

    // set each contracts source address so it can send to each other
    await atomicSwapA.setTrustedRemote(
      chainID,
      ethers.utils.solidityPack(
        ["address", "address"],
        [atomicSwapB.address, atomicSwapA.address]
      )
    );
    await atomicSwapB.setTrustedRemote(
      chainID,
      ethers.utils.solidityPack(
        ["address", "address"],
        [atomicSwapA.address, atomicSwapB.address]
      )
    );

    return {
      chainID: chainID,
      lzEndpointMock: lzEndpointMock as LZEndpointMock,
      atomicSwapA: atomicSwapA as AtomicSwap,
      atomicSwapB: atomicSwapB as AtomicSwap,
    };
  },
};

export function generateRandomString(length: number) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
