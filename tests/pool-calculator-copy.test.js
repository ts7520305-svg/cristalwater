import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),copy=require('../frontend/cw-pool-calculator-copy.js'),rules=require('../frontend/cw-pool-calculator-rules.js');
describe('calculator display language contract',()=>{
  it('provides every field, action and critical state in all five languages',()=>{
    expect(Object.keys(copy)).toEqual(['pt','en','fr','es','de']);
    const required=[...rules.fieldKeys,'title','language','session','draftFailure','draftInvalid','draftStale','storageError','pending','uncertain','saved','CALCULATOR_STALE','CALCULATOR_NOT_FOUND','CALCULATOR_INVALID','confirmDiscard','confirmConflict','confirmSwitch','confirmClear','needSalt'];
    for(const values of Object.values(copy)){
      expect(Object.keys(values)).toEqual(Object.keys(copy.pt));
      for(const key of required)expect(values[key]?.trim(),key).toBeTruthy();
      for(const value of Object.values(values)){expect(value.trim()).toBeTruthy();expect(value).not.toMatch(/undefined|<script/i);}
    }
    expect(copy.en.title).toBe('Pool Technical Calculator');expect(copy.de.language).toBe('Sprache');
  });
  it('retains the same interpolation parameters without translating source values',()=>{
    const params=value=>[...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
    for(const [key,original] of Object.entries(copy.pt))for(const values of Object.values(copy))expect(params(values[key]),key).toEqual(params(original));
    expect(params(copy.pt.storedOption)).toEqual(['value']);expect(params(copy.pt.program)).toEqual(['hours']);
  });
});
