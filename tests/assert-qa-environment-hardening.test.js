import { describe, expect, it } from "vitest";
import path from "path";
import { spawnSync } from "child_process";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts/assert-qa-environment.js");

function runAssert(extraEnv = {}) {
  const env = {
    ...process.env,
    NODE_ENV: "qa",
    QA_MODE: "true",
    ENV_SOURCE: "qa",
    ENV_FILE_LOADED: ".env.qa",
    PORT: "3102",
    DATABASE_URL: "postgresql://qa_user:secret@qa-db.internal:5432/cristal_qa?schema=public",
    UPLOAD_DIR: "uploads/qa/run-123",
    STORAGE_ID: "cristalwater-qa",
    WHATSAPP_ENABLED: "false",
    EMAIL_ENABLED: "false",
    FISCAL_ISSUING_ENABLED: "false",
    WEBHOOKS_ENABLED: "false",
    EXTERNAL_NOTIFICATIONS_ENABLED: "false",
    KNOWN_PROD_DB_HOSTS: "aws-0-eu-west-1.pooler.supabase.com",
    KNOWN_PROD_DB_NAMES: "cristalwater_production_20260707",
    KNOWN_PROD_DB_USERS: "postgres.pwgagxzojdftqxkwwbsy",
    ...extraEnv,
  };

  return spawnSync("node", [scriptPath], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
}

describe("assert-qa-environment hardening", () => {
  it("fails QA when PORT is not 3102", () => {
    const result = runAssert({ PORT: "3999" });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("FAIL=PORT deve ser 3102");
  });

  it("fails QA when database points to known production", () => {
    const result = runAssert({
      DATABASE_URL: "postgresql://qa_user:secret@aws-0-eu-west-1.pooler.supabase.com:5432/cristalwater_production_20260707?schema=public",
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("FAIL=host coincide com produção conhecida");
    expect(result.stdout).toContain("FAIL=base coincide com produção conhecida");
  });

  it("fails QA when upload path is production-like", () => {
    const result = runAssert({ UPLOAD_DIR: "uploads" });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("FAIL=uploads apontam para diretório produtivo");
  });

  it("fails QA when WhatsApp is active", () => {
    const result = runAssert({ WHATSAPP_ENABLED: "true" });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("FAIL=WHATSAPP_ENABLED deve ser false em QA");
  });

  it("does not print DATABASE_URL or secret tokens", () => {
    const result = runAssert({
      DATABASE_URL: "postgresql://qa_user:top-secret@qa-db.internal:5432/cristal_qa?schema=public",
      TWILIO_AUTH_TOKEN: "super-secret-token",
      SMTP_PASS: "super-secret-smtp",
    });

    expect(result.stdout).not.toContain("postgresql://");
    expect(result.stdout).not.toContain("top-secret");
    expect(result.stdout).not.toContain("super-secret-token");
    expect(result.stdout).not.toContain("super-secret-smtp");
  });
});
