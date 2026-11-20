import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from './email.service';

describe('EmailService.sendPasswordResetEmail', () => {
    const recipient = 'recipient@example.com';
    const token = 'reset-token-for-test';
    let sendMail: jest.Mock;

    function createService(env: Record<string, string> = {}) {
        const values: Record<string, string> = {
            SMTP_HOST: 'smtp.example.com',
            SMTP_FROM: 'Ticketing SLA <sender@example.com>',
            EMAIL_WEB_BASE_URL: 'https://service.example.com/',
            ...env,
        };
        return new EmailService({} as PrismaService, {
            get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
        } as unknown as ConfigService);
    }

    beforeEach(() => {
        sendMail = jest.fn().mockResolvedValue({ accepted: [recipient], rejected: [] });
        jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as unknown as Transporter);
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('sends text and HTML with a reset link accepted by the configured frontend', async () => {
        expect(await createService().sendPasswordResetEmail(recipient, token)).toEqual({ status: 'SENT', recipientCount: 1 });
        expect(sendMail).toHaveBeenCalledTimes(1);
        const message = sendMail.mock.calls[0][0];
        const targetUrl = `https://service.example.com/reset-password?token=${token}`;
        expect(message.to).toBe(recipient);
        expect(message.from).toBe('Ticketing SLA <sender@example.com>');
        expect(message.text).toContain(targetUrl);
        expect(message.html).toContain(`href="${targetUrl}"`);
        expect(message.text).toContain('30 menit');
        expect(message.html).toContain('30 menit');
        expect(JSON.stringify((Logger.prototype.log as jest.Mock).mock.calls)).not.toContain(token);
    });

    it('encodes the reset token in the URL', async () => {
        await createService().sendPasswordResetEmail(recipient, 'a+b&c');
        expect(sendMail.mock.calls[0][0].html).toContain('?token=a%2Bb%26c');
    });

    it('reports disabled SMTP without attempting to send', async () => {
        expect(await createService({ SMTP_HOST: '' }).sendPasswordResetEmail(recipient, token)).toEqual({ status: 'DISABLED', recipientCount: 0 });
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('reports rejected recipients as failed delivery', async () => {
        sendMail.mockResolvedValue({ accepted: [], rejected: [recipient] });
        expect(await createService().sendPasswordResetEmail(recipient, token)).toEqual({ status: 'FAILED', recipientCount: 0 });
    });

    it('handles SMTP authentication errors without logging the token or raw error', async () => {
        sendMail.mockRejectedValue(Object.assign(new Error(`sensitive details ${token}`), { code: 'EAUTH', responseCode: 535 }));
        expect(await createService().sendPasswordResetEmail(recipient, token)).toEqual({ status: 'FAILED', recipientCount: 0 });
        expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('code=EAUTH responseCode=535'));
        expect(JSON.stringify((Logger.prototype.error as jest.Mock).mock.calls)).not.toContain(token);
    });
});

describe('EmailService.resolveWebBaseUrl', () => {
    const mockPrisma = {} as PrismaService;

    const createServiceWithEnv = (env: Record<string, string | undefined>) => {
        const configService = {
            get: jest.fn((key: string, defaultValue?: unknown) => {
                if (key in env) {
                    return env[key];
                }
                return defaultValue;
            }),
        } as unknown as ConfigService;

        return new EmailService(mockPrisma, configService);
    };

    it('resolves EMAIL_WEB_BASE_URL when explicitly specified', () => {
        const service = createServiceWithEnv({
            EMAIL_WEB_BASE_URL: 'https://sla.ptcahyaintanmedika.co.id/',
            PUBLIC_WEB_URL: 'https://ticketing-demo.test,https://localhost',
        });

        // @ts-expect-error accessing private property for test verification
        expect(service.webBaseUrl).toBe('https://sla.ptcahyaintanmedika.co.id');
    });

    it('uses the public hostname from PUBLIC_WEB_URL', () => {
        const service = createServiceWithEnv({
            PUBLIC_WEB_URL: 'https://ticketing-demo.test,https://localhost',
        });

        // @ts-expect-error accessing private property for test verification
        expect(service.webBaseUrl).toBe('https://ticketing-demo.test');
    });

    it('prefers a non-localhost hostname when localhost is listed first', () => {
        const service = createServiceWithEnv({
            PUBLIC_WEB_URL: 'https://localhost,https://ticketing-dev.test',
        });

        // @ts-expect-error accessing private property for test verification
        expect(service.webBaseUrl).toBe('https://ticketing-dev.test');
    });

    it('trims trailing slash from the configured hostname', () => {
        const service = createServiceWithEnv({
            PUBLIC_WEB_URL: 'https://ticketing-demo.test/',
        });

        // @ts-expect-error accessing private property for test verification
        expect(service.webBaseUrl).toBe('https://ticketing-demo.test');
    });

    it('uses WEB_BASE_URL as a legacy explicit override', () => {
        const service = createServiceWithEnv({
            WEB_BASE_URL: 'https://ticketing-dev.test',
            PUBLIC_WEB_URL: 'https://ticketing-demo.test',
        });

        // @ts-expect-error accessing private property for test verification
        expect(service.webBaseUrl).toBe('https://ticketing-dev.test');
    });

    it('falls back to localhost origin when only local origins are configured', () => {
        const service = createServiceWithEnv({
            PUBLIC_WEB_URL: 'https://localhost',
        });

        // @ts-expect-error accessing private property for test verification
        expect(service.webBaseUrl).toBe('https://localhost');
    });

    it('falls back to default localhost URL when nothing is configured', () => {
        const service = createServiceWithEnv({});

        // @ts-expect-error accessing private property for test verification
        expect(service.webBaseUrl).toBe('http://localhost:5173');
    });
});
