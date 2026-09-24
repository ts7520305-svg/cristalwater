(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.CWClientServicePricing=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DAY=86400000,fail=()=>{throw Error('Os preços do acordo e da simulação precisam de revisão.');};
 function civil(value){if(typeof value!=='string'||!/^(20\d{2}|21\d{2})-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail();return value;}
 function cents(value){if(!['number','string'].includes(typeof value)||String(value).trim()==='')fail();const n=Number(value);if(!Number.isFinite(n)||n<0||n>10000000||Math.abs(n*100-Math.round(n*100))>0.000001)fail();return Math.round(n*100);}
 const months=s=>Array.from({length:(s.toMonth-s.fromMonth+12)%12+1},(_,i)=>(s.fromMonth-1+i)%12+1);
 function fromInput(input){return {schema:2,startsOn:input.startsOn,endsOn:input.endsOn||null,seasons:input.seasons.map((s,i)=>({key:'SEASON_'+(i+1),label:s.label.trim(),fromMonth:Number(s.fromMonth),toMonth:Number(s.toMonth),monthlyCents:s.billing==='PER_VISIT'?0:cents(s.monthlyAmount),...(s.billing==='PER_VISIT'?{billing:'PER_VISIT',visitCents:cents(s.visitAmount)}:{})}))};}
 function calculate(plan,ref){
  civil(plan?.startsOn);if(plan.endsOn&&(civil(plan.endsOn)<plan.startsOn))fail();if(typeof ref!=='string'||!/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(ref)||!Array.isArray(plan.seasons)||!plan.seasons.length||plan.seasons.length>12)fail();const occupied=new Set();
  for(const [i,s]of plan.seasons.entries()){if(s.key!=='SEASON_'+(i+1)||typeof s.label!=='string'||!s.label||!Number.isInteger(s.fromMonth)||s.fromMonth<1||s.fromMonth>12||!Number.isInteger(s.toMonth)||s.toMonth<1||s.toMonth>12||!Number.isSafeInteger(s.monthlyCents)||s.monthlyCents<0||s.monthlyCents>1000000000||s.billing!==undefined&&s.billing!=='PER_VISIT'||s.billing==='PER_VISIT'&&(s.monthlyCents!==0||!Number.isSafeInteger(s.visitCents)||s.visitCents<0||s.visitCents>1000000000))fail();for(const m of months(s)){if(occupied.has(m))fail();occupied.add(m);}}
  if(occupied.size!==12)fail();const start=Date.parse(ref+'-01T00:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);const daysInMonth=(+end-start)/DAY,segments=[],variable=new Map();let weighted=0;
  for(let d=start;d<+end;d+=DAY){const day=new Date(d).toISOString().slice(0,10),season=day<plan.startsOn||plan.endsOn&&day>plan.endsOn?null:plan.seasons.find(s=>months(s).includes(Number(day.slice(5,7)))),source=season?.key||'OUTSIDE_CONTRACT',label=season?.label||'Fora da vigência',value=season?.monthlyCents||0,previous=segments.at(-1);weighted+=value;if(previous?.source===source){previous.endsOn=day;previous.days++;}else segments.push({source,label,startsOn:day,endsOn:day,days:1,monthlyAmount:value/100});if(season?.billing==='PER_VISIT')variable.set(season.key,{period:season.key,label:season.label,unitAmount:season.visitCents/100});}
  return {monthRef:ref,amount:Math.round(weighted/daysInMonth)/100,daysInMonth,segments,method:'CALENDAR_DAY_PRORATA',perVisitRates:[...variable.values()],variableCharges:'CONFIRMED_COMPLETED_VISITS_ONLY'};
 }
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 function verify(value,plan,ref){const expected=calculate(plan,ref);if(JSON.stringify(canonical(value))!==JSON.stringify(canonical(expected)))fail();return value;}
 return {cents,fromInput,calculate,verify};
});
