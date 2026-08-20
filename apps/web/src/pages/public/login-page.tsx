import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '../../features/auth/auth-context';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field, Input } from '../../components/ui/field';
import type { AuthSession } from '../../types/api';

function landingPage(next: AuthSession): string {
  if (next.user.mustChangePassword) return '/change-password';
  if (next.user.roles.includes('TECHNICIAN') && !next.user.permissions.includes('report.read')) return '/app/assignments';
  return '/app/dashboard';
}

export function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('forfun071020@gmail.com');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to={landingPage(session)} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const next = await login(email, password);
      const requested = (location.state as { from?: string } | null)?.from;
      navigate(next.user.mustChangePassword ? '/change-password' : requested ?? landingPage(next), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login gagal.');
    } finally {
      setLoading(false);
    }
  }

  return <div className="mx-auto max-w-md py-10">
    <Card className="p-7 shadow-xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-xl bg-alice-blue-100 p-3 text-alice-blue-600 shadow-sm"><LockKeyhole /></span>
        <div><h1 className="text-2xl font-black text-charcoal-950">Login Internal</h1><p className="text-sm font-medium text-lavender-grey-600">Administrator, Head, dan Technician</p></div>
      </div>
      {error && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm font-semibold text-rose-900">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <Button className="w-full py-2.5 text-base" loading={loading}>Masuk</Button>
      </form>
      <div className="mt-5 flex justify-between text-sm font-medium">
        <Link className="text-alice-blue-600 hover:text-alice-blue-700 hover:underline" to="/register-technician">Daftar teknisi</Link>
        <Link className="text-lavender-grey-600 hover:text-charcoal-950 hover:underline" to="/forgot-password">Lupa password</Link>
      </div>
    </Card>
  </div>;
}

