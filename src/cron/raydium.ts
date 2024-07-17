import { Raydium, ReturnTypeGetAllRoute, TxVersion, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2';
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import config from '../config';

import {
  WSOLMint,
  RAYMint,
  USDCMint,
  toFeeConfig,
  toApiV3Token,
  Router,
  TokenAmount,
  Token,
  DEVNET_PROGRAM_ID,
  printSimulate,
} from '@raydium-io/raydium-sdk-v2';
import { NATIVE_MINT } from '@solana/spl-token';
import { cacheRoutes, readCachePoolData, readCachedRoutes, writeCachePoolData } from '../cache/utils';
import logger from '@/logger';

export const owner = Keypair.fromSecretKey(bs58.decode(config.solPoolWallet));
export const connection = new Connection(config.solRpcUrl);
export const txVersion = TxVersion.V0;
const cluster = 'mainnet';

let raydium: Raydium;
export const initSdk = async (params?: any): Promise<Raydium> => {
  if (raydium) return raydium;

  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`);
  raydium = await Raydium.load({
    owner,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
  });

  console.log('raydium sdk loaded');
  return raydium;
};

export const fetchTokenAccountData = async () => {
  const solAccountResp = await connection.getAccountInfo(owner.publicKey);
  const tokenAccountResp = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_PROGRAM_ID });
  const token2022Req = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_2022_PROGRAM_ID });
  const tokenAccountData = parseTokenAccountResp({
    owner: owner.publicKey,
    solAccountResp,
    tokenAccountResp: {
      context: tokenAccountResp.context,
      value: [...tokenAccountResp.value, ...token2022Req.value],
    },
  });
  return tokenAccountData;
};

const poolType = {
  4: 'AMM',
  5: 'AMM Stable',
  6: 'CLMM',
  7: 'CPMM',
};

const logTime = () => {
  var currentdate = new Date();

  return (
    currentdate.getDate() +
    '/' +
    (currentdate.getMonth() + 1) +
    '/' +
    currentdate.getFullYear() +
    ' @ ' +
    currentdate.getHours() +
    ':' +
    currentdate.getMinutes() +
    ':' +
    currentdate.getSeconds()
  );
};
export const getPools = async () => {
  let poolData = await readCachePoolData(1000 * 60 * 30);

  logger.info(`POOL INFO ${poolData?.ammPools?.length}`);
  if (poolData?.ammPools?.length > 0) {
    return poolData;
  }
  logger.warn('pool data cache not found, fetching pool data');

  logger.info('fetching pool data');
  const raydium = await initSdk();
  logger.info('sdk initialized', logTime());
  await raydium.fetchChainTime();
  logger.info('chain time fetched', logTime());

  poolData = await raydium.tradeV2.fetchRoutePoolBasicInfo();
  logger.info('pool data fetched', logTime());
  await writeCachePoolData(poolData);

  logger.info('cache pool data', logTime());

  return poolData;
};

// Function to fetch Solana fee information using fetch
async function fetchSolanaFeeInfo() {
  try {
    const response = await fetch('https://solanacompass.com/api/fees', { cache: 'no-store' });
    if (!response.ok) {
      console.error('Failed to fetch Solana fee info');
      return undefined;
    }
    const json = await response.json();
    const { avg } = json?.[15] ?? {};
    if (!avg) return undefined; // fetch error
    return {
      units: 600000,
      microLamports: Math.min(Math.ceil((avg * 1000000) / 600000), 250000),
    };
  } catch (error) {
    console.error('Error fetching Solana fee info:', error);
    return undefined;
  }
}

export async function routeSwap(amount: any, inToken: string, outToken: string) {
  amount = Number(amount) * 1000000;

  const raydium = await initSdk();
  await raydium.fetchChainTime();

  const [inputMint, outputMint] = [new PublicKey(inToken), new PublicKey(outToken)];
  const [inputMintStr, outputMintStr] = [inputMint.toBase58(), outputMint.toBase58()];

  let routes = await readCachedRoutes(inputMint, outputMint);
  if (!routes) {
    let poolData = await readCachePoolData(1000 * 60 * 90);
    if (poolData?.ammPools.length === 0) {
      console.log('fetching all pool basic info, this might take a while (more than 30 seconds)..');
      poolData = await raydium.tradeV2.fetchRoutePoolBasicInfo();

      writeCachePoolData(poolData);
    }

    console.log(poolData);

    console.log('computing swap route..');

    routes = raydium.tradeV2.getAllRoute({
      inputMint,
      outputMint,
      ...poolData,
    });

    await cacheRoutes(inputMint, outputMint, routes as ReturnTypeGetAllRoute);
  }

  const {
    routePathDict,
    mintInfos,
    ammPoolsRpcInfo,
    ammSimulateCache,

    clmmPoolsRpcInfo,
    computeClmmPoolInfo,
    computePoolTickData,

    computeCpmmData,
  } = await raydium.tradeV2.fetchSwapRoutesData({
    routes,
    inputMint,
    outputMint,
  });

  console.log('calculating available swap routes...');
  const swapRoutes = raydium.tradeV2.getAllRouteComputeAmountOut({
    inputTokenAmount: new TokenAmount(
      new Token({
        mint: inputMintStr,
        decimals: mintInfos[inputMintStr].decimals,
        isToken2022: mintInfos[inputMintStr].programId.equals(TOKEN_2022_PROGRAM_ID),
      }),
      amount
    ),
    directPath: (routes as ReturnTypeGetAllRoute).directPath.map(
      (p: any) =>
        ammSimulateCache[p.id.toBase58()] || computeClmmPoolInfo[p.id.toBase58()] || computeCpmmData[p.id.toBase58()]
    ),
    routePathDict,
    simulateCache: ammSimulateCache,
    tickCache: computePoolTickData,
    mintInfos: mintInfos,
    outputToken: toApiV3Token({
      ...mintInfos[outputMintStr],
      programId: mintInfos[outputMintStr].programId.toBase58(),
      address: outputMintStr,
      extensions: {
        feeConfig: toFeeConfig(mintInfos[outputMintStr].feeConfig),
      },
    }),
    chainTime: Math.floor(raydium.chainTimeData?.chainTime ?? Date.now() / 1000),
    slippage: 0.15,
    epochInfo: await raydium.connection.getEpochInfo(),
  });

  // swapRoutes are sorted by out amount, so first one should be the best route
  const targetRoute = swapRoutes[0];
  if (!targetRoute) throw new Error('no swap routes were found');

  console.log('target swap route:', targetRoute);
  console.log('best swap route:', {
    input: targetRoute.amountIn.amount.toExact(),
    output: targetRoute.amountOut.amount.toExact(),
    minimumOut: targetRoute.minAmountOut.amount.toExact(),
    swapType: targetRoute.routeType,
  });

  return {
    min: targetRoute.amountIn.amount.toExact(),
    price: targetRoute.amountOut.amount.toExact(),
    network_fees: 0.02,
    platform_fees: 0.2,
    slippage: 0.5,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getTransactionDetails = async (txId: string, outputMint: string) => {
  let tes;
  let triesGetTrans = 0;
  while (!tes && triesGetTrans < 30) {
    try {
      if (triesGetTrans !== 0) await sleep(10000);
      triesGetTrans++;
      tes = await connection.getTransaction(txId, { maxSupportedTransactionVersion: 2 });
    } catch (e) {
      console.log('Err getTransaction', txId);
    }
  }
  if (!tes) throw new Error('Transaction not found');

  // Find the token transfer instructions for the specific outputMint
  let recieved = 0;
  if (tes && tes.meta && tes.meta.preTokenBalances && tes.meta.postTokenBalances) {
    const preTokenBalance = tes.meta.preTokenBalances.find((balance) => balance.mint === outputMint);
    const postTokenBalance = tes.meta.postTokenBalances.find((balance) => balance.mint === outputMint);

    console.log('preTokenBalance:', preTokenBalance, 'postTokenBalance:', postTokenBalance);
    if (preTokenBalance && postTokenBalance) {
      recieved = (postTokenBalance.uiTokenAmount.uiAmount || 0) - (preTokenBalance.uiTokenAmount.uiAmount || 0);
    }
  }

  // Calculate the total amount received
  return recieved;
};

export async function swap(amount: any, inToken: string, outToken: string) {
  amount = Number(amount) * 1000000;

  const raydium = await initSdk();
  await raydium.fetchChainTime();

  const [inputMint, outputMint] = [new PublicKey(inToken), new PublicKey(outToken)];
  const [inputMintStr, outputMintStr] = [inputMint.toBase58(), outputMint.toBase58()];

  let routes = await readCachedRoutes(inputMint, outputMint);
  if (!routes) {
    let poolData = await readCachePoolData(1000 * 60 * 90);
    if (poolData?.ammPools.length === 0) {
      console.log('fetching all pool basic info, this might take a while (more than 30 seconds)..');
      poolData = await raydium.tradeV2.fetchRoutePoolBasicInfo();

      writeCachePoolData(poolData);
    }

    console.log(poolData);

    console.log('computing swap route..');

    routes = raydium.tradeV2.getAllRoute({
      inputMint,
      outputMint,
      ...poolData,
    });

    await cacheRoutes(inputMint, outputMint, routes as ReturnTypeGetAllRoute);
  }

  const {
    routePathDict,
    mintInfos,
    ammPoolsRpcInfo,
    ammSimulateCache,

    clmmPoolsRpcInfo,
    computeClmmPoolInfo,
    computePoolTickData,

    computeCpmmData,
  } = await raydium.tradeV2.fetchSwapRoutesData({
    routes,
    inputMint,
    outputMint,
  });

  console.log('calculating available swap routes...');
  const swapRoutes = raydium.tradeV2.getAllRouteComputeAmountOut({
    inputTokenAmount: new TokenAmount(
      new Token({
        mint: inputMintStr,
        decimals: mintInfos[inputMintStr].decimals,
        isToken2022: mintInfos[inputMintStr].programId.equals(TOKEN_2022_PROGRAM_ID),
      }),
      amount
    ),
    directPath: (routes as ReturnTypeGetAllRoute).directPath.map(
      (p: any) =>
        ammSimulateCache[p.id.toBase58()] || computeClmmPoolInfo[p.id.toBase58()] || computeCpmmData[p.id.toBase58()]
    ),
    routePathDict,
    simulateCache: ammSimulateCache,
    tickCache: computePoolTickData,
    mintInfos: mintInfos,
    outputToken: toApiV3Token({
      ...mintInfos[outputMintStr],
      programId: mintInfos[outputMintStr].programId.toBase58(),
      address: outputMintStr,
      extensions: {
        feeConfig: toFeeConfig(mintInfos[outputMintStr].feeConfig),
      },
    }),
    chainTime: Math.floor(raydium.chainTimeData?.chainTime ?? Date.now() / 1000),
    slippage: 0.15,
    epochInfo: await raydium.connection.getEpochInfo(),
  });

  // swapRoutes are sorted by out amount, so first one should be the best route
  const targetRoute = swapRoutes[0];
  if (!targetRoute) throw new Error('no swap routes were found');

  console.log('target swap route:', targetRoute);
  console.log('best swap route:', {
    input: targetRoute.amountIn.amount.toExact(),
    output: targetRoute.amountOut.amount.toExact(),
    minimumOut: targetRoute.minAmountOut.amount.toExact(),
    swapType: targetRoute.routeType,
  });

  // console.log('best swap route:', {
  //   min: targetRoute.amountIn.amount.toExact(),
  //   price: targetRoute.amountOut.amount.toExact(),
  //   network_fees: 0.02,
  //   platform_fees: 0.2,
  //   slippage: 0.5,
  // });

  // return {
  //   min: targetRoute.amountIn.amount.toExact(),
  //   price: targetRoute.amountOut.amount.toExact(),
  //   network_fees: 0.02,
  //   platform_fees: 0.2,
  //   slippage: 0.5,
  // };

  const computeBudgetConfig = (await fetchSolanaFeeInfo()) || {
    units: 600000,
    microLamports: 250000,
  };

  console.log(computeBudgetConfig);

  console.log('fetching swap route pool keys..');
  const poolKeys = await raydium.tradeV2.computePoolToPoolKeys({
    pools: targetRoute.poolInfoList,
    ammRpcData: ammPoolsRpcInfo,
    clmmRpcData: clmmPoolsRpcInfo,
  });

  console.log('best swap route:', {
    input: targetRoute.amountIn.amount.toExact(),
    output: targetRoute.amountOut.amount.toExact(),
    minimumOut: targetRoute.minAmountOut.amount.toExact(),
    swapType: targetRoute.routeType,
    routes: targetRoute.poolInfoList.map((p) => `${poolType[p.version]} ${p.id} ${(p as any).status}`).join(` -> `),
  });

  console.log('build swap tx..');
  const { execute, transactions } = await raydium.tradeV2.swap({
    routeProgram: Router,
    txVersion,
    swapInfo: targetRoute,
    swapPoolKeys: poolKeys,
    ownerInfo: {
      associatedOnly: true,
      checkCreateATAOwner: true,
    },
    computeBudgetConfig,
  });

  printSimulate(transactions);

  console.log('execute tx..');
  const { txIds, signedTxs } = await execute({ sequentially: true, skipPreflight: true });

  console.log('txIds:', txIds, JSON.stringify(signedTxs));

  try {
    const recievedAmount = await getTransactionDetails(txIds[0], outToken);

    return { success: true, amount: recievedAmount, transaction: txIds };
  } catch (error) {
    console.error('Transaction confirmation failed:', error);
    return { success: false, error, transaction: txIds };
  }
}
