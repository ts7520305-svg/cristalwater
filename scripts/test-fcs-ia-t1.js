const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { prisma } = require("../src/prismaClient");

const ROOT = path.join(__dirname, "..");
const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const REPORT_PATH = path.join(ROOT, "reports", `fcs-ia-t1-${Date.now()}.json`);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function pushCheck(checks, id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

async function request(method, endpoint, body, token, extraHeaders = {}, timeoutMs = 45000) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = { raw: text };
    }
    return { status: response.status, ok: response.ok, data };
  } catch (error) {
    const isTimeout = error && (error.name === "AbortError" || String(error.message || "").includes("aborted"));
    return {
      status: 0,
      ok: false,
      data: {
        error: isTimeout ? "REQUEST_TIMEOUT" : "REQUEST_ERROR",
        message: String(error && error.message ? error.message : error),
        endpoint,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function createTempAdmin() {
  const marker = `IA_T1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `${marker.toLowerCase()}@qa-ia-t1.test`;
  const plainPassword = `Tmp-${marker}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password,
      role: "ADMIN",
      active: true,
      name: `QA IA T1 ${marker}`,
      mustChangePassword: false,
    },
  });

  const login = await request("POST", "/api/auth/login", { email, password: plainPassword });
  if (!login.ok || !login.data?.token) {
    throw new Error(`ADMIN_LOGIN_FAILED status=${login.status}`);
  }

  return { userId: user.id, token: login.data.token, marker };
}

async function syntaxCheck() {
  const checkPath = path.join(ROOT, "scripts", "check-syntax.js");
  const { spawnSync } = require("child_process");
  const run = spawnSync(process.execPath, [checkPath], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 1024 * 1024 * 20,
  });
  return {
    ok: run.status === 0,
    status: run.status,
    stdout: String(run.stdout || ""),
    stderr: String(run.stderr || ""),
  };
}

(async function main() {
  ensureDir(REPORT_PATH);

  const checks = [];
  const artifacts = {};
  const created = { adminUserId: null };

  try {
    const syntax = await syntaxCheck();
    pushCheck(checks, "syntax", syntax.ok, `status=${syntax.status}`);

    const anonAdminAiStatus = await request("GET", "/api/admin-ai/status");
    pushCheck(checks, "admin-ai-anon-deny", [401, 403].includes(anonAdminAiStatus.status), `status=${anonAdminAiStatus.status}`);

    const admin = await createTempAdmin();
    created.adminUserId = admin.userId;

    const adminAiStatus = await request("GET", "/api/admin-ai/status", undefined, admin.token);
    pushCheck(checks, "admin-ai-status", adminAiStatus.status === 200 && adminAiStatus.data?.ok === true, `status=${adminAiStatus.status}`);

    const adminAiContext = await request("GET", "/api/admin-ai/context", undefined, admin.token);
    pushCheck(checks, "admin-ai-context", adminAiContext.status === 200 && adminAiContext.data?.ok === true, `status=${adminAiContext.status}`);

    const adminAiRecommendations = await request("GET", "/api/admin-ai/recommendations", undefined, admin.token);
    pushCheck(
      checks,
      "admin-ai-recommendations",
      adminAiRecommendations.status === 200 && adminAiRecommendations.data?.ok === true && Array.isArray(adminAiRecommendations.data?.recommendations),
      `status=${adminAiRecommendations.status}; recommendations=${Array.isArray(adminAiRecommendations.data?.recommendations) ? adminAiRecommendations.data.recommendations.length : -1}`
    );

    const adminAiChat = await request("POST", "/api/admin-ai/chat", { message: "Resumo operacional IA T1" }, admin.token, {}, 90000);
    const adminAiHasReply = Boolean(adminAiChat.data?.reply || adminAiChat.data?.message?.content);
    pushCheck(
      checks,
      "admin-ai-chat",
      adminAiChat.status === 200 && adminAiChat.data?.ok === true && adminAiHasReply,
      `status=${adminAiChat.status}; hasReply=${adminAiHasReply}`
    );

    const aiAdminStatus = await request("GET", "/api/ai-admin/status", undefined, admin.token);
    pushCheck(checks, "ai-admin-status", aiAdminStatus.status === 200 && aiAdminStatus.data?.ok === true, `status=${aiAdminStatus.status}`);

    const aiAdminChat = await request("POST", "/api/ai-admin/chat", { message: "Verificar contexto e recomendar prioridade." }, admin.token, {}, 90000);
    const aiAdminThreadId = Number(aiAdminChat.data?.threadId || 0);
    pushCheck(
      checks,
      "ai-admin-chat",
      aiAdminChat.status === 200 && aiAdminChat.data?.ok === true && aiAdminThreadId > 0,
      `status=${aiAdminChat.status}; threadId=${aiAdminThreadId}`
    );

    const aiAdminThreads = await request("GET", "/api/ai-admin/threads", undefined, admin.token);
    pushCheck(
      checks,
      "ai-admin-threads",
      aiAdminThreads.status === 200 && aiAdminThreads.data?.ok === true && Array.isArray(aiAdminThreads.data?.threads),
      `status=${aiAdminThreads.status}; threads=${Array.isArray(aiAdminThreads.data?.threads) ? aiAdminThreads.data.threads.length : -1}`
    );

    const aiAdminActions = await request("GET", "/api/ai-admin/actions", undefined, admin.token);
    pushCheck(
      checks,
      "ai-admin-actions",
      aiAdminActions.status === 200 && aiAdminActions.data?.ok === true && Array.isArray(aiAdminActions.data?.actions),
      `status=${aiAdminActions.status}; actions=${Array.isArray(aiAdminActions.data?.actions) ? aiAdminActions.data.actions.length : -1}`
    );

    const aiOpsContext = await request("GET", "/api/ai-ops/context", undefined, admin.token);
    pushCheck(checks, "ai-ops-context", aiOpsContext.status === 200 && aiOpsContext.data?.ok === true, `status=${aiOpsContext.status}`);

    const aiOpsChat = await request("POST", "/api/ai-ops/chat", { message: "Gerar ações operacionais do dia" }, admin.token, {}, 90000);
    pushCheck(
      checks,
      "ai-ops-chat",
      aiOpsChat.status === 200 && aiOpsChat.data?.ok === true && Boolean(aiOpsChat.data?.answer),
      `status=${aiOpsChat.status}; hasAnswer=${Boolean(aiOpsChat.data?.answer)}`
    );

    const aiOpsConversations = await request("GET", "/api/ai-ops/conversations", undefined, admin.token);
    pushCheck(
      checks,
      "ai-ops-conversations",
      aiOpsConversations.status === 200 && aiOpsConversations.data?.ok === true && Array.isArray(aiOpsConversations.data?.conversations),
      `status=${aiOpsConversations.status}; conversations=${Array.isArray(aiOpsConversations.data?.conversations) ? aiOpsConversations.data.conversations.length : -1}`
    );

    const aiOpsActions = await request("GET", "/api/ai-ops/actions", undefined, admin.token);
    pushCheck(
      checks,
      "ai-ops-actions",
      aiOpsActions.status === 200 && aiOpsActions.data?.ok === true && Array.isArray(aiOpsActions.data?.actions),
      `status=${aiOpsActions.status}; actions=${Array.isArray(aiOpsActions.data?.actions) ? aiOpsActions.data.actions.length : -1}`
    );

    const genericAiAsk = await request("POST", "/api/ai/ask", { question: "Qual é o foco operacional de hoje?" });
    pushCheck(
      checks,
      "ai-ask-public-endpoint",
      genericAiAsk.status === 200 && genericAiAsk.data?.success === true && Boolean(genericAiAsk.data?.answer),
      `status=${genericAiAsk.status}; success=${Boolean(genericAiAsk.data?.success)}`
    );

    artifacts.aiAdminThreadId = aiAdminThreadId;

    const passed = checks.filter((item) => item.pass).length;
    const total = checks.length;
    const mri = total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0;
    const ok = checks.every((item) => item.pass) && mri >= 95;

    const report = {
      ok,
      generatedAt: new Date().toISOString(),
      mission: "IA_T1",
      baseUrl: BASE_URL,
      totals: {
        checks: total,
        passed,
        failed: total - passed,
        mri,
        threshold: 95,
      },
      checks,
      artifacts,
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_PATH)}`);
    console.log(`MRI=${mri}`);
    console.log(`RESULT=${ok ? "PASS" : "FAIL"}`);
    if (!ok) process.exitCode = 1;
  } catch (error) {
    const report = {
      ok: false,
      generatedAt: new Date().toISOString(),
      mission: "IA_T1",
      baseUrl: BASE_URL,
      checks,
      error: {
        message: error.message,
        stack: String(error.stack || "").split("\n").slice(0, 8).join("\n"),
      },
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.error(`REPORT_JSON=${path.relative(ROOT, REPORT_PATH)}`);
    console.error("RESULT=FAIL");
    process.exitCode = 1;
  } finally {
    if (created.adminUserId) {
      await prisma.user.updateMany({ where: { id: created.adminUserId }, data: { active: false } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }
})();
