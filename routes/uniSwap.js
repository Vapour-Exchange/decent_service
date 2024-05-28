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
  logger.info("Request body:", req.body);

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

    logger.info(
      `Tokens Created: ,
      ${JSON.stringify(inputToken)},
      ${JSON.stringify(outputToken)}`
    );

    const inputAmountInWei = createAmountInWei(
      tokenInputAmount.toString(),
      tokenInputDecimal
    );

    logger.info(`Input Amount in Wei ${inputAmountInWei}`);

    const wethAmount = CurrencyAmount.fromRawAmount(
      inputToken,
      JSBI.BigInt(inputAmountInWei.toString())
    );
    logger.info(`Input Amount Parsed in Weth ${wethAmount}`);

    const options = getSwapOptions(config.walletAddress);

    logger.info(`Swap Router options ${JSON.stringify(options)}`);

    const alphaRouter = getRouter(config.chainId, provider);

    logger.info(`Aplha Router initialized`);

    const route = await alphaRouter.route(
      wethAmount,
      outputToken,
      TradeType.EXACT_INPUT,
      options
    );

    if (!route) {
      throw new Error("No route found for the swap");
    }

    logger.info(`Route found, ${JSON.stringify(route)}`);
    const swapResponse = await performSwap(wallet, route);
    res.status(200).json(swapResponse);
  } catch (error) {
    logger.error("Error in swap process:", error);
    res.status(500).json({ success: false, error: error });
  }
});

router.post("/approve-max", async (req, res) => {
  logger.info("Request body:", req.body);

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

    logger.info(
      `Tokens Created: ,
      ${JSON.stringify(inputToken)},
      ${JSON.stringify(outputToken)}`
    );

    const inputAmountInWei = createAmountInWei(
      tokenInputAmount.toString(),
      tokenInputDecimal
    );

    logger.info(`Input Amount in Wei ${inputAmountInWei}`);

    const wethAmount = CurrencyAmount.fromRawAmount(
      inputToken,
      JSBI.BigInt(inputAmountInWei.toString())
    );
    logger.info(`Input Amount Parsed in Weth ${wethAmount}`);

    const options = getSwapOptions(config.walletAddress);

    logger.info(`Swap Router options ${JSON.stringify(options)}`);

    const alphaRouter = getRouter(config.chainId, provider);

    logger.info(`Aplha Router initialized`);

    const route = await alphaRouter.route(
      wethAmount,
      outputToken,
      TradeType.EXACT_INPUT,
      options
    );

    if (!route) {
      throw new Error("No route found for the swap");
    }

    logger.info(`Route found, ${JSON.stringify(route)}`);

    await approveToken(
      wallet,
      tokenInputAddress,
      route.methodParameters.to,
      inputAmountInWei
    );

    res.json(route);
  } catch (error) {
    logger.error("Error in swap process:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to execute the swap" });
  }
});

router.get("/quote", async (req, res) => {
  logger.info("Request body:", req.body);

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

    logger.info(
      `Tokens Created: ,
      ${JSON.stringify(inputToken)},
      ${JSON.stringify(outputToken)}`
    );

    const inputAmountInWei = createAmountInWei(
      tokenInputAmount.toString(),
      tokenInputDecimal
    );

    logger.info(`Input Amount in Wei ${inputAmountInWei}`);

    const wethAmount = CurrencyAmount.fromRawAmount(
      inputToken,
      JSBI.BigInt(inputAmountInWei.toString())
    );
    logger.info(`Input Amount Parsed in Weth ${wethAmount}`);

    const options = getSwapOptions(config.walletAddress);

    logger.info(`Swap Router options ${JSON.stringify(options)}`);

    const alphaRouter = getRouter(config.chainId, provider);

    logger.info(`Aplha Router initialized`);

    const route = await alphaRouter.route(
      wethAmount,
      outputToken,
      TradeType.EXACT_INPUT,
      options
    );

    if (!route) {
      throw new Error("No route found for the swap");
    }

    logger.info(`Route found, ${JSON.stringify(route.quote.toFixed(10))}`);

    res
      .status(200)
      .json({ success: true, data: { amount: route.quote.toFixed(10) } });
  } catch (error) {
    logger.error("Error in swap process:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to execute the swap" });
  }
});

export default router;
