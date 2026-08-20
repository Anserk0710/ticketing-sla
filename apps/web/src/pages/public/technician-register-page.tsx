import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/http-client';
import { ErrorPanel } from '../../components/feedback/loading';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field, Input } from '../../components/ui/field';
export function TechnicianRegisterPage() {
  const [form, setForm] = useState({ displayName: '', email: '', phone: '', password: '', employeeCode: '' });
  const mutation = useMutation({ mutationFn: () => apiRequest<any>('/public/technicians/register', { method: 'POST', auth: false, body: JSON.stringify({ ...form, skills: [] }) }) });
  const update = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  if (mutation.data) return <div className="mx-auto max-w-lg"><Card className="text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /><h1 className="mt-4 text-2xl font-bold text-charcoal-900">Registrasi diterima</h1><p className="mt-2 text-charcoal-600">Akun menunggu approval dari Head atau Administrator sebelum dapat login.</p><Link className="mt-5 inline-block font-semibold text-alice-blue-600" to="/login">Kembali ke login</Link></Card></div>;
  function submit(e: FormEvent) { e.preventDefault(); mutation.mutate(); }
  return <div className="mx-auto max-w-xl"><Card className="p-7"><h1 className="text-3xl font-bold text-charcoal-900">Registrasi Teknisi</h1><p className="mt-2 text-charcoal-600">Gunakan data kerja yang valid untuk proses approval.</p>{mutation.error && <div className="mt-4"><ErrorPanel error={mutation.error} /></div>}<form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2"><Field label="Nama lengkap"><Input value={form.displayName} onChange={(e) => update('displayName', e.target.value)} required /></Field><Field label="Kode pegawai"><Input value={form.employeeCode} onChange={(e) => update('employeeCode', e.target.value)} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></Field><Field label="Nomor telepon"><Input value={form.phone} onChange={(e) => update('phone', e.target.value)} required /></Field><div className="md:col-span-2"><Field label="Password"><Input type="password" minLength={8} value={form.password} onChange={(e) => update('password', e.target.value)} required /></Field></div><div className="md:col-span-2"><Button className="w-full" loading={mutation.isPending}>Kirim Registrasi</Button></div></form></Card></div>;
}
