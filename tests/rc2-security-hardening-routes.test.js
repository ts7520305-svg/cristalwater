import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("RC2 security hardening route guards", () => {
  it("protects core/flow and operational modules with auth middleware", () => {
    const core = read("src/routes/coreFlowRoutes.js");
    const opFlow = read("src/routes/operationalFlowRoutes.js");
    const billing = read("src/routes/billingRoutes.js");
    const crm = read("src/routes/enterpriseCrmRoutes.js");

    expect(core).toMatch(/const auth = require\('\.\.\/middlewares\/authMiddleware'\);/);
    expect(core).toMatch(/adminAuth = auth\('ADMIN'\)/);
    expect(opFlow).toMatch(/router\.use\(auth\('ADMIN'\)\);/);
    expect(billing).toMatch(/router\.use\(auth\("ADMIN"\)\);/);
    expect(crm).toMatch(/router\.use\(auth\("ADMIN"\)\);/);
  });

  it("protects guide/repair/key/chat/operational-state with auth and role checks", () => {
    const guide = read("src/routes/guideRoutes.js");
    const repair = read("src/routes/repairRoutes.js");
    const keys = read("src/routes/keyRoutes.js");
    const chat = read("src/routes/chatRoutes.js");
    const opState = read("src/routes/operationalStateRoutes.js");

    for (const text of [guide, repair, keys, chat, opState]) {
      expect(text).toMatch(/router\.use\(auth\(\)\);/);
      expect(text).toMatch(/allowRoles/);
    }
  });

  it("enforces client ownership in chat controller", () => {
    const chatController = read("src/controllers/chatController.js");
    expect(chatController).toMatch(/if \(isClientRole\(req\)\)/);
    expect(chatController).toMatch(/Acesso negado/);
    expect(chatController).toMatch(/scopedClientId !== clientId/);
  });

  it("restricts technical proposals to technicians and admins", () => {
    const core = read("src/routes/coreFlowRoutes.js");
    expect(core).toMatch(/technical-change-proposals[\s\S]{0,120}technicianAuth/);
    expect(core).not.toMatch(/const anyAuth = auth\(\);/);
  });

  it("opens protected guide PDFs through an authenticated download", () => {
    const helper = read("frontend/cw-auth-download.js");
    const admin = read("frontend/admin-vehicles.js");
    const technician = read("frontend/technician-field-mode.js");
    expect(helper).toMatch(/Authorization: 'Bearer ' \+ session\.token/);
    expect(helper).toMatch(/URL\.createObjectURL/);
    expect(admin).toMatch(/data-auth-download/);
    expect(technician).toMatch(/data-auth-download/);
  });

  it("imports bcrypt for the real-month fallback admin", () => {
    const script = read("scripts/test-real-month-flow-api.js");
    expect(script).toMatch(/const bcrypt = require\("bcryptjs"\);/);
  });
});
