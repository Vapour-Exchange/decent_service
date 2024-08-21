import axios from 'axios';
import { WalletContractV4, internal, TonClient } from "@ton/ton";
import { Address, toNano, SendMode ,beginCell} from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";


const client = new TonClient({
    endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONAPI_KEY,
  });


export async function getJettonBalances(address: any) {
  try {
    const response = await axios.get(`https://testnet.tonapi.io/v2/accounts/${address}/jettons`);
    return response.data.balances;
  } catch (error) {
    console.error(`Failed to fetch jetton balances: ${error.message}`);
    throw new Error('Error fetching jetton balances');
  }
}

export async function getTonBalance ( walletAddress ){
  const walletBalance = await client.getBalance(walletAddress);
  return (Number(walletBalance.toString()) / 1e9).toFixed(9);
} 

export const gasFeeTransfer = async (walletAddress) => {;
    const key=process.env.WALLET_KEY
    try {
      const mnemonic =key
      const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
      const workChain = 0;
  
      const wallet = WalletContractV4.create({
        workchain: workChain,
        publicKey: keyPair.publicKey,
      });
  
      const contract = client.open(wallet);
      const seqno = await contract.getSeqno();
  
      const params = {
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
          internal({
            to: walletAddress,
            value: "0.06",
            body: "Example transfer body",
          }),
        ],
      };
  
      const txn = contract.createTransfer(params);
      const tetherTransferForSend = await contract.sendTransfer(params);
  
      console.log("A gasless transfer sent!", tetherTransferForSend);
      if(txn){
        return true
      }
      return false
    } catch (error) {
      console.error("An error occurred:", error);
     
      console.log(error.body);
      if (error instanceof RangeError) {
        console.error("A RangeError occurred:", error);
      }
    }
  };

  
  export const createJettonTransferTransaction = async (
    userWalletAddress,
    jettonAmount,
    jettonMasterAddress
  ) => {
    try {
      // Create a message to transfer jettons
      const forwardPayload = beginCell()
          .storeUint(0, 32) // 0 opcode means we have a comment
          .storeStringTail('Hello, TON!')
          .endCell();
  
      const jettonTransferMessage = {
        to: Address.parse(jettonMasterAddress), // Jetton master contract address
        value: toNano("0.05"), // Attach some TON for gas fees
        body: beginCell()
        .storeUint(0x0f8a7ea5, 32) // opcode for jetton transfer
        .storeUint(0, 64) // query id
        .storeCoins(toNano(jettonAmount)) // jetton amount, amount * 10^9
        .storeAddress(Address.parse("UQDkkpOBxvbbaTtQUTT25fTR39pqXFtA3BNH5Z7e7Twrc_ik"))
        .storeAddress(Address.parse(userWalletAddress)) // response destination
        .storeBit(0) // no custom payload
        .storeCoins(toNano('0.05')) // forward amount - if >0, will send notification message
        .storeBit(1) // we store forwardPayload as a reference
        .storeRef(forwardPayload)
        .endCell()
  
      };
      
      // Create an unsigned transaction
      const unsignedTransaction = {
        to: jettonMasterAddress,
        value: toNano("0.05"),
        body: jettonTransferMessage.body,
      };
      const responseData = {
        to: unsignedTransaction.to.toString(), // Convert Address to string
        value: unsignedTransaction.value.toString(), // Convert BigInt to string
        body: unsignedTransaction.body.toBoc().toString('base64'), // Convert Cell to base64 string
      };
  
      // Return as JSON
      return JSON.stringify(responseData);
    } catch (error) {
      console.error("An error occurred:", error);
      throw error; 
    }
  };
