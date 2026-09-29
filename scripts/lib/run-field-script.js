'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

// Each POSIX test owns a process group, including its forked fixture servers.
// Log descriptors are inherited directly: an orphan cannot hold a runner pipe
// open and prevent ChildProcess.close after the test itself has exited.
function runFieldScript(script, { root, evidence, timeoutMs = 120000 }) {
  return new Promise(resolve => {
    const start = Date.now(), grouped = process.platform !== 'win32';
    let child, timer, cleanupTimer, settled = false, stopping = false;
    let timedOut = false, error;

    function stopTree() {
      if (!child?.pid || stopping) return;
      stopping = true;
      if (grouped) {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (failure) {
          if (failure.code !== 'ESRCH') { error = failure.message; child.kill('SIGKILL'); }
        }
      } else if (child.exitCode === null && child.signalCode === null) {
        // Windows has no POSIX groups; taskkill targets this test's tree only.
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        const killTimer = setTimeout(() => { killer.kill(); child.kill('SIGKILL'); }, 1000);
        killer.once('error', failure => { error = failure.message; child.kill('SIGKILL'); });
        killer.once('close', () => clearTimeout(killTimer));
        killer.unref();
      }
    }

    function finish(code, signal, cleanupIncomplete = false) {
      if (settled) return;
      settled = true;
      clearTimeout(timer); clearTimeout(cleanupTimer);
      stopTree();
      resolve({ script, code: timedOut || error || cleanupIncomplete ? 1 : code, signal, ms: Date.now() - start,
        ...(timedOut ? { timedOut: true, timeoutMs } : {}),
        ...(error ? { error } : {}), ...(cleanupIncomplete ? { cleanupIncomplete: true } : {}) });
    }

    let fd;
    try {
      fd = fs.openSync(path.join(evidence, script + '.log'), 'w');
      child = spawn(process.execPath, [path.join(root, 'scripts', script)], {
        cwd: root, env: process.env, detached: grouped, stdio: ['ignore', fd, fd]
      });
    } catch (failure) {
      error = failure.message; finish(1, null); return;
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    child.once('error', failure => { error = failure.message; finish(1, null); });
    child.once('close', (code, signal) => finish(code, signal));
    timer = setTimeout(() => {
      timedOut = true;
      stopTree();
      // A stuck OS teardown must still produce one failed result. This is only
      // a cleanup allowance; the test's execution budget remains 120 seconds.
      cleanupTimer = setTimeout(() => { child.unref(); finish(1, child.signalCode, true); }, 1000);
    }, timeoutMs);
  });
}

module.exports = { runFieldScript };
