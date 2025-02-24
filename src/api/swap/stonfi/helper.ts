import axios from 'axios';
import { WalletContractV4, internal, TonClient, WalletContractV5R1 } from '@ton/ton';
import { Address, toNano, SendMode, beginCell } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import TonWeb from 'tonweb';

const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: process.env.TONAPI_KEY,
});

export async function getJettonBalances(address: any) {
  try {
    const response = await axios.get(`https://tonapi.io/v2/accounts/${address}/jettons`);
    return response.data.balances;
  } catch (error) {
    console.error(`Failed to fetch jetton balances: ${error.message}`);
    throw new Error('Error fetching jetton balances');
  }
}

export async function getTonBalance(walletAddress) {
  const walletBalance = await client.getBalance(walletAddress);
  return (Number(walletBalance.toString()) / 1e9).toFixed(9);
}

export const gasFeeTransfer = async (walletAddress, uuid) => {
  const key = process.env.WALLET_KEY;
  try {
    const mnemonic = key;
    const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
    const workChain = 0;

    const wallet = WalletContractV5R1.create({
      workChain: workChain,
      publicKey: keyPair.publicKey,
    });

    console.log(wallet);
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    console.log('\n\n\n\n\n' + (await contract.getBalance()) + '\n\n\n');
    const params = {
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      messages: [
        internal({
          to: walletAddress,
          value: '0.06',
          body: uuid,
        }),
      ],
    };

    const txn = contract.createTransfer(params);
    const tetherTransferForSend = await contract.sendTransfer(params);

    console.log('A gasless transfer sent!', tetherTransferForSend);
    if (txn) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('An error occurred:', error);

    console.log(error.body);
    if (error instanceof RangeError) {
      console.error('A RangeError occurred:', error);
    }

    return false;
  }
};

async function getUserJettonWalletAddress(userAddress, jettonCoinMasterAddress) {
  const userAddressCell = beginCell().storeAddress(Address.parse(userAddress)).endCell();

  const response = await client.runMethod(Address.parse(jettonCoinMasterAddress), 'get_wallet_address', [
    { type: 'slice', cell: userAddressCell },
  ]);

  const jettonWalletAddress = response.stack.readAddress();
  return jettonWalletAddress;
}

export const createJettonTransferTransaction = async (userWalletAddress, jettonAmount, jettonAddress, uuid) => {
  try {
    const userJettonWalletAddress = await getUserJettonWalletAddress(userWalletAddress, jettonAddress);

    // Create a message to transfer jettons
    const forwardPayload = beginCell()
      .storeUint(0, 32) // 0 opcode means we have a comment
      .storeStringTail(uuid)
      .endCell();

    const body = beginCell()
      .storeUint(0x0f8a7ea5, 32) // opcode for jetton transfer
      .storeUint(0, 64) // query id
      .storeCoins(jettonAmount) // jetton amount, amount * 10^9
      .storeAddress(Address.parse('UQAPo3vlsP2qVJ5_m1hT0NPoxHS10ACL-vT1wsItvLZQIXzD'))
      .storeAddress(Address.parse('UQAPo3vlsP2qVJ5_m1hT0NPoxHS10ACL-vT1wsItvLZQIXzD')) // response destination
      .storeBit(0) // no custom payload
      .storeCoins(toNano('0.02')) // forward amount - if >0, will send notification message
      .storeBit(1) // we store forwardPayload as a reference
      .storeRef(forwardPayload)
      .endCell();

    const unsignedTransaction = {
      to: userJettonWalletAddress.toString(),
      value: toNano('0.05').toString(),
      body: body.toBoc().toString('base64'),
    };

    // Return as JSON
    return {
      unsignedTransaction,
      userWalletAddress,
    };
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  }
};
