import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, MapPin, Send, QrCode, FileImage, FileVideo, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest, uploadMedia } from '../../api/http-client';
import { ErrorPanel, Loading } from '../../components/feedback/loading';
import { Button } from '../../components/ui/button';
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

// Phase 7: Mendukung format foto dan video yang diizinkan Backend
const COMPLAINT_MEDIA_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm'
] as const;

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

  // State Khusus Multi-Media (Phase 7)
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const catalog = useQuery({
    queryKey: ['public-catalog'],
    queryFn: () => apiRequest<Catalog>('/public/catalog', { auth: false })
  });

  const qr = useQuery({
    queryKey: ['qr', qrToken],
    queryFn: () => apiRequest<{ token: string; site: Site }>(`/public/qr/${qrToken}`, { auth: false }),
    enabled: !!qrToken
  });

  const site = useMemo(() => qr.data?.site ?? catalog.data?.sites.find((item) => item.id === form.siteId), [qr.data, catalog.data, form.siteId]);

  const mutation = useMutation({
    mutationFn: async () => {
      let mediaIds: string[] = [];

      // Phase 7: Mengunggah semua file secara concurrent (paralel) sebelum create ticket
      if (files.length > 0) {
        setIsUploading(true);
        try {
          // Argumen `true` pada uploadMedia menandakan ini adalah rute publik (public upload)
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
          mediaIds // mediaIds akan selalu berisi minimal 1 array string sesuai aturan backend
        })
      });
    }
  });

  if (catalog.isLoading || qr.isLoading) return <Loading label="Membuat koneksi lokasi QR Code…" />;
  if (catalog.error || qr.error) return <ErrorPanel error={catalog.error ?? qr.error} />;

  // Render State Sukses
  if (mutation.data) {
    return (
      <div className="mx-auto max-w-xl py-8 md:py-12">
        <Card className="p-8 text-center shadow-xl">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-extrabold text-charcoal-900">Terima kasih, laporan Anda sudah kami terima!</h1>
          <p className="mt-2 text-sm text-charcoal-600">Harap simpan kode di bawah ini untuk melacak status laporan Anda.</p>
          <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 p-5 font-mono text-3xl font-black tracking-widest text-alice-blue-400 border border-powder-blue-800 shadow-inner">
            {mutation.data.ticketCode}
          </div>
          <Link to="/track" className="mt-6 inline-flex items-center gap-2 font-semibold text-alice-blue-600 hover:text-alice-blue-700 hover:underline">
            Lacak status ticket &rarr;
          </Link>
        </Card>
      </div>
    );
  }

  // Handler Multi-Upload File (Dengan pencegahan duplikasi)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files?.length) return;

    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => (COMPLAINT_MEDIA_TYPES as readonly string[]).includes(file.type));

    if (validFiles.length !== selectedFiles.length) {
      setFileError('Beberapa file ditolak karena format tidak didukung. Pastikan memilih Foto/Video yang valid.');
    }

    setFiles(prev => {
      // Mencegah file yang sama (berdasarkan nama dan ukuran) masuk dua kali ke dalam antrean UI
      const uniqueNewFiles = validFiles.filter(
        newFile => !prev.some(existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size)
      );
      return [...prev, ...uniqueNewFiles];
    });

    // Reset input agar user bisa kembali memilih file yang sama jika tak sengaja menghapusnya dari list
    e.target.value = '';
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(current => current.filter((_, idx) => idx !== indexToRemove));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    // Validasi Media Wajib (Aturan Phase 4 & 7)
    if (files.length === 0) {
      setFileError('Bukti keluhan wajib dilampirkan minimal 1 foto atau video.');
      return;
    }

    setFileError(null);
    mutation.mutate();
  };

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  // Disable form selama proses upload media atau submit API berlangsung
  const isFormDisabled = isUploading || mutation.isPending;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <Card className="p-6 md:p-8 shadow-xl">
        <div className="mb-6 border-b border-iron-grey-100 pb-6">
          <span className="text-xs font-bold uppercase tracking-widest text-alice-blue-600">Layanan Pengaduan</span>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-charcoal-900">Ada kendala layanan? Beritahu kami!</h1>
          <p className="mt-1 text-sm text-charcoal-600">Silakan laporkan kendala Anda di sini. Kami akan segera menanganinya dan memberikan kode unik agar Anda bisa memantau perkembangannya.</p>
        </div>

        {qrToken && site && (
          <div className="mb-6 flex items-start gap-3.5 rounded-2xl border border-alice-blue-200 bg-alice-blue-50/90 p-4 text-alice-blue-950 shadow-sm">
            <span className="rounded-xl bg-alice-blue-600 p-2.5 text-white shadow-md shadow-alice-blue-600/20 shrink-0">
              <QrCode className="h-6 w-6" />
            </span>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-alice-blue-700">QR Code Verified Location</span>
              <p className="text-base font-extrabold text-charcoal-900 mt-0.5">{site.client.name} — {site.name}</p>
              <p className="text-xs font-medium text-charcoal-600 mt-0.5">{site.address}</p>
            </div>
          </div>
        )}

        {mutation.error && <div className="mb-5"><ErrorPanel error={mutation.error} /></div>}

        <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
          <Field label="Nama pelapor"><Input value={form.reporterName} onChange={(e) => update('reporterName', e.target.value)} required placeholder="Nama lengkap pelapor" disabled={isFormDisabled} /></Field>
          <Field label="Nama PIC"><Input value={form.picName} onChange={(e) => update('picName', e.target.value)} required placeholder="Person in Charge" disabled={isFormDisabled} /></Field>
          <Field label="Nomor kontak"><Input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} placeholder="08xxxxxxxxxx" required disabled={isFormDisabled} /></Field>

          {!qrToken && (
            <Field label="Lokasi/site">
              <Select value={form.siteId} onChange={(e) => update('siteId', e.target.value)} required disabled={isFormDisabled}>
                <option value="">Pilih lokasi / site</option>
                {catalog.data?.sites.map((item) => (
                  <option key={item.id} value={item.id}>{item.client.name} — {item.name}</option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Kategori">
            <Select value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)} disabled={isFormDisabled}>
              <option value="">Belum diketahui</option>
              {catalog.data?.categories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Detail lokasi tambahan"><Input value={form.locationDetail} onChange={(e) => update('locationDetail', e.target.value)} placeholder="Lantai, ruangan, atau patokan" disabled={isFormDisabled} /></Field>

          <div className="md:col-span-2">
            <Field label="Deskripsi keluhan"><Textarea value={form.description} onChange={(e) => update('description', e.target.value)} required placeholder="Jelaskan masalah, waktu mulai, dan dampaknya pada operasional." disabled={isFormDisabled} /></Field>
          </div>

          {/* Bagian Input Media (Multi-Upload) Phase 7 */}
          <div className="md:col-span-2 pt-2 border-t border-iron-grey-100">
            <Field label="Foto/Video keluhan (Wajib)" hint="Wajib minimal 1 file. Mendukung format foto dan video. Anda dapat memilih berkas berulang kali.">
              <Input
                type="file"
                accept={COMPLAINT_MEDIA_TYPES.join(',')}
                multiple
                disabled={isFormDisabled}
                onChange={handleFileChange}
              />
            </Field>

            {fileError && <p className="mt-2 text-sm font-medium text-red-600">{fileError}</p>}

            {/* List UI Berkas yang Dipilih */}
            {files.length > 0 && (
              <div className="mt-4 rounded-xl border border-iron-grey-200 bg-iron-grey-50 overflow-hidden shadow-sm">
                <div className="px-4 py-2 border-b border-iron-grey-200 bg-white">
                  <span className="text-xs font-bold text-charcoal-700">{files.length} file dipilih</span>
                </div>
                <div className="divide-y divide-iron-grey-100 max-h-48 overflow-y-auto">
                  {files.map((file, idx) => {
                    const isVideo = file.type.startsWith('video/');
                    return (
                      <div key={`${file.name}-${idx}`} className="flex items-center gap-3 p-3">
                        {isVideo ? <FileVideo className="h-5 w-5 shrink-0 text-violet-600" /> : <FileImage className="h-5 w-5 shrink-0 text-alice-blue-600" />}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold text-charcoal-900">{file.name}</p>
                          <p className="text-xs text-lavender-grey-500 uppercase">{file.type.split('/')[1]} • {formatFileSize(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-lavender-grey-400 hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50 transition-colors"
                          onClick={() => removeFile(idx)}
                          disabled={isFormDisabled}
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

          <div className="md:col-span-2 pt-4">
            <Button className="w-full py-3 md:w-auto px-8 text-base" loading={isFormDisabled}>
              <Send className="h-5 w-5" />
              {isUploading ? 'Mengunggah Berkas...' : 'Kirim Keluhan'}
            </Button>
          </div>
        </form>
      </Card>

      <aside>
        <Card className="sticky top-24 bg-powder-blue-900 border-powder-blue-800 text-white shadow-xl p-6">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-alice-blue-500/20 p-2.5 text-alice-blue-400 border border-alice-blue-500/30">
              <MapPin className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">Konteks layanan</h2>
              <span className="text-xs text-lavender-grey-400">Informasi lokasi terhubung</span>
            </div>
          </div>
          {site ? (
            <div className="mt-5 rounded-xl bg-powder-blue-950/60 p-4 border border-white/10 space-y-2 text-sm text-lavender-grey-300">
              <p><strong className="text-white text-base block">{site.client.name}</strong></p>
              <p className="font-semibold text-alice-blue-300">{site.name}</p>
              <p className="text-xs text-lavender-grey-400 leading-relaxed">{site.address}</p>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-powder-blue-950/60 p-4 border border-white/10 text-xs text-lavender-grey-400 leading-relaxed">Pilih site pada form untuk menampilkan lokasi layanan terdaftar.</p>
          )}
          <div className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed text-lavender-grey-400">
            Waktu ticket dan SLA dihitung menggunakan waktu server (WITA). Data kontak hanya dipakai untuk tracking dan komunikasi operasional.
          </div>
        </Card>
      </aside>
    </div>
  );
}