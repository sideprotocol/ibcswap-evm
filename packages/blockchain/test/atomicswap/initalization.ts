import { ethers } from "hardhat";
import { Utils, newAtomicSwapOrderID } from "../../utils/utils";
import { BlockTime } from "../../utils/time";
import { expect } from "chai";
import { IAtomicSwap } from "@sideprotocol/contracts-typechain";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AtomicSwap: Initialization", () => {
  let accounts: SignerWithAddress[];
  beforeEach(async () => {
    accounts = await ethers.getSigners();
  });
  it("should correctly initialize AtomicSwap contract", async () => {
    const { atomicSwapA } = await loadFixture(Utils.prepareTest);
    // assert that specific variables or settings are initialized as expected
    // for instance, if there's a owner or admin variable:
    expect(await atomicSwapA.owner()).to.equal(accounts[0].address);
  });
  it("should not allow re-initialization", async () => {
    const { atomicSwapA, chainID, bridgeA } = await loadFixture(
      Utils.prepareTest
    );
    await expect(
      atomicSwapA.initialize(accounts[0].address, chainID, bridgeA.address)
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });
});
