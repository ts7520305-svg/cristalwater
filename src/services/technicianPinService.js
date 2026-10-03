'use strict';
const bcrypt=require('bcryptjs');
const nativeBcrypt=require('bcrypt');
// Keep legacy and noncanonical hashes on their original verifier.
const nativeHash=/^\$2[ab]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;
const batchHash=value=>nativeHash.test(value)&&nativeBcrypt.getRounds(value)<=12;
const hashed=value=>typeof value==='string'&&/^\$2[aby]\$\d\d\$/.test(value);
async function matches(input,stored){if(typeof stored!=='string'||!stored||typeof input!=='string'||input.length>72)return false;return hashed(stored)?(nativeHash.test(stored)?nativeBcrypt:bcrypt).compare(input,stored):stored===input;}
async function findMatches(db,pin,{excludeId=null,activeOnly=false,stopAfter=2}={}){
  let cursor=0;const found=[];
  for(;;){
    const rows=await db.technician.findMany({where:{id:{gt:cursor,...(excludeId?{not:excludeId}:{})},pin:{not:null},...(activeOnly?{active:true,deletedAt:null}:{})},select:{id:true,pin:true},orderBy:{id:'asc'},take:100});
    if(!rows.length)break;
    for(let index=0;index<rows.length;){
      const batch=[rows[index++]];
      // Legacy/high-cost rows stay sequential; results/errors are consumed by ID.
      let nativeCount=batchHash(batch[0].pin)?1:0;
      if(nativeCount)while(nativeCount<4&&index<rows.length){
        const row=rows[index],native=batchHash(row.pin);
        if(hashed(row.pin)&&!native)break;
        batch.push(row);index++;if(native)nativeCount++;
      }
      const results=await Promise.all(batch.map(async row=>{
        try{return {id:row.id,match:await matches(pin,row.pin)};}
        catch(error){return {error};}
      }));
      for(const result of results){
        if('error' in result)throw result.error;
        if(result.match){found.push(result.id);if(found.length>=stopAfter)return found;}
      }
    }
    cursor=rows.at(-1).id;
  }
  return found;
}
module.exports={hashed,matches,findMatches,hash:pin=>bcrypt.hash(pin,12)};
