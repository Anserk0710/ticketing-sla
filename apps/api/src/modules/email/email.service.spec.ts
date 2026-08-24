import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from './email.service';

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
