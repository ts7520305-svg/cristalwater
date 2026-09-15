const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
require('../src/loadEnv')();
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw new Error('Isolated QA environment required');
const {inspectSchema}=require('./lib/vps-preflight-checks');
const root=path.resolve(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-preflight-'));
try{
 const aligned=inspectSchema({root});assert.equal(aligned.ok,true,aligned.detail);
 const target=path.join(dir,'schema.prisma');fs.writeFileSync(target,fs.readFileSync(path.join(root,'prisma/schema.prisma'),'utf8')+'\nmodel CwPreflightMissingTable {\n id Int @id\n}\n');
 const mismatch=inspectSchema({root,targetSchemaPath:target});assert.equal(mismatch.ok,false);assert.match(mismatch.detail,/difere/);
 assert.equal(inspectSchema({root}).ok,true,'The comparison must not modify the database');
 console.log('PASS preflight detects a missing schema change without applying migrations or altering the database');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
