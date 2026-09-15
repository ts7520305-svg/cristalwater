import {describe,it,expect} from 'vitest';
const {configurationChecks}=require('../scripts/lib/vps-preflight-checks');
const keys=require('web-push').generateVAPIDKeys();
const base={NODE_ENV:'production',DATABASE_URL:'postgresql://qa:secret-db-password@localhost/qa',JWT_SECRET:'private-test-signing-material-123456789',PORT:'3002',CORS_ORIGIN:'https://app.cristalwater.pt',WEB_PUSH_SUBJECT:'mailto:qa@example.com',WEB_PUSH_PUBLIC_KEY:keys.publicKey,WEB_PUSH_PRIVATE_KEY:keys.privateKey};
describe('field VPS configuration gates',()=>{
 it('accepts the configured field runtime without billing or AI jobs',()=>{expect(configurationChecks({...base,ENABLE_BACKGROUND_JOBS:'false'}).every(c=>c.ok)).toBe(true);});
 it.each([{QA_MODE:'true'},{NODE_ENV:'test'},{EXTERNAL_NOTIFICATIONS_ENABLED:'false'},{WEB_PUSH_PRIVATE_KEY:''},{CORS_ORIGIN:'*'},{CORS_ORIGIN:'http://app.cristalwater.pt'},{PORT:'70000'},{DATABASE_URL:'file:dev.db'},{ALLOW_LEGACY_PLAIN_PASSWORDS:'true'}])('blocks an unsafe field configuration %o',change=>{expect(configurationChecks({...base,...change}).some(c=>!c.ok)).toBe(true);});
 it('does not expose credentials or keys in its diagnostic output',()=>{const output=JSON.stringify(configurationChecks({...base,WEB_PUSH_PUBLIC_KEY:'invalid',QA_MODE:'true'}));for(const secret of [base.JWT_SECRET,base.WEB_PUSH_PRIVATE_KEY,'secret-db-password'])expect(output).not.toContain(secret);});
});
