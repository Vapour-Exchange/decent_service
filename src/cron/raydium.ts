import { Raydium, TxVersion, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2';
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
import { readCachePoolData, writeCachePoolData } from '../cache/utils';
import logger from '@/logger';

export const owner = Keypair.fromSecretKey(bs58.decode(config.solPoolWallet));
export const connection = new Connection(config.solRpcUrl);
export const txVersion = TxVersion.V0;
const cluster = 'mainnet';

let raydium: any;
export const initSdk = async (params?: any) => {
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

  logger.info(`POOL INFO ${poolData.length}`);
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
  writeCachePoolData(poolData);

  logger.info('cache pool data', logTime());

  return poolData;
};

export async function routeSwap(amount: string, inToken: string, outToken: string) {
  const raydium = await initSdk();
  await raydium.fetchChainTime();

  const [inputMint, outputMint] = [new PublicKey(inToken), new PublicKey(outToken)];
  const [inputMintStr, outputMintStr] = [inputMint.toBase58(), outputMint.toBase58()];

  let poolData = readCachePoolData(1000 * 60 * 35);
  if (poolData.ammPools.length === 0) {
    console.log('fetching all pool basic info, this might take a while (more than 30 seconds)..');
    poolData = await raydium.tradeV2.fetchRoutePoolBasicInfo();

    writeCachePoolData(poolData);
  }

  console.log('computing swap route..');
  const routes = raydium.tradeV2.getAllRoute({
    inputMint,
    outputMint,
    ...poolData,
  });

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
    directPath: routes.directPath.map(
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
    slippage: 2,
    epochInfo: await raydium.connection.getEpochInfo(),
  });

  // swapRoutes are sorted by out amount, so first one should be the best route
  const targetRoute = swapRoutes[0];
  if (!targetRoute) throw new Error('no swap routes were found');

  console.log('best swap route:', {
    input: targetRoute.amountIn.amount.toExact(),
    output: targetRoute.amountOut.amount.toExact(),
    minimumOut: targetRoute.minAmountOut.amount.toExact(),
    swapType: targetRoute.routeType,
  });

  return {
    input: targetRoute.amountIn.amount.toExact(),
    output: targetRoute.amountOut.amount.toExact(),
    minimumOut: targetRoute.minAmountOut.amount.toExact(),
    swapType: targetRoute.routeType,
  };

  console.log('fetching swap route pool keys..');
  const poolKeys = await raydium.tradeV2.computePoolToPoolKeys({
    pools: targetRoute.poolInfoList,
    ammRpcData: ammPoolsRpcInfo,
    clmmRpcData: clmmPoolsRpcInfo,
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
    computeBudgetConfig: {
      units: 600000,
      microLamports: 10000000,
    },
  });

  printSimulate(transactions);

  console.log('execute tx..');
  const { txIds } = await execute({ sequentially: true });
  console.log('txIds:', txIds);
}
