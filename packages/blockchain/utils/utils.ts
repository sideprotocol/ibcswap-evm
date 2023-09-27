import {
  appendFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "fs";

import { ethers, upgrades } from "hardhat";
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
    const [owner, admin] = await ethers.getSigners();
    //deploy contracts

    // const scopeTokenFactory = await ethers.getContractFactory(
    //   "BlockScopeToken"
    // );
    // const scopeToken = await scopeTokenFactory.deploy(
    //   "BlockScope Token",
    //   "Scope",
    //   admin.address
    // );
    // await scopeToken.deployed();

    // const scopeOracleFactory = await ethers.getContractFactory(
    //   "BlockScopeOracle"
    // );

    // const oracles = [
    //   { source: 0, token: "", feed: { base: "", quote: "", oracle: "" } },
    //   { source: 0, token: "", feed: { base: "", quote: "", oracle: "" } },
    //   { source: 0, token: "", feed: { base: "", quote: "", oracle: "" } },
    // ];

    // const scopeOracle = await upgrades.deployProxy(
    //   scopeOracleFactory,
    //   [admin.address, oracles],
    //   {
    //     kind: "uups",
    //   }
    // );

    // const scopeVestingFactory = await ethers.getContractFactory(
    //   "BlockScopeVesting"
    // );
    // const scopeVesting = await scopeVestingFactory.deploy(scopeToken.address);
    // await scopeVesting.deployed();

    // const scopePaymentFactory = await ethers.getContractFactory(
    //   "BlockScopePayment"
    // );

    // const tiers = [
    //   { name: "free", price: 10 },
    //   { name: "tier1", price: 20 },
    //   { name: "tier2", price: 30 },
    // ];
    // const scopePayment = await upgrades.deployProxy(
    //   scopePaymentFactory,
    //   [admin.address, daoTreasury.address, tiers],
    //   {
    //     kind: "uups",
    //   }
    // );

    // await scopeToken
    //   .connect(owner)
    //   .approve(scopePayment.address, ERC20_MINT_AMOUNT);
    // await scopeToken
    //   .connect(owner)
    //   .approve(scopeVesting.address, ERC20_MINT_AMOUNT);

    return {
      // scopeToken: scopeToken,
      // scopeOracle: scopeOracle,
      // scopeVesting: scopeVesting,
      // scopePayment: scopePayment,
      // admin,
      // daoTreasury,
      // user,
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
