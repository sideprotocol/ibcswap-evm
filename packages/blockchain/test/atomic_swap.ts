import { ethers } from "hardhat";
import { Utils, newAtomicSwapOrderID } from "../utils/utils";
import { BlockTime } from "../utils/time";
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

  const createDefaultAtomicOrder = async () => {
    const { atomicSwapA, atomicSwapB, chainID } = await loadFixture(
      Utils.prepareTest
    );
    const [maker, taker, makerReceiver, takerReceiver] = accounts;
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
      makerReceiver: makerReceiver.address,
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

    const id = newAtomicSwapOrderID(accounts[0].address, chainID, chainID, 0);
    const orderIDAtContractA = await atomicSwapA.swapOrderID(id);
    expect(orderIDAtContractA.id).to.equal(id);
    const orderIDAtContractB = await atomicSwapB.swapOrderID(id);
    expect(orderIDAtContractB.id).to.equal(orderIDAtContractA.id);
    return {
      orderID: id,
      chainID: chainID,
      maker,
      makerReceiver,
      taker,
      takerReceiver,

      chainA: atomicSwapA,
      chainB: atomicSwapB,
      payload: payload,
    };
  };
  it("deploy test", async () => {
    const { atomicSwapA, atomicSwapB } = await Utils.prepareTest();
    expect(atomicSwapA.address).not.equal(ethers.constants.AddressZero);
    expect(atomicSwapB.address).not.equal(ethers.constants.AddressZero);
  });
  describe("MakeSwap", () => {
    it("happy path", async () => {
      createDefaultAtomicOrder();
    });
  });

  describe("TakeSwap", () => {
    it("happy path", async () => {
      const { orderID, chainID, chainA, chainB, taker } =
        await createDefaultAtomicOrder();
      const takeSwapMsg = {
        orderID: orderID,
        takerReceiver: accounts[1].address,
      };

      const encoder = new ethers.utils.AbiCoder();
      const payloadBytes = encoder.encode(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const estimateFee = await chainB.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      await expect(
        chainB.connect(taker).takeSwap(takeSwapMsg, {
          value: estimateFee.nativeFee.mul(11).div(10),
        })
      ).not.to.reverted;

      const statusAtChainA = await chainA.swapOrderStatus(orderID);
      expect(statusAtChainA.status).to.equal(4);

      const statusAtChainB = await chainB.swapOrderStatus(orderID);
      expect(statusAtChainB.status).to.equal(4);
    });
  });

  describe("CancelSwap", () => {
    it("happy path", async () => {
      const { orderID, chainID, chainA, chainB, taker } =
        await createDefaultAtomicOrder();
      const cancelSwapMsg = {
        orderID: orderID,
      };

      const encoder = new ethers.utils.AbiCoder();
      const payloadBytes = encoder.encode(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const estimateFee = await chainB.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      await expect(
        chainA.cancelSwap(cancelSwapMsg, {
          value: estimateFee.nativeFee.mul(11).div(10),
        })
      ).not.to.reverted;

      const statusAtChainA = await chainA.swapOrderStatus(orderID);
      expect(statusAtChainA.status).to.equal(2);

      const statusAtChainB = await chainB.swapOrderStatus(orderID);
      expect(statusAtChainB.status).to.equal(2);
    });
  });
});
