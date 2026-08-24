import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  FileText,
  Search,
  ShieldCheck
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { apiRequest } from '../../api/http-client';
import { ErrorPanel } from '../../components/feedback/loading';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/field';
import { formatDate } from '../../utils/format';

interface TrackingTimelineItem {
  status: string;
  createdAt: string;
}

interface PublicTrackingResult {
  ticketCode: string;
  client: string;
  site: string;
  publicStatus: string;
  createdAt: string;
  firstRespondedAt?: string | null;
  priority: string;
  scheduledAt?: string | null;
  description: string;
  timeline: TrackingTimelineItem[];
}

const DIGITS_ONLY_PATTERN = /^\d+$/;

const neoInputClass =
  'border-white/80 bg-white/60 shadow-[inset_2px_2px_5px_rgba(2,43,58,0.07),inset_-2px_-2px_5px_rgba(255,255,255,0.82)] focus:border-alice-blue-600 focus:bg-white/75';

function sanitizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function formatOptionalDate(
  value: string | null | undefined,
  fallback = 'Belum tersedia'
) {
  return value ? formatDate(value) : fallback;
}

function MetadataItem({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-lavender-grey-600">
        {label}
      </dt>

      <dd className="mt-1.5 text-sm font-bold leading-5 text-charcoal-950">
        {children}
      </dd>
    </div>
  );
}

export function PublicTrackPage() {
  const [ticketCode, setTicketCode] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPhoneError, setContactPhoneError] = useState<string | null>(
    null
  );

  const tracking = useMutation({
    mutationFn: () =>
      apiRequest<PublicTrackingResult>('/public/tickets/track', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          ticketCode: ticketCode.trim(),
          contactPhone
        })
      })
  });

  const resetTrackingResult = () => {
    if (tracking.data || tracking.error) {
      tracking.reset();
    }
  };

  const handleTicketCodeChange = (value: string) => {
    resetTrackingResult();
    setTicketCode(value.toUpperCase());
  };

  const handleContactPhoneChange = (value: string) => {
    resetTrackingResult();

    const sanitizedValue = sanitizePhone(value);

    setContactPhone(sanitizedValue);

    if (contactPhoneError) {
      setContactPhoneError(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!DIGITS_ONLY_PATTERN.test(contactPhone)) {
      setContactPhoneError(
        'Nomor kontak wajib hanya berisi angka 0–9.'
      );
      return;
    }

    setContactPhoneError(null);
    tracking.mutate();
  };

  const result = tracking.data;

  const latestTimelineItem =
    result && result.timeline.length > 0
      ? result.timeline[result.timeline.length - 1]
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-4">
      {/* ──────────────────────────────────────────────
          HERO
      ────────────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-end">
        <div className="max-w-3xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-alice-blue-600" />

            <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-alice-blue-600">
              Public Support / Tracking
            </span>
          </div>

          <h1 className="max-w-2xl text-4xl font-black tracking-[-0.035em] text-charcoal-950 md:text-5xl">
            Pantau perkembangan
            <span className="block text-alice-blue-600">
              laporan Anda.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-charcoal-600 md:text-base">
            Masukkan kode ticket dan nomor kontak yang digunakan saat
            laporan dibuat. Informasi terbaru mengenai proses penanganan
            akan ditampilkan di halaman ini.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-[#022b3a] p-5 shadow-[0_18px_38px_rgba(2,43,58,0.16)]">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10">
              <ShieldCheck className="h-5 w-5 text-[#bfdbf7]" />
            </div>

            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#bfdbf7]">
                Akses Terverifikasi
              </p>

              <p className="mt-1 text-sm font-semibold leading-6 text-white">
                Kode ticket dan nomor kontak diperlukan untuk membuka
                informasi laporan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          SEARCH / VERIFICATION
      ────────────────────────────────────────────── */}
      <section className="rounded-[20px] border border-white/80 bg-[#e1e5f2] p-5 shadow-[12px_12px_28px_rgba(2,43,58,0.10),-10px_-10px_24px_rgba(255,255,255,0.88)] md:p-7">
        <div className="mb-6 flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/45 text-sm font-black text-alice-blue-600 shadow-[3px_3px_8px_rgba(2,43,58,0.08),-3px_-3px_8px_rgba(255,255,255,0.80)]">
            01
          </span>

          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-charcoal-950">
              Verifikasi ticket
            </h2>

            <p className="mt-1 text-sm leading-6 text-charcoal-600">
              Gunakan data yang sama dengan saat laporan dibuat.
            </p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <Field
            label="Kode ticket"
            hint="Kode unik yang diterima setelah mengirim keluhan."
          >
            <Input
              value={ticketCode}
              onChange={(event) =>
                handleTicketCodeChange(event.target.value)
              }
              placeholder="Contoh: TKT-XXXXXXXX"
              autoComplete="off"
              required
              disabled={tracking.isPending}
              className={neoInputClass}
            />
          </Field>

          <Field
            label="Nomor kontak"
            hint="Gunakan angka saja tanpa spasi atau simbol."
            error={contactPhoneError ?? undefined}
          >
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="tel"
              pattern="[0-9]+"
              value={contactPhone}
              onChange={(event) =>
                handleContactPhoneChange(event.target.value)
              }
              placeholder="081234567890"
              required
              disabled={tracking.isPending}
              className={neoInputClass}
            />
          </Field>

          <div className="lg:self-start lg:pt-[27px]">
            <Button
              type="submit"
              loading={tracking.isPending}
              className="min-h-[46px] w-full bg-gradient-to-br from-[#238a9e] to-[#1f7a8c] px-7 text-base shadow-[0_10px_24px_rgba(31,122,140,0.22)] hover:brightness-105 lg:w-auto"
            >
              <Search className="h-5 w-5" />
              Lacak Ticket
            </Button>
          </div>
        </form>

        {tracking.error && (
          <div className="mt-6">
            <ErrorPanel error={tracking.error} />
          </div>
        )}
      </section>

      {/* ──────────────────────────────────────────────
          RESULT
      ────────────────────────────────────────────── */}
      {result && !tracking.isPending && (
        <section
          className="space-y-6"
          aria-live="polite"
          aria-label="Hasil tracking ticket"
        >
          {/* Section Label */}
          <div className="flex items-center gap-4 pt-2">
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-alice-blue-600">
              Hasil Tracking
            </span>

            <span className="h-px flex-1 bg-lavender-grey-200" />
          </div>

          {/* ──────────────────────────────────────────
              MAIN SUMMARY
          ────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-[20px] border border-white/80 bg-[#e1e5f2] shadow-[12px_12px_28px_rgba(2,43,58,0.10),-10px_-10px_24px_rgba(255,255,255,0.88)]">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_330px]">
              {/* Ticket Information */}
              <div className="p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-lavender-grey-600">
                      Ticket Reference
                    </span>

                    <div className="mt-2 inline-flex rounded-xl border border-white/80 bg-white/55 px-4 py-2.5 shadow-[inset_2px_2px_5px_rgba(2,43,58,0.05),inset_-2px_-2px_5px_rgba(255,255,255,0.8)]">
                      <span className="font-mono text-base font-black tracking-[0.08em] text-alice-blue-700 md:text-lg">
                        {result.ticketCode}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-7">
                  <h2 className="text-2xl font-black tracking-tight text-charcoal-950 md:text-3xl">
                    {result.site}
                  </h2>

                  <p className="mt-1.5 text-sm font-semibold text-charcoal-600">
                    {result.client}
                  </p>
                </div>

                <dl className="mt-8 grid gap-x-8 gap-y-6 border-t border-charcoal-950/10 pt-6 sm:grid-cols-3">
                  <MetadataItem label="Waktu dibuat">
                    {formatOptionalDate(result.createdAt)}
                  </MetadataItem>

                  <MetadataItem label="Respons awal">
                    {formatOptionalDate(
                      result.firstRespondedAt,
                      'Belum ada respons'
                    )}
                  </MetadataItem>

                  <MetadataItem label="Prioritas layanan">
                    {result.priority || '—'}
                  </MetadataItem>
                </dl>
              </div>

              {/* Status Contrast Panel */}
              <div className="relative overflow-hidden bg-[#022b3a] p-6 md:p-8">
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#1f7a8c]/20 blur-3xl" />

                <div className="relative">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#bfdbf7] shadow-[0_0_0_5px_rgba(191,219,247,0.10)]" />

                    <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#bfdbf7]">
                      Current Status
                    </span>
                  </div>

                  <h3 className="mt-5 text-3xl font-black tracking-[-0.025em] text-white">
                    {result.publicStatus}
                  </h3>

                  <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-white/65">
                    Status terbaru berdasarkan aktivitas penanganan
                    ticket yang telah tercatat.
                  </p>

                  <div className="mt-8 border-t border-white/10 pt-5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                      Pembaruan terakhir
                    </span>

                    <p className="mt-1.5 text-sm font-bold text-white">
                      {latestTimelineItem
                        ? formatDate(latestTimelineItem.createdAt)
                        : formatOptionalDate(result.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────
              RESCHEDULE ALERT
          ────────────────────────────────────────── */}
          {result.scheduledAt && (
            <div className="flex items-start gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 shadow-[0_8px_24px_rgba(120,83,20,0.06)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <Clock className="h-5 w-5 text-amber-700" />
              </div>

              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-700">
                  Perubahan Jadwal
                </span>

                <h3 className="mt-1 text-base font-extrabold text-amber-950">
                  Penanganan dijadwalkan ulang
                </h3>

                <p className="mt-1 text-sm font-semibold text-amber-800">
                  {formatDate(result.scheduledAt)}
                </p>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────
              DETAIL + TIMELINE
          ────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            {/* Complaint Description */}
            <article className="rounded-[18px] border border-white/80 bg-[#e1e5f2] p-6 shadow-[8px_8px_20px_rgba(2,43,58,0.08),-8px_-8px_20px_rgba(255,255,255,0.84)]">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/45">
                  <FileText className="h-4.5 w-4.5 text-alice-blue-600" />
                </span>

                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-lavender-grey-600">
                    02 / Informasi
                  </span>

                  <h3 className="mt-0.5 text-base font-extrabold text-charcoal-950">
                    Detail Keluhan
                  </h3>
                </div>
              </div>

              <div className="mt-5 border-t border-charcoal-950/10 pt-5">
                <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-charcoal-700">
                  {result.description ||
                    'Detail keluhan tidak tersedia.'}
                </p>
              </div>
            </article>

            {/* Timeline */}
            <article className="rounded-[18px] border border-white/80 bg-[#e1e5f2] p-6 shadow-[8px_8px_20px_rgba(2,43,58,0.08),-8px_-8px_20px_rgba(255,255,255,0.84)]">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/45">
                  <Clock className="h-4.5 w-4.5 text-alice-blue-600" />
                </span>

                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-lavender-grey-600">
                    03 / Progress
                  </span>

                  <h3 className="mt-0.5 text-base font-extrabold text-charcoal-950">
                    Timeline Perkembangan
                  </h3>
                </div>
              </div>

              {result.timeline.length > 0 ? (
                <div className="mt-7">
                  {result.timeline.map((item, index) => {
                    const isLatest =
                      index === result.timeline.length - 1;

                    return (
                      <div
                        key={`${item.status}-${item.createdAt}-${index}`}
                        className="relative flex gap-4 pb-7 last:pb-0"
                      >
                        {!isLatest && (
                          <span
                            aria-hidden="true"
                            className="absolute left-[17px] top-9 bottom-0 w-px bg-lavender-grey-300"
                          />
                        )}

                        <div
                          className={
                            isLatest
                              ? 'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-alice-blue-600 shadow-[0_6px_16px_rgba(31,122,140,0.24)]'
                              : 'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white bg-[#e1e5f2] shadow-[3px_3px_8px_rgba(2,43,58,0.08),-3px_-3px_8px_rgba(255,255,255,0.85)]'
                          }
                        >
                          {isLatest ? (
                            <Clock className="h-4 w-4 text-white" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-alice-blue-600" />
                          )}
                        </div>

                        <div className="min-w-0 pt-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={
                                isLatest
                                  ? 'text-sm font-extrabold text-charcoal-950'
                                  : 'text-sm font-bold text-charcoal-800'
                              }
                            >
                              {item.status}
                            </p>

                            {isLatest && (
                              <span className="rounded-md bg-alice-blue-600/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-alice-blue-700">
                                Terkini
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs font-semibold text-lavender-grey-600">
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-white/70 bg-white/40 p-4">
                  <p className="text-sm font-medium leading-6 text-charcoal-600">
                    Belum ada aktivitas perkembangan yang dapat
                    ditampilkan.
                  </p>
                </div>
              )}
            </article>
          </div>
        </section>
      )}
    </div>
  );
}