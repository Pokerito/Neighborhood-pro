import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { api } from '@/src/lib/api';
import { theme } from '@/src/theme';

export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'paid' | 'cancelled' | 'error'>('idle');
  const [err, setErr] = useState('');

  const startCheckout = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await api('/payments/checkout', { method: 'POST', body: JSON.stringify({ booking_id: id }) });
      if (res.already_paid || res.demo || res.payment_status === 'paid') { setStatus('paid'); return; }
      if (Platform.OS === 'web') {
        window.location.href = res.url;
      } else {
        setUrl(res.url);
      }
    } catch (e: any) { setErr(e.message || 'Failed'); setStatus('error'); }
    finally { setLoading(false); }
  }, [id]);

  const skipPay = () => {
    router.replace('/(tabs)/bookings');
  };

  const pollStatus = useCallback(async () => {
    try {
      const r = await api(`/payments/status/${id}`);
      if (r.payment_status === 'paid') setStatus('paid');
    } catch {}
  }, [id]);

  useEffect(() => {
    if (status === 'processing') pollStatus();
  }, [status, pollStatus]);

  const onNavChange = (navState: any) => {
    const u = navState.url || '';
    if (u.includes('payment-return')) {
      const isSuccess = u.includes('status=success');
      setUrl(null);
      setStatus(isSuccess ? 'processing' : 'cancelled');
      if (isSuccess) setTimeout(pollStatus, 800);
    }
  };

  if (url && Platform.OS !== 'web') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={styles.webHeader}>
          <Pressable onPress={() => setUrl(null)} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.webTitle}>Secure checkout</Text>
          <View style={{ width: 40 }} />
        </View>
        <WebView source={{ uri: url }} onNavigationStateChange={onNavChange} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface }}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.replace('/(tabs)/bookings')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {status === 'paid' ? (
          <View style={styles.centerCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="checkmark" size={40} color={theme.color.success} />
            </View>
            <Text style={styles.bigTitle}>Payment successful</Text>
            <Text style={styles.bigSub}>Your booking is confirmed. The pro will reach out shortly.</Text>
            <Pressable testID="view-bookings-button" style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/bookings')}>
              <Text style={styles.primaryBtnText}>View bookings</Text>
            </Pressable>
          </View>
        ) : status === 'cancelled' ? (
          <View style={styles.centerCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="alert-circle" size={40} color={theme.color.warning} />
            </View>
            <Text style={styles.bigTitle}>Payment cancelled</Text>
            <Text style={styles.bigSub}>Your booking is saved. You can pay later from Bookings.</Text>
            <Pressable style={styles.primaryBtn} onPress={startCheckout}>
              <Text style={styles.primaryBtnText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={skipPay}>
              <Text style={styles.ghostBtnText}>Pay later</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.centerCard}>
            <View style={[styles.iconCircle, { backgroundColor: theme.color.brandTertiary }]}>
              <Ionicons name="card" size={40} color={theme.color.brand} />
            </View>
            <Text style={styles.bigTitle}>Confirm & pay</Text>
            <Text style={styles.bigSub}>Secure checkout via Stripe. Use test card 4242 4242 4242 4242.</Text>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Pressable testID="pay-now-button" style={styles.primaryBtn} onPress={startCheckout} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Pay now</Text>}
            </Pressable>
            <Pressable testID="pay-later-button" style={styles.ghostBtn} onPress={skipPay}>
              <Text style={styles.ghostBtnText}>Pay on arrival</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 48 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: theme.color.onSurface },
  body: { flex: 1, padding: theme.spacing.xl, justifyContent: 'center' },
  centerCard: { alignItems: 'center', gap: 12 },
  iconCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  bigTitle: { fontSize: 22, fontWeight: '800', color: theme.color.onSurface, textAlign: 'center' },
  bigSub: { fontSize: 14, color: theme.color.muted, textAlign: 'center', marginBottom: 12, lineHeight: 20 },
  primaryBtn: { backgroundColor: theme.color.brand, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ghostBtn: { borderWidth: 1, borderColor: theme.color.borderStrong, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  ghostBtnText: { color: theme.color.onSurfaceTertiary, fontWeight: '700' },
  err: { color: theme.color.error, textAlign: 'center' },
  webHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#111' },
  webTitle: { color: '#fff', fontWeight: '700' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
