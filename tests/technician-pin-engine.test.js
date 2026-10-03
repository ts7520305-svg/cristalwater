import {afterEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const pins=require('../src/services/technicianPinService');
const native=require('bcrypt'),legacy=require('bcryptjs');
const fixturePin='001234';
const fixtureHash=await legacy.hash(fixturePin,4);
afterEach(()=>vi.restoreAllMocks());

describe('technician PIN engine compatibility',()=>{
  it.each(['$2a$','$2b$'])('uses the installed native engine for canonical %s hashes',async prefix=>{
    const fast=vi.spyOn(native,'compare'),fallback=vi.spyOn(legacy,'compare');
    const hash=prefix+fixtureHash.slice(4);
    expect(await pins.matches(fixturePin,hash)).toBe(true);
    expect(await pins.matches('001235',hash)).toBe(false);
    expect(fast).toHaveBeenCalledTimes(2);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('retains the legacy 2y verifier rather than reinterpreting stored credentials',async()=>{
    const fast=vi.spyOn(native,'compare'),fallback=vi.spyOn(legacy,'compare');
    const hash='$2y$'+fixtureHash.slice(4);
    expect(await pins.matches(fixturePin,hash)).toBe(true);
    expect(await pins.matches('001235',hash)).toBe(false);
    expect(fast).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(2);
    expect(hash).toBe('$2y$'+fixtureHash.slice(4));
  });

  it('preserves the historical result and rejection for noncanonical hashes',async()=>{
    const fast=vi.spyOn(native,'compare'),fallback=vi.spyOn(legacy,'compare');
    expect(await pins.matches(fixturePin,'$2a$04$broken')).toBe(false);
    await expect(pins.matches(fixturePin,fixtureHash.replace('$04$','$03$'))).rejects.toThrow();
    expect(fast).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(2);
  });

  it.each(['000001',' with spaces ','nul\u0000inside','\u00e9'.repeat(20),'\u20ac'.repeat(24)])('retains exact legacy string semantics for fixture %j',async pin=>{
    const hash=await legacy.hash(pin,4);
    expect(await pins.matches(pin,hash)).toBe(await legacy.compare(pin,hash));
    expect(await pins.matches('wrong',hash)).toBe(await legacy.compare('wrong',hash));
  });

  it('retains plaintext comparison and typed/length guards without any hash verification',async()=>{
    const fast=vi.spyOn(native,'compare'),fallback=vi.spyOn(legacy,'compare');
    expect(await pins.matches('001234','001234')).toBe(true);
    expect(await pins.matches(' 001234','001234')).toBe(false);
    for(const [input,stored]of [[null,fixtureHash],[1234,fixtureHash],['x'.repeat(73),fixtureHash],[fixturePin,null],[fixturePin,1234],[fixturePin,'']])expect(await pins.matches(input,stored)).toBe(false);
    expect(fast).not.toHaveBeenCalled();expect(fallback).not.toHaveBeenCalled();
  });

  it('keeps the existing new-PIN hash policy at cost twelve and readable by both engines',async()=>{
    const hash=await pins.hash(fixturePin);
    expect(pins.hashed(hash)).toBe(true);expect(native.getRounds(hash)).toBe(12);
    expect(await native.compare(fixturePin,hash)).toBe(true);
    expect(await legacy.compare(fixturePin,hash)).toBe(true);
  });

  it('retains ordered pagination, exclusions, active guards and ambiguous identities',async()=>{
    const pages=[[{id:1,pin:'wrong'},{id:2,pin:fixtureHash}],[{id:3,pin:fixturePin}],[]];
    const before=structuredClone(pages),calls=[];
    const db={technician:{findMany:async options=>{calls.push(options);return pages[calls.length-1];}}};
    expect(await pins.findMatches(db,fixturePin,{excludeId:9,activeOnly:true,stopAfter:2})).toEqual([2,3]);
    expect(calls).toEqual([0,2].map(cursor=>({where:{id:{gt:cursor,not:9},pin:{not:null},active:true,deletedAt:null},select:{id:true,pin:true},orderBy:{id:'asc'},take:100})));
    expect(pages).toEqual(before);
  });

  it('still stops at the first requested match without fetching another page',async()=>{
    const findMany=vi.fn(async()=>[{id:1,pin:fixtureHash},{id:2,pin:fixturePin}]);
    expect(await pins.findMatches({technician:{findMany}},fixturePin,{stopAfter:1})).toEqual([1]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('bounds native work to four and consumes out-of-order results in database order',async()=>{
    const hashes=Array.from({length:8},(_,index)=>fixtureHash.slice(0,-1)+'ABCDEFGH'[index]);
    let active=0,maximum=0;
    const completed=[];
    vi.spyOn(native,'compare').mockImplementation(async(_pin,hash)=>{
      const index=hashes.indexOf(hash);active++;maximum=Math.max(maximum,active);
      await new Promise(resolve=>setTimeout(resolve,index%4===0?20:0));
      active--;completed.push(index+1);return index===0||index===3;
    });
    const findMany=vi.fn(async()=>hashes.map((pin,index)=>({id:index+1,pin})));
    expect(await pins.findMatches({technician:{findMany}},fixturePin)).toEqual([1,4]);
    expect(maximum).toBe(4);expect(active).toBe(0);
    expect(completed).toHaveLength(4);expect(completed[0]).not.toBe(1);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('does not let a faster later match hide an earlier verification error',async()=>{
    const second=fixtureHash.slice(0,-1)+'A',failure=new Error('original verifier failure');
    const compare=vi.spyOn(native,'compare').mockImplementation(async(_pin,hash)=>{
      if(hash===fixtureHash){await new Promise(resolve=>setTimeout(resolve,10));throw failure;}
      return true;
    });
    const findMany=vi.fn(async()=>[{id:1,pin:fixtureHash},{id:2,pin:second}]);
    await expect(pins.findMatches({technician:{findMany}},fixturePin,{stopAfter:1})).rejects.toBe(failure);
    expect(compare).toHaveBeenCalledTimes(2);expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('retains an earlier stop even when later native work rejects',async()=>{
    const second=fixtureHash.slice(0,-1)+'A';
    vi.spyOn(native,'compare').mockImplementation(async(_pin,hash)=>{
      if(hash===second)throw new Error('later verification must not change the first match');
      await new Promise(resolve=>setTimeout(resolve,10));return true;
    });
    const findMany=vi.fn(async()=>[{id:1,pin:fixtureHash},{id:2,pin:second}]);
    expect(await pins.findMatches({technician:{findMany}},fixturePin,{stopAfter:1})).toEqual([1]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('keeps legacy verification as a barrier before later native work',async()=>{
    const failure=new Error('legacy failure'),compare=vi.spyOn(native,'compare').mockResolvedValue(false);
    const fallback=vi.spyOn(legacy,'compare').mockRejectedValue(failure);
    const findMany=vi.fn(async()=>[{id:1,pin:fixtureHash},{id:2,pin:'$2y$'+fixtureHash.slice(4)},{id:3,pin:fixtureHash}]);
    await expect(pins.findMatches({technician:{findMany}},fixturePin)).rejects.toBe(failure);
    expect(compare).toHaveBeenCalledTimes(1);expect(fallback).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('does not start a later high-cost hash after the first requested match',async()=>{
    const costly=fixtureHash.replace('$04$','$13$'),compare=vi.spyOn(native,'compare').mockResolvedValue(true);
    const findMany=vi.fn(async()=>[{id:1,pin:fixtureHash},{id:2,pin:costly}]);
    expect(await pins.findMatches({technician:{findMany}},fixturePin,{stopAfter:1})).toEqual([1]);
    expect(compare).toHaveBeenCalledTimes(1);expect(compare).toHaveBeenCalledWith(fixturePin,fixtureHash);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('counts four native verifications even when literal PINs are interleaved',async()=>{
    const hashes=Array.from({length:4},(_,index)=>fixtureHash.slice(0,-1)+'ABCD'[index]);
    let active=0,maximum=0;
    const compare=vi.spyOn(native,'compare').mockImplementation(async(_pin,hash)=>{
      active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setImmediate(resolve));active--;
      return hash===hashes[0]||hash===hashes[1];
    });
    const findMany=vi.fn(async()=>[{id:1,pin:hashes[0]},{id:2,pin:'not this literal PIN'},{id:3,pin:hashes[1]},{id:4,pin:'another literal PIN'},{id:5,pin:hashes[2]},{id:6,pin:hashes[3]}]);
    expect(await pins.findMatches({technician:{findMany}},fixturePin)).toEqual([1,3]);
    expect(maximum).toBe(4);expect(active).toBe(0);expect(compare).toHaveBeenCalledTimes(4);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
