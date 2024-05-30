import {
  AlphaRouter,
  UniswapMulticallProvider,
  SwapType,
} from "@uniswap/smart-order-router";
import { Percent, Token } from "@uniswap/sdk-core";
import { ethers } from "ethers";
import { ERC20_ABI } from "../lib/index.js";
import logger from "../logger.js";

export function getSwapOptions(walletAddress) {
  return {
    recipient: walletAddress,
    slippageTolerance: new Percent(50, 10_000),
    deadline: Math.floor(Date.now() / 1000 + 1800),
    type: SwapType.SWAP_ROUTER_02,
  };
}

export function createTokens(
  chainId,
  inputAddress,
  inputDecimal,
  inputSymbol,
  inputName,
  outputAddress,
  outputDecimal,
  outputSymbol,
  outputName
) {
  const inputToken = new Token(
    chainId,
    inputAddress,
    inputDecimal,
    inputSymbol,
    inputName
  );
  const outputToken = new Token(
    chainId,
    outputAddress,
    outputDecimal,
    outputSymbol,
    outputName
  );

  return { inputToken, outputToken };
}

export function createAmountInWei(amount, decimal) {
  return ethers.utils.parseUnits(amount.toString(), decimal);
}

export function getRouter(chainId, provider) {
  return new AlphaRouter({
    chainId,
    provider,
    multicall2Provider: new UniswapMulticallProvider(chainId, provider),
  });
}

export async function approveToken(wallet, tokenAddress, spender, amount) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const tokenApprovalTx = await tokenContract.approve(
    spender,
    ethers.BigNumber.from(amount.toString())
  );
  const tokenApprovalReceipt = await tokenApprovalTx.wait();

  if (tokenApprovalReceipt.status !== 1) {
    throw new Error("Token approval transaction failed");
  }

  logger.info("Token approved successfully", { txHash: tokenApprovalTx.hash });
}

export async function performSwap(wallet, route) {
  const gasPrice = await wallet.provider.getGasPrice();
  const maxFeePerGas = gasPrice.mul(2);
  const maxPriorityFeePerGas = gasPrice.mul(2);

  const gasEstimate = await wallet.estimateGas({
    to: route.methodParameters.to,
    data: route.methodParameters.calldata,
    value: ethers.BigNumber.from(route.methodParameters.value),
  });

  console.log(gasEstimate);

  const txRes = await wallet.sendTransaction({
    data: route.methodParameters.calldata,
    to: route.methodParameters.to,
    value: ethers.BigNumber.from(route.methodParameters.value),
    from: wallet.address,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasLimit: gasEstimate.mul(2),
  });

  const swapReceipt = await txRes.wait();

  if (swapReceipt.status !== 1) {
    throw new Error("Swap transaction failed");
  }

  logger.info("Swap transaction successful", { txHash: txRes.hash });

  return {
    success: swapReceipt.status !== 1 ? false : true,
    data: { receipt: swapReceipt, transaction: txRes },
  };
}
