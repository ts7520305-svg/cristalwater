'use strict';
const bcrypt=require('bcryptjs');
const hashed=value=>typeof value==='string'&&/^\$2[aby]\$\d\d\$/.test(value);
async function matches(input,stored){if(typeof stored!=='string'||!stored||typeof input!=='string'||input.length>72)return false;return hashed(stored)?bcrypt.compare(input,stored):stored===input;}
async function findMatches(db,pin,{excludeId=null,activeOnly=false,stopAfter=2}={}){let cursor=0;const found=[];for(;;){const rows=await db.technician.findMany({where:{id:{gt:cursor,...(excludeId?{not:excludeId}:{})},pin:{not:null},...(activeOnly?{active:true,deletedAt:null}:{})},select:{id:true,pin:true},orderBy:{id:'asc'},take:100});if(!rows.length)break;for(const row of rows)if(await matches(pin,row.pin)){found.push(row.id);if(found.length>=stopAfter)return found;}cursor=rows.at(-1).id;}return found;}
module.exports={hashed,matches,findMatches,hash:pin=>bcrypt.hash(pin,12)};
