import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../api/http-client';
import { ErrorPanel } from '../../components/feedback/loading';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field, Input } from '../../components/ui/field';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState('');
  const mutation = useMutation({
    mutationFn: () => apiRequest<{ success: boolean }>('/public/auth/reset-password', {
      method: 'POST', auth: false, body: JSON.stringify({ token, newPassword })
    })
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setLocalError('');
    if (newPassword !== confirmation) {
      setLocalError('Konfirmasi password tidak sama.');
      return;
    }
    mutation.mutate();
  }

  return <div className="mx-auto max-w-md">
    <Card>
      <h1 className="text-2xl font-bold text-charcoal-900">Reset password</h1>
      <p className="mt-2 text-sm text-charcoal-600">Masukkan token reset dan password baru minimal delapan karakter.</p>
      {(localError || mutation.error) && <div className="mt-4">{localError ? <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{localError}</div> : <ErrorPanel error={mutation.error} />}</div>}
      {mutation.data ? <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Password berhasil diubah. <Link className="font-semibold underline" to="/login">Masuk sekarang</Link>.</div> :
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Token reset"><Input value={token} onChange={(e) => setToken(e.target.value)} required /></Field>
          <Field label="Password baru"><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required /></Field>
          <Field label="Konfirmasi password"><Input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} minLength={8} required /></Field>
          <Button className="w-full" loading={mutation.isPending}>Simpan password baru</Button>
        </form>}
    </Card>
  </div>;
}
