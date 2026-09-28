'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fork}=require('node:child_process'),{randomUUID,createHash}=require('node:crypto'),{performance}=require('node:perf_hooks');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||process.env.EXTERNAL_NOTIFICATIONS_ENABLED!=='false')throw Error('Isolated QA required');
const dbAddress=new URL(process.env.DATABASE_URL);assert(['localhost','127.0.0.1'].includes(dbAddress.hostname)&&/qa/i.test(dbAddress.pathname));
const {prisma}=require('../src/prismaClient'),root=path.resolve(__dirname,'..'),folder=path.join(root,'reports/field-suite/attachment-volume');
const hash=v=>createHash('sha256').update(Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex'),mib=v=>Math.round(v/1048576*100)/100;
let completed=false;const deadline=setTimeout(()=>{console.error('Attachment volume assertions incomplete');process.exit(1);},110000);
process.on('exit',()=>{if(!completed&&!process.exitCode)process.exitCode=1;});
async function probe(mode){
 const stamp=('QA413-'+randomUUID()).toUpperCase(),reads=[],requestIds=[],clients=[];let guide,server;
 const models=['client','pool','technician','user','vehicle','serviceVisit','transportGuide','transportGuideItem','workGuide','workGuideItem','vehicleMaintenanceRecord','vehicleStockMovement','transportGuideAttachment','systemSetting','fieldWriteRequest','userAuditLog','stockPurchase','stockPurchaseItem','stockMovement','stockBalance','inventoryProduct','operationalReminder','clientMessage','communicationLog','invoice','payment'];
 await require('../src/services/clientChatHistoryService').ensure();
 const counts=async()=>{const out={};for(const model of models)out[model]=await prisma[model].count();return out;},before=await counts();
 const finance=()=>Promise.all(['invoice','payment'].map(model=>prisma[model].findMany({orderBy:{id:'asc'}}))).then(hash),financeBefore=await finance();
 const uploads=require('../src/config/uploadPath'),diskRoot=uploads.ensureUploadBaseDirReady();
 assert(/^attachment-volume-[A-Za-z0-9]+$/.test(path.basename(diskRoot)), 'Probe requires its own disposable upload directory');
 const files=()=>fs.readdirSync(diskRoot,{recursive:true}).filter(file=>fs.statSync(path.join(diskRoot,file)).isFile()).sort();
 const admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),sign=body=>require('jsonwebtoken').sign(body,require('../src/utils/jwtSecret').getJwtSecret(),{expiresIn:'30m'}),at=sign({id:admin.id,role:'ADMIN',principalType:'USER'});
 let base,token=at,limit,url,field,body,filename=stamp+'.txt';
 async function sampleServer(command){return new Promise((resolve,reject)=>{const onExit=()=>reject(Error('HTTP process exited'));server.once('exit',onExit);server.once('message',message=>{server.off('exit',onExit);resolve(message);});server.send({command});});}
 async function request(endpoint,{method='GET',form,raw,credential=token,headers={},expected=200,drop=false,binary=false}={}){
  await sampleServer('start');let peak=process.memoryUsage().rss;const sample=()=>{peak=Math.max(peak,process.memoryUsage().rss);};const timer=setInterval(sample,5),start=performance.now();let response,value,bytes=0,sha256,lost=false;
  try{response=await fetch(base+endpoint,{method,headers:{...(credential?{Authorization:'Bearer '+credential}:{}),...headers,...(drop?{'x-qa-drop-response':'true'}:{})},body:form||raw,signal:AbortSignal.timeout(30000)});
   if(binary){const digest=createHash('sha256');for await(const b of response.body){bytes+=b.length;digest.update(b);}sha256=digest.digest('hex');}
   else{const text=await response.text();bytes=Buffer.byteLength(text);try{value=JSON.parse(text);}catch{value=text;}}
  }catch(error){if(!drop)throw error;lost=true;}finally{sample();clearInterval(timer);}
  const apiMemory=await sampleServer('stop');const record={mode,endpoint,method,status:response?.status||null,lost,bytes,durationMs:Math.round((performance.now()-start)*10)/10,sampledServerRssMiB:apiMemory.rssMiB,sampledClientRssMiB:mib(peak),...(sha256?{sha256}:{})};reads.push(record);
  if(drop)assert(lost,'Response loss not reproduced');else assert.equal(response.status,expected,JSON.stringify({...record,error:typeof value==='object'?value?.error:null}));
  assert(record.durationMs<30000&&apiMemory.rssMiB<768&&peak<768*1048576,JSON.stringify(record));return {body:value,response,record};
 }
 const multipart=(fields,bytes,other={})=>{const form=new FormData();for(const [k,v]of Object.entries(fields))form.append(k,String(v));form.append(field,new Blob([bytes],{type:other.mime||'text/plain'}),other.name||filename);return form;};
 try{
  for(let i=0;i<2;i++)clients.push(await prisma.client.create({data:{name:stamp+'-'+i,active:true}}));
  const ct=sign({id:clients[0].id,role:'CLIENT',principalType:'CLIENT'}),foreign=sign({id:clients[1].id,role:'CLIENT',principalType:'CLIENT'});
  if(mode==='inventory'){limit=20*1048576;url='/api/inventory/purchases';field='document';body=()=>{const requestId=randomUUID();requestIds.push(requestId);return {requestId,supplierName:stamp,invoiceNumber:stamp,items:JSON.stringify([{productName:stamp,unit:'KG',quantity:1,unitCost:0.01}]),totalAmount:'0.01'};};}
  if(mode==='documents'){limit=50*1048576;url='/api/documents';field='file';body=()=>({entity:stamp,title:stamp});}
  if(mode==='chat'){limit=25*1048576;url='/api/client-messages/upload';field='file';token=ct;body=()=>({clientId:clients[0].id,requestId:randomUUID()});}
  if(mode==='official'){limit=25*1048576;url='/api/transport-guide-documents/review';field='document';guide=await require('./helpers/transport-guide-document-fixture')(prisma,'volume');}
  assert(limit&&field);server=fork(__filename,['server'],{env:process.env,stdio:['ignore','ignore','inherit','ipc']});base=await new Promise((resolve,reject)=>{server.once('message',m=>resolve('http://127.0.0.1:'+m.port));server.once('error',reject);});
  const data=Buffer.alloc(limit+1,65),successful=[];
  for(const delta of [-1,0,1]){
   const bytes=data.subarray(0,limit+delta),beforeFiles=files(),beforeCounts=await counts();
   const fields=mode==='official'?{payload:JSON.stringify({guideId:guide.transport.id,reason:'Boundary volume',file:guide.describe(bytes,filename,'text/plain')})}:body();
   const result=await request(url,{method:'POST',form:multipart(fields,bytes),expected:delta===1?(mode==='official'?400:413):mode==='inventory'||mode==='documents'?201:200});
   result.record.uploadBytes=bytes.length;result.record.boundaryDelta=delta;
   if(delta===1||mode==='official'){assert.deepEqual(files(),beforeFiles);assert.deepEqual(await counts(),beforeCounts);}
   if(delta<1)successful.push({result:result.body,fields,size:bytes.length,sha256:hash(bytes)});
  }
  const maximum=successful[1],same=()=>multipart(maximum.fields,data.subarray(0,limit));let download,identity;
  if(mode==='official'){
   const p=maximum.result,packet={proposal:p.proposal,requestId:p.requestId,reviewToken:p.reviewToken};url='/api/transport-guide-documents/commit';maximum.fields={payload:JSON.stringify(packet)};
   await request(url,{method:'POST',form:same(),drop:true});
   const receipt=(await request('/api/transport-guide-documents/result/'+p.requestId)).body;assert.equal(receipt.status,'CONFIRMED');
   const repeated=(await request(url,{method:'POST',form:same()})).body;assert.deepEqual(repeated.result,receipt.result);assert.equal(await prisma.transportGuideAttachment.count({where:{guideId:guide.transport.id}}),2);
   download='/api/transport-guide-documents/'+guide.transport.id+'/files/'+receipt.result.document.id;identity={name:'x-cw-document-id',value:String(receipt.result.document.id)};
   assert.equal(hash(fs.readFileSync(guide.disk)),hash(guide.oldBytes));
  }else if(mode==='documents'){
   const beforeList=(await request('/api/documents?entity='+stamp)).body.documents;
   await request(url,{method:'POST',form:same(),drop:true});
   const afterList=(await request('/api/documents?entity='+stamp)).body.documents;assert.equal(afterList.length,beforeList.length+1);
   const recovered=afterList.filter(row=>!beforeList.some(old=>old.id===row.id));assert.equal(recovered.length,1);download=recovered[0].url;
   // This legacy endpoint has no request UUID: recover by listing, never blindly repeat POST.
  }else{
   const lostFields=body(),repeat=()=>multipart(lostFields,data.subarray(0,limit));
   await request(url,{method:'POST',form:repeat(),drop:true});
   const beforeRepeat=await counts(),beforeFiles=files();const recovered=(await request(url,{method:'POST',form:repeat(),expected:mode==='inventory'?201:200})).body;
   assert.deepEqual(await counts(),beforeRepeat);assert.deepEqual(files(),beforeFiles);
   if(mode==='inventory'){assert(recovered.idempotent);download=recovered.purchase.documentPath;assert.equal(await prisma.stockMovement.count({where:{purchaseId:recovered.purchase.id}}),1);}
   else{assert(recovered.replayed);download='/api/client-messages/attachments/'+recovered.message.id;identity={name:'x-cw-message-id',value:String(recovered.message.id)};}
  }
  const downloaded=await request(download,{binary:true});assert.equal(downloaded.record.bytes,limit);assert.equal(downloaded.record.sha256,maximum.sha256);
  if(identity)assert.equal(downloaded.response.headers.get(identity.name),identity.value);
  if(mode!=='inventory'){await request(download,{credential:null,expected:401});await request(download,{credential:foreign,expected:mode==='chat'?404:403});}
  else{const publicRead=await request(download,{binary:true,credential:null});assert.equal(publicRead.record.sha256,maximum.sha256);}
  await request(url,{method:'POST',form:multipart(mode==='official'?maximum.fields:body(),Buffer.from('small')),credential:null,expected:401});
  if(mode==='chat')await request(url,{method:'POST',form:multipart(body(),Buffer.from('small')),credential:foreign,expected:403});
  const beforeBad=await counts(),filesBeforeBad=files(),small=mode==='official'?await guide.document():Buffer.from('opaque attachment');
  const duplicate=multipart(mode==='official'?{payload:JSON.stringify({guideId:guide.transport.id,reason:'Malformed upload',file:guide.describe(small)})}:body(),small);
  duplicate.append(field,new Blob([small]),filename);await request(mode==='official'?'/api/transport-guide-documents/review':url,{method:'POST',form:duplicate,expected:400});
  const truncated=Buffer.from('--qa-boundary\r\nContent-Disposition: form-data; name="'+field+'"; filename="incomplete.txt"\r\nContent-Type: text/plain\r\n\r\npartial');
  await request(mode==='official'?'/api/transport-guide-documents/review':url,{method:'POST',raw:truncated,headers:{'Content-Type':'multipart/form-data; boundary=qa-boundary'},expected:400});
  assert.deepEqual(await counts(),beforeBad);assert.deepEqual(files(),filesBeforeBad);
  assert.equal(await finance(),financeBefore);
  return {ok:true,mode,phase:'assertions-completed',limit,reads,downloadHash:maximum.sha256,belowAndExactAccepted:true,aboveRejected:true,malformedRejected:true,responseLossRecovered:true,duplicateWritesPrevented:mode!=='documents',manualListingRecoveryOnly:mode==='documents',downloadPolicy:mode==='inventory'?'Existing public inventory attachment path; not a private download guarantee':'Authenticated download with foreign/anonymous refusal',unrelatedFinancePreserved:true};
 }finally{
  if(server&&server.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill('SIGTERM');});
  if(guide)await guide.cleanup();
  await prisma.communicationLog.deleteMany({where:{clientId:{in:clients.map(c=>c.id)}}});await prisma.clientMessage.deleteMany({where:{clientId:{in:clients.map(c=>c.id)}}});
  await prisma.operationalReminder.deleteMany({where:{sourceKey:{in:requestIds.map(id=>'inventory-purchase:'+id)}}});
  const purchases=await prisma.stockPurchase.findMany({where:{supplierName:stamp},select:{id:true}});await prisma.stockMovement.deleteMany({where:{purchaseId:{in:purchases.map(p=>p.id)}}});await prisma.stockPurchase.deleteMany({where:{id:{in:purchases.map(p=>p.id)}}});
  await prisma.stockBalance.deleteMany({where:{productName:stamp}});await prisma.inventoryProduct.deleteMany({where:{name:stamp}});await prisma.client.deleteMany({where:{id:{in:clients.map(c=>c.id)}}});
  fs.rmSync(diskRoot,{recursive:true,force:true});assert.deepEqual(await counts(),before,'Fixture cleanup must restore model counts');assert.equal(await finance(),financeBefore);
 }
}
async function main(){
 fs.mkdirSync(folder,{recursive:true});const results=[],failures=[],engine=(await prisma.$queryRawUnsafe('SELECT version() AS version'))[0].version;await prisma.$disconnect();
 for(const mode of ['inventory','documents','chat','official']){
  const dir=fs.mkdtempSync(path.join(require('../src/config/uploadPath').resolveUploadSubdir(''),'attachment-volume-'));
  try{results.push(await new Promise((resolve,reject)=>{let packet;const child=fork(__filename,['probe',mode],{env:{...process.env,UPLOAD_DIR:path.relative(root,dir)},stdio:['ignore','pipe','pipe','ipc']});let err='';child.stderr.on('data',b=>{err+=b;});child.stdout.on('data',()=>{});child.on('message',p=>{packet=p;});child.once('error',reject);child.once('exit',(code,signal)=>{if(code===0&&!signal&&packet?.ok)resolve(packet);else reject(Error(mode+': '+(packet?.error||err.slice(-1500)||'Missing completion proof')));});}));}
  catch(error){failures.push({mode,error:error.message});console.error(error.message);}finally{fs.rmSync(dir,{recursive:true,force:true});}
  fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({ok:false,phase:'in-progress',engine,results,failures},null,2)+'\n');
 }
 assert.deepEqual(failures,[]);assert.equal(results.length,4);fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({ok:true,phase:'assertions-completed',engine,results,cleanupVerified:true,scope:'Four upload surfaces, configured limit minus one/exact/plus one, real HTTP/SQL, download SHA-256, access policy, lost response, multipart truncation/multiple files, unchanged finance and fixture cleanup. Separate fresh API and client processes per surface; each RSS sampled independently, excluding database. Other four photo/expense surfaces remain a subsequent batch. Generic attachments preserve arbitrary byte types. General documents recover by listing, not idempotent POST; inventory legacy file URLs remain public.'},null,2)+'\n');
 completed=true;console.log('PASS attachment volume: four surfaces, below/exact/above limits, full download hashes, access, response-loss recovery, malformed multipart, unchanged finance and cleanup');
}
async function serve(){
 const uploads=require('../src/config/uploadPath'),app=require('express')();app.use(require('express').json());
 app.use((req,res,next)=>{const json=res.json.bind(res);res.json=data=>{if(req.headers['x-qa-drop-response']==='true'&&res.statusCode>=200&&res.statusCode<300){res.destroy();return res;}return json(data);};next();});
 for(const [prefix,route]of [['inventory','inventoryRoutes'],['documents','documentRoutes'],['client-messages','clientMessageRoutes'],['transport-guide-documents','transportGuideDocumentRoutes']])app.use('/api/'+prefix,require('../src/routes/'+route));
 app.use(uploads.getUploadsPublicBasePath(),require('../src/services/transportGuideDocumentFiles').protectUploads,require('../src/services/clientChatAttachmentService').protectLegacyUploads,require('express').static(uploads.resolveUploadBaseDir()));app.use(require('../src/middlewares/errorHandlerMiddleware'));
 let timer,peak;const sample=()=>{peak=Math.max(peak,process.memoryUsage().rss);};process.on('message',({command})=>{if(command==='start'){peak=process.memoryUsage().rss;timer=setInterval(sample,5);process.send({ready:true});}else{sample();clearInterval(timer);process.send({rssMiB:mib(peak)});}});
 await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>process.send({port:s.address().port}));s.once('error',reject);process.on('SIGTERM',()=>{clearInterval(timer);s.close(()=>{completed=true;resolve();});});});
}
(process.argv[2]==='server'?serve():process.argv[2]==='probe'?probe(process.argv[3]).then(result=>{completed=true;process.send({...result,cleanupVerified:true});}):main()).catch(error=>{console.error(error);if(process.send)process.send({ok:false,error:error.message});process.exitCode=1;}).finally(async()=>{await prisma.$disconnect();clearTimeout(deadline);if(process.send)process.disconnect();});
