import axios from 'axios';
import express, { Request, Response, Router } from 'express';
import logger from '@/logger';
import config from '@/config';



export const stonfiRouter: Router = (() => {
  const router = express.Router();

  router.post('/quote', async (req: Request, res: Response) => {
    const { offer_address, ask_address, units, slippage_tolerance } = req.body;

    if (!offer_address || !ask_address || !units || !slippage_tolerance) {
      res.status(500).json({ success: false, error: 'Missing required field' });
    }

    try {
      const endpoint = `https://api.ston.fi/v1/swap/simulate`;
      const params = {
        offer_address: offer_address,
        ask_address: ask_address,
        units,
        slippage_tolerance: slippage_tolerance,
      };

      const response = await axios.post(endpoint, '', { params, headers: { accept: 'application/json' } });

      res.status(200).json({
        success: true,
        data: {
          price: response.data.swap_rate.toFixed(10),
          min: 1,
          network_fees: config.networkFees,
          platform_fees: config.platformFees,
          slippage: 0.5,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });


  router.get('/tokens/:address', async (req: Request, res: Response) => {
    try {
      const address = req.params.address;
      if (!address) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }
      const response = await axios.get(`https://tonapi.io/v2/accounts/${address}/jettons`);
      res.status(200).json({ success: true, data: response.data.balances });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
})();
