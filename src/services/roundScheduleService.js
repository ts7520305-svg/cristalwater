function fail(message){throw Object.assign(new Error(message),{status:400});}
const key=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function dateValue(value){
  if(value===null||value==='')return null;
  if(value instanceof Date)return value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))fail('Data da ronda inválida');
  const date=new Date(`${value}T00:00:00Z`);if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)fail('Data da ronda inválida');return date;
}
function parse(body,current={}){
  const recurrence=String(body.recurrence??current.recurrence??'WEEKLY').toUpperCase();
  const rawDay=body.dayOfWeek??current.dayOfWeek??1,dayOfWeek=Number(rawDay);
  if(!['DAILY','WEEKLY','MONTHLY'].includes(recurrence)||typeof rawDay==='boolean'||!Number.isInteger(dayOfWeek)||dayOfWeek<0||dayOfWeek>6)fail('Indique frequência e dia da semana válidos');
  const rawMonth=body.dayOfMonth??current.dayOfMonth,dayOfMonth=recurrence==='MONTHLY'?Number(rawMonth):null;
  if(recurrence==='MONTHLY'&&(typeof rawMonth==='boolean'||!Number.isInteger(dayOfMonth)||dayOfMonth<1||dayOfMonth>31))fail('Indique o dia do mês entre 1 e 31');
  const startsOn=dateValue(body.startsOn===undefined?(current.startsOn||null):body.startsOn),endsOn=dateValue(body.endsOn===undefined?(current.endsOn||null):body.endsOn);
  if(startsOn&&endsOn&&endsOn<startsOn)fail('O fim da ronda não pode ser anterior ao início');
  return {recurrence,dayOfWeek,dayOfMonth,startsOn,endsOn};
}
function inWindow(round,date){const day=key(date);return (!round.startsOn||day>=new Date(round.startsOn).toISOString().slice(0,10))&&(!round.endsOn||day<=new Date(round.endsOn).toISOString().slice(0,10));}
function matches(round,date){
  if(!inWindow(round,date))return false;
  if(round.recurrence==='DAILY')return true;
  if(round.recurrence==='MONTHLY')return date.getDate()===Math.min(Number(round.dayOfMonth),new Date(date.getFullYear(),date.getMonth()+1,0).getDate());
  return date.getDay()===Number(round.dayOfWeek);
}
function planned(date,order){const value=new Date(date);value.setHours(8,Math.max(0,Number(order||1)-1)*30,0,0);return value;}
function weekDates(round,start,order=1){return Array.from({length:7},(_,i)=>{const date=new Date(start);date.setDate(date.getDate()+i);return planned(date,order);}).filter(date=>matches(round,date));}
function nextDate(round,start,order=1){
  const date=new Date(start);date.setHours(12,0,0,0);
  if(round.startsOn&&key(date)<new Date(round.startsOn).toISOString().slice(0,10)){const [y,m,d]=new Date(round.startsOn).toISOString().slice(0,10).split('-').map(Number);date.setFullYear(y,m-1,d);}
  for(let i=0;i<32;i++){if(matches(round,date))return planned(date,order);date.setDate(date.getDate()+1);}return null;
}
async function update(db,id,body,data){return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Round" WHERE id=${id} FOR UPDATE`;
  const current=await tx.round.findUnique({where:{id}});if(!current)return null;
  return tx.round.update({where:{id},data:{...data,...parse(body,current)}});
});}
module.exports={parse,matches,inWindow,weekDates,nextDate,update};
