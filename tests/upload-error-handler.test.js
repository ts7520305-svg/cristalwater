import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { MulterError } = require('multer');
const source = readFileSync(new URL('../src/middlewares/errorHandlerMiddleware.js', import.meta.url), 'utf8');

function handle(error, contentType = 'multipart/form-data; boundary=qa') {
  const logger = { error: vi.fn() };
  const sandbox = { module: { exports: {} }, require: name => {
    if (name === 'multer') return { MulterError };
    if (name === '../services/loggerService') return logger;
    throw Error('Unexpected dependency');
  } };
  vm.runInNewContext(source, sandbox);
  const res = { status: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const req = { headers: { 'content-type': contentType }, originalUrl: '/api/documents', method: 'POST', user: { id: 1 } };
  sandbox.module.exports(error, req, res, vi.fn());
  return { res, logger, req };
}

describe('upload errors retain actionable responses without masking server failures', () => {
  it.each([['LIMIT_FILE_SIZE', 413], ['LIMIT_UNEXPECTED_FILE', 400]])('returns a private client error for %s', (code, status) => {
    const { res, logger } = handle(new MulterError(code, 'PRIVATE_FIELD'));
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: expect.any(String) });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('PRIVATE_FIELD');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each(['Unexpected end of form', 'Unexpected end of file', 'Multipart: Boundary not found', 'Malformed part header'])('rejects malformed multipart: %s', message => {
    const { res, logger } = handle(Error(message));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: expect.any(String) });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    [Error('PRIVATE_DATABASE_PATH'), 'multipart/form-data; boundary=qa'],
    [Error('Unexpected end of form'), 'application/json'],
    [Object.assign(Error('PRIVATE_DISK_FAILURE'), { code: 'LIMIT_FILE_SIZE' }), 'multipart/form-data; boundary=qa'],
  ])('retains generic 500 and diagnostic logging for application errors', (error, contentType) => {
    const { res, logger, req } = handle(error, contentType);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'Erro interno do servidor' });
    expect(logger.error).toHaveBeenCalledWith('SERVER_ERROR', { message: error.message, stack: error.stack, url: req.originalUrl, method: req.method, user: req.user });
  });
});
