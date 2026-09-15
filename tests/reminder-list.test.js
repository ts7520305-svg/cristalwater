import { it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/business/admin/ReminderListBusiness.js', import.meta.url), 'utf8');
it('does not report an empty or partial reminder list when a database page fails', async () => {
  let calls = 0;
  const tx = { generalReminder: { async findMany() {
    if (calls++) throw Error('database page unavailable');
    return Array.from({ length: 500 }, (_, i) => ({ id: i + 1 }));
  } } };
  const prisma = { generalReminder: {}, $transaction: async fn => fn(tx) };
  const sandbox = { require: () => ({ prisma }), module: { exports: {} } };
  vm.runInNewContext(source, sandbox);
  await expect(sandbox.module.exports.list()).rejects.toThrow('database page unavailable');
});
