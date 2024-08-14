import axios from 'axios';
import express, { Request, Response, Router } from 'express';

export const walletInfoRouter: Router = (() => {
  const router = express.Router();

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
