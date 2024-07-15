import { PublicKey } from '@solana/web3.js';
import Redis from 'ioredis';
import { BasicPoolInfo } from '@raydium-io/raydium-sdk-v2';
import { ReturnTypeGetAllRoute } from '@raydium-io/raydium-sdk-v2';

const redis = new Redis({
  host: 'vpx.redis.cache.windows.net',
  port: 6380,
  password: 'WCIOustdCG4VrSa4mHVEG6WANTpUC5PKWAzCaFMphEA=',
  tls: {
    servername: 'vpx.redis.cache.windows.net',
  },
});

export const readCachePoolData = async (cacheTime?: any) => {
  let cacheData = {
    time: 0,
    ammPools: [] as BasicPoolInfo[],
    clmmPools: [] as BasicPoolInfo[],
    cpmmPools: [] as BasicPoolInfo[],
  };

  try {
    console.log('reading cache pool data');
    const data = await redis.get('pool_data');
    if (data) {
      const parsedData = JSON.parse(data);
      if (Date.now() - parsedData.time > (cacheTime ?? 1000 * 60 * 10)) {
        console.log('cache data expired');
        return cacheData;
      }
      cacheData.time = parsedData.time;
      cacheData.ammPools = parsedData.ammPools.map((p: any) => ({
        ...p,
        id: new PublicKey(p.id),
        mintA: new PublicKey(p.mintA),
        mintB: new PublicKey(p.mintB),
      }));
      cacheData.clmmPools = parsedData.clmmPools.map((p: any) => ({
        ...p,
        id: new PublicKey(p.id),
        mintA: new PublicKey(p.mintA),
        mintB: new PublicKey(p.mintB),
      }));
      cacheData.cpmmPools = parsedData.cpmmPools.map((p: any) => ({
        ...p,
        id: new PublicKey(p.id),
        mintA: new PublicKey(p.mintA),
        mintB: new PublicKey(p.mintB),
      }));
      console.log('read cache pool data success');
    } else {
      console.log('no cache pool data found');
    }
  } catch (error) {
    console.log('cannot read cache pool data', error);
  }

  return {
    ammPools: cacheData.ammPools,
    clmmPools: cacheData.clmmPools,
    cpmmPools: cacheData.cpmmPools,
  };
};

export const writeCachePoolData = async (data: any) => {
  console.log('caching all pool basic info..');

  const cacheData = {
    time: Date.now(),
    ammPools: data.ammPools.map((p: any) => ({
      id: p.id.toBase58(),
      version: p.version,
      mintA: p.mintA.toBase58(),
      mintB: p.mintB.toBase58(),
    })),
    clmmPools: data.clmmPools.map((p: any) => ({
      id: p.id.toBase58(),
      version: p.version,
      mintA: p.mintA.toBase58(),
      mintB: p.mintB.toBase58(),
    })),
    cpmmPools: data.cpmmPools.map((p: any) => ({
      id: p.id.toBase58(),
      version: p.version,
      mintA: p.mintA.toBase58(),
      mintB: p.mintB.toBase58(),
    })),
  };

  try {
    await redis.set('pool_data', JSON.stringify(cacheData));
    console.log('cache pool data success');
  } catch (error) {
    console.log('cache pool data failed', error);
  }
};

export const cacheRoutes = async (inputMint: PublicKey, outputMint: PublicKey, routes: ReturnTypeGetAllRoute) => {
  const key = `routes:${inputMint.toBase58()}:${outputMint.toBase58()}`;
  try {
    await redis.set(key, JSON.stringify(routes), 'EX', 900); // Set expiry time to 15 minutes (900 seconds)
    console.log('cache routes data success');
  } catch (error) {
    console.log('cache routes data failed', error);
  }
};

export const readCachedRoutes = async (inputMint: PublicKey, outputMint: PublicKey, cacheTime?: any) => {
  const key = `routes:${inputMint.toBase58()}:${outputMint.toBase58()}`;
  let cacheData: ReturnTypeGetAllRoute | null = null;

  try {
    console.log('reading cached routes data');
    const data = await redis.get(key);
    if (data) {
      const parsedData = JSON.parse(data);
      if (Date.now() - parsedData.time > (cacheTime ?? 1000 * 60 * 10)) {
        console.log('cache data expired');
        return cacheData;
      }
      cacheData = {
        ...parsedData,
        directPath: parsedData.directPath.map((p: any) => ({
          ...p,
          id: new PublicKey(p.id),
          mintA: new PublicKey(p.mintA),
          mintB: new PublicKey(p.mintB),
        })),
        addLiquidityPools: parsedData.addLiquidityPools.map((p: any) => ({
          ...p,
          id: new PublicKey(p.id),
          mintA: new PublicKey(p.mintA),
          mintB: new PublicKey(p.mintB),
        })),
        needSimulate: parsedData.needSimulate.map((p: any) => ({
          ...p,
          id: new PublicKey(p.id),
          mintA: new PublicKey(p.mintA),
          mintB: new PublicKey(p.mintB),
        })),
        routePathDict: Object.fromEntries(
          Object.entries(parsedData.routePathDict).map(([routeMint, routeInfo]: [string, any]) => [
            routeMint,
            {
              ...routeInfo,
              mintProgram: new PublicKey(routeInfo.mintProgram),
              in: routeInfo.in.map((p: any) => ({
                ...p,
                id: new PublicKey(p.id),
                mintA: new PublicKey(p.mintA),
                mintB: new PublicKey(p.mintB),
              })),
              out: routeInfo.out.map((p: any) => ({
                ...p,
                id: new PublicKey(p.id),
                mintA: new PublicKey(p.mintA),
                mintB: new PublicKey(p.mintB),
              })),
            },
          ])
        ),
        needTickArray: parsedData.needTickArray.map((p: any) => ({
          ...p,
          id: new PublicKey(p.id),
          mintA: new PublicKey(p.mintA),
          mintB: new PublicKey(p.mintB),
        })),
        cpmmPoolList: parsedData.cpmmPoolList.map((p: any) => ({
          ...p,
          id: new PublicKey(p.id),
          mintA: new PublicKey(p.mintA),
          mintB: new PublicKey(p.mintB),
        })),
      };
      console.log('read cached routes data success');
    } else {
      console.log('no cached routes data found');
    }
  } catch (error) {
    console.log('cannot read cached routes data', error);
  }

  return cacheData;
};

// Don't forget to handle Redis client connection and errors
redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.log('Redis error: ', err);
});
