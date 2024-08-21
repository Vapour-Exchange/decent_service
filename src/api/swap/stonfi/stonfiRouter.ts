import axios from 'axios';
import express, { Request, Response, Router } from 'express';
import { TonClient, Address, address } from "@ton/ton";
import logger from '@/logger';
import config from '@/config';
import { getJettonBalances, getTonBalance, gasFeeTransfer, createJettonTransferTransaction } from './helper';



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
      const response = await axios.get(`https://testnet.tonapi.io/v2/accounts/${address}/jettons`);
      res.status(200).json({ success: true, data: response.data.balances });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });


  router.post('/swap', async (req: Request, res: Response) => {
    const { walletAddress, tokenAddress, amount } = req.body;

    const claim = []

    if (!walletAddress || !tokenAddress || !amount) {
      res.status(500).json({ success: false, error: 'Missing required field' });
    }

    const userIndex = claim.findIndex(user => user.address === walletAddress);

    if (userIndex !== -1) {
      if (claim[userIndex].limit >= 3) {
        res.status(500).json({ success: false, error: 'Limit reached' });
      } else {
        claim[userIndex].limit += 1;
      }
    } else {
      claim.push({
        address: walletAddress,
        limit: 1
      });
    }
    try {
      // Fetch jetton balances and wallet balance
      const jettonBalances = await getJettonBalances(walletAddress);
      const selectedToken = jettonBalances.find(
        (token) => Address.parse(token.jetton.address).toString() === tokenAddress
      );

      if (!selectedToken) {
        res.status(404).json({ success: false, error: 'Token not found' });

      }

      const balanceInTon = await getTonBalance(walletAddress);

      if (balanceInTon > 0) {
        res.status(500).json({ success: false, error: 'Not Eligible' });
      }
      const gasFeeIsTranferred = await gasFeeTransfer(walletAddress)
      if (gasFeeIsTranferred) {
        const data = await createJettonTransferTransaction(walletAddress, amount, tokenAddress)
        res.status(200).json({ success: true, data: data });
      }


      res.status(500).json({ success: false, error: 'Something went wrong' });


    } catch (error) {
      console.error(`Error in /swap endpoint: ${error.message}`);
      res.status(500).send('Internal server error');
    }
  });

  return router;
})();
