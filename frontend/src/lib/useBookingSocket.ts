import { useEffect, useRef, useState } from 'react';
import { getToken } from './api';

export type BookingUpdate = {
  type: 'snapshot' | 'status';
  booking_id: string;
  status: string;
  eta_minutes: number | null;
  updated_at?: string;
};

export function useBookingSocket(bookingId: string | undefined, onUpdate: (u: BookingUpdate) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const httpBase = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const wsBase = httpBase.replace(/^http/, 'ws');
      const url = `${wsBase}/api/ws/bookings/${bookingId}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          cbRef.current(data);
        } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          reconnect = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnect) clearTimeout(reconnect);
      try { wsRef.current?.close(); } catch {}
    };
  }, [bookingId]);

  return { connected };
}
