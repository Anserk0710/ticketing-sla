import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { EmptyState } from '../../components/data-display/empty-state';
import { PageHeader } from '../../components/data-display/page-header';
import { ErrorPanel, Loading } from '../../components/feedback/loading';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field, Textarea } from '../../components/ui/field';
import { formatDate } from '../../utils/format';

export function ApprovalsPage() {
  const qc = useQueryClient(); const [rejectId, setRejectId] = useState<string | null>(null); const [reason, setReason] = useState('');
  const query = useQuery({ queryKey: ['technician-approvals'], queryFn: () => apiRequest<any[]>('/technicians/approvals') });
  const mutation = useMutation({ mutationFn: ({ id, action, body }: { id: string; action: 'approve' | 'reject'; body: unknown }) => apiRequest(`/technicians/approvals/${id}/${action}`, { method: 'POST', body: JSON.stringify(body) }), onSuccess: async () => { setRejectId(null); setReason(''); await qc.invalidateQueries({ queryKey: ['technician-approvals'] }); } });
  if (query.isLoading) return <Loading />; if (query.error) return <ErrorPanel error={query.error} />;
  return <><PageHeader eyebrow="Account Lifecycle" title="Approval Teknisi" description="Review registrasi teknisi. Akun hanya dapat login setelah berstatus APPROVED." />{mutation.error && <div className="mb-5"><ErrorPanel error={mutation.error} /></div>}{!query.data?.length ? <EmptyState title="Tidak ada approval tertunda" description="Registrasi teknisi baru akan tampil di halaman ini." /> : <div className="grid gap-5 lg:grid-cols-2">{query.data.map((profile) => <Card key={profile.id}><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{profile.user.displayName}</h2><p className="text-sm text-lavender-grey-500">{profile.user.email}</p></div><Badge value={profile.user.status} /></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-lavender-grey-500">Nomor</dt><dd className="font-semibold">{profile.user.phoneNormalized}</dd></div><div><dt className="text-lavender-grey-500">Kode pegawai</dt><dd className="font-semibold">{profile.employeeCode || '—'}</dd></div><div><dt className="text-lavender-grey-500">Skills</dt><dd className="font-semibold">{profile.skills.join(', ') || 'Belum diisi'}</dd></div><div><dt className="text-lavender-grey-500">Registrasi</dt><dd className="font-semibold">{formatDate(profile.createdAt)}</dd></div></dl><div className="mt-5 flex gap-2"><Button loading={mutation.isPending} onClick={() => mutation.mutate({ id: profile.id, action: 'approve', body: { note: 'Data telah diverifikasi.' } })}><Check className="h-4 w-4" />Approve</Button><Button variant="danger" onClick={() => setRejectId(profile.id)}><X className="h-4 w-4" />Reject</Button></div>{rejectId === profile.id && <div className="mt-4 rounded-xl bg-iron-grey-50 p-4"><Field label="Alasan penolakan"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field><div className="mt-3 flex gap-2"><Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate({ id: profile.id, action: 'reject', body: { reason } })}>Konfirmasi</Button><Button variant="ghost" onClick={() => setRejectId(null)}>Batal</Button></div></div>}</Card>)}</div>}</>;
}
