import { PublicKey } from '@solana/web3.js';
import Redis from 'ioredis';

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
    ammPools: [],
    clmmPools: [],
    cpmmPools: [],
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

      return parsedData;
    } else {
      console.log('no cache pool data found');
      return [];
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

// Don't forget to handle Redis client connection and errors
redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.log('Redis error: ', err);
});
