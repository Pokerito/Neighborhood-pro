import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'tasklocal_token';

export async function saveToken(token: string) {
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem(KEY, token); } catch {}
  } else {
    await SecureStore.setItemAsync(KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return window.localStorage.getItem(KEY); } catch { return null; }
  }
  return await SecureStore.getItemAsync(KEY);
}

export async function clearToken() {
  if (Platform.OS === 'web') {
    try { window.localStorage.removeItem(KEY); } catch {}
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export async function api(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}
