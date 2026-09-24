'use strict';
require('../../src/loadEnv')();
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||process.env.EMAIL_ENABLED!=='false'||process.env.EXTERNAL_NOTIFICATIONS_ENABLED!=='false'||!process.send)throw Error('Isolated QA child required');
const express=require('express'),path=require('node:path'),{prisma}=require('../../src/prismaClient');
let fault=null;const transaction=prisma.$transaction.bind(prisma);
prisma.$transaction=(work,options)=>transaction(async db=>{for(const model of ['fieldWriteRequest','technicalHistory','userAuditLog']){const create=db[model].create.bind(db[model]);db[model].create=(...args)=>{if(fault===model)throw Error('QA_REPORT_ORIGIN_FAILURE');return create(...args);};}return work(db);},options);
const app=express();app.use(express.json({limit:'64kb'}));app.use('/api/report-visit',require('../../src/routes/reportVisitRoutes'));app.use('/api/reports',require('../../src/routes/reportRoutes'));app.use('/api/report-settings',require('../../src/routes/reportSettingRoutes'));app.use(express.static(path.resolve(__dirname,'../../frontend')));
const server=app.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
process.on('message',message=>{fault=message.fault||null;process.send({configured:true});});process.on('SIGTERM',()=>server.close(async()=>{await prisma.$disconnect();process.exit(0);}));
