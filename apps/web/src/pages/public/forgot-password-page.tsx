import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/http-client';
import { ErrorPanel } from '../../components/feedback/loading';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field, Input } from '../../components/ui/field';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const mutation = useMutation({
    mutationFn: () => apiRequest<{ message: string; developmentToken?: string }>('/public/auth/forgot-password', {
      method: 'POST', auth: false, body: JSON.stringify({ email })
    })
  });
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate(); }

  return <div className="mx-auto max-w-md">
    <Card>
      <h1 className="text-2xl font-bold text-charcoal-900">Lupa password</h1>
      <p className="mt-2 text-sm text-charcoal-600">Masukkan email akun. Respons dibuat generik untuk melindungi data pengguna.</p>
      {mutation.error && <div className="mt-4"><ErrorPanel error={mutation.error} /></div>}
      {mutation.data ? <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
        <p>{mutation.data.message}</p>
        {mutation.data.developmentToken && <>
          <p className="mt-3 break-all font-mono text-xs">Token demo: {mutation.data.developmentToken}</p>
          <Link className="mt-3 inline-block font-semibold underline" to={`/reset-password?token=${encodeURIComponent(mutation.data.developmentToken)}`}>Lanjutkan reset password</Link>
        </>}
      </div> : <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Button className="w-full" loading={mutation.isPending}>Kirim Instruksi</Button>
      </form>}
    </Card>
  </div>;
}
