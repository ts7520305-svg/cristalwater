import { beforeEach, describe, expect, it, vi } from "vitest";

const createTransportMock = vi.hoisted(() => vi.fn());

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

describe("external integration kill-switch", () => {
  beforeEach(() => {
    vi.resetModules();
    createTransportMock.mockReset();
    global.fetch = vi.fn();

    process.env.NODE_ENV = "production";
    process.env.QA_MODE = "true";
    process.env.EMAIL_ENABLED = "false";
    process.env.WHATSAPP_ENABLED = "false";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.TWILIO_ACCOUNT_SID = "sid";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+100000000";
  });

  it("does not send email in QA even with SMTP configured when EMAIL_ENABLED=false", async () => {
    const { sendEmail } = await import("../src/services/emailService.js");

    await expect(sendEmail({
      to: "qa@example.com",
      subject: "qa",
      text: "qa",
    })).rejects.toMatchObject({ code: "disabled_in_qa" });

    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("does not call Twilio API in QA even with credentials when WHATSAPP_ENABLED=false", async () => {
    const { sendWhatsAppViaApi } = await import("../src/services/whatsappService.js");

    await expect(sendWhatsAppViaApi({
      toPhone: "+351912000000",
      text: "qa",
    })).rejects.toMatchObject({ code: "disabled_in_qa" });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
