import axios from 'axios';
import express, { Request, Response, Router } from 'express';

export const decentRouter: Router = (() => {
  const router = express.Router();

  router.get('/dexscreener/token_info/:chainId/:pairAddress', async (req: Request, res: Response) => {
    const chainId = req.params.chainId;
    const pairAddress = req.params.pairAddress;

    try {
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`);
      console.log('Data fetch Successfully', response.data);
      res.status(200).json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('Error fetching data from DexScreener:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/dexscreener/token_info/:tokenAddreses', async (req: Request, res: Response) => {
    const tokenAddreses = req.params.tokenAddreses;

    try {
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddreses}`);
      console.log('Data fetch Successfully', response.data);
      res.status(200).json({ success: false, data: response.data });
    } catch (error: any) {
      console.error('Error fetching data from DexScreener:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
})();
