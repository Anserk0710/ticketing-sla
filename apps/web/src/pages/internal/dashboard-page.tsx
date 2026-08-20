import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, ClipboardList, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/http-client';
import { ErrorPanel, Loading } from '../../components/feedback/loading';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { PageHeader } from '../../components/data-display/page-header';
import { SlaCountdown } from '../../components/data-display/sla-countdown';
import { formatDate } from '../../utils/format';

function Stat({ label, value, icon: Icon, note, tone = 'alice' }: { label: string; value: number; icon: typeof ClipboardList; note?: string; tone?: 'alice' | 'amber' | 'rose' | 'emerald' | 'blue' }) {

  const tones = {
    alice: 'bg-alice-blue-50 text-alice-blue-700 border-alice-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-powder-blue-50 text-powder-blue-700 border-powder-blue-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100'
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-lavender-grey-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-charcoal-900">{value}</p>
          {note && <p className="mt-2 text-xs font-medium text-lavender-grey-500">{note}</p>}
        </div>
        <span className={`rounded-2xl border p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const summary = useQuery({ queryKey: ['dashboard-summary'], queryFn: () => apiRequest<any>('/dashboard/summary') });
  const tickets = useQuery({ queryKey: ['dashboard-tickets'], queryFn: () => apiRequest<any>('/tickets?page=1&pageSize=8') });

  if (summary.isLoading || tickets.isLoading) return <Loading />;
  if (summary.error || tickets.error) return <ErrorPanel error={summary.error ?? tickets.error} />;

  const data = summary.data;

  // Phase 8: Memastikan dashboard menghitung PENDING sebagai aktif/tertunda, bukan selesai.
  const activeAndDelayedTickets =
    (data.tickets.byStatus.ASSIGNED ?? 0) +
    (data.tickets.byStatus.ON_SITE ?? 0) +
    (data.tickets.byStatus.IN_PROGRESS ?? 0) +
    (data.tickets.byStatus.REOPENED ?? 0) +
    (data.tickets.byStatus.PENDING ?? 0);

  return (
    <>
      <PageHeader eyebrow="Ringkasan Operasional" title="Dashboard Kinerja" description="Lihat gambaran cepat semua keluhan yang masuk, seberapa cepat tim merespons, dan bagaimana kinerja penyelesaiannya." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Total Keluhan" value={data.tickets.total} icon={ClipboardList} tone="alice" />
        <Stat label="Keluhan Baru" value={data.tickets.byStatus.NEW ?? 0} icon={Clock3} tone="amber" />

        {/* Update Label dan Value untuk mencakup tiket PENDING dan REOPENED */}
        <Stat label="Aktif & Tertunda" value={activeAndDelayedTickets} icon={Wrench} tone="blue" note="Termasuk ticket pending" />

        <Stat label="Kecepatan Respons" value={data.mttr?.respondHours ?? 0} icon={Clock3} tone="rose" note="Rata-rata (Jam)" />
        <Stat label="Kecepatan Selesai" value={data.mttr?.resolutionHours ?? 0} icon={CheckCircle2} tone="emerald" note="Rata-rata (Jam)" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-charcoal-900">Keluhan terbaru yang masuk</h2>
              <p className="text-xs text-lavender-grey-500">Berdasarkan waktu laporan yang paling baru.</p>
            </div>
            <Link className="text-xs font-bold text-alice-blue-600 hover:text-alice-blue-800 hover:underline" to="/app/tickets">
              Lihat semua &rarr;
            </Link>
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-iron-grey-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-iron-grey-100/80 text-[11px] font-bold uppercase tracking-wider text-charcoal-700">
                <tr>
                  <th className="py-3 px-3.5">Keluhan</th>
                  <th className="py-3 px-3.5">Lokasi</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5">Target Respons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-iron-grey-100 bg-white">
                {tickets.data.data.map((ticket: any) => (
                  <tr key={ticket.id} className="transition-colors hover:bg-alice-blue-50/40">
                    <td className="py-3 px-3.5">
                      <Link className="font-mono font-bold text-alice-blue-700 hover:underline" to={`/app/tickets/${ticket.id}`}>
                        {ticket.ticketCode}
                      </Link>
                      <p className="mt-0.5 text-xs text-lavender-grey-500">{formatDate(ticket.createdAt)}</p>
                    </td>
                    <td className="py-3 px-3.5">
                      <p className="font-semibold text-charcoal-900">{ticket.site.name}</p>
                      <p className="text-xs text-lavender-grey-500">{ticket.site.client.name}</p>
                    </td>
                    <td className="py-3 px-3.5"><Badge value={ticket.status} /></td>
                    <td className="py-3 px-3.5">
                      <SlaCountdown
                        dueAt={ticket.slaRespond?.dueAt}
                        status={ticket.slaRespond?.runtime?.status}
                        outcome={ticket.slaRespond?.runtime?.outcome}
                        completedAt={ticket.slaRespond?.completedAt}
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-charcoal-900">Perhitungan SLA</h2>
          <p className="text-xs text-lavender-grey-500">Persentase perhitungan SLA berdasarkan waktu respons dan penyelesaian seluruh keluhan.</p>
          <div className="mt-6 space-y-6">
            <div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-charcoal-700">Pencapaian SLA Respons</span>
                <span className="text-alice-blue-600 font-extrabold">{data.mttr?.respondPercentage ?? 0}%</span>
              </div>
              <div className="mt-2 h-3.5 overflow-hidden rounded-full bg-iron-grey-100 p-0.5 border border-iron-grey-200/60">
                <div className="h-full rounded-full bg-gradient-to-r from-alice-blue-500 to-alice-blue-600 transition-all duration-500" style={{ width: `${Math.min(100, data.mttr?.respondPercentage ?? 0)}%` }} />
              </div>
              <p className="mt-2 text-xs text-lavender-grey-500 font-medium">Persentase keluhan yang ditanggapi tepat waktu sebelum batas SLA.</p>
            </div>
            <div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-charcoal-700">Pencapaian SLA Penyelesaian</span>
                <span className="text-emerald-600 font-extrabold">{data.mttr?.resolutionPercentage ?? 0}%</span>
              </div>
              <div className="mt-2 h-3.5 overflow-hidden rounded-full bg-iron-grey-100 p-0.5 border border-iron-grey-200/60">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500" style={{ width: `${Math.min(100, data.mttr?.resolutionPercentage ?? 0)}%` }} />
              </div>
              <p className="mt-2 text-xs text-lavender-grey-500 font-medium">Persentase keluhan yang berhasil diselesaikan sesuai target batas SLA.</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}