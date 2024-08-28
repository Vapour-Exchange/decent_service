import axios from 'axios';
import express, { Request, Response, Router } from 'express';
import { TonClient, Address, address } from '@ton/ton';
import logger from '@/logger';
import config from '@/config';
import { getJettonBalances, getTonBalance, gasFeeTransfer, createJettonTransferTransaction } from './helper';
import TonWeb from 'tonweb';

const tonweb = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC'));

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
      const response = await axios.get(`https://tonapi.io/v2/accounts/${address}/jettons`);
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
    const { address } = req.body;

    if (!address) {
      return res.status(400).send('Missing required parameters');
    }
    const responseData = [];
    try {
      for (let j = 0; j < address.length; j++) {
        const transactions = await tonweb.provider.getTransactions(address[j].address, 10);
        for (let i = 0; i < transactions?.length; i++) {
          const transaction = transactions[i];

          const inMessage = transaction?.in_msg.message;
          const outMessages = transaction?.out_msgs || [];

          // Ensure the inMessage exists and contains the expected data
          if (inMessage) {
            responseData.push({
              uuid: address[j].uuid,
              success: true,
              tokenAddress: transaction.address.account_address, // Token contract address
              walletAddress: transaction.in_msg.source && Address.parse(transaction.in_msg.source).toString(), // Incoming wallet address
              outgoingAddresses:
                transaction.in_msg.destination && Address.parse(transaction.in_msg.destination).toString(), // Array of outgoing wallet addresses
              amount: transaction.in_msg.value, // Amount in nanoTONs
              decodeBody: inMessage,
            });
          } else {
            // console.log(`No matching UUID found in transaction.`);
            responseData.push({
              uuid: address[j].uuid,
              success: false,
            });
          }
        }
      }

      return res.status(200).json({ success: true, data: responseData });
    } catch (error) {
      console.error(`Error in /transactions endpoint: ${error.message}`);
      return res.status(500).json({ success: false, data: [] });
    }
  });

  return router;
})();
