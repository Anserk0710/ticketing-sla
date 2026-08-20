import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { apiRequest } from '../../api/http-client';
import { ErrorPanel } from '../../components/feedback/loading';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field, Input } from '../../components/ui/field';
import { useAuth } from '../../features/auth/auth-context';

export function ChangePasswordPage() {
  const { session, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState('');
  const mutation = useMutation({
    mutationFn: () => apiRequest<{ success: boolean }>('/auth/change-password', {
      method: 'POST', body: JSON.stringify({ currentPassword, newPassword })
    }),
    onSuccess: () => { void logout(); }
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

  return <div className="min-h-screen bg-lavender-grey-100 px-4 py-12">
    <div className="mx-auto max-w-md">
      <Card className="p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-xl bg-amber-100 p-3 text-amber-700"><KeyRound /></span>
          <div><h1 className="text-2xl font-bold">Ganti password</h1><p className="text-sm text-lavender-grey-500">{session?.user.email}</p></div>
        </div>
        {session?.user.mustChangePassword && <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Akun ini menggunakan password sementara. Ganti password sebelum mengakses aplikasi.</div>}
        {(localError || mutation.error) && <div className="mb-4">{localError ? <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{localError}</div> : <ErrorPanel error={mutation.error} />}</div>}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Password saat ini"><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></Field>
          <Field label="Password baru"><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required /></Field>
          <Field label="Konfirmasi password baru"><Input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} minLength={8} required /></Field>
          <Button className="w-full" loading={mutation.isPending}>Ganti password</Button>
        </form>
        <p className="mt-4 text-xs text-lavender-grey-500">Setelah berhasil, seluruh sesi akan dicabut dan Anda perlu login kembali.</p>
      </Card>
    </div>
  </div>;
}
