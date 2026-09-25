(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CWPoolCalculatorRules=value;}(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const scope='POOL_CALCULATION',version=/^pool-calculator-v2:[a-f0-9]{64}$/,uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const fieldKeys=['shape','shapeFactor','lengthM','widthM','diameterM','depthMinM','depthMaxM','averageDepthM','surfaceM2','volumeM3','pumpFlowM3h','pumpPowerHp','bathersAverage','poolLoad','saltCurrentPpm','targetSalinityPpm','chlorinatorGph','chlorineCurrentPpm','targetChlorinePpm','alkalinityCurrentPpm','targetAlkalinityPpm','phCurrent','targetPh','orpCurrentMv','targetOrpMv','heatPumpPhase','heatPumpThermalKw','heatPumpElectricalKw','cop','currentWaterTempC','targetWaterTempC','covered','ambientLossFactor','notes'];
  const chemistry=['alkalinityCurrentPpm','targetAlkalinityPpm','phCurrent','targetPh','orpCurrentMv','targetOrpMv'];
  const strings=['shape','poolLoad','heatPumpPhase','covered','notes'],modelKeys=fieldKeys.filter(key=>!chemistry.includes(key)),numbers=fieldKeys.filter(key=>!strings.includes(key));
  const defaults=Object.fromEntries(fieldKeys.map(key=>[key,({shape:'RECTANGULAR',poolLoad:'NORMAL',targetSalinityPpm:'3500',targetChlorinePpm:'2',targetAlkalinityPpm:'100',targetPh:'7.4',targetOrpMv:'720',cop:'5',targetWaterTempC:'27',covered:'false'})[key]??'']));
  const geometryKeys=['shape','shapeFactor','lengthM','widthM','diameterM','depthMinM','depthMaxM','averageDepthM','surfaceM2','volumeM3'];
  const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const positive=value=>Number.isInteger(value)&&value>0&&value<=2147483647;
  const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])])):value;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  const fields=value=>exact(value,fieldKeys)&&fieldKeys.every(key=>typeof value[key]==='string'&&value[key].length<=(key==='notes'?10000:1000)&&(!numbers.includes(key)||value[key]===''||/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value[key])&&Number.isFinite(Number(value[key]))))&&['true','false'].includes(value.covered);
  function form(pool,profile){
    const values={...defaults};
    if(profile)for(const key of modelKeys)if(profile[key]!==null&&profile[key]!==undefined)values[key]=String(profile[key]);
    const saved=profile?.lastResultJson?.chemistry;
    if(object(saved))for(const key of chemistry)if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))values[key]=String(saved[key]);
    if(profile?.volumeM3===null||profile?.volumeM3===undefined)if(pool.volumeM3!==null&&pool.volumeM3!==undefined)values.volumeM3=String(pool.volumeM3);
    if(!profile?.shape)values.shape=pool.type||defaults.shape;
    return values;
  }
  function normalizedProfile(input){
    const result={};
    for(const key of modelKeys){
      if(numbers.includes(key))result[key]=input[key]===''?null:Number(input[key]);
      else if(key==='covered')result[key]=input[key]==='true';
      else result[key]=input[key]||({shape:'RECTANGULAR',poolLoad:'NORMAL'}[key]??null);
    }
    for(const [key,value]of Object.entries({targetSalinityPpm:3500,targetChlorinePpm:2,cop:5,targetWaterTempC:27}))result[key]=result[key]||value;
    return result;
  }
  function patch(pool,profile,input){
    const previous=form(pool,profile),normalized=normalizedProfile(input),changed=fieldKeys.filter(key=>input[key]!==previous[key]);
    return {changed,profile:profile?Object.fromEntries(changed.filter(key=>modelKeys.includes(key)).map(key=>[key,normalized[key]])):normalized};
  }
  const command=body=>exact(body,['requestId','expectedVersion','fields'])&&uuid(body.requestId)&&version.test(body.expectedVersion)&&fields(body.fields);
  const intent=body=>({expectedVersion:body.expectedVersion,fields:body.fields});
  const envelope=(poolId,body)=>({v:1,scope,resourceId:poolId,payload:intent(body)});
  function state(value){
    if(value?.ok!==true||value.scope!==scope||!positive(value.poolId)||!version.test(value.version)||value.pool?.id!==value.poolId||!positive(value.pool.clientId)||typeof value.pool.name!=='string'||typeof value.pool.type!=='string'&&value.pool.type!==null||value.pool.volumeM3!==null&&!(typeof value.pool.volumeM3==='number'&&Number.isFinite(value.pool.volumeM3))||value.pool.client?.id!==value.pool.clientId||typeof value.pool.client.name!=='string'||!fields(value.fields))return false;
    const p=value.profile;
    if(p!==null&&(!object(p)||!positive(p.id)||p.poolId!==value.poolId||modelKeys.some(key=>!Object.hasOwn(p,key)||(numbers.includes(key)?p[key]!==null&&!(typeof p[key]==='number'&&Number.isFinite(p[key])):key==='covered'?typeof p[key]!=='boolean':p[key]!==null&&typeof p[key]!=='string'))))return false;
    return equal(form(value.pool,value.profile),value.fields);
  }
  function confirmation(result,record,owner){
    const receipt=result?.receipt;
    if(!command(record?.command)||!state(record.review)||record.review.poolId!==record.poolId||record.command.expectedVersion!==record.review.version||result?.ok!==true||typeof result.applied!=='boolean'||!equal(result.context,intent(record.command))||receipt?.owner!==owner||receipt.scope!==scope||receipt.resourceId!==record.poolId||receipt.requestId!==record.command.requestId.toLowerCase()||receipt.payloadHash!==record.payloadHash||!Number.isFinite(Date.parse(receipt.confirmedAt)))return false;
    if(!result.applied)return ['CALCULATOR_NOT_FOUND','CALCULATOR_STALE','CALCULATOR_INVALID'].includes(result.code)&&typeof result.message==='string';
    if(!state(result.state)||!result.state.profile||result.state.poolId!==record.poolId||result.state.version===record.review.version||!positive(result.historyId)||!object(result.calculation?.geometry)||!equal(result.state.profile.lastResultJson,result.calculation))return false;
    const expected=patch(record.review.pool,record.review.profile,record.command.fields),before=record.review.profile;
    if(before&&result.state.profile.id!==before.id||result.state.pool.clientId!==record.review.pool.clientId||result.state.pool.name!==record.review.pool.name)return false;
    if(!equal(result.changedFields,expected.changed))return false;
    for(const key of modelKeys)if(result.state.profile[key]!== (Object.hasOwn(expected.profile,key)?expected.profile[key]:before[key]))return false;
    for(const key of chemistry){let expected=record.command.fields[key]===''?null:Number(record.command.fields[key]);const fallback={targetPh:7.4,targetAlkalinityPpm:100,targetOrpMv:720}[key];if(fallback!==undefined)expected=expected||fallback;if(result.calculation.chemistry?.[key]!==expected)return false;}
    const volumeChanged=expected.changed.some(key=>geometryKeys.includes(key));
    if(result.state.pool.volumeM3!==(volumeChanged&&result.calculation.geometry.volumeM3>0?result.calculation.geometry.volumeM3:record.review.pool.volumeM3)||result.state.pool.type!==(expected.changed.includes('shape')?result.state.profile.shape:record.review.pool.type))return false;
    return true;
  }
  return {scope,version,uuid,fieldKeys,chemistry,strings,modelKeys,numbers,defaults,geometryKeys,object,positive,canonical,equal,exact,fields,form,normalizedProfile,patch,command,intent,envelope,state,confirmation};
}));
