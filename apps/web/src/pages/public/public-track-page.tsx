import { useMutation } from '@tanstack/react-query';
import { Search, Clock, CheckCircle2, FileText } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../api/http-client';
import { ErrorPanel } from '../../components/feedback/loading';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field, Input } from '../../components/ui/field';
import { formatDate } from '../../utils/format';

export function PublicTrackPage() {
  const [ticketCode, setTicketCode] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  
  const tracking = useMutation({
    mutationFn: () => apiRequest<any>('/public/tickets/track', {
      method: 'POST', auth: false, body: JSON.stringify({ ticketCode, contactPhone })
    })
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    tracking.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6 md:p-8 shadow-xl">
        <div className="border-b border-iron-grey-100 pb-5">
          <span className="text-xs font-bold uppercase tracking-widest text-alice-blue-600">Public Tracking</span>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-charcoal-900">Lacak perkembangan ticket</h1>
          <p className="mt-1 text-sm font-medium text-charcoal-600">Masukkan kode ticket resmi dan nomor kontak yang didaftarkan saat membuat laporan.</p>
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-5 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Kode ticket">
            <Input
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
              placeholder="Contoh: TKT-XXXXXXXX"
              required
            />
          </Field>
          <Field label="Nomor kontak">
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              required
            />
          </Field>
          <div className="self-end">
            <Button className="w-full md:w-auto px-6 py-2.5 text-base" loading={tracking.isPending}>
              <Search className="h-5 w-5" />
              Lacak
            </Button>
          </div>
        </form>

        {tracking.error && (
          <div className="mt-5">
            <ErrorPanel error={tracking.error} />
          </div>
        )}
      </Card>

      {tracking.data && (
        <Card className="p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-iron-grey-100 pb-5">
            <div>
              <span className="inline-block rounded-lg bg-alice-blue-50 px-3 py-1 font-mono text-sm font-bold text-alice-blue-700 border border-alice-blue-200">
                {tracking.data.ticketCode}
              </span>
              <h2 className="mt-3 text-2xl font-extrabold text-charcoal-900">
                {tracking.data.client} — {tracking.data.site}
              </h2>
            </div>
            <Badge value={tracking.data.publicStatus} />
          </div>

          <dl className="grid gap-4 rounded-2xl bg-iron-grey-50 p-4 border border-iron-grey-100 text-sm md:grid-cols-3">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-lavender-grey-500">Waktu Dibuat</dt>
              <dd className="mt-1 font-semibold text-charcoal-900">{formatDate(tracking.data.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-lavender-grey-500">Respons Awal</dt>
              <dd className="mt-1 font-semibold text-charcoal-900">{formatDate(tracking.data.firstRespondedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-lavender-grey-500">Prioritas Layanan</dt>
              <dd className="mt-1 font-semibold text-charcoal-900">{tracking.data.priority}</dd>
            </div>
            {tracking.data.scheduledAt && (
              <div className="md:col-span-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
                <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-amber-700">Dijadwalkan Ulang Pada</dt>
                  <dd className="mt-0.5 font-semibold text-amber-900">{formatDate(tracking.data.scheduledAt)}</dd>
                </div>
              </div>
            )}
          </dl>

          <div className="rounded-2xl border border-iron-grey-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lavender-grey-500">
              <FileText className="h-4 w-4 text-alice-blue-600" />
              Detail Keluhan
            </div>
            <p className="mt-2 text-sm leading-relaxed font-medium text-charcoal-800">
              {tracking.data.description}
            </p>
          </div>

          <div className="pt-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-charcoal-900">
              <Clock className="h-5 w-5 text-alice-blue-600" />
              Timeline Perkembangan
            </h3>
            <div className="mt-4 space-y-3.5 pl-2">
              {tracking.data.timeline.map((item: any, index: number) => (
                <div key={index} className="flex items-start gap-3.5">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-alice-blue-500 ring-4 ring-alice-blue-100" />
                  <div>
                    <p className="text-sm font-bold text-charcoal-900">{item.status}</p>
                    <p className="text-xs font-medium text-lavender-grey-500">{formatDate(item.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
