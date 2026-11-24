import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { PageHeader } from '../../components/data-display/page-header';
import { ErrorPanel, Loading } from '../../components/feedback/loading';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Select } from '../../components/ui/field';
import { formatDate, formatDuration } from '../../utils/format';

export function ReportsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<'tickets' | 'technicians'>('tickets');
  const [exporting, setExporting] = useState(false);

  const params = `page=1&pageSize=100&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ''}`;
  const report = useQuery({ queryKey: ['report', tab, search, status], queryFn: () => apiRequest<any>(`/reports/${tab}?${params}`) });

  async function exportExcel() {
    setExporting(true);
    try {
      const blob = await apiRequest<Blob>(`/reports/tickets/export?${params}`, { method: 'POST' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Laporan Langsung"
        title="Laporan Operasional"
        description="Unduh laporan operasional secara lengkap dalam format Excel."
        action={
          <Button onClick={() => void exportExcel()} loading={exporting}>
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        }
      />
      <Card className="p-6">
        <div className="flex flex-wrap gap-2 border-b border-iron-grey-100 pb-4">
          <button
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${tab === 'tickets' ? 'bg-powder-blue-900 text-white shadow-md' : 'bg-iron-grey-100 text-charcoal-700 hover:bg-iron-grey-200'
              }`}
            onClick={() => setTab('tickets')}
          >
            Report Ticket
          </button>
          <button
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${tab === 'technicians' ? 'bg-powder-blue-900 text-white shadow-md' : 'bg-iron-grey-100 text-charcoal-700 hover:bg-iron-grey-200'
              }`}
            onClick={() => setTab('technicians')}
          >
            SLA Teknisi
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-lavender-grey-400" />
            <Input className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari ticket, reporter, atau PIC..." />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua status ticket</option>
            {/* Phase 8: PENDING dan CANCELLED dimasukkan ke dalam opsi filter laporan */}
            {['NEW', 'RESPONDED', 'ASSIGNED', 'ON_SITE', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'].map((item) => (
              <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>
            ))}
          </Select>
        </div>

        {report.isLoading ? (
          <Loading />
        ) : report.error ? (
          <div className="mt-5"><ErrorPanel error={report.error} /></div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-iron-grey-200/80">
            {tab === 'tickets' ? (
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-iron-grey-100/80 text-[11px] font-bold uppercase tracking-wider text-charcoal-700">
                  <tr>
                    <th className="py-3.5 px-4">Ticket</th>
                    <th className="py-3.5 px-4">Client / Site</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Respond By</th>
                    <th className="py-3.5 px-4">SLA Respond</th>
                    <th className="py-3.5 px-4">SLA Work</th>
                    <th className="py-3.5 px-4">Lead</th>
                    <th className="py-3.5 px-4">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-iron-grey-100 bg-white">
                  {report.data.data.map((row: any) => (
                    <tr key={row.ticketId} className="transition-colors hover:bg-alice-blue-50/40">
                      <td className="py-3.5 px-4 font-mono font-bold text-alice-blue-700">{row.ticketCode}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-charcoal-900">{row.client}</p>
                        <p className="text-xs text-lavender-grey-500">{row.site}</p>
                      </td>
                      <td className="py-3.5 px-4"><Badge value={row.status} /></td>
                      <td className="py-3.5 px-4 text-charcoal-700 font-medium">{row.respondedBy || '—'}</td>
                      <td className="py-3.5 px-4">
                        <Badge value={row.slaRespondOutcome ?? row.slaRespondStatus ?? 'N/A'} />
                        <p className="mt-1 text-xs text-lavender-grey-500 font-medium">{formatDuration(row.slaRespondElapsedSeconds)}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge value={row.slaWorkAggregate} />
                        <p className="mt-1 text-xs text-lavender-grey-500 font-medium">
                          {row.slaWorkAggregate === 'NOT_STARTED' || row.slaWorkElapsedSeconds == null
                            ? '—'
                            : formatDuration(row.slaWorkElapsedSeconds)}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-charcoal-700 font-medium">{row.leadTechnician || '—'}</td>
                      <td className="py-3.5 px-4 text-xs font-medium text-lavender-grey-500">{formatDate(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-iron-grey-100/80 text-[11px] font-bold uppercase tracking-wider text-charcoal-700">
                  <tr>
                    <th className="py-3.5 px-4">Ticket</th>
                    <th className="py-3.5 px-4">Teknisi</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Assigned</th>
                    <th className="py-3.5 px-4">Check-in</th>
                    <th className="py-3.5 px-4">Completed</th>
                    <th className="py-3.5 px-4">SLA Outcome</th>
                    <th className="py-3.5 px-4">Breach</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-iron-grey-100 bg-white">
                  {report.data.data.map((row: any) => (
                    <tr key={row.memberId} className="transition-colors hover:bg-alice-blue-50/40">
                      <td className="py-3.5 px-4 font-mono font-bold text-alice-blue-700">{row.ticketCode}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-charcoal-900">{row.technician}</p>
                        <p className="text-xs text-lavender-grey-500">{row.client} — {row.site}</p>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-charcoal-700">{row.role}</td>
                      <td className="py-3.5 px-4 text-xs font-medium text-lavender-grey-500">{formatDate(row.assignedAt)}</td>
                      <td className="py-3.5 px-4 text-xs font-medium text-lavender-grey-500">{formatDate(row.firstCheckinAt)}</td>
                      <td className="py-3.5 px-4 text-xs font-medium text-lavender-grey-500">{formatDate(row.completedAt)}</td>
                      <td className="py-3.5 px-4"><Badge value={row.slaOutcome ?? 'OPEN'} /></td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-rose-700">{formatDuration(row.breachSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </>
  );
}