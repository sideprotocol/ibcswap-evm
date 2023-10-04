import {
  appendFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "fs";

import { ethers, upgrades } from "hardhat";
import {
  LZEndpointMock,
  AtomicSwap,
  MockToken,
  SideLzAppUpgradable,
} from "@sideprotocol/contracts-typechain";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

export const ERC20_MINT_AMOUNT = 100000000;
// stable coins
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const ETH_USDC = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

export const WHALES: string[] = [];

export enum PoolType {
  IN_CHAIN = 0,
  INTER_CHAIN = 1,
}

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
    const accounts = await ethers.getSigners();
    const [owner] = accounts;
    //deploy contracts
    // create a LayerZero Endpoint mock for testing
    const chainID = 123;
    const LayerZeroEndpointMock = await ethers.getContractFactory(
      "LZEndpointMock"
    );
    const lzEndpointMock = await LayerZeroEndpointMock.deploy(chainID);

    // bridge contract deployment
    const sideBridgeFactory = await ethers.getContractFactory(
      "SideLzAppUpgradable"
    );

    const sideBridgeAtChainA = await upgrades.deployProxy(
      sideBridgeFactory,
      [owner.address, lzEndpointMock.address],
      {
        initializer: "initialize",
      }
    );

    const sideBridgeAtChainB = await upgrades.deployProxy(
      sideBridgeFactory,
      [owner.address, lzEndpointMock.address],
      {
        initializer: "initialize",
      }
    );

    // AtomicSwap contract deploy
    const atomicSwapFactory = await ethers.getContractFactory("AtomicSwap");

    const atomicSwapA = await upgrades.deployProxy(
      atomicSwapFactory,
      [owner.address, chainID, sideBridgeAtChainA.address],
      {
        initializer: "initialize",
      }
    );
    const atomicSwapB = await upgrades.deployProxy(
      atomicSwapFactory,
      [owner.address, chainID, sideBridgeAtChainB.address],
      {
        initializer: "initialize",
      }
    );

    // Setup layer zero endpoint
    await lzEndpointMock.setDestLzEndpoint(
      sideBridgeAtChainA.address,
      lzEndpointMock.address
    );
    await lzEndpointMock.setDestLzEndpoint(
      sideBridgeAtChainB.address,
      lzEndpointMock.address
    );

    // set each contracts source address so it can send to each other
    await sideBridgeAtChainA.setTrustedRemote(
      chainID,
      ethers.utils.solidityPack(
        ["address", "address"],
        [sideBridgeAtChainB.address, sideBridgeAtChainA.address]
      )
    );
    await sideBridgeAtChainB.setTrustedRemote(
      chainID,
      ethers.utils.solidityPack(
        ["address", "address"],
        [sideBridgeAtChainA.address, sideBridgeAtChainB.address]
      )
    );

    await sideBridgeAtChainA.setPacketReceivers(
      atomicSwapA.address,
      ethers.constants.AddressZero
    );

    await sideBridgeAtChainB.setPacketReceivers(
      atomicSwapB.address,
      ethers.constants.AddressZero
    );

    // Deploy Mock Token
    const mockERC20TokenFactory = await ethers.getContractFactory("MockToken");
    const mockUSDC = await mockERC20TokenFactory.deploy("USDC", "USDC");
    const mockUSDT = await mockERC20TokenFactory.deploy("USDT", "USDT");
    const mockDAI = await mockERC20TokenFactory.deploy("DAI", "DAI");
    const MINT_AMOUNT = ethers.utils.parseEther("100000");

    await Promise.all(
      accounts.map(async (account) => {
        await mockUSDC.mint(account.address, MINT_AMOUNT);
        await mockUSDT.mint(account.address, MINT_AMOUNT);
        await mockDAI.mint(account.address, MINT_AMOUNT);

        await mockUSDC.approve(atomicSwapA.address, MINT_AMOUNT);
        await mockUSDC.approve(atomicSwapB.address, MINT_AMOUNT);
        await mockUSDT.approve(atomicSwapA.address, MINT_AMOUNT);
        await mockUSDT.approve(atomicSwapB.address, MINT_AMOUNT);
        await mockDAI.approve(atomicSwapA.address, MINT_AMOUNT);
        await mockDAI.approve(atomicSwapB.address, MINT_AMOUNT);
      })
    );

    return {
      chainID: chainID,
      bridgeA: sideBridgeAtChainA as SideLzAppUpgradable,
      bridgeB: sideBridgeAtChainB as SideLzAppUpgradable,
      lzEndpointMock: lzEndpointMock as LZEndpointMock,
      atomicSwapA: atomicSwapA as AtomicSwap,
      atomicSwapB: atomicSwapB as AtomicSwap,
      usdc: mockUSDC as MockToken,
      usdt: mockUSDT as MockToken,
      dai: mockDAI as MockToken,
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

import { keccak256 } from "ethers/lib/utils";

export function newAtomicSwapOrderID(
  sender: string,
  dstChainID: number,
  chainID: number,
  swapOrderCounter: number
): string {
  const id = keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["uint16", "uint16", "address", "uint256"],
      [chainID, dstChainID, sender, swapOrderCounter]
    )
  );
  return id;
}

export const createDefaultAtomicOrder = async (
  poolType: PoolType,
  withNativeToken?: boolean
) => {
  const { atomicSwapA, atomicSwapB, chainID, usdc, usdt, bridgeA, bridgeB } =
    await loadFixture(Utils.prepareTest);
  const accounts = await ethers.getSigners();
  const [maker, taker, makerReceiver, takerReceiver] = accounts;
  const payload = {
    sellToken: {
      token: withNativeToken ? ethers.constants.AddressZero : usdc.address,
      amount: ethers.utils.parseEther("20"),
    },
    buyToken: {
      token: withNativeToken ? ethers.constants.AddressZero : usdt.address,
      amount: ethers.utils.parseEther("20"),
    },
    makerSender: maker.address,
    makerReceiver: makerReceiver.address,
    desiredTaker: taker.address,
    expireAt: 222,
    dstChainID: chainID,
    poolType: poolType,
  };
  const encoder = new ethers.utils.AbiCoder();
  const payloadBytes = encoder.encode(
    [
      "tuple(address, uint256)",
      "tuple(address, uint256)",
      "address",
      "address",
      "address",
      "uint256",
      "uint16",
      "uint16",
    ],
    [
      [ethers.constants.AddressZero, 20],
      [ethers.constants.AddressZero, 20],
      maker.address,
      maker.address,
      taker.address,
      222,
      chainID,
      poolType,
    ]
  );

  const estimateFee = await bridgeA.estimateFee(
    chainID,
    false,
    "0x",
    payloadBytes
  );
  if (!withNativeToken) {
    const amount = await usdc.allowance(
      accounts[0].address,
      atomicSwapA.address
    );
    await expect(
      usdc.increaseAllowance(
        atomicSwapA.address,
        amount.add(payload.sellToken.amount)
      )
    ).not.to.reverted;
  }

  let nativeTokenAmount = estimateFee.nativeFee.mul(11).div(10);
  if (withNativeToken) {
    nativeTokenAmount = nativeTokenAmount.add(payload.sellToken.amount);
  }
  await expect(
    atomicSwapA.makeSwap(payload, {
      value: nativeTokenAmount,
    })
  ).to.emit(atomicSwapA, "AtomicSwapOrderCreated");

  // check token balance.
  if (!withNativeToken) {
    const balanceOfUSDC = await usdc.balanceOf(atomicSwapA.address);
    expect(balanceOfUSDC.toString()).to.equal(payload.sellToken.amount);
  }

  const id = newAtomicSwapOrderID(accounts[0].address, chainID, chainID, 0);
  const orderIDAtContractA = await atomicSwapA.swapOrderID(id);
  expect(orderIDAtContractA.id).to.equal(id);

  if (poolType == PoolType.INTER_CHAIN) {
    const orderIDAtContractB = await atomicSwapB.swapOrderID(id);
    expect(orderIDAtContractB.id).to.equal(orderIDAtContractA.id);
  }

  return {
    orderID: id,
    chainID: chainID,
    maker,
    makerReceiver,
    taker,
    takerReceiver,

    chainA: atomicSwapA,
    chainB: atomicSwapB,
    bridgeA,
    bridgeB,
    payload: payload,
    usdt,
    usdc,
  };
};

export const encodePayload = (types: string[], values: any[]): string => {
  return new ethers.utils.AbiCoder().encode(types, values);
};
