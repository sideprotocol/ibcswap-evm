import { ethers } from "hardhat";
import {
  PoolType,
  Utils,
  createDefaultAtomicOrder,
  newAtomicSwapOrderID,
} from "../../utils/utils";
import { BlockTime } from "../../utils/time";
import { expect } from "chai";
import { IAtomicSwap } from "@sideprotocol/contracts-typechain";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AtomicSwap: MakeSwap", () => {
  let accounts: SignerWithAddress[];
  beforeEach(async () => {
    accounts = await ethers.getSigners();
  });

  describe("In-chain", () => {
    it("create in-chain pool with native token", async () => {
      const {
        atomicSwapA,
        atomicSwapB,
        chainID,
        usdc,
        usdt,
        bridgeA,
        bridgeB,
      } = await loadFixture(Utils.prepareTest);
      const accounts = await ethers.getSigners();
      const [maker, taker, makerReceiver, takerReceiver] = accounts;
      const payload = {
        sellToken: {
          token: ethers.constants.AddressZero,
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
        poolType: PoolType.IN_CHAIN,
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
          PoolType.IN_CHAIN,
        ]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      const amount = await usdc.allowance(
        accounts[0].address,
        atomicSwapA.address
      );

      expect(
        await atomicSwapA.makeSwap(payload, {
          value: estimateFee.nativeFee.mul(11).div(10).add(20),
        })
      ).not.to.reverted;

      const lockedAmount = await ethers.provider.getBalance(
        atomicSwapA.address
      );
      expect(lockedAmount.gte(20)).to.equal(true);

      const id = newAtomicSwapOrderID(accounts[0].address, chainID, chainID, 0);
      const orderIDAtContractA = await atomicSwapA.swapOrderID(id);
      expect(orderIDAtContractA.id).to.equal(id);

      const orderIDAtContractB = await atomicSwapB.swapOrderID(id);
      expect(orderIDAtContractB.id).to.equal(ethers.constants.HashZero);
    });
    it("create in-chain pool with ERC20 token", async () =>
      createDefaultAtomicOrder(PoolType.IN_CHAIN));

    it("should revert to create in-chain pool with same token address", async () => {
      const { atomicSwapA, chainID, usdc, bridgeA } = await loadFixture(
        Utils.prepareTest
      );
      const accounts = await ethers.getSigners();
      const [maker, taker, makerReceiver, takerReceiver] = accounts;
      const payload = {
        sellToken: {
          token: usdc.address,
          amount: "20",
        },
        buyToken: {
          token: usdc.address,
          amount: "20",
        },
        makerSender: maker.address,
        makerReceiver: makerReceiver.address,
        desiredTaker: taker.address,
        expireAt: 222,
        dstChainID: chainID,
        poolType: PoolType.IN_CHAIN,
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
          PoolType.IN_CHAIN,
        ]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      const amount = await usdc.allowance(
        accounts[0].address,
        atomicSwapA.address
      );
      await expect(
        atomicSwapA.makeSwap(payload, {
          value: estimateFee.nativeFee.mul(11).div(10),
        })
      ).to.revertedWithCustomError(atomicSwapA, "InvalidTokenPair");
    });
    it("should revert to create in-chain pool with wrong maker", async () => {
      const { atomicSwapA, chainID, usdc, usdt, bridgeA } = await loadFixture(
        Utils.prepareTest
      );
      const accounts = await ethers.getSigners();
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
        makerSender: taker.address,
        makerReceiver: makerReceiver.address,
        desiredTaker: taker.address,
        expireAt: 222,
        dstChainID: chainID,
        poolType: PoolType.IN_CHAIN,
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
          PoolType.IN_CHAIN,
        ]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      const amount = await usdc.allowance(
        accounts[0].address,
        atomicSwapA.address
      );
      await expect(
        atomicSwapA.makeSwap(payload, {
          value: estimateFee.nativeFee.mul(11).div(10),
        })
      ).to.revertedWithCustomError(atomicSwapA, "NotOwnerOfToken");
    });

    it("should revert to create in-chain pool with not allowed amount", async () => {
      const { atomicSwapA, chainID, usdc, usdt, bridgeA } = await loadFixture(
        Utils.prepareTest
      );
      const accounts = await ethers.getSigners();
      const [maker, taker, makerReceiver, takerReceiver] = accounts;
      const payload = {
        sellToken: {
          token: usdc.address,
          amount: "90",
        },
        buyToken: {
          token: usdt.address,
          amount: "20",
        },
        makerSender: taker.address,
        makerReceiver: makerReceiver.address,
        desiredTaker: taker.address,
        expireAt: 222,
        dstChainID: chainID,
        poolType: PoolType.IN_CHAIN,
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
          PoolType.IN_CHAIN,
        ]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );
      await expect(
        atomicSwapA.connect(taker).makeSwap(payload, {
          value: estimateFee.nativeFee.mul(11).div(10),
        })
      ).to.revertedWithCustomError(atomicSwapA, "NotAllowedAmount");
    });

    it("should revert to create in-chain pool with transfer failed", async () => {
      const { atomicSwapA, chainID, usdc, usdt, bridgeA } = await loadFixture(
        Utils.prepareTest
      );
      const accounts = await ethers.getSigners();
      const [maker, taker, makerReceiver, takerReceiver] = accounts;
      const payload = {
        sellToken: {
          token: usdc.address,
          amount: "90",
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
        poolType: PoolType.IN_CHAIN,
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
          PoolType.IN_CHAIN,
        ]
      );

      await usdc.setFailTransferFrom(true);
      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );
      await expect(
        atomicSwapA.makeSwap(payload, {
          value: estimateFee.nativeFee.mul(11).div(10),
        })
      ).to.revertedWith("Failed in Lock token");
    });

    it("should not run cross chain message when poolType is In-chain", async () => {
      const {
        atomicSwapA,
        atomicSwapB,
        chainID,
        usdc,
        usdt,
        bridgeA,
        bridgeB,
      } = await loadFixture(Utils.prepareTest);
      const accounts = await ethers.getSigners();
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
        poolType: PoolType.IN_CHAIN,
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
          PoolType.IN_CHAIN,
        ]
      );

      const estimateFee = await bridgeA.estimateFee(
        chainID,
        false,
        "0x",
        payloadBytes
      );

      const amount = await usdc.allowance(
        accounts[0].address,
        atomicSwapA.address
      );

      expect(
        await usdc.increaseAllowance(
          atomicSwapA.address,
          amount.add(payload.sellToken.amount)
        )
      ).to.emit(atomicSwapA, "AtomicSwapOrderCreated");

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

      const orderIDAtContractB = await atomicSwapB.swapOrderID(id);
      expect(orderIDAtContractB.id).to.equal(ethers.constants.HashZero);
    });
  });

  describe("Inter-chain", () => {
    it("create inter-chain pool", async () =>
      createDefaultAtomicOrder(PoolType.INTER_CHAIN));
  });
});
