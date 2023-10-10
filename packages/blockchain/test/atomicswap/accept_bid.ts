import { ethers } from "hardhat";
import {
  PoolType,
  bidToDefaultAtomicOrder,
  encodePayload,
} from "../../utils/utils";
import { expect } from "chai";

describe("AtomicSwap: AcceptBid", () => {
  describe("In-chain", () => {
    it("should accept bid with native token", async () => {
      const {
        atomicSwapA,
        maker,
        makerReceiver,
        orderID,
        bidAmount,
        bidder,
        bidderReceiver,
        payload,
      } = await bidToDefaultAtomicOrder(PoolType.IN_CHAIN, true, true);

      await expect(
        atomicSwapA.connect(maker).acceptBid(orderID, bidder)
      ).to.changeEtherBalances(
        [makerReceiver, bidderReceiver],
        [bidAmount, payload.sellToken.amount]
      );
    });
    it("should accept bid with erc20 token", async () => {
      const {
        atomicSwapA,
        maker,
        makerReceiver,
        orderID,
        usdc,
        usdt,
        bidAmount,
        bidder,
        bidderReceiver,
        payload,
      } = await bidToDefaultAtomicOrder(PoolType.IN_CHAIN, false, true);

      const balanceBeforeAcceptOfBidder = await usdc.balanceOf(bidderReceiver);

      await expect(
        atomicSwapA.connect(maker).acceptBid(orderID, bidder)
      ).to.changeTokenBalance(usdt, makerReceiver, bidAmount);

      const balanceAfterAcceptOfBidder = await usdc.balanceOf(bidderReceiver);

      expect(
        balanceAfterAcceptOfBidder.sub(balanceBeforeAcceptOfBidder)
      ).to.equal(payload.sellToken.amount);
    });
    it("should revert to accept bid by not maker", async () => {
      const { atomicSwapA, taker, orderID, bidder } =
        await bidToDefaultAtomicOrder(PoolType.IN_CHAIN, true, true);

      await expect(
        atomicSwapA.connect(taker).acceptBid(orderID, bidder)
      ).to.revertedWithCustomError(atomicSwapA, "NoPermissionToAccept");
    });
    it("should revert to accept bid with already took bid", async () => {
      const {
        atomicSwapA,
        atomicSwapB,
        maker,
        makerReceiver,
        taker,
        orderID,
        chainID,
        usdc,
        usdt,
        bridgeA,
        bridgeB,
        bidAmount,
        bidder,
        bidderReceiver,
        payload,
      } = await bidToDefaultAtomicOrder(PoolType.IN_CHAIN, true, true);

      const balanceBeforeAcceptOfMaker = await ethers.provider.getBalance(
        makerReceiver.address
      );
      const balanceBeforeAcceptOfBidder = await ethers.provider.getBalance(
        bidderReceiver
      );

      await expect(atomicSwapA.connect(maker).acceptBid(orderID, bidder)).not.to
        .reverted;

      // check balance after accept bid
      const balanceAfterAcceptOfMaker = await ethers.provider.getBalance(
        makerReceiver.address
      );
      expect(
        balanceAfterAcceptOfMaker.sub(balanceBeforeAcceptOfMaker)
      ).to.equal(bidAmount);

      const balanceAfterAcceptOfBidder = await ethers.provider.getBalance(
        bidderReceiver
      );

      expect(
        balanceAfterAcceptOfBidder.sub(balanceBeforeAcceptOfBidder)
      ).to.equal(payload.sellToken.amount);

      await expect(
        atomicSwapA.connect(maker).acceptBid(orderID, bidder)
      ).to.revertedWithCustomError(atomicSwapA, "NoPlaceStatusOfBid");
    });
  });

  describe("Inter-chain", () => {
    it("should accept bid with native token", async () => {
      const {
        atomicSwapA,
        bridgeA,
        maker,
        makerReceiver,
        chainID,
        orderID,
        bidAmount,
        bidder,
        bidderReceiver,
        payload,
      } = await bidToDefaultAtomicOrder(PoolType.INTER_CHAIN, true, true);

      const balanceBeforeAcceptOfMaker = await ethers.provider.getBalance(
        makerReceiver.address
      );
      const balanceBeforeAcceptOfBidder = await ethers.provider.getBalance(
        bidderReceiver
      );
      const acceptPayloadBytes = encodePayload(
        ["bytes32", "address"],
        [orderID, bidder]
      );
      const fee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        acceptPayloadBytes
      );

      await expect(
        atomicSwapA.connect(maker).acceptBid(orderID, bidder, {
          value: fee.nativeFee.mul(20).div(10),
        })
      ).to.be.changeEtherBalance(makerReceiver.address, bidAmount);

      // check balance after accept bid
      const balanceAfterAcceptOfBidder = await ethers.provider.getBalance(
        bidderReceiver
      );
      expect(
        balanceAfterAcceptOfBidder.sub(balanceBeforeAcceptOfBidder)
      ).to.equal(payload.sellToken.amount);

      const balanceAfterAcceptOfMaker = await ethers.provider.getBalance(
        makerReceiver.address
      );
      expect(
        balanceAfterAcceptOfMaker.sub(balanceBeforeAcceptOfMaker)
      ).to.equal(bidAmount);
    });
    it("should accept bid with erc20 token", async () => {
      const {
        atomicSwapA,
        bridgeA,
        chainID,
        maker,
        makerReceiver,
        orderID,
        usdc,
        usdt,
        bidAmount,
        bidder,
        bidderReceiver,
        payload,
      } = await bidToDefaultAtomicOrder(PoolType.INTER_CHAIN, false, true);

      const balanceBeforeAcceptOfMaker = await usdt.balanceOf(
        makerReceiver.address
      );
      const balanceBeforeAcceptOfBidder = await usdc.balanceOf(bidderReceiver);

      const acceptPayloadBytes = encodePayload(
        ["bytes32", "address"],
        [orderID, bidder]
      );
      const fee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        acceptPayloadBytes
      );

      await expect(
        atomicSwapA.connect(maker).acceptBid(orderID, bidder, {
          value: fee.nativeFee.mul(11).div(10),
        })
      ).to.be.changeTokenBalance(usdt, makerReceiver.address, bidAmount);

      // check balance after accept bid
      const balanceAfterAcceptOfMaker = await usdt.balanceOf(
        makerReceiver.address
      );
      expect(
        balanceAfterAcceptOfMaker.sub(balanceBeforeAcceptOfMaker)
      ).to.equal(bidAmount);

      const balanceAfterAcceptOfBidder = await usdc.balanceOf(bidderReceiver);
      expect(
        balanceAfterAcceptOfBidder.sub(balanceBeforeAcceptOfBidder)
      ).to.equal(payload.sellToken.amount);
    });
  });
});
