import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import nodemailer, { Transporter } from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';

type EmailSendStatus = 'DISABLED' | 'SKIPPED' | 'SENT' | 'FAILED';

export interface EmailSendResult {
    status: EmailSendStatus;
    recipientCount: number;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly transporter: Transporter | null;
    private readonly from: string | null;
    private readonly webBaseUrl: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {
        const smtp = this.createTransporter();

        this.transporter = smtp.transporter;
        this.from = smtp.from;
        this.webBaseUrl = this.resolveWebBaseUrl();

        if (!this.transporter) {
            this.logger.log(
                'Email notification disabled beacuse SMTP configuration is incomplete.',
            );
        }
    }

    async sendNewTicketNotification(
        ticketId: string,
    ): Promise<EmailSendResult> {
        if (!this.transporter || !this.from) {
            return {
                status: 'DISABLED',
                recipientCount: 0,
            };
        }

        try {
            const [ticket, recipients] = await Promise.all([
                this.prisma.ticket.findUnique({
                    where: {
                        id: ticketId,
                    },
                    include: {
                        site: {
                            include: {
                                client: true,
                            },
                        },
                        category: true,
                        priority: true,
                    },
                }),

                this.prisma.user.findMany({
                    where: {
                        status: UserStatus.APPROVED,
                        roles: {
                            some: {
                                role: {
                                    name: {
                                        in: [
                                            'ADMINISTRATOR',
                                            'HEAD',
                                        ],
                                    },
                                },
                            },
                        },
                    },
                    select: {
                        email: true,
                    },
                }),
            ]);

            if (!ticket) {
                this.logger.warn(`New-ticket email skipped because ticket ${ticketId} was not found.`);
                return {
                    status: 'SKIPPED',
                    recipientCount: 0,
                };
            }

            const emails = [
                ...new Set(
                    recipients
                        .map((recipient) =>
                            recipient.email
                                .trim()
                                .toLowerCase(),
                        )
                        .filter(Boolean),
                ),
            ];

            if (emails.length === 0) {
                this.logger.warn(
                    `New-Ticket email skipped for ${ticket.ticketCode}: no approved Head/Administrator recipient.`
                );

                return {
                    status: 'SKIPPED',
                    recipientCount: 0,
                };
            }

            const targetUrl = `${this.webBaseUrl}/app/tickets/${ticket.id}`;
            const category = ticket.category?.name ?? 'Belum diklasifikasikan';
            const location = [
                ticket.site.name,
                ticket.locationDetail,
            ]
                .filter(Boolean)
                .join(' - ');

            await this.transporter.sendMail({
                from: this.from,
                to: 'Undisclosed recipients:;',
                bcc: emails,
                subject: `[Ticketing SLA] Ticket baru ${ticket.ticketCode}`,
                text: [
                    'Ticket baru telah masuk.',
                    '',
                    `Kode: ${ticket.ticketCode}`,
                    `Client: ${ticket.site.client.name}`,
                    `Site: ${ticket.site.name}`,
                    `Lokasi: ${location}`,
                    `Kategori: ${category}`,
                    `Prioritas: ${ticket.priority.label}`,
                    `Pelapor: ${ticket.reporterName}`,
                    `PIC: ${ticket.picName}`,
                    '',
                    'Deskripsi:',
                    ticket.description,
                    '',
                    `Buka detail ticket: ${targetUrl}`,
                ].join('\n'),

                html: this.renderNewTicketHtml({
                    ticketCode: ticket.ticketCode,
                    clientName: ticket.site.client.name,
                    siteName: ticket.site.name,
                    location,
                    category,
                    priority: ticket.priority.label,
                    reporterName: ticket.reporterName,
                    picName: ticket.picName,
                    description: ticket.description,
                    targetUrl,
                }),
            });

            this.logger.log(`New-ticket email sent for ${ticket.ticketCode} to ${emails.length} recipient(s).`);

            return {
                status: 'SENT',
                recipientCount: emails.length,
            };
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            this.logger.error(`New-ticket email failed for ticket ${ticketId}: ${message}`);

            return {
                status: 'FAILED',
                recipientCount: 0,
            };
        }
    }

    private createTransporter(): {
        transporter: Transporter | null;
        from: string | null;
    } {
        const host = this.config
            .get<string>('SMTP_HOST')
            ?.trim();

        const port =
            Number(
                this.config.get<string>(
                    'SMTP_PORT',
                    '587',
                ),
            );

        const from =
            this.config
                .get<string>('SMTP_FROM')
                ?.trim();

        const user =
            this.config
                .get<string>('SMTP_USER')
                ?.trim();

        const pass =
            this.config
                .get<string>('SMTP_PASS')
                ?.trim();

        const hasCompleteAuth =
            Boolean(user) === Boolean(pass);

        if (
            !host ||
            !from ||
            !Number.isInteger(port) ||
            port <= 0 ||
            !hasCompleteAuth
        ) {
            return {
                transporter: null,
                from: null,
            };
        }

        const secure =
            this.readBoolean(
                this.config.get<string>(
                    'SMTP_SECURE',
                ),
                port === 465,
            );

        const rejectUnauthorized =
            this.readBoolean(
                this.config.get<string>(
                    'SMTP_TLS_REJECT_UNAUTHORIZED',
                ),
                true,
            );

        const connectionTimeout =
            this.readPositiveNumber(
                this.config.get<string>(
                    'SMTP_CONNECTION_TIMEOUT_MS',
                ),
                5_000,
            );

        return {
            from,
            transporter:
                nodemailer.createTransport({
                    host,
                    port,
                    secure,
                    auth:
                        user && pass
                            ? {
                                user,
                                pass,
                            }
                            : undefined,

                    connectionTimeout,
                    greetingTimeout:
                        connectionTimeout,
                    socketTimeout:
                        connectionTimeout * 2,
                    tls: {
                        rejectUnauthorized,
                    },
                }),
        };
    }

    private resolveWebBaseUrl(): string {
        /*
         * PUBLIC_WEB_URL saat ini juga dipakai
         * sebagai konfigurasi CORS dan bisa berisi
         * beberapa origin dipisahkan koma.
         *
         * Email hanya menggunakan origin pertama.
         */
        const configured =
            this.config
                .get<string>('PUBLIC_WEB_URL')
                ?.split(',')[0]
                ?.trim();

        return (
            configured ||
            'http://localhost:5173'
        ).replace(/\/+$/, '');
    }

    private readBoolean(
        value: string | undefined,
        fallback: boolean,
    ): boolean {
        if (
            value == null ||
            value.trim() === ''
        ) {
            return fallback;
        }

        return [
            '1',
            'true',
            'yes',
            'on',
        ].includes(
            value
                .trim()
                .toLowerCase(),
        );
    }

    private readPositiveNumber(
        value: string | undefined,
        fallback: number,
    ): number {
        const parsed =
            Number(value);

        return Number.isFinite(parsed) &&
            parsed > 0
            ? parsed
            : fallback;
    }

    private renderNewTicketHtml(
        input: {
            ticketCode: string;
            clientName: string;
            siteName: string;
            location: string;
            category: string;
            priority: string;
            reporterName: string;
            picName: string;
            description: string;
            targetUrl: string;
        },
    ): string {
        /*
         * Data public complaint harus di-escape
         * sebelum dimasukkan ke HTML email.
         */
        const safe =
            Object.fromEntries(
                Object.entries(input).map(
                    ([key, value]) => [
                        key,
                        this.escapeHtml(value),
                    ],
                ),
            ) as Record<
                keyof typeof input,
                string
            >;

        return `
      <!doctype html>
      <html lang="id">
        <body style="margin:0;padding:24px;background:#f7f9fb;font-family:Arial,sans-serif;color:#0f172a;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <div style="padding:24px;background:#022b3a;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;">
                Ticketing SLA
              </div>

              <h1 style="margin:8px 0 0;font-size:22px;">
                Ticket baru ${safe.ticketCode}
              </h1>
            </div>

            <div style="padding:24px;">
              <p style="margin-top:0;">
                Ticket baru telah masuk dan memerlukan tindak lanjut Head/Administrator.
              </p>

              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr>
                  <td style="padding:8px 0;font-weight:bold;width:150px;">
                    Client
                  </td>
                  <td>
                    ${safe.clientName}
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 0;font-weight:bold;">
                    Site
                  </td>
                  <td>
                    ${safe.siteName}
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 0;font-weight:bold;">
                    Lokasi
                  </td>
                  <td>
                    ${safe.location}
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 0;font-weight:bold;">
                    Kategori
                  </td>
                  <td>
                    ${safe.category}
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 0;font-weight:bold;">
                    Prioritas
                  </td>
                  <td>
                    ${safe.priority}
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 0;font-weight:bold;">
                    Pelapor
                  </td>
                  <td>
                    ${safe.reporterName}
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 0;font-weight:bold;">
                    PIC
                  </td>
                  <td>
                    ${safe.picName}
                  </td>
                </tr>
              </table>

              <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:12px;white-space:pre-wrap;">
                ${safe.description}
              </div>

              <p style="margin:24px 0 0;">
                <a
                  href="${safe.targetUrl}"
                  style="display:inline-block;padding:12px 18px;border-radius:10px;background:#1f7a8c;color:#ffffff;text-decoration:none;font-weight:bold;"
                >
                  Buka Detail Ticket
                </a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `.trim();
    }

    private escapeHtml(
        value: string,
    ): string {
        return value
            .replaceAll(
                '&',
                '&amp;',
            )
            .replaceAll(
                '<',
                '&lt;',
            )
            .replaceAll(
                '>',
                '&gt;',
            )
            .replaceAll(
                '"',
                '&quot;',
            )
            .replaceAll(
                "'",
                '&#039;',
            );
    }
}