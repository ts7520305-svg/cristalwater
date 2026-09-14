import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import vm from "node:vm";

function browser({ status = 200, popupBlocked = false } = {}) {
  const popup = { location: {}, close: vi.fn(), opener: {} };
  const fetch = vi.fn().mockResolvedValue({ ok: status === 200, status, blob: async () => "pdf-bytes" });
  const BlobURL = class extends URL {};
  BlobURL.createObjectURL = vi.fn().mockReturnValue("blob:qa-pdf");
  BlobURL.revokeObjectURL = vi.fn();
  const window = { location: new URL("https://pool.test/admin-vehicles"), open: vi.fn(() => popupBlocked ? null : popup) };
  const context = { window, fetch, URL: BlobURL, document: { addEventListener: vi.fn() },
    localStorage: { getItem: (key) => key === "cristalwater_jwt" ? "qa-session" : null }, setTimeout: vi.fn() };
  vm.runInNewContext(fs.readFileSync("frontend/cw-auth-download.js", "utf8"), context);
  return { ...context, popup, open: window.CristalDownloads.open };
}

describe("authenticated guide documents", () => {
  it("fetches with the current session and displays the document, never the token URL", async () => {
    const b = browser();
    await b.open("/api/guides/work/7/pdf");
    expect(b.fetch).toHaveBeenCalledWith("/api/guides/work/7/pdf", { headers: { Authorization: "Bearer qa-session" } });
    expect(b.popup.location.href).toBe("blob:qa-pdf");
    expect(b.popup.opener).toBeNull();
    b.setTimeout.mock.calls[0][0]();
    expect(b.URL.revokeObjectURL).toHaveBeenCalledWith("blob:qa-pdf");
  });
  it.each([401, 403, 500])("closes the blank window on HTTP %s", async (status) => {
    const b = browser({ status });
    await expect(b.open("/api/guides/work/7/pdf")).rejects.toThrow();
    expect(b.popup.close).toHaveBeenCalled();
    expect(b.URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("does not disclose the token to external URLs", async () => {
    const b = browser();
    await expect(b.open("https://other.test/api/guides/work/7/pdf")).rejects.toThrow();
    expect(b.fetch).not.toHaveBeenCalled();
  });
  it("reports a blocked popup instead of silently losing the PDF", async () => {
    const b = browser({ popupBlocked: true });
    await expect(b.open("/api/guides/work/7/pdf")).rejects.toThrow("nova janela");
    expect(b.fetch).not.toHaveBeenCalled();
  });
});
