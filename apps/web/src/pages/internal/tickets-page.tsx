import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/http-client';
import { EmptyState } from '../../components/data-display/empty-state';
import { PageHeader } from '../../components/data-display/page-header';
import { SlaCountdown } from '../../components/data-display/sla-countdown';
import { ErrorPanel, Loading } from '../../components/feedback/loading';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { Input, Select } from '../../components/ui/field';
import { formatDate } from '../../utils/format';

type TicketSortBy = 'ticketCode' | 'clientName' | 'siteName' | 'priority' | 'status' | 'createdAt';
type TicketSortOrder = 'asc' | 'desc';

type SortableHeaderProps = {
  label: string;
  value: TicketSortBy;
  sortBy: TicketSortBy;
  sortOrder: TicketSortOrder;
  onSort: (value: TicketSortBy) => void;
};

function SortableHeader({ label, value, sortBy, sortOrder, onSort }: SortableHeaderProps) {
  const isActive = sortBy === value;
  const SortIcon = isActive ? (sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      aria-sort={isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="py-3.5 px-4"
      scope="col"
    >
      <button
        className="inline-flex items-center gap-1.5 rounded-sm text-left hover:text-charcoal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alice-blue-500 focus-visible:ring-offset-2"
        onClick={() => onSort(value)}
        type="button"
      >
        {label}
        <SortIcon aria-hidden="true" className={isActive ? 'text-alice-blue-700' : 'text-lavender-grey-400'} size={14} />
      </button>
    </th>
  );
}

export function TicketsPage() {
  const [inputSearch, setInputSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState<TicketSortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<TicketSortOrder>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(inputSearch.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [inputSearch]);

  const handleSort = (nextSortBy: TicketSortBy) => {
    if (nextSortBy === sortBy) {
      setSortOrder((current) => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(nextSortBy);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const query = useQuery({
    queryKey: ['tickets', debouncedSearch, status, sortBy, sortOrder, page],
    queryFn: () => apiRequest<any>(`/tickets?page=${page}&pageSize=20&search=${encodeURIComponent(debouncedSearch)}${status ? `&status=${status}` : ''}&sortBy=${sortBy}&sortOrder=${sortOrder}`)
  });

  return (
    <>
      <PageHeader eyebrow="Daftar Keluhan" title="Semua Keluhan" description="Pantau semua keluhan yang masuk, siapa yang sedang mengerjakan, dan batas waktu penyelesaiannya di sini." />
      <Card className="p-6">
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-lavender-grey-400" />
            <Input className="pl-10" value={inputSearch} onChange={(e) => setInputSearch(e.target.value)} placeholder="Cari ticket, client, site, reporter, PIC, atau deskripsi..." />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Semua status ticket</option>
            {['NEW','RESPONDED','ASSIGNED','ON_SITE','IN_PROGRESS','RESOLVED','CLOSED','REJECTED','REOPENED','CANCELLED','PENDING'].map((item) => (
              <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>
            ))}
          </Select>
        </div>

        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <div className="mt-5"><ErrorPanel error={query.error} /></div>
        ) : !query.data?.data?.length ? (
          <div className="mt-6"><EmptyState title="Tidak ada keluhan" description="Coba ubah kata kunci pencarian Anda atau tunggu hingga ada laporan baru yang masuk." /></div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-iron-grey-200/80">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-iron-grey-100/80 text-[11px] font-bold uppercase tracking-wider text-charcoal-700">
                <tr>
                  <SortableHeader label="Ticket" value="ticketCode" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Client" value="clientName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Site" value="siteName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Priority" value="priority" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Status" value="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <th className="py-3.5 px-4" scope="col">SLA Respond</th>
                  <th className="py-3.5 px-4" scope="col">SLA Pengerjaan</th>
                  <SortableHeader label="Dibuat" value="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-iron-grey-100 bg-white">
                {query.data.data.map((ticket: any) => {
                  const activeWorkSla = ticket.assignments?.[0]?.members?.find((m: any) => m.slaInstances?.[0])?.slaInstances?.[0];
                  return (
                    <tr key={ticket.id} className="transition-colors hover:bg-alice-blue-50/50">
                      <td className="py-4 px-4">
                        <Link className="font-mono font-extrabold text-alice-blue-700 hover:text-alice-blue-950 hover:underline" to={`/app/tickets/${ticket.id}`}>
                          {ticket.ticketCode}
                        </Link>
                        <p className="mt-1 max-w-xs truncate text-xs font-medium text-charcoal-600">{ticket.description}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-charcoal-900">{ticket.site.client.name}</p>
                      </td>
                      <td className="py-4 px-4 text-xs text-lavender-grey-500">{ticket.site.name}</td>
                      <td className="py-4 px-4"><Badge value={ticket.priority.code} /></td>
                      <td className="py-4 px-4"><Badge value={ticket.status} /></td>
                      <td className="py-4 px-4">
                        <SlaCountdown
                          dueAt={ticket.slaRespond?.dueAt}
                          status={ticket.slaRespond?.runtime?.status}
                          outcome={ticket.slaRespond?.runtime?.outcome}
                          completedAt={ticket.slaRespond?.completedAt}
                          size="sm"
                        />
                      </td>
                      <td className="py-4 px-4">
                        {activeWorkSla ? (
                          <SlaCountdown
                            dueAt={activeWorkSla.dueAt}
                            status={activeWorkSla.status}
                            outcome={activeWorkSla.outcome}
                            completedAt={activeWorkSla.completedAt}
                            size="sm"
                          />
                        ) : (
                          <Badge value={ticket.workSlaAggregate?.status ?? 'NOT_STARTED'} />
                        )}
                      </td>
                      <td className="py-4 px-4 text-xs font-medium text-lavender-grey-500">{formatDate(ticket.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}


        {query.data && query.data.meta.total > query.data.meta.pageSize && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-iron-grey-100 pt-4 text-sm">
            <span className="text-xs font-semibold text-lavender-grey-500">
              Menampilkan {((page - 1) * query.data.meta.pageSize) + 1} - {Math.min(page * query.data.meta.pageSize, query.data.meta.total)} dari total {query.data.meta.total} keluhan
            </span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border border-iron-grey-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-iron-grey-50 disabled:opacity-40 disabled:hover:bg-white"
                disabled={page === 1}
                onClick={() => setPage((v) => v - 1)}
              >
                Sebelumnya
              </button>
              <span className="px-2 text-xs font-bold text-charcoal-700">Halaman {page} dari {Math.ceil(query.data.meta.total / query.data.meta.pageSize)}</span>
              <button
                className="rounded-xl border border-iron-grey-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-iron-grey-50 disabled:opacity-40 disabled:hover:bg-white"
                disabled={page * query.data.meta.pageSize >= query.data.meta.total}
                onClick={() => setPage((v) => v + 1)}
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
