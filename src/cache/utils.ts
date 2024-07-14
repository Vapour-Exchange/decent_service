import { PublicKey } from '@solana/web3.js';
import jsonfile from 'jsonfile';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), '../data/pool_data.json');

export const readCachePoolData = (cacheTime?: any) => {
  let cacheData = {
    time: 0,
    ammPools: [],
    clmmPools: [],
    cpmmPools: [],
  };
  try {
    console.log('reading cache pool data');
    const data = jsonfile.readFileSync(filePath);
    if (Date.now() - data.time > (cacheTime ?? 1000 * 60 * 10)) {
      console.log('cache data expired');
      return cacheData;
    }
    cacheData.time = data.time;
    cacheData.ammPools = data.ammPools.map((p: any) => ({
      ...p,
      id: new PublicKey(p.id),
      mintA: new PublicKey(p.mintA),
      mintB: new PublicKey(p.mintB),
    }));
    cacheData.clmmPools = data.clmmPools.map((p: any) => ({
      ...p,
      id: new PublicKey(p.id),
      mintA: new PublicKey(p.mintA),
      mintB: new PublicKey(p.mintB),
    }));
    cacheData.cpmmPools = data.cpmmPools.map((p: any) => ({
      ...p,
      id: new PublicKey(p.id),
      mintA: new PublicKey(p.mintA),
      mintB: new PublicKey(p.mintB),
    }));
    console.log('read cache pool data success');
  } catch {
    console.log('cannot read cache pool data');
  }

  return {
    ammPools: cacheData.ammPools,
    clmmPools: cacheData.clmmPools,
    cpmmPools: cacheData.cpmmPools,
  };
};

export const writeCachePoolData = (data: any) => {
  console.log('caching all pool basic info..');

  jsonfile
    .writeFile(filePath, {
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
    })
    .then(() => {
      console.log('cache pool data success');
    })
    .catch((e: Error) => {
      console.log('cache pool data failed', e);
    });
};
