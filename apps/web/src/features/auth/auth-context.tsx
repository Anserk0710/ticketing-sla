import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest, getStoredSession, storeSession } from '../../api/http-client';
import type { AuthSession } from '../../types/api';

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [loading] = useState(false);

  useEffect(() => {
    const sync = () => setSession(getStoredSession());
    window.addEventListener('ticketing-session-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('ticketing-session-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    login: async (email, password) => {
      const next = await apiRequest<AuthSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        auth: false
      });
      storeSession(next);
      setSession(next);
      return next;
    },
    logout: async () => {
      try {
        if (session) {
          await apiRequest('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken: session.refreshToken })
          });
        }
      } finally {
        storeSession(null);
        setSession(null);
      }
    },
    hasPermission: (permission) => !!session?.user.permissions.includes(permission)
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth harus berada di AuthProvider');
  return value;
}
