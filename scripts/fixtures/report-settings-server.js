'use strict';
require('../../src/loadEnv')();
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||!process.send)throw Error('Isolated QA child required');
const express=require('express'),{prisma}=require('../../src/prismaClient');
const transaction=prisma.$transaction.bind(prisma);let fault=null;
prisma.$transaction=(work,options)=>transaction(async tx=>{
  const methods={read:['client','findUnique'],setting:['clientReportSetting','upsert'],audit:['userAuditLog','create'],receipt:['fieldWriteRequest','create']};
  if(methods[fault]){const [model,method]=methods[fault];tx[model][method]=async()=>{throw Error('QA_PRIVATE_REPORT_SETTINGS_FAILURE');};}
  return work(tx);
},options);
const app=express();app.use(express.json());app.use('/api/report-settings',require('../../src/routes/reportSettingRoutes'));
const server=app.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
process.on('message',message=>{fault=message.fault;process.send({configured:true});});
process.on('SIGTERM',()=>server.close(async()=>{await prisma.$disconnect();process.exit(0);}));
