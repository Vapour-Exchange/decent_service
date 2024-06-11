import dotenv from "dotenv";
import { ChainId } from "@uniswap/sdk-core";
dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  chainJsonRpcUrl: process.env.CHAIN_JSON_RPC_URL,
  walletPrivKey: process.env.WALLET_PRIV_KEY,
  walletAddress: process.env.WALLET_ADDRESS,
  userHeader: "user.wallet",
  chainId: ChainId.BASE,
  networkFees: 0.02,
  platformFees: 0.2,
};

if (
  !config.jwtSecret ||
  !config.chainJsonRpcUrl ||
  !config.walletPrivKey ||
  !config.walletAddress
) {
  throw new Error("Missing required environment variables");
}

export default config;
