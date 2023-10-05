import { PoolType, createDefaultAtomicOrder } from "../../utils/utils";
import { ethers } from "hardhat";
import { expect } from "chai";
import { randomBytes } from "crypto";
describe("AtomicSwap: CancelSwap", () => {
  it("cancel swap (in-chain)", async () => {
    const { orderID, chainID, chainA, chainB, taker, bridgeB, bridgeA, usdc } =
      await createDefaultAtomicOrder(PoolType.IN_CHAIN);
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

    const operators = await chainA.swapOrderOperators(orderID);
    const sellToken = await chainA.swapOrderSellToken(orderID);
    const amountBeforeCancel = await usdc.balanceOf(operators.maker);

    await expect(
      chainA.cancelSwap(cancelSwapMsg, {
        value: estimateFee.nativeFee.mul(20).div(10),
      })
    ).not.to.reverted;

    const amountAfterCancel = await usdc.balanceOf(operators.maker);
    expect(amountAfterCancel.sub(amountBeforeCancel).toString()).to.be.equal(
      sellToken.amount
    );

    const swapOrderIDAtChainA = await chainA.swapOrderID(orderID);
    expect(swapOrderIDAtChainA.id).to.equal(ethers.constants.HashZero);
  });
  it("cancel swap (inter-chain)", async () => {
    const { orderID, chainID, chainA, chainB, taker, bridgeB, bridgeA, usdc } =
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

    const operators = await chainA.swapOrderOperators(orderID);
    const sellToken = await chainA.swapOrderSellToken(orderID);
    const amountBeforeCancel = await usdc.balanceOf(operators.maker);

    await expect(
      chainA.cancelSwap(cancelSwapMsg, {
        value: estimateFee.nativeFee.mul(20).div(10),
      })
    ).not.to.reverted;

    const amountAfterCancel = await usdc.balanceOf(operators.maker);
    expect(amountAfterCancel.sub(amountBeforeCancel).toString()).to.be.equal(
      sellToken.amount
    );

    const swapOrderIDAtChainA = await chainA.swapOrderID(orderID);
    expect(swapOrderIDAtChainA.id).to.equal(ethers.constants.HashZero);
    const swapOrderIDAtChainB = await chainB.swapOrderID(orderID);
    expect(swapOrderIDAtChainB.id).to.equal(ethers.constants.HashZero);
  });

  it("should revert when sender is not the maker", async () => {
    const { orderID, chainA, taker } = await createDefaultAtomicOrder(
      PoolType.IN_CHAIN
    );
    const cancelSwapMsg = {
      orderID: orderID,
    };

    await expect(
      chainA.connect(taker).cancelSwap(cancelSwapMsg)
    ).to.be.revertedWithCustomError(chainA, "NoPermissionToCancel");
  });

  it("should revert when swap doesn't exist", async () => {
    const { chainA, taker } = await createDefaultAtomicOrder(PoolType.IN_CHAIN);
    const cancelSwapMsg = {
      orderID: randomBytes(32),
    };
    await expect(
      chainA.connect(taker).cancelSwap(cancelSwapMsg)
    ).to.be.revertedWithCustomError(chainA, "NonExistPool");
  });

  it("should unlock ether when sell token is zero address", async () => {
    const { orderID, chainA, maker, payload } = await createDefaultAtomicOrder(
      PoolType.IN_CHAIN,
      true
    );
    const balanceBeforeCancel = await ethers.provider.getBalance(maker.address);
    const tx = await chainA.cancelSwap({ orderID: orderID });
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed;
    const txCost = gasUsed.mul(tx.gasPrice!);

    // Now, instead of expecting the difference in balance to be exactly `payload.sellToken.amount`
    // you'd expect it to be `payload.sellToken.amount - txCost`
    const expectedIncrease = payload.sellToken.amount.sub(txCost);
    const balanceAfterCancel = await ethers.provider.getBalance(maker.address);
    expect(balanceAfterCancel.sub(balanceBeforeCancel).toString()).to.be.equal(
      expectedIncrease.toString()
    );
  });
});
