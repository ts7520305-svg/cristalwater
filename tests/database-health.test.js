import {describe,it,expect,vi} from 'vitest';
const {checkDatabaseHealth}=require('../src/services/databaseHealthService');
describe('public database health',()=>{
 it('reports available only after a successful database query',async()=>{
  const query=vi.fn(async()=>[{one:1}]);expect(await checkDatabaseHealth({$queryRaw:query})).toEqual({ok:true,database:'ONLINE'});expect(query.mock.calls[0][0].join('')).toBe('SELECT 1');
 });
 it.each(['connection refused: postgresql://private:password@host/database','Prisma error: /private/server/config'])('does not disclose internal errors: %s',async message=>{
  const result=await checkDatabaseHealth({$queryRaw:async()=>{throw Error(message);}});expect(result.ok).toBe(false);expect(result.database).toBe('ERROR');expect(JSON.stringify(result)).not.toContain(message);expect(result.error).toBe('Base de dados temporariamente indisponível.');
 });
});
