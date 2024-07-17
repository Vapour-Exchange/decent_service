import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import express, { Request, Response, Router } from 'express';

import { z } from 'zod';
import config from '@/config';
import { SwapSchema } from '@/api/swap/uniswap/uniswapModel';

import { createApiResponse } from '@/api-docs/openAPIResponseBuilders';
import { handleServiceResponse, validateRequest } from '@/common/utils/httpHandlers';
import logger from '@/logger';
import { getPools, routeSwap, swap } from '@/cron/raydium';

interface QuoteQuery {
  amount: string;
  inputMint: string;
  outputMint: string;
}

export const raydiumRegistry = new OpenAPIRegistry();
raydiumRegistry.register('uniswap', SwapSchema);

export const raydiumRouter: Router = (() => {
  const router = express.Router();

  raydiumRegistry.registerPath({
    method: 'get',
    path: '/raydium/get-pools',
    tags: ['Raydium'],
    request: {},
    responses: createApiResponse(SwapSchema, 'Success'),
  });

  router.get('/get-pools', async (req: Request, res: Response) => {
    logger.info('Request body:', req.body);
    try {
      const pools = await getPools();
      res.status(200).json({
        success: true,
        data: pools.ammPools.length,
      });
    } catch (error: any) {
      logger.error('Error in getting pools process:', error);
      res.status(500).json({ success: false, errors: error.message });
    }
  });

  raydiumRegistry.registerPath({
    method: 'get',
    path: '/raydium/quote',
    tags: ['Raydium'],
    request: {},
    responses: createApiResponse(SwapSchema, 'Success'),
  });

  router.get('/quote', async (req: Request<{}, {}, {}, QuoteQuery>, res: Response<any>) => {
    const { amount, inputMint, outputMint } = req.query;
    try {
      const quote = await routeSwap(amount, inputMint, outputMint);
      res.status(200).json({
        success: true,
        data: quote,
      });
    } catch (error: any) {
      logger.error('Error in getting pools process:', error);
      res.status(500).json({ success: false, errors: error.message });
    }
  });

  raydiumRegistry.registerPath({
    method: 'post',
    path: '/raydium/swap',
    tags: ['Raydium'],
    request: {},
    responses: createApiResponse(SwapSchema, 'Success'),
  });

  router.get('/swap', async (req: Request<{}, {}, {}, QuoteQuery>, res: Response<any>) => {
    const { amount, inputMint, outputMint } = req.query;
    try {
      const quote = await swap(amount, inputMint, outputMint);
      res.status(200).json({
        success: true,
        data: quote,
      });
    } catch (error: any) {
      logger.error('Error in getting pools process:', error);
      res.status(500).json({ success: false, errors: error.message });
    }
  });

  return router;
})();
