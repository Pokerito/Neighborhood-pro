import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/lib/auth';
import { theme } from '@/src/theme';

type Booking = {
  booking_id: string; provider_id: string; provider_name: string;
  service: string; scheduled_at: string; address: string;
  status: string; payment_status: string; total_amount: number;
  customer_name?: string;
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  requested: { bg: '#FEF3C7', fg: '#92400E' },
  accepted: { bg: '#DBEAFE', fg: '#1E3A8A' },
  en_route: { bg: '#E0E7FF', fg: '#3730A3' },
  in_progress: { bg: '#FEE2E2', fg: '#991B1B' },
  completed: { bg: '#D1FAE5', fg: '#065F46' },
  cancelled: { bg: '#F5F5F4', fg: '#57534E' },
};

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

export default function Bookings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'customer' | 'provider'>('customer');
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(tab === 'customer' ? '/bookings' : '/bookings/provider');
      setItems(data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const providerMode = user?.provider_mode;

  const updateStatus = async (bid: string, status: string) => {
    try {
      await api(`/bookings/${bid}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (e: any) { console.warn(e); }
  };

  const nextStatus = (s: string) =>
    s === 'requested' ? 'accepted' :
    s === 'accepted' ? 'en_route' :
    s === 'en_route' ? 'in_progress' :
    s === 'in_progress' ? 'completed' : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        {providerMode && (
          <View style={styles.segmented}>
            <Pressable testID="seg-customer" onPress={() => setTab('customer')} style={[styles.segBtn, tab === 'customer' && styles.segActive]}>
              <Text style={[styles.segText, tab === 'customer' && styles.segTextActive]}>My bookings</Text>
            </Pressable>
            <Pressable testID="seg-provider" onPress={() => setTab('provider')} style={[styles.segBtn, tab === 'provider' && styles.segActive]}>
              <Text style={[styles.segText, tab === 'provider' && styles.segTextActive]}>Jobs</Text>
            </Pressable>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.color.brand} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={48} color={theme.color.muted} />
          <Text style={styles.emptyTitle}>{tab === 'customer' ? 'No bookings yet' : 'No incoming jobs'}</Text>
          <Text style={styles.emptySub}>{tab === 'customer' ? 'Discover services and book your first pro.' : 'You\'ll see new job requests here.'}</Text>
          {tab === 'customer' && (
            <Pressable testID="empty-cta-browse" style={styles.emptyBtn} onPress={() => router.push('/(tabs)')}>
              <Text style={styles.emptyBtnText}>Browse services</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.color.brand} />}
        >
          {items.map((b) => {
            const c = STATUS_COLORS[b.status] || STATUS_COLORS.requested;
            const nxt = nextStatus(b.status);
            return (
              <Pressable key={b.booking_id} onPress={() => router.push(`/track/${b.booking_id}`)} style={styles.card} testID={`booking-${b.booking_id}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.cardTitle}>{b.service}</Text>
                    <Text style={styles.cardSub}>{tab === 'customer' ? b.provider_name : b.customer_name || 'Customer'}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: c.bg }]}>
                    <Text style={[styles.pillText, { color: c.fg }]}>{b.status.replace('_', ' ')}</Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <Ionicons name="calendar-outline" size={14} color={theme.color.muted} />
                  <Text style={styles.rowText}>{formatDate(b.scheduled_at)}</Text>
                </View>
                <View style={styles.row}>
                  <Ionicons name="location-outline" size={14} color={theme.color.muted} />
                  <Text style={styles.rowText} numberOfLines={1}>{b.address}</Text>
                </View>
                <View style={styles.footer}>
                  <Text style={styles.amount}>${b.total_amount.toFixed(2)}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {tab === 'customer' && b.status !== 'cancelled' && b.status !== 'completed' && (
                      <Pressable testID={`track-${b.booking_id}`} style={styles.smallBtnGhost} onPress={() => router.push(`/track/${b.booking_id}`)}>
                        <Text style={styles.smallBtnGhostText}>Track</Text>
                      </Pressable>
                    )}
                    {tab === 'customer' && b.payment_status !== 'paid' && b.status !== 'cancelled' && (
                      <Pressable testID={`pay-${b.booking_id}`} style={styles.smallBtn} onPress={() => router.push(`/checkout/${b.booking_id}`)}>
                        <Text style={styles.smallBtnText}>Pay</Text>
                      </Pressable>
                    )}
                    {tab === 'provider' && nxt && (
                      <Pressable testID={`advance-${b.booking_id}`} style={styles.smallBtn} onPress={() => updateStatus(b.booking_id, nxt)}>
                        <Text style={styles.smallBtnText}>Mark {nxt.replace('_', ' ')}</Text>
                      </Pressable>
                    )}
                    {tab === 'customer' && b.status === 'requested' && (
                      <Pressable testID={`cancel-${b.booking_id}`} style={styles.smallBtnGhost} onPress={() => updateStatus(b.booking_id, 'cancelled')}>
                        <Text style={styles.smallBtnGhostText}>Cancel</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                {b.payment_status === 'paid' && (
                  <View style={styles.paidBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={theme.color.success} />
                    <Text style={{ color: theme.color.success, fontSize: 11, fontWeight: '700' }}>PAID</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  title: { fontSize: 26, fontWeight: '800', color: theme.color.onSurface },
  segmented: { flexDirection: 'row', backgroundColor: theme.color.surfaceTertiary, borderRadius: 10, padding: 3, marginTop: 12 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segActive: { backgroundColor: '#fff', ...theme.shadow.card },
  segText: { color: theme.color.muted, fontWeight: '600', fontSize: 13 },
  segTextActive: { color: theme.color.onSurface },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xl, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.color.onSurface, marginTop: 8 },
  emptySub: { color: theme.color.muted, textAlign: 'center' },
  emptyBtn: { backgroundColor: theme.color.brand, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border,
    borderRadius: 16, padding: 14, marginBottom: 12, gap: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.color.onSurface },
  cardSub: { fontSize: 13, color: theme.color.muted, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rowText: { fontSize: 13, color: theme.color.onSurfaceTertiary, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTopWidth: 1, borderTopColor: theme.color.divider, paddingTop: 10 },
  amount: { fontSize: 18, fontWeight: '800', color: theme.color.onSurface },
  smallBtn: { backgroundColor: theme.color.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  smallBtnGhost: { borderWidth: 1, borderColor: theme.color.borderStrong, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  smallBtnGhostText: { color: theme.color.onSurfaceTertiary, fontWeight: '700', fontSize: 12 },
  paidBadge: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 },
});
