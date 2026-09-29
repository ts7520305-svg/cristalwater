import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('frontend/cw-field-write-store.js','utf8');
const catalogue=JSON.parse(source.match(/const messages = (\{[\s\S]*?\n  \});/)[1]);
function browser(language){const window={},document={documentElement:{lang:language}};vm.runInNewContext(source,language===undefined?{window}:{window,document});return{store:window.CWFieldWriteStore,document};}
const words={pt:['Reveja os intervalos','Confirme os materiais','Resposta incompleta.'],en:['Review the intervals','Check the materials','Incomplete response.'],fr:['Vérifiez les intervalles','Vérifiez les matériaux','Réponse incomplète.'],es:['Revise los intervalos','Compruebe los materiales','Respuesta incompleta.'],de:['Prüfen Sie die Zeitintervalle','Prüfen Sie die Materialien','Unvollständige Antwort.']};
describe('Owned field-write errors',()=>{
  it('covers every owned message with five nonempty translations and no formatting placeholders',()=>{
    expect(Object.keys(catalogue)).toHaveLength(70);
    const {store}=browser('pt');
    for(const [code,texts] of Object.entries(catalogue)){
      expect(texts).toHaveLength(5);expect(new Set(texts).size).toBe(5);
      for(const [i,language] of ['pt','en','fr','es','de'].entries()){
        expect(typeof texts[i]).toBe('string');expect(texts[i].trim()).toBe(texts[i]);expect(texts[i].length).toBeGreaterThan(10);expect(texts[i]).not.toMatch(/\{\w+\}/);
        expect(store.message(code,language)).toBe(texts[i]);
      }
    }
    const referenced=[...source.slice(source.indexOf('  const uuid')).matchAll(/problem\('([^']+)'\)/g)].map(m=>m[1]);
    expect([...new Set([...referenced,'completionAlreadyConfirmed','completionPending'])].sort()).toEqual(Object.keys(catalogue).sort());
  });
  it.each(Object.entries(words))('uses %s at error creation and supplies an explicit transient descriptor',(language,expected)=>{
    const {store,document}=browser(language);
    for(const [i,run,code] of [[0,()=>store.equipmentTime({}),'intervals'],[1,()=>store.equipmentMaterials({}),'materials'],[2,()=>store.confirmation({},{}),'receiptIncomplete']]){
      let error;try{run();}catch(caught){error=caught;}
      expect(error.message.startsWith(expected[i])).toBe(true);expect(error.copy).toEqual({key:'fieldWriteError',params:{code}});
      const original=error.message;document.documentElement.lang='pt';expect(error.message).toBe(original);document.documentElement.lang=language;
    }
  });
  it('works with no DOM or language engine and normalizes region and unsupported locale tags',()=>{
    const {store}=browser();expect(()=>store.equipmentTime({})).toThrow('Reveja os intervalos');
    expect(store.message('expired','EN-gb')).toBe('Session expired. Sign in again with the same account.');
    expect(store.message('expired','fr-CA')).toBe('Session expirée. Reconnectez-vous avec le même compte.');
    expect(store.message('expired','it')).toBe('Sessão expirada. Volte a entrar com a mesma conta.');
    expect(store.message('literal unknown <b>')).toBe('literal unknown <b>');
  });
  it.each(Object.keys(words))('keeps valid material/time payloads exact in %s',language=>{
    const {store}=browser(language),time={startAt:'2026-09-29T08:00:00.000Z',endAt:'2026-09-29T08:00:00.001Z'},materials={mode:'DECLARED',items:[{productName:'Sal original',unit:'kg',quantity:'1.250000'}]};
    expect(store.equipmentTime(time)).toEqual(time);expect(store.equipmentMaterials(materials)).toEqual({mode:'DECLARED',items:[{productName:'SAL ORIGINAL',unit:'KG',quantity:'1.25'}]});
    expect(materials.items[0].quantity).toBe('1.250000');
  });
  it('keeps every original entry point self-contained without a new script dependency',()=>{
    const consumers=['technician.html','technician-field-mode.html','technician-new-client.html','admin-operational-settings.html','admin-alerts.html'];
    for(const file of consumers){const html=fs.readFileSync('frontend/'+file,'utf8');expect(html.match(/src="\/cw-field-write-store.js"/g)).toHaveLength(1);}
    expect(source).not.toMatch(/window\.CWLegacyTechnicianCopy/);
  });
});
