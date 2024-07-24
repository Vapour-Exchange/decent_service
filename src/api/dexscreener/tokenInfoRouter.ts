import logger from '@/logger';
import axios from 'axios';
import express, { Request, Response, Router } from 'express';

export const tokenInfoRouter: Router = (() => {
  const router = express.Router();

  router.get('/dexscreener/token_info/:chainId/:pairAddress', async (req: Request, res: Response) => {
    const chainId = req.query.chainId;
    const pairAddress = req.query.pairAddress;

    try {
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`);
      console.log('Data fetch Successfully', response.data);
      res.status(200).json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('Error fetching data from DexScreener:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/dexscreener/token_info', async (req: Request, res: Response) => {

    const dexId  = req.query.dexID;
    const symbol =   req.query.symbol; 
    const tokenAddress  = req.query.tokenAddress;

    if (!dexId || !symbol || !tokenAddress) {
      logger.info(`${dexId} - dexId, ${symbol} - symbol, ${tokenAddress} - tokenAddress`)
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);

      let filteredByDex = response.data.pairs.filter((pair) => pair.dexId === dexId);
      let filteredBySymbol = filteredByDex.filter(
        (pair) => pair.baseToken.symbol === symbol || pair.quoteToken.symbol === symbol
      );
      if (filteredBySymbol.length === 0) {
        return res.status(404).json({ success: false, error: 'No pairs found for the given symbol' });
      }
      let data = filteredBySymbol.reduce((max, current) => {
        let currentFdv = current.fdv || 0;
        let maxFdv = max.fdv || 0;
        return currentFdv > maxFdv ? current : max;
      });
      res.status(200).json({ success: true, data: data });
    } catch (error) {
      console.error('Error fetching data from DexScreener:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
})();
