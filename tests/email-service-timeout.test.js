import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nodemailer = require('nodemailer');
const { sendEmail } = require('../src/services/emailService');
const payload = { to: 'timeout@qa.invalid', subject: 'Synthetic timeout test', text: 'No real delivery' };
let sendMail, close, create;

describe('SMTP outcome bounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const [key, value] of Object.entries({ NODE_ENV: 'test', QA_MODE: 'false', EMAIL_ENABLED: 'true', SMTP_HOST: 'smtp.qa.invalid', SMTP_USER: 'qa', SMTP_PASS: 'qa-test-only' })) vi.stubEnv(key, value);
    sendMail = vi.fn();
    close = vi.fn();
    create = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

  it('preserves the provider response and closes the one transport', async () => {
    const result = { accepted: [payload.to], rejected: [] };
    sendMail.mockResolvedValue(result);
    expect(await sendEmail(payload)).toBe(result);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 60000 }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves failures without retrying or reporting acceptance', async () => {
    const error = new Error('synthetic connection lost');
    sendMail.mockRejectedValue(error);
    await expect(sendEmail(payload)).rejects.toBe(error);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a stalled provider and keeps a late response uncertain', async () => {
    let resolve;
    sendMail.mockImplementation(() => new Promise(done => { resolve = done; }));
    const outcome = sendEmail(payload).then(result => ({ result }), error => ({ error }));
    await vi.advanceTimersByTimeAsync(90000);
    const result = await outcome;
    expect(result.error).toMatchObject({ message: 'smtp_result_unconfirmed', statusCode: 503 });
    resolve({ accepted: [payload.to] });
    await vi.runAllTimersAsync();
    expect(await outcome).toBe(result);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('blocks disabled integrations before creating a transport', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'false');
    await expect(sendEmail(payload)).rejects.toMatchObject({ code: 'disabled_in_qa' });
    expect(create).not.toHaveBeenCalled();
  });

  it('does not start a timeout when SMTP is unconfigured', async () => {
    vi.stubEnv('SMTP_HOST', '');
    await expect(sendEmail(payload)).rejects.toMatchObject({ code: 'smtp_not_configured' });
    expect(create).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
