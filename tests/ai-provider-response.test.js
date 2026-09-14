import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {askOpenAI,askAI}=require('../src/services/ai/aiProvider');
beforeEach(()=>{vi.stubEnv('OPENAI_API_KEY','qa-placeholder-not-a-real-key');vi.stubEnv('AI_PROVIDER','openai');});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function response(data){vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>data}));}
describe('Responses API adapter',()=>{
 it('collects message text after non-message output items',async()=>{
  response({status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:'Primeiro parágrafo.'},{type:'output_text',text:'Segundo parágrafo.'}]}]});
  expect((await askOpenAI({userPrompt:'QA'})).text).toBe('Primeiro parágrafo.\nSegundo parágrafo.');
  expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
 });
 it('does not present an incomplete response as a completed answer',async()=>{
  response({status:'incomplete',output_text:'Parcial'});await expect(askOpenAI()).rejects.toThrow('não foi concluída');
 });
 it('does not silently accept a refusal or empty response',async()=>{
  response({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]});await expect(askOpenAI()).rejects.toThrow('revisão humana');
  response({status:'completed',output:[]});await expect(askOpenAI()).rejects.toThrow('resposta de texto');
 });
 it('labels fallback and demonstration without claiming generated advice',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Network unavailable')));
  const failed=await askAI({userPrompt:'QA'});expect(failed.raw.fallback).toBe(true);expect(failed.text).toContain('indisponível');
  vi.stubEnv('AI_PROVIDER','mock');const demo=await askAI({userPrompt:'QA'});expect(demo.text).toContain('não foi gerada uma análise técnica');
 });
});
