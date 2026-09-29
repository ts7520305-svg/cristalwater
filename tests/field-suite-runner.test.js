import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const { runFieldScript } = createRequire(import.meta.url)('../scripts/lib/run-field-script');
const directories = [], pids = new Set();

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-field-runner-'));
  directories.push(root);
  fs.mkdirSync(path.join(root, 'scripts')); fs.mkdirSync(path.join(root, 'logs'));
  return { root, evidence: path.join(root, 'logs'), write(name, source) { fs.writeFileSync(path.join(root, 'scripts', name), source); } };
}

function alive(pid) {
  // Linux may retain a killed, reparented process as a zombie until PID1 reaps
  // it. Such a process is stopped and cannot serve requests or hold descriptors.
  try { process.kill(pid, 0); }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
  if (process.platform === 'linux') {
    try { if (fs.readFileSync('/proc/' + pid + '/stat', 'utf8').split(') ')[1].startsWith('Z ')) return false; }
    catch (error) { if (!['ENOENT', 'EACCES'].includes(error.code)) throw error; }
  }
  return true;
}

afterEach(() => {
  for (const pid of pids) { if (alive(pid)) process.kill(pid, 'SIGKILL'); }
  pids.clear();
  for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function withDescendant(f, exitParent = false) {
  f.write('descendant.js', `process.on('SIGTERM',()=>{});process.send({ready:true});process.stderr.write('DESCENDANT_READY\\n');setInterval(()=>{},1000);`);
  f.write('parent.js', `const fs=require('node:fs'),path=require('node:path'),{fork}=require('node:child_process');
    const child=fork(path.join(__dirname,'descendant.js'),[],{stdio:['ignore','ignore','inherit','ipc']});
    fs.writeFileSync(path.join(__dirname,'pids.json'),JSON.stringify({parent:process.pid,descendant:child.pid}));
    child.once('message',()=>{console.log('PARENT_READY');${exitParent ? 'process.exit(0);' : 'setInterval(()=>{},1000);'}});`);
}

async function rememberPids(f) {
  const file = path.join(f.root, 'scripts', 'pids.json');
  await expect.poll(() => fs.existsSync(file), { timeout: 2500 }).toBe(true);
  const ids = JSON.parse(fs.readFileSync(file, 'utf8'));
  pids.add(ids.parent); pids.add(ids.descendant); return ids;
}

describe('field suite process supervision', () => {
  it('preserves success, nonzero exits and stderr after stdout closes', async () => {
    const f = fixture();
    f.write('success.js', `const fs=require('node:fs');fs.writeSync(1,'OUT\\n');fs.closeSync(1);setTimeout(()=>fs.writeSync(2,'LATE_ERROR_CHANNEL\\n'),50);`);
    f.write('failure.js', `process.stderr.write('ASSERTION_FAILED\\n');process.exitCode=7;`);
    const success = await runFieldScript('success.js', f), failure = await runFieldScript('failure.js', f);
    expect(success).toMatchObject({ script: 'success.js', code: 0, signal: null });
    expect(success.timedOut).toBeUndefined();
    expect(fs.readFileSync(path.join(f.evidence, 'success.js.log'), 'utf8')).toBe('OUT\nLATE_ERROR_CHANNEL\n');
    expect(failure).toMatchObject({ script: 'failure.js', code: 7, signal: null });
    expect(fs.readFileSync(path.join(f.evidence, 'failure.js.log'), 'utf8')).toBe('ASSERTION_FAILED\n');
  });

  it.skipIf(process.platform === 'win32')('times out a forked server, keeps its log and runs the next test without killing unrelated processes', async () => {
    const f = fixture(); withDescendant(f);
    const sentinel = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
    pids.add(sentinel.pid);
    f.write('next.js', `console.log('NEXT_TEST_PASSED');`);
    const pending = runFieldScript('parent.js', { ...f, timeoutMs: 3000 });
    const ids = await rememberPids(f), result = await pending;
    expect(result).toMatchObject({ code: 1, signal: 'SIGKILL', timedOut: true, timeoutMs: 3000 });
    expect(result.cleanupIncomplete).toBeUndefined();
    expect(result.ms).toBeGreaterThanOrEqual(3000); expect(result.ms).toBeLessThan(5000);
    await expect.poll(() => alive(ids.parent) || alive(ids.descendant)).toBe(false);
    expect(alive(sentinel.pid)).toBe(true);
    const log = fs.readFileSync(path.join(f.evidence, 'parent.js.log'), 'utf8');
    expect(log).toContain('PARENT_READY'); expect(log).toContain('DESCENDANT_READY');
    expect(await runFieldScript('next.js', f)).toMatchObject({ code: 0, signal: null });
    expect(fs.readFileSync(path.join(f.evidence, 'next.js.log'), 'utf8')).toBe('NEXT_TEST_PASSED\n');
  }, 10000);

  it.skipIf(process.platform === 'win32')('cleans an inherited server even when the parent exits successfully before its deadline', async () => {
    const f = fixture(); withDescendant(f, true);
    const pending = runFieldScript('parent.js', { ...f, timeoutMs: 3000 });
    const ids = await rememberPids(f), result = await pending;
    expect(result).toMatchObject({ code: 0, signal: null }); expect(result.timedOut).toBeUndefined();
    await expect.poll(() => alive(ids.parent) || alive(ids.descendant)).toBe(false);
    expect(fs.readFileSync(path.join(f.evidence, 'parent.js.log'), 'utf8')).toContain('PARENT_READY');
  });

  it('records spawn and log errors without preventing the next script', async () => {
    const f = fixture(); f.write('next.js', `console.log('NEXT_TEST_PASSED');`);
    const badCwd = await runFieldScript('next.js', { root: path.join(f.root, 'missing'), evidence: f.evidence });
    expect(badCwd).toMatchObject({ code: 1, signal: null }); expect(badCwd.error).toContain('ENOENT');
    const badLog = await runFieldScript('next.js', { root: f.root, evidence: path.join(f.root, 'missing') });
    expect(badLog).toMatchObject({ code: 1, signal: null }); expect(badLog.error).toContain('ENOENT');
    expect(await runFieldScript('next.js', f)).toMatchObject({ code: 0 });
  });
});
