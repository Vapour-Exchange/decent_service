import { AlphaRouter, UniswapMulticallProvider, SwapType, OnChainQuoteProvider } from '@uniswap/smart-order-router';
import { Percent, Token } from '@uniswap/sdk-core';
import { ethers, Wallet, providers, BigNumber } from 'ethers';
import { ERC20_ABI } from '@/lib/erc20Abi';
import logger from '@/logger';
import { cacheProvider } from '@/services/swapService/cacheProvider';

export const MAX_FEE_PER_GAS = 100000000000;
export const MAX_PRIORITY_FEE_PER_GAS = 100000000000;

interface SwapOptions {
  recipient: string;
  slippageTolerance: Percent;
  deadline: number;
  type: SwapType;
}

interface Tokens {
  inputToken: Token;
  outputToken: Token;
}

export function getSwapOptions(walletAddress: string): SwapOptions {
  return {
    recipient: walletAddress,
    slippageTolerance: new Percent(100, 10_000),
    deadline: Math.floor(Date.now() / 1000 + 1800),
    type: SwapType.UNIVERSAL_ROUTER,
  };
}

export function createTokens(
  chainId: number,
  inputAddress: string,
  inputDecimal: number,
  inputSymbol: string,
  inputName: string,
  outputAddress: string,
  outputDecimal: number,
  outputSymbol: string,
  outputName: string
): Tokens {
  const inputToken = new Token(chainId, inputAddress, inputDecimal, inputSymbol, inputName);
  const outputToken = new Token(chainId, outputAddress, outputDecimal, outputSymbol, outputName);

  return { inputToken, outputToken };
}

export function createAmountInWei(amount: number | string, decimal: number): ethers.BigNumber {
  return ethers.utils.parseUnits(amount.toString(), decimal);
}

export function getRouter(chainId: number, provider: providers.BaseProvider): AlphaRouter {
  const multicall2Provider = new UniswapMulticallProvider(chainId, provider);
  return new AlphaRouter({
    chainId,
    provider,
    multicall2Provider: multicall2Provider,
    // routeCachingProvider: cacheProvider,
    onChainQuoteProvider: new OnChainQuoteProvider(
      chainId,
      provider,
      multicall2Provider,
      {
        retries: 2,
        minTimeout: 100,
        maxTimeout: 1000,
      },
      () => {
        return {
          multicallChunk: 210,
          gasLimitPerCall: 705_000,
          quoteMinSuccessRate: 0.15,
        };
      },
      {
        gasLimitOverride: 2_000_000,
        multicallChunk: 70,
      }
    ),
  });
}

function removeLeadingZeros(address: string): string {
  const strippedAddress = address.startsWith('0x') ? address.slice(2) : address;
  const nonZeroIndex = strippedAddress.search(/[1-9a-f]/);
  const response = '0x' + strippedAddress.slice(nonZeroIndex);
  return response.toLowerCase();
}

function getAmountFromTransaction(receipt: ethers.providers.TransactionReceipt, decimals: number): number {
  const logs = receipt.logs;
  const wallet = ethers.utils.getAddress(receipt.from).toLowerCase();
  const router = ethers.utils.getAddress(receipt.to).toLowerCase();

  const amountLog = logs.find((log: any) => {
    return (
      log.topics[0] == '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' &&
      removeLeadingZeros(log.topics[2]) == wallet &&
      removeLeadingZeros(log.topics[1]) != router
    );
  });

  if (amountLog) {
    const amountInBigNumber = ethers.BigNumber.from(amountLog.data);
    const formattedAmount = ethers.utils.formatUnits(amountInBigNumber, decimals);
    return parseFloat(formattedAmount);
  } else {
    console.log('No relevant log found');
    return 0;
  }
}

export async function approveToken(
  wallet: Wallet,
  tokenAddress: string,
  spender: string,
  amount: BigNumber
): Promise<void> {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const gasLimit = 100000;
  const tokenApprovalTx = await tokenContract.approve(spender, ethers.BigNumber.from(amount.toString()), {
    gasLimit: ethers.BigNumber.from(gasLimit.toString()),
  });
  const tokenApprovalReceipt = await tokenApprovalTx.wait();

  if (tokenApprovalReceipt.status !== 1) {
    throw new Error('Token approval transaction failed');
  }

  logger.info('Token approved successfully', { txHash: tokenApprovalTx.hash });
}

export async function performSwap(
  wallet: Wallet,
  route: any,
  decimals: number
): Promise<{ success: boolean; data: any }> {
  const gasPrice = await wallet.provider.getGasPrice();
  const maxFeePerGas = gasPrice.mul(120).div(100);
  const maxPriorityFeePerGas = gasPrice.mul(120).div(100);
  let gasLimit: any = ethers.utils.hexlify(2000000);

  try {
    gasLimit = await wallet.estimateGas({
      to: route.methodParameters.to,
      data: route.methodParameters.calldata,
      value: ethers.BigNumber.from(route.methodParameters.value),
    });
  } catch (error) {
    console.log('Estimate gas error', error);
  }

  const txRes = await wallet.sendTransaction({
    data: route.methodParameters.calldata,
    to: route.methodParameters.to,
    value: ethers.BigNumber.from(route.methodParameters.value),
    from: wallet.address,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasLimit: gasLimit,
  });

  const swapReceipt = await txRes.wait();
  let amount = 0;

  if (swapReceipt.status === 1) {
    amount = getAmountFromTransaction(swapReceipt, decimals);
  }

  logger.info('Swap transaction successful', { txHash: txRes.hash });

  return {
    success: swapReceipt.status !== 1 ? false : true,
    data: { receipt: swapReceipt, transaction: txRes, amount: amount },
  };
}
