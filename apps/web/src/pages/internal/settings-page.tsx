import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check, ChevronDown, ChevronUp, Copy, Edit2, ExternalLink,
  MapPin, Plus, QrCode, RefreshCw, X
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { PageHeader } from '../../components/data-display/page-header';
import { ErrorPanel, Loading } from '../../components/feedback/loading';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field, Input, Select, Textarea } from '../../components/ui/field';
import { useAuth } from '../../features/auth/auth-context';
import { formatDate, formatDuration } from '../../utils/format';

type Tab = 'clients' | 'sites' | 'catalog' | 'users' | 'sla';

/* ─── kecil helper ────────────────────────────────────────── */
function SectionTitle({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h3 className="text-base font-bold text-charcoal-900">{title}</h3>
        {count !== undefined && <p className="text-xs text-lavender-grey-500">{count} entri</p>}
      </div>
      {action}
    </div>
  );
}

function Thead({ cols }: { cols: string[] }) {
  return (
    <thead className="bg-iron-grey-100/80 text-[11px] font-bold uppercase tracking-wider text-charcoal-700">
      <tr>
        {cols.map((c) => <th key={c} className="whitespace-nowrap px-4 py-3">{c}</th>)}
      </tr>
    </thead>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      title="Salin" className="ml-1 text-lavender-grey-400 hover:text-alice-blue-600 transition-colors"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function InlineForm({ title, error, onClose, children }: { title: string; error?: Error | null; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-2xl border border-alice-blue-200 bg-gradient-to-br from-alice-blue-50 to-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-bold text-alice-blue-800">{title}</p>
        <button onClick={onClose} className="rounded-lg p-1 text-lavender-grey-500 hover:bg-iron-grey-100 transition-colors"><X className="h-4 w-4" /></button>
      </div>
      {children}
      {!!error && <div className="mt-3"><ErrorPanel error={error} /></div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  TAB CLIENTS                                                  */
/* ──────────────────────────────────────────────────────────── */
function ClientsTab() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState({ code: '', name: '', isActive: true });
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const query = useQuery({ queryKey: ['clients'], queryFn: () => apiRequest<any[]>('/clients') });
  const save = useMutation({
    mutationFn: (body: object) =>
      apiRequest(editId ? `/clients/${editId}` : '/clients', { method: editId ? 'PATCH' : 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setOpen(false); setEditId(null); setForm({ code: '', name: '', isActive: true }); await qc.invalidateQueries({ queryKey: ['clients'] }); }
  });

  function startEdit(item: any) { setForm({ code: item.code, name: item.name, isActive: item.isActive }); setEditId(item.id); setOpen(true); }
  function startNew() { setForm({ code: '', name: '', isActive: true }); setEditId(null); setOpen(true); }

  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorPanel error={query.error} />;

  return (
    <div>
      <SectionTitle title="Clients" count={query.data?.length}
        action={hasPermission('client.manage') && <Button onClick={startNew}><Plus className="h-4 w-4" />Tambah Client</Button>} />

      {open && hasPermission('client.manage') && (
        <InlineForm title={editId ? 'Edit Client' : 'Tambah Client Baru'} error={save.error} onClose={() => { setOpen(false); setEditId(null); }}>
          <form className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
            <Field label="Kode">
              <Input value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required placeholder="CLI-001" />
            </Field>
            <Field label="Nama Client">
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="PT. Nama Klien" />
            </Field>
            <Field label="Status">
              <Select value={form.isActive ? '1' : '0'} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.value === '1' }))}>
                <option value="1">Aktif</option><option value="0">Nonaktif</option>
              </Select>
            </Field>
            <div className="sm:col-span-3 flex gap-2">
              <Button type="submit" loading={save.isPending}>{editId ? 'Simpan Perubahan' : 'Buat Client'}</Button>
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); setEditId(null); }}>Batal</Button>
            </div>
          </form>
        </InlineForm>
      )}

      <div className="overflow-x-auto rounded-xl border border-iron-grey-200/80">
        <table className="w-full text-left text-sm">
          <Thead cols={['Code', 'Nama Client', 'Sites', 'Status', 'Aksi']} />
          <tbody className="divide-y divide-iron-grey-100 bg-white">
            {query.data?.map((item) => (
              <tr key={item.id} className="hover:bg-alice-blue-50/30 transition-colors">
                <td className="px-4 py-3.5 font-mono font-bold text-alice-blue-700">{item.code}</td>
                <td className="px-4 py-3.5 font-semibold text-charcoal-900">{item.name}</td>
                <td className="px-4 py-3.5 text-charcoal-600">{item._count?.sites ?? 0} site</td>
                <td className="px-4 py-3.5"><Badge value={item.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                <td className="px-4 py-3.5">
                  {hasPermission('client.manage') && (
                    <button onClick={() => startEdit(item)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-lavender-grey-500 hover:text-alice-blue-700 transition-colors">
                      <Edit2 className="h-3.5 w-3.5" />Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!query.data?.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-lavender-grey-400">Belum ada client. Klik "Tambah Client".</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  TAB SITES & QR                                              */
/* ──────────────────────────────────────────────────────────── */
function SitesTab() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [siteForm, setSiteForm] = useState({ clientId: '', code: '', name: '', address: '', latitude: '', longitude: '', allowedCheckinRadius: '', isActive: true });
  const [editId, setEditId] = useState<string | null>(null);
  const [openSiteForm, setOpenSiteForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [qrSiteId, setQrSiteId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState('');

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => apiRequest<any[]>('/sites') });
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiRequest<any[]>('/clients') });

  const saveSite = useMutation({
    mutationFn: (body: object) =>
      apiRequest(editId ? `/sites/${editId}` : '/sites', { method: editId ? 'PATCH' : 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setOpenSiteForm(false); setEditId(null);
      setSiteForm({ clientId: '', code: '', name: '', address: '', latitude: '', longitude: '', allowedCheckinRadius: '', isActive: true });
      await qc.invalidateQueries({ queryKey: ['sites'] });
    }
  });

  const saveQr = useMutation({
    mutationFn: (body: object) => apiRequest('/qr-codes', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setQrSiteId(null); setQrToken(''); await qc.invalidateQueries({ queryKey: ['sites'] }); }
  });

  function genToken() {
    const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return 'QR-' + Array.from({ length: 8 }, () => ch[Math.floor(Math.random() * ch.length)]).join('');
  }

  function startEdit(item: any) {
    setSiteForm({ clientId: item.clientId, code: item.code, name: item.name, address: item.address, latitude: item.latitude?.toString() ?? '', longitude: item.longitude?.toString() ?? '', allowedCheckinRadius: item.allowedCheckinRadius?.toString() ?? '', isActive: item.isActive });
    setEditId(item.id); setOpenSiteForm(true);
  }

  function submitSite(e: React.FormEvent) {
    e.preventDefault();
    saveSite.mutate({
      clientId: siteForm.clientId, code: siteForm.code, name: siteForm.name, address: siteForm.address,
      ...(siteForm.latitude ? { latitude: parseFloat(siteForm.latitude) } : {}),
      ...(siteForm.longitude ? { longitude: parseFloat(siteForm.longitude) } : {}),
      ...(siteForm.allowedCheckinRadius ? { allowedCheckinRadius: parseInt(siteForm.allowedCheckinRadius) } : {}),
      isActive: siteForm.isActive
    });
  }

  function openQrForm(siteId: string) { setQrSiteId(siteId); setQrToken(genToken()); setExpandedId(siteId); }

  if (sites.isLoading) return <Loading />;
  if (sites.error) return <ErrorPanel error={sites.error} />;

  return (
    <div>
      <SectionTitle title="Sites & QR Codes" count={sites.data?.length}
        action={hasPermission('site.manage') && (
          <Button onClick={() => { setSiteForm({ clientId: '', code: '', name: '', address: '', latitude: '', longitude: '', allowedCheckinRadius: '', isActive: true }); setEditId(null); setOpenSiteForm(true); }}>
            <Plus className="h-4 w-4" />Tambah Site
          </Button>
        )} />

      {openSiteForm && hasPermission('site.manage') && (
        <InlineForm title={editId ? 'Edit Site' : 'Tambah Site Baru'} error={saveSite.error} onClose={() => { setOpenSiteForm(false); setEditId(null); }}>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submitSite}>
            <Field label="Client">
              <Select value={siteForm.clientId} onChange={(e) => setSiteForm(f => ({ ...f, clientId: e.target.value }))} required>
                <option value="">Pilih client</option>
                {clients.data?.filter(c => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Kode Site">
              <Input value={siteForm.code} onChange={(e) => setSiteForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required placeholder="SITE-GDG-A" />
            </Field>
            <Field label="Nama Site">
              <Input value={siteForm.name} onChange={(e) => setSiteForm(f => ({ ...f, name: e.target.value }))} required placeholder="Gedung A - Lantai 3" />
            </Field>
            <Field label="Alamat" className="sm:col-span-2 lg:col-span-3">
              <Input value={siteForm.address} onChange={(e) => setSiteForm(f => ({ ...f, address: e.target.value }))} required placeholder="Jl. Contoh No. 1, Kota" />
            </Field>
            <Field label="Latitude (GPS)">
              <Input type="number" step="any" value={siteForm.latitude} onChange={(e) => setSiteForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-8.4095" />
            </Field>
            <Field label="Longitude (GPS)">
              <Input type="number" step="any" value={siteForm.longitude} onChange={(e) => setSiteForm(f => ({ ...f, longitude: e.target.value }))} placeholder="115.1889" />
            </Field>
            <Field label="Radius Check-in (meter)">
              <Input type="number" value={siteForm.allowedCheckinRadius} onChange={(e) => setSiteForm(f => ({ ...f, allowedCheckinRadius: e.target.value }))} placeholder="200 meter" />
            </Field>
            <Field label="Status">
              <Select value={siteForm.isActive ? '1' : '0'} onChange={(e) => setSiteForm(f => ({ ...f, isActive: e.target.value === '1' }))}>
                <option value="1">Aktif</option><option value="0">Nonaktif</option>
              </Select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <Button type="submit" loading={saveSite.isPending}>{editId ? 'Simpan Perubahan' : 'Buat Site'}</Button>
              <Button type="button" variant="ghost" onClick={() => { setOpenSiteForm(false); setEditId(null); }}>Batal</Button>
            </div>
          </form>
        </InlineForm>
      )}

      {/* Sites table — expand row untuk QR */}
      <div className="space-y-3">
        {!sites.data?.length && (
          <div className="rounded-xl border border-iron-grey-200 bg-iron-grey-50 py-10 text-center text-sm text-lavender-grey-400">
            Belum ada site. Klik "Tambah Site".
          </div>
        )}

        {sites.data?.map((item) => {
          const isExpanded = expandedId === item.id;
          const isQrOpen = qrSiteId === item.id;

          return (
            <div key={item.id} className="overflow-hidden rounded-2xl border border-iron-grey-200 bg-white shadow-sm">
              {/* Site header row */}
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-alice-blue-700 bg-alice-blue-50 px-2 py-0.5 rounded-full border border-alice-blue-100">{item.code}</span>
                    <Badge value={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                  <p className="mt-1 text-base font-bold text-charcoal-900">{item.name}</p>
                  <p className="text-sm text-lavender-grey-500">{item.client?.name} — {item.address}</p>
                  {item.latitude && item.longitude && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=17/${item.latitude}/${item.longitude}`}
                      target="_blank" rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-alice-blue-600 hover:underline"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasPermission('site.manage') && (
                    <button
                      onClick={() => startEdit(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-iron-grey-200 bg-white px-3 py-2 text-xs font-semibold text-charcoal-600 hover:bg-iron-grey-50 hover:text-alice-blue-700 transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />Edit
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-iron-grey-200 bg-white px-3 py-2 text-xs font-semibold text-charcoal-600 hover:bg-iron-grey-50 transition-colors"
                  >
                    <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                    {item.qrCodes?.length ?? 0} QR Code
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* QR panel — expandable */}
              {isExpanded && (
                <div className="border-t border-iron-grey-100 bg-iron-grey-50 p-4">
                  {/* Form generate QR baru */}
                  {isQrOpen && hasPermission('site.manage') ? (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="font-bold text-emerald-800">Generate QR Code Baru untuk {item.name}</p>
                        <button onClick={() => setQrSiteId(null)} className="text-emerald-600 hover:text-emerald-900">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <Field label="Token QR (unik, dapat dibaca)" className="flex-1 min-w-[200px]">
                          <div className="flex gap-2">
                            <Input
                              value={qrToken}
                              onChange={(e) => setQrToken(e.target.value.toUpperCase())}
                              placeholder="QR-XXXXXXXX"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setQrToken(genToken())}
                              title="Generate token baru"
                              className="shrink-0 rounded-xl border border-iron-grey-300 bg-white px-3 py-2 text-charcoal-600 hover:bg-iron-grey-50 transition-colors"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          </div>
                        </Field>
                        <div className="flex gap-2 pb-[1px]">
                          <Button
                            loading={saveQr.isPending}
                            onClick={() => { if (qrToken) saveQr.mutate({ siteId: item.id, token: qrToken }); }}
                          >
                            <QrCode className="h-4 w-4" />Simpan QR
                          </Button>
                          <Button variant="secondary" onClick={() => setQrSiteId(null)}>Batal</Button>
                        </div>
                      </div>
                      {saveQr.error && <div className="mt-3"><ErrorPanel error={saveQr.error} /></div>}
                    </div>
                  ) : hasPermission('site.manage') && (
                    <button
                      onClick={() => openQrForm(item.id)}
                      className="mb-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Plus className="h-4 w-4" />Generate QR Code Baru
                    </button>
                  )}

                  {/* Daftar QR code */}
                  {item.qrCodes?.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {item.qrCodes.map((qr: any) => (
                        <div key={qr.id} className="rounded-xl border border-iron-grey-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-sm font-bold text-charcoal-900">{qr.token}</span>
                                <CopyBtn text={`${window.location.origin}/complaint/${qr.token}`} />
                              </div>
                              <p className="mt-1 text-xs text-lavender-grey-500">
                                {qr.expiresAt ? `Expires: ${formatDate(qr.expiresAt)}` : 'Tidak ada batas waktu'}
                              </p>
                              <a
                                href={`/complaint/${qr.token}`}
                                target="_blank" rel="noreferrer"
                                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-alice-blue-600 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />Buka URL Complaint
                              </a>
                            </div>
                            <Badge value={qr.isActive ? 'ACTIVE' : 'INACTIVE'} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-iron-grey-200 bg-white px-4 py-6 text-center text-sm text-lavender-grey-400">
                      Belum ada QR code untuk site ini.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  TAB CATALOG (Category + Priority)                           */
/* ──────────────────────────────────────────────────────────── */
function CatalogTab() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [catForm, setCatForm] = useState({ code: '', name: '', displayOrder: '0', isActive: true });
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState(false);

  const cats = useQuery({ queryKey: ['categories'], queryFn: () => apiRequest<any[]>('/categories') });
  const prios = useQuery({ queryKey: ['priorities'], queryFn: () => apiRequest<any[]>('/priorities') });

  const saveCat = useMutation({
    mutationFn: (body: object) =>
      apiRequest(editCatId ? `/categories/${editCatId}` : '/categories', { method: editCatId ? 'PATCH' : 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setOpenCat(false); setEditCatId(null); setCatForm({ code: '', name: '', displayOrder: '0', isActive: true }); await qc.invalidateQueries({ queryKey: ['categories'] }); }
  });

  if (cats.isLoading || prios.isLoading) return <Loading />;
  if (cats.error || prios.error) return <ErrorPanel error={cats.error ?? prios.error} />;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Kategori */}
      <div>
        <SectionTitle title="Kategori" count={cats.data?.length}
          action={hasPermission('catalog.manage') && (
            <Button onClick={() => { setCatForm({ code: '', name: '', displayOrder: '0', isActive: true }); setEditCatId(null); setOpenCat(true); }}>
              <Plus className="h-4 w-4" />Tambah
            </Button>
          )} />

        {openCat && (
          <InlineForm title={editCatId ? 'Edit Kategori' : 'Tambah Kategori'} error={saveCat.error} onClose={() => { setOpenCat(false); setEditCatId(null); }}>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveCat.mutate({ ...catForm, displayOrder: parseInt(catForm.displayOrder) }); }}>
              <Field label="Kode"><Input value={catForm.code} onChange={(e) => setCatForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required placeholder="CAT-NET" /></Field>
              <Field label="Nama Kategori"><Input value={catForm.name} onChange={(e) => setCatForm(f => ({ ...f, name: e.target.value }))} required placeholder="Gangguan Jaringan" /></Field>
              <Field label="Urutan Tampil"><Input type="number" value={catForm.displayOrder} onChange={(e) => setCatForm(f => ({ ...f, displayOrder: e.target.value }))} /></Field>
              <Field label="Status">
                <Select value={catForm.isActive ? '1' : '0'} onChange={(e) => setCatForm(f => ({ ...f, isActive: e.target.value === '1' }))}>
                  <option value="1">Aktif</option><option value="0">Nonaktif</option>
                </Select>
              </Field>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" loading={saveCat.isPending}>{editCatId ? 'Simpan' : 'Buat Kategori'}</Button>
                <Button type="button" variant="ghost" onClick={() => { setOpenCat(false); setEditCatId(null); }}>Batal</Button>
              </div>
            </form>
          </InlineForm>
        )}

        <div className="overflow-hidden rounded-xl border border-iron-grey-200/80">
          <table className="w-full text-sm">
            <Thead cols={['Code', 'Nama', '#', 'Status', 'Aksi']} />
            <tbody className="divide-y divide-iron-grey-100 bg-white">
              {cats.data?.map((item) => (
                <tr key={item.id} className="hover:bg-alice-blue-50/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-alice-blue-700">{item.code}</td>
                  <td className="px-4 py-3 font-semibold text-charcoal-900">{item.name}</td>
                  <td className="px-4 py-3 text-xs text-lavender-grey-400">{item.displayOrder}</td>
                  <td className="px-4 py-3"><Badge value={item.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td className="px-4 py-3">
                    {hasPermission('catalog.manage') && (
                      <button onClick={() => { setCatForm({ code: item.code, name: item.name, displayOrder: item.displayOrder?.toString() ?? '0', isActive: item.isActive }); setEditCatId(item.id); setOpenCat(true); }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-lavender-grey-500 hover:text-alice-blue-700 transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prioritas — read only, managed via SLA tab */}
      <div>
        <SectionTitle title="Prioritas" count={prios.data?.length} />
        <div className="overflow-hidden rounded-xl border border-iron-grey-200/80">
          <table className="w-full text-sm">
            <Thead cols={['Priority', 'Label', 'SLA Respond', 'SLA Work']} />
            <tbody className="divide-y divide-iron-grey-100 bg-white">
              {prios.data?.map((item) => (
                <tr key={item.id} className="hover:bg-alice-blue-50/30 transition-colors">
                  <td className="px-4 py-3"><Badge value={item.code} /></td>
                  <td className="px-4 py-3 font-semibold text-charcoal-900">{item.label}</td>
                  <td className="px-4 py-3 font-medium text-charcoal-700">{formatDuration(item.policies[0]?.respondTargetSeconds)}</td>
                  <td className="px-4 py-3 font-medium text-charcoal-700">{formatDuration(item.policies[0]?.workTargetSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-lavender-grey-400">Target SLA dikelola di tab <strong>SLA Policy</strong>.</p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  TAB USERS                                                   */
/* ──────────────────────────────────────────────────────────── */
function UsersTab() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [actionId, setActionId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [tempResult, setTempResult] = useState<{ temporaryPassword: string } | null>(null);

  const query = useQuery({ queryKey: ['users'], queryFn: () => apiRequest<any[]>('/users') });
  const resetPass = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<{ temporaryPassword: string }>(`/users/${id}/temporary-password`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: async (data) => { setTempResult(data); setActionId(null); setReason(''); await qc.invalidateQueries({ queryKey: ['users'] }); }
  });

  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorPanel error={query.error} />;

  return (
    <div>
      <SectionTitle title="Users" count={query.data?.length} />

      {tempResult && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-amber-800">✅ Password Sementara Berhasil Dibuat</p>
              <p className="mt-1 text-xs text-amber-700">Bagikan ke user — <strong>wajib diganti</strong> saat login pertama.</p>
            </div>
            <button onClick={() => setTempResult(null)} className="text-amber-600 hover:text-amber-900"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <code className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-2.5 font-mono text-xl font-bold text-amber-900 tracking-widest">
              {tempResult.temporaryPassword}
            </code>
            <CopyBtn text={tempResult.temporaryPassword} />
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-iron-grey-200/80">
        <table className="w-full min-w-[700px] text-left text-sm">
          <Thead cols={['User', 'Role', 'Status', 'Last Login', 'Terdaftar', 'Aksi']} />
          <tbody className="divide-y divide-iron-grey-100 bg-white">
            {query.data?.map((item) => (
              <Fragment key={item.id}>
                <tr className="hover:bg-alice-blue-50/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-charcoal-900">{item.displayName}</p>
                    <p className="text-xs text-lavender-grey-500">{item.email}</p>
                    {item.phoneNormalized && <p className="text-xs text-lavender-grey-400">{item.phoneNormalized}</p>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {item.roles?.map((r: any) => <Badge key={r.role.name} value={r.role.name} variant="dark" />)}
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><Badge value={item.status} /></td>
                  <td className="px-4 py-3.5 text-xs text-lavender-grey-500">{formatDate(item.lastLoginAt)}</td>
                  <td className="px-4 py-3.5 text-xs text-lavender-grey-500">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    {hasPermission('user.manage') && (
                      <button
                        onClick={() => { setActionId(item.id); setReason(''); setTempResult(null); }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-lavender-grey-500 hover:text-amber-700 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />Reset Password
                      </button>
                    )}
                  </td>
                </tr>
                {actionId === item.id && (
                  <tr>
                    <td colSpan={6} className="bg-amber-50 px-4 py-0">
                      <div className="my-3 rounded-xl border border-amber-200 p-4">
                        <p className="mb-3 font-bold text-amber-800">Reset Password — {item.displayName}</p>
                        <div className="flex flex-wrap items-end gap-3">
                          <Field label="Alasan reset" className="flex-1 min-w-[220px]">
                            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: User lupa password" required />
                          </Field>
                          <div className="flex gap-2 pb-px">
                            <Button loading={resetPass.isPending} onClick={() => { if (reason) resetPass.mutate({ id: item.id, reason }); }}>
                              <RefreshCw className="h-4 w-4" />Generate Password
                            </Button>
                            <Button variant="ghost" onClick={() => setActionId(null)}>Batal</Button>
                          </div>
                        </div>
                        {resetPass.error && <div className="mt-3"><ErrorPanel error={resetPass.error} /></div>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  TAB SLA POLICY                                              */
/* ──────────────────────────────────────────────────────────── */
function SlaPoliciesTab() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ priorityId: '', respondMinutes: '', workHours: '', warningThresholdPercent: '75' });

  const policies = useQuery({ queryKey: ['sla-policies'], queryFn: () => apiRequest<any[]>('/sla/policies') });
  const prios = useQuery({ queryKey: ['priorities'], queryFn: () => apiRequest<any[]>('/priorities') });

  const save = useMutation({
    mutationFn: (body: object) => apiRequest('/sla/policies', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setOpen(false); setForm({ priorityId: '', respondMinutes: '', workHours: '', warningThresholdPercent: '75' });
      await qc.invalidateQueries({ queryKey: ['sla-policies'] });
      await qc.invalidateQueries({ queryKey: ['priorities'] });
    }
  });

  if (policies.isLoading) return <Loading />;
  if (policies.error) return <ErrorPanel error={policies.error} />;

  return (
    <div>
      <SectionTitle title="SLA Policy Versions" count={policies.data?.length}
        action={hasPermission('sla.policy.manage') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Policy Baru</Button>} />

      {open && (
        <InlineForm title="Buat Versi SLA Policy Baru" error={save.error} onClose={() => setOpen(false)}>
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            ⚠️ Policy baru hanya berlaku untuk ticket/assignment yang dibuat <strong>setelah</strong> policy ini aktif. Data lama tetap menggunakan snapshot lama.
          </div>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              priorityId: form.priorityId,
              respondTargetSeconds: Math.round(parseFloat(form.respondMinutes) * 60),
              workTargetSeconds: Math.round(parseFloat(form.workHours) * 3600),
              warningThresholdPercent: parseInt(form.warningThresholdPercent),
              effectiveFrom: new Date().toISOString()
            });
          }}>
            <Field label="Priority">
              <Select value={form.priorityId} onChange={(e) => setForm(f => ({ ...f, priorityId: e.target.value }))} required>
                <option value="">Pilih priority</option>
                {prios.data?.map((p: any) => <option key={p.id} value={p.id}>{p.label} ({p.code})</option>)}
              </Select>
            </Field>
            <Field label="Target Respond (menit)">
              <Input type="number" min="1" step="0.5" value={form.respondMinutes} onChange={(e) => setForm(f => ({ ...f, respondMinutes: e.target.value }))} required placeholder="30" />
            </Field>
            <Field label="Target Pengerjaan (jam)">
              <Input type="number" min="1" step="0.5" value={form.workHours} onChange={(e) => setForm(f => ({ ...f, workHours: e.target.value }))} required placeholder="4" />
            </Field>
            <Field label="Warning Threshold (%)">
              <Input type="number" min="1" max="99" value={form.warningThresholdPercent} onChange={(e) => setForm(f => ({ ...f, warningThresholdPercent: e.target.value }))} required />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
              <Button type="submit" loading={save.isPending}>Simpan Policy</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            </div>
          </form>
        </InlineForm>
      )}

      <div className="overflow-x-auto rounded-xl border border-iron-grey-200/80">
        <table className="w-full min-w-[600px] text-left text-sm">
          <Thead cols={['Priority', 'Version', 'Target Respond', 'Target Pengerjaan', 'Warning %', 'Effective From', 'Dibuat Oleh']} />
          <tbody className="divide-y divide-iron-grey-100 bg-white">
            {policies.data?.map((item) => (
              <tr key={item.id} className="hover:bg-alice-blue-50/30 transition-colors">
                <td className="px-4 py-3.5"><Badge value={item.priority?.code ?? '—'} /></td>
                <td className="px-4 py-3.5 font-mono font-bold text-charcoal-900">v{item.version}</td>
                <td className="px-4 py-3.5 font-medium text-charcoal-700">{formatDuration(item.respondTargetSeconds)}</td>
                <td className="px-4 py-3.5 font-medium text-charcoal-700">{formatDuration(item.workTargetSeconds)}</td>
                <td className="px-4 py-3.5 text-charcoal-600">{item.warningThresholdPercent}%</td>
                <td className="px-4 py-3.5 text-xs text-lavender-grey-500">{formatDate(item.effectiveFrom)}</td>
                <td className="px-4 py-3.5 text-xs text-lavender-grey-500">{item.createdBy?.displayName ?? 'System'}</td>
              </tr>
            ))}
            {!policies.data?.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-lavender-grey-400">Belum ada policy. Klik "Policy Baru".</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  MAIN PAGE                                                    */
/* ──────────────────────────────────────────────────────────── */
export function SettingsPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>('clients');

  const tabs: { key: Tab; label: string; visible: boolean }[] = [
    { key: 'clients', label: '🏢 Clients', visible: hasPermission('client.read') },
    { key: 'sites', label: '📍 Sites & QR', visible: hasPermission('site.read') },
    { key: 'catalog', label: '🏷️ Kategori', visible: hasPermission('catalog.read') },
    { key: 'users', label: '👥 Users', visible: hasPermission('user.read') },
    { key: 'sla', label: '⏱️ SLA Policy', visible: hasPermission('sla.policy.read') },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Pengaturan Sistem"
        title="Data Utama & Konfigurasi"
        description="Atur daftar klien, lokasi, kode QR, kategori masalah, batas waktu penyelesaian, dan akun tim Anda di sini."
      />
      <Card className="p-6">
        <div className="mb-6 flex flex-wrap gap-2 border-b border-iron-grey-100 pb-4">
          {tabs.filter(t => t.visible).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${tab === t.key ? 'bg-powder-blue-900 text-white shadow-md' : 'bg-iron-grey-100 text-charcoal-700 hover:bg-iron-grey-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'clients' && <ClientsTab />}
        {tab === 'sites'   && <SitesTab />}
        {tab === 'catalog' && <CatalogTab />}
        {tab === 'users'   && <UsersTab />}
        {tab === 'sla'     && <SlaPoliciesTab />}
      </Card>
    </>
  );
}
