import express from "express";
import { ethers } from "ethers";
import {
  ChainId,
  CurrencyAmount,
  Percent,
  Token,
  TradeType,
} from "@uniswap/sdk-core";
import JSBI from "jsbi";
import config from "../config.js";
import logger from "../logger.js";
import {
  getSwapOptions,
  createTokens,
  createAmountInWei,
  getRouter,
  approveToken,
  performSwap,
} from "../services/swapService.js";

const router = express.Router();
const provider = new ethers.providers.JsonRpcProvider(
  config.chainJsonRpcUrl,
  config.chainId
);
const wallet = new ethers.Wallet(config.walletPrivKey, provider);

router.post("/swap", async (req, res) => {
  logger.debug("Request body:", req.body);

  try {
    const {
      tokenInput: {
        address: tokenInputAddress,
        decimal: tokenInputDecimal,
        symbol: tokenInputSymbol,
        name: tokenInputName,
        amount: tokenInputAmount,
      },
      tokenOutput: {
        address: tokenOutputAddress,
        decimal: tokenOutputDecimal,
        symbol: tokenOutputSymbol,
        name: tokenOutputName,
      },
    } = req.body;

    const { inputToken, outputToken } = createTokens(
      config.chainId,
      tokenInputAddress,
      tokenInputDecimal,
      tokenInputSymbol,
      tokenInputName,
      tokenOutputAddress,
      tokenOutputDecimal,
      tokenOutputSymbol,
      tokenOutputName
    );
    const inputAmountInWei = createAmountInWei(
      tokenInputAmount,
      tokenInputDecimal
    );
    const wethAmount = CurrencyAmount.fromRawAmount(
      inputToken,
      JSBI.BigInt(inputAmountInWei.toString())
    );
    const options = getSwapOptions(config.walletAddress);

    const alphaRouter = getRouter(config.chainId, provider);
    const route = await alphaRouter.route(
      wethAmount,
      outputToken,
      TradeType.EXACT_INPUT,
      options
    );

    if (!route) {
      throw new Error("No route found for the swap");
    }

    await approveToken(
      wallet,
      tokenInputAddress,
      route.methodParameters.to,
      inputAmountInWei
    );
    await performSwap(wallet, route);

    res.json({});
  } catch (error) {
    logger.error("Error in swap process:", error);
    res.status(500).json({ error: "Failed to execute the swap" });
  }
});

export default router;
