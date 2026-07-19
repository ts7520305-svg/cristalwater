import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadEnvModulePath = path.resolve(process.cwd(), "src/loadEnv.js");

function mkTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cw-loadenv-"));
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function clearKeys(keys) {
  for (const key of keys) delete process.env[key];
}

function resolveLoadEnv(mod) {
  return mod.loadEnv || mod.default || mod;
}

describe("loadEnv QA hardening", () => {
  const originalCwd = process.cwd();

  beforeEach(() => {
    vi.resetModules();
    clearKeys(["NODE_ENV", "PORT", "QA_MODE", "ENV_SOURCE", "ENV_FILE_LOADED"]);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.resetModules();
    clearKeys(["NODE_ENV", "PORT", "QA_MODE", "ENV_SOURCE", "ENV_FILE_LOADED"]);
  });

  it("fails when NODE_ENV=qa and .env.qa is missing", async () => {
    const tmp = mkTempDir();
    writeFile(path.join(tmp, ".env"), "PORT=3002\nNODE_ENV=production\n");
    process.chdir(tmp);
    process.env.NODE_ENV = "qa";

    const loadEnv = resolveLoadEnv(await import(loadEnvModulePath));
    expect(() => loadEnv()).toThrow(/Missing required environment file/i);
  });

  it("never falls back from qa to .env", async () => {
    const tmp = mkTempDir();
    writeFile(path.join(tmp, ".env"), "PORT=3002\nQA_MODE=false\n");
    process.chdir(tmp);
    process.env.NODE_ENV = "qa";

    const loadEnv = resolveLoadEnv(await import(loadEnvModulePath));
    expect(() => loadEnv()).toThrow(/\.env\.qa/i);
    expect(process.env.PORT).toBeUndefined();
    expect(process.env.ENV_SOURCE).toBeUndefined();
  });

  it("loads .env.qa explicitly when NODE_ENV=qa", async () => {
    const tmp = mkTempDir();
    writeFile(path.join(tmp, ".env.qa"), "PORT=3102\nQA_MODE=true\n");
    process.chdir(tmp);
    process.env.NODE_ENV = "qa";

    const loadEnv = resolveLoadEnv(await import(loadEnvModulePath));
    loadEnv();

    expect(process.env.PORT).toBe("3102");
    expect(process.env.QA_MODE).toBe("true");
    expect(process.env.ENV_SOURCE).toBe("qa");
    expect(process.env.ENV_FILE_LOADED).toBe(".env.qa");
  });

  it("keeps production compatibility by loading .env", async () => {
    const tmp = mkTempDir();
    writeFile(path.join(tmp, ".env"), "PORT=3002\nNODE_ENV=production\n");
    process.chdir(tmp);
    process.env.NODE_ENV = "production";

    const loadEnv = resolveLoadEnv(await import(loadEnvModulePath));
    loadEnv();

    expect(process.env.PORT).toBe("3002");
    expect(process.env.ENV_SOURCE).toBe("production");
    expect(process.env.ENV_FILE_LOADED).toBe(".env");
  });
});
