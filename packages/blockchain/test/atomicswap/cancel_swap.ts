import { PoolType, createDefaultAtomicOrder } from "../../utils/utils";
import { ethers } from "hardhat";
import { expect } from "chai";
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

    // const statusAtChainB = await chainB.swapOrderStatus(orderID);
    // expect(statusAtChainB.status).to.equal(2);
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
});
