'use strict';
require('../../src/loadEnv')();
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||process.env.EMAIL_ENABLED!=='false'||process.env.EXTERNAL_NOTIFICATIONS_ENABLED!=='false'||!process.send)throw Error('Isolated QA child required');
const express=require('express'),path=require('node:path'),{prisma}=require('../../src/prismaClient');
let fault=null,provider='local',delay=0,calls=[];
const transaction=prisma.$transaction.bind(prisma);
prisma.$transaction=(work,options)=>transaction(async db=>{if(fault==='finance')db.invoice.findMany=async()=>{throw Error('QA_PRIVATE_SOURCE_FAILURE');};if(fault==='coverage')db.stockMovement.findMany=async()=>{throw Error('QA_PRIVATE_COVERAGE_FAILURE');};if(fault==='maintenance-revenue')db.operationalReminder.findMany=async()=>{throw Error('QA_PRIVATE_MAINTENANCE_REVENUE_FAILURE');};if(fault==='revenue')db.invoiceLine.findMany=async()=>{throw Error('QA_PRIVATE_REVENUE_FAILURE');};return work(db);},options);
for(const method of ['count','findMany']){const original=prisma.serviceVisit[method].bind(prisma.serviceVisit);prisma.serviceVisit[method]=(...args)=>fault==='operations'?Promise.reject(Error('QA_PRIVATE_OPERATION_FAILURE')):original(...args);}
process.env.OPENAI_API_KEY='qa-placeholder-not-a-real-key';process.env.ENABLE_ADMIN_AI_OPENAI='false';process.env.ENABLE_ADMIN_AI_WEB='false';
const app=express();app.use(express.json({limit:'1mb'}));
app.post('/qa-provider/responses',async(req,res)=>{calls.push(req.body);if(delay)await new Promise(r=>setTimeout(r,delay));if(provider==='error')return res.status(503).json({error:{message:'QA_PRIVATE_PROVIDER_FAILURE'}});if(provider==='incomplete')return res.json({status:'incomplete',output_text:'{"answer":"Parcial","recommendations":[]}'});if(provider==='refusal')return res.json({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'QA'}]}]});if(provider==='malformed')return res.json({status:'completed',output_text:'not JSON'});res.json({status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'QA: análise financeira com dados do mês '+JSON.parse(req.body.input[1].content[0].text).platformContext.finance.monthRef,recommendations:['QA: confirmar recebimentos antes de contactar clientes.'],actions:[{type:'create_invoice_draft',payload:{clientId:1}}]})}]}]});});
app.use('/api/ai-admin',require('../../src/routes/aiAdminRoutes'));
app.get('/admin-ai',(req,res)=>res.sendFile(path.resolve(__dirname,'../../frontend/admin-ai.html')));
app.use(express.static(path.resolve(__dirname,'../../frontend')));
const server=app.listen(0,'127.0.0.1',()=>{const port=server.address().port;process.env.OPENAI_BASE_URL='http://127.0.0.1:'+port+'/qa-provider';process.send({port});});
process.on('message',m=>{if('fault'in m)fault=m.fault;if('provider'in m){provider=m.provider;process.env.ENABLE_ADMIN_AI_OPENAI=provider==='local'?'false':'true';}if('delay'in m)delay=m.delay;if(m.reset)calls=[];process.send({configured:true,calls});});
process.on('SIGTERM',()=>server.close(async()=>{await prisma.$disconnect();process.exit(0);}));
