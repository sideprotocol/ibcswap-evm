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

  enum PoolType {
    IN_CHAIN = 0,
    INTER_CHAIN = 1,
  }

  const createDefaultAtomicOrder = async (poolType: PoolType) => {
    const { atomicSwapA, atomicSwapB, chainID, usdc, usdt, bridgeA, bridgeB } =
      await loadFixture(Utils.prepareTest);
    const [maker, taker, makerReceiver, takerReceiver] = accounts;
    const payload = {
      sellToken: {
        token: usdc.address,
        amount: "20",
      },
      buyToken: {
        token: usdt.address,
        amount: "20",
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
    if (poolType == PoolType.INTER_CHAIN) {
      console.log("hello world!");
    }
    const amount = await usdc.allowance(
      accounts[0].address,
      atomicSwapA.address
    );

    expect(
      await usdc.increaseAllowance(
        atomicSwapA.address,
        amount.add(payload.sellToken.amount)
      )
    ).not.to.reverted;

    expect(
      await atomicSwapA.makeSwap(payload, {
        value: estimateFee.nativeFee.mul(11).div(10),
      })
    ).not.to.reverted;

    // check token balance.
    const balanceOfUSDC = await usdc.balanceOf(atomicSwapA.address);
    expect(balanceOfUSDC.toString()).to.equal(payload.sellToken.amount);

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

  const encodePayload = (types: string[], values: any[]): string => {
    return new ethers.utils.AbiCoder().encode(types, values);
  };

  it("deploy test", async () => {
    const { atomicSwapA, atomicSwapB } = await Utils.prepareTest();
    expect(atomicSwapA.address).not.equal(ethers.constants.AddressZero);
    expect(atomicSwapB.address).not.equal(ethers.constants.AddressZero);
  });

  describe("MakeSwap", () => {
    it("create in-chain pool", async () =>
      createDefaultAtomicOrder(PoolType.IN_CHAIN));
    it("create inter-chain pool", async () =>
      createDefaultAtomicOrder(PoolType.INTER_CHAIN));
  });

  describe("TakeSwap", () => {
    const testTakeSwap = async (poolType: PoolType) => {
      const {
        orderID,
        chainID,
        chainA,
        chainB,
        taker,
        usdt,
        bridgeA,
        bridgeB,
      } = await createDefaultAtomicOrder(poolType);

      const payloadBytes = encodePayload(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const bridge = poolType === PoolType.IN_CHAIN ? bridgeA : bridgeB;
      const atomicSwap = poolType === PoolType.IN_CHAIN ? chainA : chainB;
      const estimateFee = await bridge.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      await expect(usdt.connect(taker).approve(atomicSwap.address, 20)).not.to
        .reverted;

      await expect(
        atomicSwap.connect(taker).takeSwap(
          {
            orderID,
            takerReceiver: accounts[1].address,
          },
          {
            value: estimateFee.nativeFee.mul(11).div(10),
          }
        )
      ).not.to.reverted;

      expect((await atomicSwap.swapOrderStatus(orderID)).status).to.equal(4);
      if (poolType === PoolType.INTER_CHAIN) {
        expect((await chainB.swapOrderStatus(orderID)).status).to.equal(4);
      }
    };

    it("success to take pool (in-chain)", async () =>
      testTakeSwap(PoolType.IN_CHAIN));
    it("success to take pool (inter-chain)", async () =>
      testTakeSwap(PoolType.INTER_CHAIN));
  });

  describe("CancelSwap", () => {
    it("happy path", async () => {
      const { orderID, chainID, chainA, chainB, taker, bridgeB, bridgeA } =
        await createDefaultAtomicOrder(PoolType.INTER_CHAIN);
      const cancelSwapMsg = {
        orderID: orderID,
      };

      const encoder = new ethers.utils.AbiCoder();
      const payloadBytes = encoder.encode(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      await expect(
        chainA.cancelSwap(cancelSwapMsg, {
          value: estimateFee.nativeFee.mul(20).div(10),
        })
      ).not.to.reverted;

      const statusAtChainA = await chainA.swapOrderStatus(orderID);
      expect(statusAtChainA.status).to.equal(2);

      const statusAtChainB = await chainB.swapOrderStatus(orderID);
      expect(statusAtChainB.status).to.equal(2);
    });
  });
});
