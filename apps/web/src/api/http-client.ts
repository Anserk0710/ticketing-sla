import type { ApiFailure, AuthSession } from '../types/api';

const API_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
const SESSION_KEY = 'ticketing-sla-session';
let refreshPromise: Promise<AuthSession | null> | null = null;

export function getStoredSession(): AuthSession | null {
  try { const value = localStorage.getItem(SESSION_KEY); return value ? JSON.parse(value) as AuthSession : null; } catch { return null; }
}
export function storeSession(session: AuthSession | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent('ticketing-session-changed'));
}

async function refreshSession(): Promise<AuthSession | null> {
  const current = getStoredSession();
  if (!current?.refreshToken) return null;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: current.refreshToken })
  });
  if (!response.ok) { storeSession(null); return null; }
  const body = await response.json() as { data: AuthSession };
  storeSession(body.data);
  return body.data;
}

export async function apiRequest<T>(path: string, options: RequestInit & { auth?: boolean; raw?: boolean } = {}): Promise<T> {
  const execute = async (session?: AuthSession | null) => {
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (options.auth !== false && session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
    return fetch(`${API_URL}${path}`, { ...options, headers });
  };

  let session = getStoredSession();
  let response = await execute(session);
  if (response.status === 401 && options.auth !== false && session?.refreshToken) {
    refreshPromise ??= refreshSession().finally(() => { refreshPromise = null; });
    session = await refreshPromise;
    if (session) response = await execute(session);
  }
  if (!response.ok) {
    let failure: ApiFailure | null = null;
    try { failure = await response.json() as ApiFailure; } catch { /* ignore */ }
    const error = new Error(failure?.error.message ?? `Request gagal (${response.status})`) as Error & { code?: string; details?: unknown };
    error.code = failure?.error.code; error.details = failure?.error.details;
    throw error;
  }
  if (options.raw) return response as unknown as T;
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('spreadsheet') || contentType.includes('application/octet-stream')) return await response.blob() as T;
  const body = await response.json();
  return (body && typeof body === 'object' && 'meta' in body) ? body as T : body.data as T;
}

export async function uploadMedia(file: File, isPublic = false): Promise<{ id: string; originalName: string }> {
  const form = new FormData(); form.append('file', file);
  return apiRequest(isPublic ? '/public/media/upload' : '/media/upload', { method: 'POST', body: form, auth: !isPublic });
}
