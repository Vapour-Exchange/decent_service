import { Raydium, TxVersion, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2';
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
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
  console.warn(logTime());
  const raydium = await initSdk();
  console.warn(logTime());
  await raydium.fetchChainTime();
  console.warn(logTime());
  let poolData = await raydium.tradeV2.fetchRoutePoolBasicInfo();
  console.warn(Date.now());

  console.warn(poolData);
  writeCachePoolData(poolData);
  console.warn(logTime());
};

async function routeSwap() {
  const raydium = await initSdk();
  await raydium.fetchChainTime();

  const inputAmount = '100';
  const SOL = NATIVE_MINT; // or WSOLMint
  const [inputMint, outputMint] = [USDCMint, SOL];
  const [inputMintStr, outputMintStr] = [inputMint.toBase58(), outputMint.toBase58()];

  // strongly recommend cache all pool data, it will reduce lots of data fetching time
  // code below is a simple way to cache it, you can implement it with any other ways
  let poolData = readCachePoolData(); // initial cache time is 10 mins(1000 * 60 * 10), if wants to cache longer, set bigger number in milliseconds
  // let poolData = readCachePoolData(1000 * 60 * 60 * 24 * 10) // example for cache 1 day
  if (poolData.ammPools.length === 0) {
    console.log('fetching all pool basic info, this might take a while (more than 30 seconds)..');
    poolData = await raydium.tradeV2.fetchRoutePoolBasicInfo();
    // console.log(poolData)
    writeCachePoolData(poolData);
  }

  console.log('computing swap route..');
  // route here also can cache for a time period by pair to reduce time
  // e.g.{inputMint}-${outputMint}'s routes, if poolData don't change, routes should be almost same
  const routes = raydium.tradeV2.getAllRoute({
    inputMint,
    outputMint,
    ...poolData,
  });

  // data here also can try to cache if you wants e.g. mintInfos
  // but rpc related info doesn't suggest to cache it for a long time, because base/quote reserve and pool price change by time
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
      inputAmount
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
