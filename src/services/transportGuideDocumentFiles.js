 'use strict';
const fs=require('node:fs/promises'),constants=require('node:fs').constants,path=require('node:path'),{createHash}=require('node:crypto'),sharp=require('sharp');
const {resolveUploadBaseDir,getUploadsPublicBasePath}=require('../config/uploadPath'),R=require('../../frontend/cw-transport-documents-rules');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),fail=()=>{throw Object.assign(Error('TRANSPORT_INVALID_FILE'),{code:'TRANSPORT_INVALID_FILE',statusCode:400});};
async function validate(file,expected){
 if(!R.file(expected)||!file||!Buffer.isBuffer(file.buffer)||file.buffer.length!==expected.size||hash(file.buffer)!==expected.sha256)fail();
 if(file.originalname!==expected.name&&Buffer.from(file.originalname,'latin1').toString('utf8')!==expected.name)fail();
 if(![expected.mimeType,'application/octet-stream',...(expected.mimeType==='application/xml'?['text/xml']:[])].includes(file.mimetype))fail();
 const bytes=file.buffer,mime=expected.mimeType;
 if(mime==='application/pdf'){
  if(!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(bytes.subarray(0,12).toString('ascii')))fail();
  const tail=/startxref\s+(\d+)\s+%%EOF\s*$/.exec(bytes.subarray(-1024).toString('ascii'));if(!tail)fail();
  const offset=Number(tail[1]);if(!Number.isSafeInteger(offset)||offset<9||offset>=bytes.length||!/^(?:xref\b|\d+\s+\d+\s+obj\b)/.test(bytes.subarray(offset,offset+80).toString('ascii')))fail();
 }else if(mime.startsWith('image/')){
  try{const pipeline=sharp(bytes,{failOn:'warning',limitInputPixels:48000000,animated:false,pages:1}).timeout({seconds:3}),m=await pipeline.metadata();if(({png:'image/png',jpeg:'image/jpeg',webp:'image/webp'})[m.format]!==mime||(m.pages||1)!==1)fail();await pipeline.stats();}catch(_){fail();}
 }else{
  let value;try{value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(_){fail();}
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail();
  if(mime==='application/xml'){const root=value.replace(/^\s*<\?xml[^?]*\?>/i,'').trim();if(!/^<[A-Za-z_][\w.:-]*(?:\s|>|\/)/.test(root)||/^<(?:html|svg|script)(?:\s|>|\/)/i.test(root)||/<!DOCTYPE|<!ENTITY/i.test(value))fail();}
 }
 return bytes;
}
function reference(value){const prefix=getUploadsPublicBasePath()+'/guides/';if(typeof value!=='string'||!value.startsWith(prefix))return null;const name=value.slice(prefix.length);return /^[A-Za-z0-9_.-]{1,200}$/.test(name)&&!['.','..'].includes(name)?name:null;}
async function legacy(row,guideId,read=true){
 if(!row)return null;let value;try{value=JSON.parse(row.value);}catch(_){return {state:'INVALID',name:'legacy-record',mimeType:'application/octet-stream',bytes:null,sha256:null,size:null};}
 const name=R.name(value?.originalName)?value.originalName:R.name(value?.filename)?value.filename:'legacy-record',result={state:'UNCHECKED',name,mimeType:typeof value?.mimeType==='string'?value.mimeType:'application/octet-stream',bytes:null,sha256:null,size:null};
 const filename=reference(value?.url);if(!filename||value.guideId!==undefined&&value.guideId!==guideId)return {...result,state:'INVALID'};if(!read)return result;
 let handle;try{
  const directory=path.join(resolveUploadBaseDir(),'guides');if((await fs.lstat(directory)).isSymbolicLink())return {...result,state:'INVALID'};
  handle=await fs.open(path.join(directory,filename),constants.O_RDONLY|(constants.O_NOFOLLOW||0)|(constants.O_NONBLOCK||0));const stat=await handle.stat();if(!stat.isFile()||!stat.size||stat.size>R.maxFile)return {...result,state:'INVALID'};
  const buffer=Buffer.alloc(stat.size+1);let size=0;while(size<buffer.length){const {bytesRead}=await handle.read(buffer,size,buffer.length-size,size);if(!bytesRead)break;size+=bytesRead;}if(size!==stat.size)return {...result,state:'INVALID'};const bytes=buffer.subarray(0,size);return {...result,state:'AVAILABLE',bytes,size,sha256:hash(bytes)};
 }catch(e){if(['ENOENT','ENOTDIR'].includes(e.code))return {...result,state:'MISSING'};if(['ELOOP','EACCES'].includes(e.code))return {...result,state:'INVALID'};throw e;}finally{if(handle)await handle.close();}
}
// Old guide files stay on disk, but all access now goes through a scoped API.
async function protectUploads(req,res,next){
 try{const decoded=decodeURIComponent(req.path);if(/[\\\0]/.test(decoded))return res.status(400).end();const relative=path.posix.normalize('/'+decoded).slice(1);if(relative==='guides'||relative.startsWith('guides/'))return res.status(404).set('Cache-Control','private, no-store').end();
  const root=await fs.realpath(resolveUploadBaseDir()),candidate=path.resolve(root,relative);if(!candidate.startsWith(root+path.sep))return res.status(404).end();
  try{const target=await fs.realpath(candidate),guides=path.join(root,'guides');if(target===guides||target.startsWith(guides+path.sep))return res.status(404).set('Cache-Control','private, no-store').end();}catch(e){if(!['ENOENT','ENOTDIR'].includes(e.code))throw e;}
  next();
 }catch(_){res.status(503).set('Cache-Control','private, no-store').end();}
}
module.exports={hash,validate,legacy,reference,protectUploads};
