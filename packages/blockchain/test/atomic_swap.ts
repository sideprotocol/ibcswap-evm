import { ethers } from "hardhat";
import { Utils } from "../utils/utils";
import { expect } from "chai";
import { IAtomicSwap } from "@sideprotocol/contracts-typechain";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AtomicSwap", () => {
  let accounts: SignerWithAddress[];
  beforeEach(async () => {
    accounts = await ethers.getSigners();
  });
  it("deploy test", async () => {
    const { atomicSwapA, atomicSwapB } = await Utils.prepareTest();
    expect(atomicSwapA.address).not.equal(ethers.constants.AddressZero);
    expect(atomicSwapB.address).not.equal(ethers.constants.AddressZero);
  });
  describe("MakeSwap", () => {
    it("happy path", async () => {
      const { atomicSwapA, atomicSwapB, chainID } = await loadFixture(
        Utils.prepareTest
      );
      const [_, maker, taker] = accounts;
      const payload = {
        sellToken: {
          token: ethers.constants.AddressZero,
          amount: "20",
        },
        buyToken: {
          token: ethers.constants.AddressZero,
          amount: "20",
        },
        makerSender: maker.address,
        makerReceiver: maker.address,
        desiredTaker: taker.address,
        expireAt: 222,
        dstChainID: chainID,
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
        ],
        [
          [ethers.constants.AddressZero, 20],
          [ethers.constants.AddressZero, 20],
          maker.address,
          maker.address,
          taker.address,
          222,
          chainID,
        ]
      );

      const estimateFee = await atomicSwapA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      expect(
        await atomicSwapA.makeSwap(payload, {
          value: estimateFee.nativeFee.mul(11).div(10),
        })
      ).not.to.reverted;
    });
  });
});
