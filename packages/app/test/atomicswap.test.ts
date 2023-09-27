import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();
describe("AtomicSwap", () => {
  const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545/");
  const privateKeys = JSON.parse(process.env.PRIVATE_TEST_KEYS!) as string[];
  describe("AtomicSwap", () => {
    it("only ERC20", async () => {
      const testKeys = privateKeys.slice(1, 4);
    });
  });
});
