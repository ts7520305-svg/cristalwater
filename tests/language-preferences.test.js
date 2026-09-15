import { describe,it,expect } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {normalizeLanguage,SUPPORTED_LANGUAGES}=require('../src/services/languagePreferenceService');
describe('language preference normalization',()=>{
 it.each(['es','es-ES','es-MX','Español','espanhol','Spanish'])('accepts Spanish %s',value=>expect(normalizeLanguage(value)).toBe('es'));
 it('retains existing languages and falls back for unsupported values',()=>{
  expect([...SUPPORTED_LANGUAGES]).toEqual(['pt','en','fr','es','de']);
  for(const lang of ['pt','en','fr','de'])expect(normalizeLanguage(lang)).toBe(lang);
  expect(normalizeLanguage('unknown')).toBe('pt');
 });
});
