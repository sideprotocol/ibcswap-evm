import { ethers } from "hardhat";
import {
  PoolType,
  createDefaultAtomicOrder,
  encodePayload,
} from "../../utils/utils";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("TakeSwap", () => {
  let accounts: SignerWithAddress[];
  beforeEach(async () => {
    accounts = await ethers.getSigners();
  });
  const testTakeSwap = async (
    poolType: PoolType,
    withNativeToken?: boolean
  ) => {
    const {
      orderID,
      chainID,
      atomicSwapA,
      atomicSwapB,
      taker,
      usdt,
      bridgeA,
      bridgeB,
    } = await createDefaultAtomicOrder(poolType, withNativeToken);

    const payloadBytes = encodePayload(
      ["bytes32", "address", "address"],
      [orderID, taker.address, taker.address]
    );

    const bridge = poolType === PoolType.IN_CHAIN ? bridgeA : bridgeB;
    const atomicSwap =
      poolType === PoolType.IN_CHAIN ? atomicSwapA : atomicSwapB;
    const estimateFee = await bridge.estimateFee(
      chainID,
      false,
      "0x",
      payloadBytes
    );

    const buyToken = await atomicSwap.swapOrderBuyToken(orderID);
    let nativeTokenAmount = estimateFee.nativeFee.mul(11).div(10);

    if (withNativeToken) {
      nativeTokenAmount = nativeTokenAmount.add(buyToken.amount);
    } else {
      await expect(
        usdt.connect(taker).approve(atomicSwap.address, buyToken.amount)
      ).not.to.reverted;
    }

    await expect(
      atomicSwap.connect(taker).takeSwap(
        {
          orderID,
          takerReceiver: accounts[1].address,
        },
        {
          value: nativeTokenAmount,
        }
      )
    ).not.to.reverted;

    expect((await atomicSwap.swapOrderStatus(orderID)).status).to.equal(4);
    if (poolType === PoolType.INTER_CHAIN) {
      expect((await atomicSwapB.swapOrderStatus(orderID)).status).to.equal(4);
    }
    return {
      orderID,
      atomicSwap,
      taker,
    };
  };

  it("should success to take in-chain pool with native token", async () =>
    testTakeSwap(PoolType.IN_CHAIN, true));
  it("should success to take in-chain pool with erc20 token", async () =>
    testTakeSwap(PoolType.IN_CHAIN));
  it("should success to take pool (inter-chain)", async () =>
    testTakeSwap(PoolType.INTER_CHAIN));

  it("should fail when trying to take a non-existent swap", async () => {
    const { orderID, chainID, atomicSwapA, atomicSwapB, taker, usdt, bridgeA, bridgeB } =
      await createDefaultAtomicOrder(PoolType.IN_CHAIN, true);
    const payloadBytes = encodePayload(
      ["bytes32", "address", "address"],
      [orderID, taker.address, taker.address]
    );

    await expect(
      atomicSwapA.connect(taker).takeSwap({
        orderID: ethers.utils.randomBytes(32), // Some random orderID
        takerReceiver: accounts[1].address,
      })
    ).to.be.revertedWithCustomError(atomicSwapB, "NonExistPool");
  });

  it("should fail when trying to take with insufficient Ether", async () => {
    const { orderID, chainID, atomicSwapA, taker, bridgeA } =
      await createDefaultAtomicOrder(PoolType.IN_CHAIN, true);

    const payloadBytes = encodePayload(
      ["bytes32", "address", "address"],
      [orderID, taker.address, taker.address]
    );

    const bridge = bridgeA;
    const atomicSwap = atomicSwapA;
    const estimateFee = await bridge.estimateFee(
      chainID,
      false,
      "0x",
      payloadBytes
    );

    const nativeTokenAmount = estimateFee.nativeFee.mul(11).div(10).add(0);
    await expect(
      atomicSwap.connect(taker).takeSwap(
        {
          orderID,
          takerReceiver: accounts[1].address,
        },
        {
          value: nativeTokenAmount,
        }
      )
    ).to.be.revertedWith("Not enough funds to buy");
  });

  it("should fail when trying to take with insufficient ERC20 allowance", async () => {
    const { orderID, chainID, atomicSwapA, atomicSwapB, taker, usdt, bridgeA, bridgeB } =
      await createDefaultAtomicOrder(PoolType.IN_CHAIN);

    const payloadBytes = encodePayload(
      ["bytes32", "address", "address"],
      [orderID, taker.address, taker.address]
    );

    const bridge = bridgeA;
    const atomicSwap = atomicSwapA;
    const estimateFee = await bridge.estimateFee(
      chainID,
      false,
      "0x",
      payloadBytes
    );

    const nativeTokenAmount = estimateFee.nativeFee.mul(11).div(10);
    await expect(
      atomicSwap.connect(taker).takeSwap(
        {
          orderID,
          takerReceiver: accounts[1].address,
        },
        {
          value: nativeTokenAmount,
        }
      )
    ).to.be.reverted;
  });

  it("should fail when trying to take an already completed swap", async () => {
    // Assuming the swap was taken in previous tests
    const { orderID, taker, atomicSwap } = await testTakeSwap(
      PoolType.IN_CHAIN,
      true
    );
    await expect(
      atomicSwap.connect(taker).takeSwap({
        orderID,
        takerReceiver: accounts[1].address,
      })
    ).to.be.revertedWith("AlreadyCompleted");
  });

  it("should fail when a non-taker tries to take the swap", async () => {
    const { orderID, atomicSwapA } = await createDefaultAtomicOrder(
      PoolType.IN_CHAIN,
      true
    );

    await expect(
      atomicSwapA.connect(accounts[2]).takeSwap({
        orderID,
        takerReceiver: accounts[1].address,
      })
    ).to.be.revertedWith("NoPermissionToTake");
  });
});
