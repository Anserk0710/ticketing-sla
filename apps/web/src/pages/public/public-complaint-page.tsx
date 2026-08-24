import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  MapPin,
  QrCode,
  FileImage,
  FileVideo,
  X,
  ArrowRight,
  ShieldCheck,
  Clock,
  Building2,
  UploadCloud,
  Check,
  Send
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest, uploadMedia } from '../../api/http-client';
import { ErrorPanel, Loading } from '../../components/feedback/loading';
import { Card } from '../../components/ui/card';
import { Field, Input, Select, Textarea } from '../../components/ui/field';
import type { Catalog, Site } from '../../types/api';

interface CreatedTicket {
  id: string;
  ticketCode: string;
  status: string;
  createdAt: string;
}

function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

// Format foto dan video yang diizinkan Backend
const COMPLAINT_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm'
] as const;

const CONTACT_PHONE_PATTERN = /^\d+$/;

function sanitizeContactPhone(value: string) {
  return value.replace(/\D/g, '');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PublicComplaintPage() {
  const { qrToken } = useParams();

  // State Form Utama
  const [form, setForm] = useState({
    reporterName: '',
    picName: '',
    contactPhone: '',
    locationDetail: '',
    categoryId: '',
    siteId: '',
    description: ''
  });

  const [contactPhoneError, setContactPhoneError] = useState<string | null>(null);

  // State Khusus Multi-Media
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const catalog = useQuery({
    queryKey: ['public-catalog'],
    queryFn: () => apiRequest<Catalog>('/public/catalog', { auth: false })
  });

  const qr = useQuery({
    queryKey: ['qr', qrToken],
    queryFn: () => apiRequest<{ token: string; site: Site }>(`/public/qr/${qrToken}`, { auth: false }),
    enabled: !!qrToken
  });

  const site = useMemo(
    () => qr.data?.site ?? catalog.data?.sites.find((item) => item.id === form.siteId),
    [qr.data, catalog.data, form.siteId]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      let mediaIds: string[] = [];

      // Mengunggah semua file secara concurrent sebelum create ticket
      if (files.length > 0) {
        setIsUploading(true);
        try {
          const uploadPromises = files.map((f) => uploadMedia(f, true));
          const uploadedAssets = await Promise.all(uploadPromises);
          mediaIds = uploadedAssets.map((asset) => asset.id);
        } finally {
          setIsUploading(false);
        }
      }

      // Payload pembuatan tiket
      return apiRequest<CreatedTicket>('/public/tickets', {
        method: 'POST',
        auth: false,
        headers: { 'Idempotency-Key': generateIdempotencyKey() },
        body: JSON.stringify({
          ...form,
          qrToken,
          siteId: qrToken ? undefined : form.siteId,
          categoryId: form.categoryId || undefined,
          mediaIds
        })
      });
    }
  });

  if (catalog.isLoading || qr.isLoading) return <Loading label="Memuat konfigurasi layanan…" />;
  if (catalog.error || qr.error) return <ErrorPanel error={catalog.error ?? qr.error} />;

  // Render State Sukses
  if (mutation.data) {
    const ticketCode = mutation.data.ticketCode;
    const handleCopy = () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(ticketCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2500);
      }
    };

    return (
      <div className="mx-auto max-w-2xl py-8 md:py-16">
        <div className="neo-container p-6 sm:p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 shadow-sm">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Laporan Berhasil Dibuat
          </div>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-charcoal-950 sm:text-3xl">
            Laporan Anda Sudah Kami Terima
          </h1>

          <p className="mt-3 text-sm text-charcoal-600 sm:text-base leading-relaxed max-w-lg mx-auto">
            Tim operasional kami akan segera menindaklanjuti kendala ini. Simpan kode tiket berikut untuk memantau status penanganan secara berkala.
          </p>

          {/* Ticket Code Display */}
          <div className="mx-auto mt-8 max-w-md rounded-2xl bg-gradient-to-br from-[#04394d] to-[#022b3a] p-6 text-white shadow-xl border border-white/10">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#bfdbf7]">
              Kode Tiket Pelaporan
            </span>
            <div className="mt-2 font-mono text-3xl sm:text-4xl font-black tracking-widest text-white">
              {ticketCode}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-semibold text-[#bfdbf7] transition-all"
            >
              {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : null}
              {copiedCode ? 'Tersalin ke Clipboard!' : 'Salin Kode Tiket'}
            </button>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/track"
              className="neo-btn-cta inline-flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <span>Lacak Status Tiket</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={() => {
                mutation.reset();
                setForm({
                  reporterName: '',
                  picName: '',
                  contactPhone: '',
                  locationDetail: '',
                  categoryId: '',
                  siteId: '',
                  description: ''
                });
                setFiles([]);
              }}
              className="text-sm font-semibold text-charcoal-700 hover:text-charcoal-950 py-2.5 px-4 rounded-xl hover:bg-white/40 transition-colors"
            >
              Kirim Laporan Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handler Multi-Upload File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files?.length) return;

    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter((file) =>
      (COMPLAINT_MEDIA_TYPES as readonly string[]).includes(file.type)
    );

    if (validFiles.length !== selectedFiles.length) {
      setFileError('Format file tidak didukung. Harap pilih file gambar (JPG/PNG/WEBP) atau video (MP4/MOV/WEBM).');
    }

    setFiles((prev) => {
      const uniqueNewFiles = validFiles.filter(
        (newFile) => !prev.some((existing) => existing.name === newFile.name && existing.size === newFile.size)
      );
      return [...prev, ...uniqueNewFiles];
    });

    e.target.value = '';
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((current) => current.filter((_, idx) => idx !== indexToRemove));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!CONTACT_PHONE_PATTERN.test(form.contactPhone)) {
      setContactPhoneError('Nomor kontak wajib hanya berisi angka 0–9.');
      return;
    }

    if (files.length === 0) {
      setFileError('Bukti keluhan wajib dilampirkan minimal 1 foto atau video.');
      return;
    }

    setContactPhoneError(null);
    setFileError(null);
    mutation.mutate();
  };

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleContactPhoneChange = (value: string) => {
    const sanitizedValue = sanitizeContactPhone(value);
    update('contactPhone', sanitizedValue);
    if (contactPhoneError) {
      setContactPhoneError(null);
    }
  };

  const isFormDisabled = isUploading || mutation.isPending;

  return (
    <div className="space-y-8">
      {/* ─── HERO HEADER ────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-alice-blue-600/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-alice-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-alice-blue-600" />
          Public Support
        </div>

        <h1 className="max-w-3xl text-4xl font-black tracking-tight text-charcoal-950 md:text-[40px] lg:text-[48px] lg:leading-tight">
          Laporkan kendala.<br />
          <span className="text-charcoal-600">Kami akan menangani sisanya.</span>
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-charcoal-600 md:text-base">
          Sampaikan informasi masalah secara lengkap agar tim operasional dapat melakukan tindak lanjut dengan lebih cepat.
        </p>
      </div>

      {/* ─── 2-COLUMN MAIN COMPOSITION ──────────────────────────────── */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
        {/* LEFT COLUMN: FORM CARD */}
        <div className="neo-raised rounded-[20px] p-5 sm:p-6 md:p-8">
          {mutation.error && (
            <div className="mb-6">
              <ErrorPanel error={mutation.error} />
            </div>
          )}

          <form onSubmit={submit} className="space-y-8">
            {/* ─── SECTION 01: INFORMASI PELAPOR ────────────────────── */}
            <div>
              <div className="flex items-center gap-3 border-b border-charcoal-950/10 pb-3">
                <span className="font-mono text-base font-bold text-alice-blue-600">01</span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-charcoal-950 sm:text-lg">
                    Informasi Pelapor
                  </h2>
                  <p className="text-xs text-charcoal-500">Identitas dan kontak penanggung jawab di lapangan</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Nama Pelapor" hint="Nama lengkap pengisi laporan">
                  <Input
                    value={form.reporterName}
                    onChange={(e) => update('reporterName', e.target.value)}
                    required
                    placeholder="Contoh: Budi Pratama"
                    disabled={isFormDisabled}
                    className="neo-input"
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
                    value={form.contactPhone}
                    onChange={(e) => handleContactPhoneChange(e.target.value)}
                    placeholder="081234567890"
                    required
                    disabled={isFormDisabled}
                    className="neo-input"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Nama PIC (Person In Charge)" hint="Petugas atau PIC yang dapat ditemui saat teknisi tiba">
                    <Input
                      value={form.picName}
                      onChange={(e) => update('picName', e.target.value)}
                      required
                      placeholder="Nama PIC di lokasi"
                      disabled={isFormDisabled}
                      className="neo-input"
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* ─── SECTION 02: LOKASI LAYANAN ──────────────────────── */}
            <div>
              <div className="flex items-center gap-3 border-b border-charcoal-950/10 pb-3">
                <span className="font-mono text-base font-bold text-alice-blue-600">02</span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-charcoal-950 sm:text-lg">
                    Lokasi Layanan
                  </h2>
                  <p className="text-xs text-charcoal-500">Penentuan site dan area spesifik terjadinya kendala</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {qrToken && site ? (
                  <div className="neo-inset mb-8 flex items-start gap-4 rounded-2xl p-4 md:p-5">
                    <span className="neo-soft shrink-0 rounded-2xl p-3">
                      <QrCode className="h-6 w-6 text-alice-blue-600" />
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-alice-blue-700">
                          Lokasi terverifikasi
                        </span>

                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          QR VERIFIED
                        </span>
                      </div>

                      <p className="mt-1 text-base font-extrabold text-charcoal-950">
                        {site.client.name} — {site.name}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-charcoal-600">
                        {site.address}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <Field label="Site / Lokasi Layanan" hint="Pilih unit kerja atau lokasi yang mengalami kendala">
                      <Select
                        value={form.siteId}
                        onChange={(e) => update('siteId', e.target.value)}
                        required
                        disabled={isFormDisabled}
                        className="neo-input"
                      >
                        <option value="">-- Pilih Lokasi / Site --</option>
                        {catalog.data?.sites.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.client.name} — {item.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <Field
                    label="Detail Lokasi Spesifik"
                    hint="Sebutkan ruang, lantai, atau posisi spesifik perangkat/layanan"
                  >
                    <Input
                      value={form.locationDetail}
                      onChange={(e) => update('locationDetail', e.target.value)}
                      placeholder="Contoh: Lantai 2, Ruang Server / Meja Resepsionis"
                      disabled={isFormDisabled}
                      className="neo-input"
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* ─── SECTION 03: DETAIL PERMASALAHAN ─────────────────── */}
            <div>
              <div className="flex items-center gap-3 border-b border-charcoal-950/10 pb-3">
                <span className="font-mono text-base font-bold text-alice-blue-600">03</span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-charcoal-950 sm:text-lg">
                    Detail Permasalahan
                  </h2>
                  <p className="text-xs text-charcoal-500">Kategori dan penjelasan terperinci gejala gangguan</p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <Field label="Kategori Gangguan">
                  <Select
                    value={form.categoryId}
                    onChange={(e) => update('categoryId', e.target.value)}
                    disabled={isFormDisabled}
                    className="neo-input"
                  >
                    <option value="">-- Belum diketahui / Umum --</option>
                    {catalog.data?.categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Deskripsi Kendala"
                  hint="Jelaskan secara rinci apa yang terjadi, sejak kapan, dan dampaknya pada aktivitas operasional"
                >
                  <Textarea
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                    required
                    placeholder="Contoh: Jaringan internet di lantai 2 terputus sejak pukul 09:30 WITA, lampu indikator router berkedip merah..."
                    disabled={isFormDisabled}
                    className="neo-input min-h-32"
                  />
                </Field>
              </div>
            </div>

            {/* ─── SECTION 04: BUKTI PENDUKUNG ──────────────────────── */}
            <div>
              <div className="flex items-center justify-between border-b border-charcoal-950/10 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-base font-bold text-alice-blue-600">04</span>
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-charcoal-950 sm:text-lg">
                      Bukti Pendukung
                    </h2>
                    <p className="text-xs text-charcoal-500">Lampirkan foto atau video kendala</p>
                  </div>
                </div>
                <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600">
                  Wajib
                </span>
              </div>

              <div className="md:col-span-2 mt-2 border-t border-charcoal-950/5 pt-6">
                <Input
                  type="file"
                  accept={COMPLAINT_MEDIA_TYPES.join(',')}
                  multiple
                  disabled={isFormDisabled}
                  onChange={handleFileChange}
                  className="neo-input cursor-pointer"
                />

                {fileError && (
                  <p className="text-xs font-semibold text-rose-600 mt-2">{fileError}</p>
                )}

                {/* Media Queue List */}
                {files.length > 0 && (
                  <div className="neo-inset mt-4 overflow-hidden rounded-2xl">
                    <div className="flex items-center justify-between border-b border-charcoal-950/5 px-4 py-3">
                      <span className="text-xs font-bold text-charcoal-700">
                        {files.length} file dipilih
                      </span>

                      <span className="text-[11px] font-semibold text-charcoal-500">
                        Foto / Video
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-charcoal-950/5">
                      {files.map((file, idx) => {
                        const isVideo = file.type.startsWith('video/');
                        return (
                          <div
                            key={`${file.name}-${idx}`}
                            className="flex min-h-16 items-center gap-3 px-4 py-3"
                          >
                            {isVideo ? (
                              <FileVideo className="h-4 w-4 shrink-0 text-violet-600" />
                            ) : (
                              <FileImage className="h-4 w-4 shrink-0 text-alice-blue-600" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-semibold text-charcoal-900">{file.name}</p>
                              <p className="text-[10px] text-charcoal-500 uppercase">
                                {file.type.split('/')[1]} • {formatFileSize(file.size)}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="neo-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-charcoal-500 hover:text-rose-600 disabled:opacity-50"
                              onClick={() => removeFile(idx)}
                              disabled={isFormDisabled}
                              aria-label={`Hapus ${file.name}`}
                              title="Hapus berkas"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 pt-3">
              <button
                className="neo-btn-cta w-full md:w-auto flex items-center justify-center gap-2"
                disabled={isFormDisabled}
                type="submit"
              >
                <span>{isUploading ? 'Mengunggah bukti...' : 'Kirim Keluhan'}</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: DEEP NAVY SERVICE CONTEXT PANEL */}
        <aside className="lg:sticky lg:top-24">
          <Card className="sticky top-24 rounded-[20px] border-0 p-6 text-white shadow-[14px_14px_32px_rgba(2,43,58,0.11),-12px_-12px_28px_rgba(255,255,255,0.8)]" style={{ background: 'linear-gradient(145deg, #04394d, #022b3a)' }}>
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <span className="rounded-xl bg-white/10 p-2.5 text-[#bfdbf7]">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#bfdbf7]">
                  Service Context
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Konteks Layanan
                </h3>
              </div>
            </div>

            {site ? (
              <div className="mt-5 space-y-3 rounded-2xl bg-white/5 p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Location Verified</span>
                </div>
                <p className="text-sm font-extrabold text-white">
                  {site.client.name}
                </p>

                <p className="text-sm font-semibold text-[#bfdbf7]">
                  {site.name}
                </p>

                <p className="text-xs leading-relaxed text-white/70">
                  {site.address}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-white/5 p-4 border border-white/10">
                <p className="text-xs leading-relaxed text-white/70">
                  Pilih lokasi/site pada form untuk menampilkan informasi lokasi
                  layanan.
                </p>
              </div>
            )}

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-[#bfdbf7]" />
                <span className="text-sm font-semibold text-[#bfdbf7]">Support</span>
              </div>
              <p className="text-xs leading-5 text-white/70">
                08:00 — 17:00 WITA<br />
                Nomor kontak digunakan untuk tracking laporan.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}