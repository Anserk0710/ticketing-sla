import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService, EmailSendResult } from '../email/email.service';
import { AuthService } from './auth.service';

describe('AuthService.forgotPassword', () => {
  const user = { id: 'user-id', email: 'recipient@example.com' };
  let findUnique: jest.Mock;
  let create: jest.Mock;
  let write: jest.Mock;
  let sendPasswordResetEmail: jest.Mock;
  let service: AuthService;

  function createService(env: Record<string, string> = { NODE_ENV: 'production' }) {
    return new AuthService(
      { user: { findUnique }, passwordResetToken: { create } } as unknown as PrismaService,
      {} as JwtService,
      { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService,
      { write } as unknown as AuditService,
      { sendPasswordResetEmail } as unknown as EmailService,
    );
  }

  beforeEach(() => {
    findUnique = jest.fn().mockResolvedValue(user);
    create = jest.fn().mockResolvedValue({ id: 'reset-id' });
    write = jest.fn().mockResolvedValue({});
    sendPasswordResetEmail = jest.fn().mockResolvedValue({ status: 'SENT', recipientCount: 1 });
    service = createService();
  });

  it('emails the token matching the persisted hash and records delivery without exposing it', async () => {
    const startedAt = Date.now();
    const result = await service.forgotPassword(' Recipient@Example.com ', '127.0.0.1');
    expect(findUnique).toHaveBeenCalledWith({ where: { email: user.email } });
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [recipient, token] = sendPasswordResetEmail.mock.calls[0];
    expect(recipient).toBe(user.email);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const stored = create.mock.calls[0][0].data;
    expect(stored).toEqual({
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: expect.any(Date),
      requestedIp: '127.0.0.1',
    });
    expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(startedAt + 30 * 60_000);
    expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 30 * 60_000);
    expect(result).not.toHaveProperty('developmentToken');
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ after: { emailStatus: 'SENT' } }));
    expect(JSON.stringify(write.mock.calls)).not.toContain(token);
  });

  it('does not create a token or send email for an unknown account and returns the same message', async () => {
    const knownResult = await service.forgotPassword(user.email);
    findUnique.mockResolvedValue(null);
    create.mockClear();
    sendPasswordResetEmail.mockClear();
    write.mockClear();
    expect(await service.forgotPassword('unknown@example.com')).toEqual(knownResult);
    expect(create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it.each(['FAILED', 'DISABLED'])('records %s delivery while preserving the generic response', async (status) => {
    sendPasswordResetEmail.mockResolvedValue({ status, recipientCount: 0 });
    expect(await service.forgotPassword(user.email)).toEqual({
      message: 'Jika email terdaftar, instruksi reset password akan dikirim.',
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ after: { emailStatus: status } }));
  });

  it('waits for email delivery before resolving the request', async () => {
    let finishDelivery!: (result: EmailSendResult) => void;
    let notifyStarted!: () => void;
    const started = new Promise<void>((resolve) => { notifyStarted = resolve; });
    sendPasswordResetEmail.mockImplementation(() => {
      notifyStarted();
      return new Promise<EmailSendResult>((resolve) => { finishDelivery = resolve; });
    });
    let completed = false;
    const request = service.forgotPassword(user.email).then(() => { completed = true; });
    await started;
    expect(completed).toBe(false);
    expect(write).not.toHaveBeenCalled();
    finishDelivery({ status: 'SENT', recipientCount: 1 });
    await request;
    expect(completed).toBe(true);
  });

  it('does not send an email if saving the token fails', async () => {
    create.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.forgotPassword(user.email)).rejects.toThrow('Database unavailable');
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('does not expose a development token when APP_ENV is production', async () => {
    service = createService({ APP_ENV: 'PRODUCTION', NODE_ENV: 'development' });
    expect(await service.forgotPassword(user.email)).not.toHaveProperty('developmentToken');
  });

  it('retains the development reset link outside production', async () => {
    service = createService({ APP_ENV: 'DEVELOPMENT', NODE_ENV: 'development' });
    const result = await service.forgotPassword(user.email);
    expect(result.developmentToken).toBe(sendPasswordResetEmail.mock.calls[0][1]);
  });
});
