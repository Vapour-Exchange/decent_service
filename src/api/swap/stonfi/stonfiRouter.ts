import axios from 'axios';
import express, { Request, Response, Router } from 'express';
import { TonClient, Address, address } from '@ton/ton';
import logger from '@/logger';
import config from '@/config';
import { getJettonBalances, getTonBalance, gasFeeTransfer, createJettonTransferTransaction } from './helper';
import TonWeb from 'tonweb';

const tonweb = new TonWeb(new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC'));

const currencyAPI = 'https://api.exchangerate-api.com/v4/latest/USD';

export const stonfiRouter: Router = (() => {
  const router = express.Router();

  router.post('/quote', async (req: Request, res: Response) => {
    const { offer_address, ask_address, units, slippage_tolerance } = req.body;
    if (!offer_address || !ask_address || !units || !slippage_tolerance) {
      return res.status(500).json({ success: false, error: 'Missing required field' });
    }

    try {
      const endpoint = `https://api.ston.fi/v1/swap/simulate`;
      const params = {
        offer_address: Address.parse(offer_address).toString(),
        ask_address: Address.parse(ask_address).toString(),
        units: units,
        slippage_tolerance: slippage_tolerance,
      };

      const response = await axios.post(endpoint, '', { params, headers: { accept: 'application/json' } });
      const usdPrice = response?.data?.swap_rate;

      // Fetch the USD to INR conversion rate
      const currencyResponse = await axios.get(currencyAPI);
      const conversionRate = currencyResponse.data.rates.INR;

      // Convert USD price to INR
      const inrPrice = usdPrice * conversionRate;

      res.status(200).json({
        success: true,
        data: {
          price: Number(response.data.swap_rate).toFixed(10),
          min: 1,
          network_fees: 0.7,
          platform_fees: config.platformFees,
          slippage: 0.5,
          swap_rate: response.data.swap_rate,
        },
      });
    } catch (error) {
      console.log(error);
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

  router.post('/sweep', async (req: Request, res: Response) => {
    const { walletAddress, tokenAddress, amount, uuid } = req.body;

    if (!walletAddress || !tokenAddress || !amount || !uuid) {
      return res.status(400).send('Missing required parameters');
    }

    try {
      const gasFeeTransferStatus = await gasFeeTransfer(walletAddress, uuid);

      console.log(gasFeeTransferStatus, 'gasFeeTransfer');
      if (gasFeeTransferStatus) {
        const data = await createJettonTransferTransaction(walletAddress, amount, tokenAddress, uuid);
        return res.status(200).json({ success: true, data: data });
      }

      return res.status(500).json({ success: false, error: 'Something went wrong' });
    } catch (error) {
      logger.error(`Error in /swap endpoint: ${error.message}`);
      return res.status(500).json({ success: false, error: 'Someting went wrong' });
    }
  });

  router.post('/transactions', async (req: Request, res: Response) => {
    const { transactions } = req.body;

    const poolWallet = 'UQDkkpOBxvbbaTtQUTT25fTR39pqXFtA3BNH5Z7e7Twrc_ik';
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ success: false, message: 'Missing or invalid required parameters' });
    }

    try {
      const responseData = (
        await Promise.all(
          transactions.map(async (addrObj) => {
            try {
              const userTransactions = await tonweb.provider.getTransactions(addrObj.address, 30);
              return userTransactions
                ?.map((transaction) => {
                  const inMessage = transaction?.in_msg.message;
                  const outMessages = transaction?.out_msgs?.[0];

                  if (outMessages && atob(outMessages?.msg_data?.text ?? '') === addrObj.uuid) {
                    return {
                      uuid: addrObj.uuid,
                      success: !!inMessage,
                    };
                  }
                  return null; // Return null if conditions are not met
                })
                .filter((item) => item !== null); // Filter out null values
            } catch (err) {
              console.log(`Error processing address ${addrObj.address}: ${err.message}`);
              return []; // Return an empty array on error to avoid nulls in the final array
            }
          })
        )
      ).flat();
      const flattenedResponseData = responseData.flat().filter((item) => item !== null);

      return res.status(200).json({ success: true, data: flattenedResponseData });
    } catch (error) {
      console.error(`Error in /transactions endpoint: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Someting went wrong' });
    }
  });
  return router;
})();
