import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import express, { Request, Response, Router } from 'express';
import { ethers } from 'ethers';

import { z } from 'zod';
import config from '@/config';
import { SwapSchema } from '@/api/swap/uniswap/uniswapModel';
import {
  getSwapOptions,
  createTokens,
  createAmountInWei,
  getRouter,
  approveToken,
  performSwap,
} from '@/services/swapService/uniswap';
import { createApiResponse } from '@/api-docs/openAPIResponseBuilders';
import { handleServiceResponse, validateRequest } from '@/common/utils/httpHandlers';
import logger from '@/logger';
import JSBI from 'jsbi';
import { CurrencyAmount, TradeType } from '@uniswap/sdk-core';
import { cacheProvider } from '@/services/swapService/cacheProvider';
export const uniswapRegistry = new OpenAPIRegistry();
uniswapRegistry.register('uniswap', SwapSchema);

const provider = new ethers.providers.JsonRpcProvider(config.chainJsonRpcUrl, config.chainId);
const wallet = new ethers.Wallet(config.walletPrivKey, provider);

export const uniswapRouter: Router = (() => {
  const router = express.Router();

  uniswapRegistry.registerPath({
    method: 'post',
    path: '/swap',
    tags: ['Uniswap'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: SwapSchema,
          },
        },
      },
    },
    responses: createApiResponse(SwapSchema, 'Success'),
  });

  router.post('/swap', validateRequest(SwapSchema), async (req: Request, res: Response) => {
    logger.info('Request body:', req.body);
    try {
      const { tokenInput, tokenOutput } = req.body;
      const { inputToken, outputToken } = createTokens(
        config.chainId,
        tokenInput.address,
        tokenInput.decimal,
        tokenInput.symbol,
        tokenInput.name,
        tokenOutput.address,
        tokenOutput.decimal,
        tokenOutput.symbol,
        tokenOutput.name
      );

      logger.info(`Tokens Created: ${JSON.stringify(inputToken)}, ${JSON.stringify(outputToken)}`);

      const inputAmountInWei = createAmountInWei(tokenInput.amount.toString(), tokenInput.decimal);
      logger.info(`Input Amount in Wei: ${inputAmountInWei}`);

      const wethAmount = CurrencyAmount.fromRawAmount(inputToken, JSBI.BigInt(inputAmountInWei.toString()));
      logger.info(`Input Amount Parsed in Weth: ${wethAmount}`);

      const options = getSwapOptions(config.walletAddress);
      logger.info(`Swap Router options: ${JSON.stringify(options)}`);

      const alphaRouter = getRouter(config.chainId, provider);
      logger.info(`Alpha Router initialized`);

      const route = await alphaRouter.route(wethAmount, outputToken, TradeType.EXACT_INPUT, options);

      if (!route) throw new Error('No route found for the swap');

      logger.info(`Route found: ${JSON.stringify(route)}`);
      const swapResponse = await performSwap(wallet, route, tokenOutput.decimal);
      res.status(200).json(swapResponse);
    } catch (error: any) {
      logger.error('Error in swap process:', error);
      res.status(500).json({ success: false, errors: error.message });
    }
  });

  uniswapRegistry.registerPath({
    method: 'post',
    path: '/approve-max',
    tags: ['Uniswap'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: SwapSchema,
          },
        },
      },
    },
    responses: createApiResponse(SwapSchema, 'Success'),
  });

  router.post('/approve-max', validateRequest(SwapSchema), async (req: Request, res: Response) => {
    logger.info('Request body:', req.body);
    try {
      const { tokenInput, tokenOutput } = req.body;
      const { inputToken, outputToken } = createTokens(
        config.chainId,
        tokenInput.address,
        tokenInput.decimal,
        tokenInput.symbol,
        tokenInput.name,
        tokenOutput.address,
        tokenOutput.decimal,
        tokenOutput.symbol,
        tokenOutput.name
      );

      logger.info(`Tokens Created: ${JSON.stringify(inputToken)}, ${JSON.stringify(outputToken)}`);

      const inputAmountInWei = createAmountInWei(tokenInput.amount.toString(), tokenInput.decimal);
      logger.info(`Input Amount in Wei: ${inputAmountInWei}`);

      const wethAmount = CurrencyAmount.fromRawAmount(inputToken, JSBI.BigInt(inputAmountInWei.toString()));
      logger.info(`Input Amount Parsed in Weth: ${wethAmount}`);

      const options = getSwapOptions(config.walletAddress);
      logger.info(`Swap Router options: ${JSON.stringify(options)}`);

      const alphaRouter = getRouter(config.chainId, provider);
      logger.info(`Alpha Router initialized`);

      const route = await alphaRouter.route(wethAmount, outputToken, TradeType.EXACT_INPUT, options);

      if (!route) throw new Error('No route found for the swap');

      logger.info(`Route found: ${JSON.stringify(route)}`);
      await approveToken(wallet, tokenInput.address, route.methodParameters?.to || '', inputAmountInWei);

      res.status(200).json(route);
    } catch (error: any) {
      logger.error('Error in approve process:', error);
      res.status(500).json({ success: false, errors: error.message });
    }
  });

  uniswapRegistry.registerPath({
    method: 'post',
    path: '/quote',
    tags: ['Uniswap'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: SwapSchema,
          },
        },
      },
    },
    responses: createApiResponse(
      z.object({
        success: z.boolean(),
        data: z.object({
          price: z.string(),
          min: z.number(),
          network_fees: z.number(),
          platform_fees: z.number(),
          slippage: z.number(),
        }),
      }),
      'Success'
    ),
  });

  router.post('/quote', validateRequest(SwapSchema), async (req: Request, res: Response) => {
    logger.info('Request body:', req.body);
    try {
      const { tokenInput, tokenOutput } = req.body;
      const { inputToken, outputToken } = createTokens(
        config.chainId,
        tokenInput.address,
        tokenInput.decimal,
        tokenInput.symbol,
        tokenInput.name,
        tokenOutput.address,
        tokenOutput.decimal,
        tokenOutput.symbol,
        tokenOutput.name
      );

      logger.info(`Tokens Created: ${JSON.stringify(inputToken)}, ${JSON.stringify(outputToken)}`);

      const inputAmountInWei = createAmountInWei(tokenInput.amount.toString(), tokenInput.decimal);
      logger.info(`Input Amount in Wei: ${inputAmountInWei}`);

      const wethAmount = CurrencyAmount.fromRawAmount(inputToken, JSBI.BigInt(inputAmountInWei.toString()));
      logger.info(`Input Amount Parsed in Weth: ${wethAmount}`);

      const options = getSwapOptions(config.walletAddress);
      logger.info(`Swap Router options: ${JSON.stringify(options)}`);

      const alphaRouter = getRouter(config.chainId, provider);
      logger.info(`Alpha Router initialized`);

      const route = await alphaRouter.route(wethAmount, outputToken, TradeType.EXACT_INPUT, options);

      if (!route) throw new Error('No route found for the swap');

      logger.info(`Route found: ${JSON.stringify(route.quote.toFixed(10))}`);
      res.status(200).json({
        success: true,
        data: {
          price: route.quote.toFixed(10),
          min: 1,
          network_fees: config.networkFees,
          platform_fees: config.platformFees,
          slippage: 0.5,
        },
      });
    } catch (error: any) {
      logger.error('Error in quote process:', error);
      res.status(500).json({ success: false, errors: error.message });
    }
  });

  return router;
})();
