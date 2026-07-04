import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api, saveToken, getToken, clearToken } from './api';

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'customer' | 'provider' | 'admin';
  is_provider: boolean;
  provider_mode: boolean;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthCtx = createContext<Ctx | null>(null);

async function processSessionId(sessionId: string): Promise<User | null> {
  const res = await fetch('https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data', {
    headers: { 'X-Session-ID': sessionId },
  });
  if (!res.ok) throw new Error('Google session invalid');
  const data = await res.json();
  const token = data.session_token || sessionId;
  const backendRes = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/google-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_token: token }),
  });
  const payload = await backendRes.json();
  if (!backendRes.ok) throw new Error(payload.detail || 'Backend rejected session');
  await saveToken(payload.token);
  return payload.user as User;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Web: handle #session_id=... in URL
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hash = window.location.hash || '';
          const search = window.location.search || '';
          const m = hash.match(/session_id=([^&]+)/) || search.match(/session_id=([^&]+)/);
          if (m) {
            const u = await processSessionId(decodeURIComponent(m[1]));
            setUser(u);
            window.history.replaceState(null, '', window.location.pathname);
            setLoading(false);
            return;
          }
        }
        const token = await getToken();
        if (token) await refresh();
      } catch (e) {
        console.warn('auth init', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    await saveToken(res.token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) });
    await saveToken(res.token);
    setUser(res.user);
  };

  const loginWithGoogle = async () => {
    if (Platform.OS === 'web') {
      const redirect = window.location.origin + '/';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
      return;
    }
    const redirect = Linking.createURL('auth');
    const result = await WebBrowser.openAuthSessionAsync(
      `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`,
      redirect,
    );
    if (result.type === 'success' && result.url) {
      const m = result.url.match(/session_id=([^&#]+)/);
      if (m) {
        const u = await processSessionId(decodeURIComponent(m[1]));
        setUser(u);
      }
    }
  };

  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    await clearToken();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be inside AuthProvider');
  return c;
}
