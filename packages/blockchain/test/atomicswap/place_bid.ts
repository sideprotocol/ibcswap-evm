import { ethers } from "hardhat";
import {
  PoolType,
  Utils,
  createDefaultAtomicOrder,
  encodePayload,
  newAtomicSwapOrderID,
} from "../../utils/utils";
import { BlockTime } from "../../utils/time";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("AtomicSwap: PlaceBid", () => {
  let accounts: SignerWithAddress[];
  beforeEach(async () => {
    accounts = await ethers.getSigners();
  });

  describe("In-chain", () => {
    it("should place bid with native token", async () => {
      const { atomicSwapA, atomicSwapB, taker, orderID, chainID, bridgeA } =
        await createDefaultAtomicOrder(PoolType.IN_CHAIN, true, true);
      // try to take swap

      const payloadBytes = encodePayload(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      const buyToken = await atomicSwapA.swapOrderBuyToken(orderID);
      let nativeTokenAmount = estimateFee.nativeFee.mul(11).div(10);
      nativeTokenAmount = nativeTokenAmount.add(buyToken.amount);

      await expect(
        atomicSwapA.connect(taker).takeSwap(
          {
            orderID,
            takerReceiver: accounts[1].address,
          },
          {
            value: nativeTokenAmount,
          }
        )
      ).to.revertedWith("NoPermissionToTake");

      const bidPayload = {
        bidder: taker.address,
        bidAmount: ethers.utils.parseEther("10"),
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes = encodePayload(
        ["uint256", "bytes32", "address", "uint256"],
        [
          bidPayload.bidAmount,
          bidPayload.orderID,
          bidPayload.bidderReceiver,
          bidPayload.expireTimestamp,
        ]
      );
      const estimateBidFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes
      );

      // make bid
      await expect(
        atomicSwapA.connect(taker).placeBid(bidPayload, {
          value: buyToken.amount,
        })
      ).to.changeEtherBalance(atomicSwapA.address, buyToken.amount);
    });

    it("should update bid with more native token than original one", async () => {
      const { atomicSwapA, taker, orderID, chainID, bridgeA } =
        await createDefaultAtomicOrder(PoolType.IN_CHAIN, true, true);
      // try to take swap

      const payloadBytes = encodePayload(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      const buyToken = await atomicSwapA.swapOrderBuyToken(orderID);
      let nativeTokenAmount = estimateFee.nativeFee.mul(11).div(10);
      nativeTokenAmount = nativeTokenAmount.add(buyToken.amount);

      await expect(
        atomicSwapA.connect(taker).takeSwap(
          {
            orderID,
            takerReceiver: accounts[1].address,
          },
          {
            value: nativeTokenAmount,
          }
        )
      ).to.revertedWith("NoPermissionToTake");

      const bidPayload = {
        bidder: taker.address,
        bidAmount: ethers.utils.parseEther("10"),
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes = encodePayload(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          taker.address,
          bidPayload.bidAmount,
          bidPayload.orderID,
          bidPayload.bidderReceiver,
          bidPayload.expireTimestamp,
        ]
      );
      const estimateBidFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes
      );

      const txAmount = estimateBidFee.nativeFee.add(buyToken.amount);
      // make bid
      await expect(
        atomicSwapA.connect(taker).placeBid(bidPayload, {
          value: txAmount,
        })
      ).not.to.reverted;
      const balanceOfAtomicSwap = await ethers.provider.getBalance(
        atomicSwapA.address
      );
      expect(balanceOfAtomicSwap.sub(buyToken.amount)).to.gte(buyToken.amount);

      // Add updates.
      const bidPayload2 = {
        bidder: taker.address,
        bidAmount: ethers.utils.parseEther("50"),
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes2 = encodePayload(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          taker.address,
          bidPayload2.bidAmount,
          bidPayload2.orderID,
          bidPayload2.bidderReceiver,
          bidPayload2.expireTimestamp,
        ]
      );
      const estimateBidFee2 = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes2
      );

      const txAmount2 = estimateBidFee2.nativeFee.add(bidPayload2.bidAmount);
      // make bid
      await expect(
        atomicSwapA.connect(taker).placeBid(bidPayload2, {
          value: txAmount2,
        })
      ).not.to.reverted;
      const balanceOfAtomicSwap2 = await ethers.provider.getBalance(
        atomicSwapA.address
      );
      expect(balanceOfAtomicSwap2).to.gte(bidPayload2.bidAmount);
    });
    it("should place bid with erc20 token", async () => {
      const { atomicSwapA, taker, orderID, chainID, usdt, bridgeA } =
        await createDefaultAtomicOrder(PoolType.IN_CHAIN, false, true);
      // try to take swap
      const payloadBytes = encodePayload(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      const buyToken = await atomicSwapA.swapOrderBuyToken(orderID);
      let nativeTokenAmount = estimateFee.nativeFee.mul(12).div(10);

      await expect(
        atomicSwapA.connect(taker).takeSwap(
          {
            orderID,
            takerReceiver: accounts[1].address,
          },
          {
            value: nativeTokenAmount,
          }
        )
      ).to.revertedWith("NoPermissionToTake");

      const bidPayload = {
        bidder: taker.address,
        bidAmount: buyToken.amount,
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes = encodePayload(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          taker.address,
          bidPayload.bidAmount,
          bidPayload.orderID,
          bidPayload.bidderReceiver,
          bidPayload.expireTimestamp,
        ]
      );
      const estimateBidFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes
      );
      // make bid
      await usdt.connect(taker).approve(atomicSwapA.address, buyToken.amount);

      await expect(
        atomicSwapA.connect(taker).placeBid(bidPayload, {
          value: estimateBidFee.nativeFee,
        })
      ).not.to.reverted;
      const balanceOfAtomicSwap = await usdt.balanceOf(atomicSwapA.address);
      expect(balanceOfAtomicSwap).to.equal(buyToken.amount);
    });
    it("should update bid with more erc20 token than original one", async () => {
      const { atomicSwapA, taker, orderID, chainID, usdt, bridgeA } =
        await createDefaultAtomicOrder(PoolType.IN_CHAIN, false, true);
      // try to take swap

      const payloadBytes = encodePayload(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      const buyToken = await atomicSwapA.swapOrderBuyToken(orderID);
      let nativeTokenAmount = estimateFee.nativeFee.mul(11).div(10);

      await expect(
        atomicSwapA.connect(taker).takeSwap(
          {
            orderID,
            takerReceiver: accounts[1].address,
          },
          {
            value: nativeTokenAmount,
          }
        )
      ).to.revertedWith("NoPermissionToTake");

      const bidPayload = {
        bidder: taker.address,
        bidAmount: buyToken.amount,
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes = encodePayload(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          taker.address,
          bidPayload.bidAmount,
          bidPayload.orderID,
          bidPayload.bidderReceiver,
          bidPayload.expireTimestamp,
        ]
      );
      const estimateBidFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes
      );
      // make bid
      await usdt.connect(taker).approve(atomicSwapA.address, buyToken.amount);

      await expect(
        atomicSwapA.connect(taker).placeBid(bidPayload, {
          value: estimateBidFee.nativeFee,
        })
      ).not.to.reverted;
      const balanceOfAtomicSwap = await usdt.balanceOf(atomicSwapA.address);
      expect(balanceOfAtomicSwap).to.equal(buyToken.amount);

      const bidPayload2 = {
        bidder: taker.address,
        bidAmount: ethers.utils.parseEther("80"),
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes2 = encodePayload(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          taker.address,
          bidPayload2.bidAmount,
          bidPayload2.orderID,
          bidPayload2.bidderReceiver,
          bidPayload2.expireTimestamp,
        ]
      );
      const estimateBid2Fee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes2
      );

      await usdt
        .connect(taker)
        .approve(atomicSwapA.address, bidPayload2.bidAmount);
      await expect(
        atomicSwapA.connect(taker).placeBid(bidPayload2, {
          value: estimateBid2Fee.nativeFee,
        })
      ).not.to.reverted;

      const balanceOfAtomicSwap2 = await usdt.balanceOf(atomicSwapA.address);
      expect(balanceOfAtomicSwap2).to.equal(bidPayload2.bidAmount);
    });
    it("should revert to place bid with not enough native token", async () => {
      const { atomicSwapA, taker, orderID, chainID, bridgeA } =
        await createDefaultAtomicOrder(PoolType.IN_CHAIN, true, true);
      // try to take swap

      const payloadBytes = encodePayload(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      let nativeTokenAmount = estimateFee.nativeFee.mul(11).div(10);
      await expect(
        atomicSwapA.connect(taker).takeSwap(
          {
            orderID,
            takerReceiver: accounts[1].address,
          },
          {
            value: nativeTokenAmount,
          }
        )
      ).to.revertedWith("NoPermissionToTake");

      const bidPayload = {
        bidder: taker.address,
        bidAmount: ethers.utils.parseEther("10"),
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes = encodePayload(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          taker.address,
          bidPayload.bidAmount,
          bidPayload.orderID,
          bidPayload.bidderReceiver,
          bidPayload.expireTimestamp,
        ]
      );
      const estimateBidFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes
      );

      // make bid
      await expect(
        atomicSwapA.connect(taker).placeBid(bidPayload, {
          value: estimateBidFee.nativeFee,
        })
      ).to.revertedWith("Not enough fund to bid");
    });
    it("should revert to place bid with not allowed amount erc20 token", async () => {
      const { atomicSwapA, taker, orderID, chainID, bridgeA, usdt } =
        await createDefaultAtomicOrder(PoolType.IN_CHAIN, false, true);
      // try to take swap
      const buyToken = await atomicSwapA.swapOrderBuyToken(orderID);
      const bidPayload = {
        bidder: taker.address,
        bidAmount: buyToken.amount,
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes = encodePayload(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          taker.address,
          bidPayload.bidAmount,
          bidPayload.orderID,
          bidPayload.bidderReceiver,
          bidPayload.expireTimestamp,
        ]
      );
      const estimateBidFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes
      );
      // make bid

      await expect(
        atomicSwapA.connect(taker).placeBid(bidPayload, {
          value: estimateBidFee.nativeFee,
        })
      ).to.revertedWithCustomError(atomicSwapA, "NotAllowedAmount");
    });
    it("should revert to place bid with not enough erc20 token", async () => {
      const { atomicSwapA, taker, orderID, chainID, bridgeA, usdt } =
        await createDefaultAtomicOrder(PoolType.IN_CHAIN, false, true);
      // try to take swap
      const buyToken = await atomicSwapA.swapOrderBuyToken(orderID);
      const bidPayload = {
        bidder: taker.address,
        bidAmount: buyToken.amount.sub(20),
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes = encodePayload(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          taker.address,
          bidPayload.bidAmount,
          bidPayload.orderID,
          bidPayload.bidderReceiver,
          bidPayload.expireTimestamp,
        ]
      );
      const estimateBidFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes
      );
      // make bid
      await usdt.connect(taker).approve(atomicSwapA.address, buyToken.amount);
      await expect(
        atomicSwapA.connect(taker).placeBid(bidPayload, {
          value: estimateBidFee.nativeFee,
        })
      ).to.revertedWith("Not enough fund to bid");
    });
  });

  describe("Inter-chain", () => {
    it("should place bid with native token", async () => {
      const {
        atomicSwapA,
        atomicSwapB,
        taker,
        orderID,
        chainID,
        usdc,
        usdt,
        bridgeA,
        bridgeB,
      } = await createDefaultAtomicOrder(PoolType.INTER_CHAIN, true, true);
      // try to take swap

      const payloadBytes = encodePayload(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      const buyToken = await atomicSwapA.swapOrderBuyToken(orderID);
      let nativeTokenAmount = estimateFee.nativeFee.mul(12).div(10);
      nativeTokenAmount = nativeTokenAmount.add(buyToken.amount);

      await expect(
        atomicSwapA.connect(taker).takeSwap(
          {
            orderID,
            takerReceiver: accounts[1].address,
          },
          {
            value: nativeTokenAmount,
          }
        )
      ).to.revertedWith("NoPermissionToTake");

      const bidPayload = {
        bidder: taker.address,
        bidAmount: buyToken.amount,
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes = encodePayload(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          taker.address,
          bidPayload.bidAmount,
          bidPayload.orderID,
          bidPayload.bidderReceiver,
          bidPayload.expireTimestamp,
        ]
      );

      const estimateBidFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes
      );

      const txAmount = estimateBidFee.nativeFee
        .mul(11)
        .div(10)
        .add(buyToken.amount);
      // make bid
      await expect(
        atomicSwapB.connect(taker).placeBid(bidPayload, {
          value: txAmount,
        })
      ).to.changeEtherBalance(atomicSwapB.address, buyToken.amount);

      const bidAtA = await atomicSwapA.bids(orderID, taker.address);
      const bidAtB = await atomicSwapB.bids(orderID, taker.address);
      expect(bidAtA).to.deep.equal(bidAtB);
    });
    it("should place bid with erc20 token", async () => {
      const {
        atomicSwapA,
        atomicSwapB,
        taker,
        orderID,
        chainID,
        usdt,
        bridgeA,
      } = await createDefaultAtomicOrder(PoolType.INTER_CHAIN, false, true);
      // try to take swap

      const payloadBytes = encodePayload(
        ["bytes32", "address", "address"],
        [orderID, taker.address, taker.address]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      const buyToken = await atomicSwapA.swapOrderBuyToken(orderID);
      let nativeTokenAmount = estimateFee.nativeFee.mul(11).div(10);

      await usdt.connect(taker).approve(atomicSwapA.address, buyToken.amount);

      await expect(
        atomicSwapA.connect(taker).takeSwap(
          {
            orderID,
            takerReceiver: accounts[1].address,
          },
          {
            value: nativeTokenAmount,
          }
        )
      ).to.revertedWith("NoPermissionToTake");

      const bidPayload = {
        bidder: taker.address,
        bidAmount: buyToken.amount,
        orderID: orderID,
        bidderReceiver: taker.address,
        expireTimestamp: await BlockTime.AfterSeconds(30),
      };

      const bidPayloadBytes = encodePayload(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          taker.address,
          bidPayload.bidAmount,
          bidPayload.orderID,
          bidPayload.bidderReceiver,
          bidPayload.expireTimestamp,
        ]
      );
      const estimateBidFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        bidPayloadBytes
      );

      const txAmount = estimateBidFee.nativeFee
        .mul(11)
        .div(10)
        .add(buyToken.amount);
      // make bid
      await expect(
        atomicSwapA.connect(taker).placeBid(bidPayload, {
          value: txAmount,
        })
      ).to.changeTokenBalance(usdt, atomicSwapA.address, buyToken.amount);

      const bidAtA = await atomicSwapA.bids(orderID, taker.address);
      const bidAtB = await atomicSwapB.bids(orderID, taker.address);
      expect(bidAtA).to.deep.equal(bidAtB);
    });
  });
});
