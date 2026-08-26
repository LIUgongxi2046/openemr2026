import { reactive } from 'vue';
import {
  sessionLoginResponseWireSchema,
  sessionUserWireSchema,
  type SessionLoginResponseWire,
  type SessionUserWire,
} from './generated/contracts';

const STORAGE_KEY = 'openemr2026.clinical-session';

interface StoredSession { token: string; user: SessionUserWire }

function restore(): StoredSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null') as StoredSession | null;
    if (!value?.token) return null;
    return { token: value.token, user: sessionUserWireSchema.parse(value.user) };
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

const restored = restore();
export const authSession = reactive<{ token: string; user: SessionUserWire | null }>({
  token: restored?.token ?? '',
  user: restored?.user ?? null,
});

function persist() {
  if (typeof sessionStorage === 'undefined') return;
  if (!authSession.token || !authSession.user) sessionStorage.removeItem(STORAGE_KEY);
  else sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: authSession.token, user: authSession.user }));
}

export async function loginClinicalSession(username: string, password: string): Promise<SessionLoginResponseWire> {
  const response = await fetch('/api/v1/session/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) throw new Error(response.status === 423 ? '账户已锁定，请稍后重试' : '用户名或密码错误');
  const session = sessionLoginResponseWireSchema.parse(payload);
  authSession.token = session.bearer_token;
  authSession.user = session.user;
  persist();
  return session;
}

export async function refreshClinicalSession(): Promise<SessionUserWire | null> {
  if (!authSession.token) return null;
  const response = await fetch('/api/v1/session/current', {
    headers: { Authorization: `Bearer ${authSession.token}` },
  });
  if (!response.ok) {
    clearClinicalSession();
    return null;
  }
  authSession.user = sessionUserWireSchema.parse(await response.json());
  persist();
  return authSession.user;
}

export async function logoutClinicalSession(): Promise<void> {
  const token = authSession.token;
  try {
    if (token) await fetch('/api/v1/session/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } finally {
    clearClinicalSession();
  }
}

export function clearClinicalSession() {
  authSession.token = '';
  authSession.user = null;
  persist();
}

