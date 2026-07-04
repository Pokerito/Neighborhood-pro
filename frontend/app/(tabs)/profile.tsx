import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/lib/auth';
import { theme } from '@/src/theme';

type Category = { category_id: string; name: string };

export default function Profile() {
  const { user, logout, refresh, setUser } = useAuth();
  const [showApply, setShowApply] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [rate, setRate] = useState('60');
  const [catId, setCatId] = useState('home_repairs');
  const [applying, setApplying] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (showApply && cats.length === 0) {
      api('/categories').then(setCats).catch(() => {});
    }
  }, [showApply, cats.length]);

  const loadStats = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setStatsLoading(true);
    try { setStats(await api('/admin/stats')); } catch {}
    finally { setStatsLoading(false); }
  }, [user]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const onToggleProvider = async (val: boolean) => {
    if (!user?.is_provider && val) { setShowApply(true); return; }
    try {
      const u = await api('/users/provider-mode', { method: 'POST', body: JSON.stringify({ enabled: val }) });
      setUser(u);
    } catch (e) { console.warn(e); }
  };

  const submitApply = async () => {
    if (!businessName || !bio) return;
    setApplying(true);
    try {
      await api('/providers/apply', {
        method: 'POST',
        body: JSON.stringify({
          business_name: businessName, category_id: catId, bio,
          hourly_rate: parseFloat(rate) || 50, services: [], city: '',
        }),
      });
      await refresh();
      setShowApply(false);
    } catch (e: any) { console.warn(e.message); }
    finally { setApplying(false); }
  };

  const onLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}>
          <View style={styles.head}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={30} color={theme.color.brand} />
            </View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
                <View style={styles.iconTint}><Ionicons name="briefcase" size={18} color={theme.color.brand} /></View>
                <View>
                  <Text style={styles.rowTitle}>Provider mode</Text>
                  <Text style={styles.rowSub}>{user?.is_provider ? 'Toggle to accept jobs' : 'Become a service provider'}</Text>
                </View>
              </View>
              <Switch
                testID="provider-mode-toggle"
                value={!!user?.provider_mode}
                onValueChange={onToggleProvider}
                trackColor={{ true: theme.color.brand, false: theme.color.borderStrong }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {showApply && (
            <View style={styles.applyCard}>
              <Text style={styles.applyTitle}>Become a provider</Text>
              <Text style={styles.label}>Business name</Text>
              <TextInput testID="apply-business" style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="e.g. Rivera Repairs" placeholderTextColor={theme.color.muted} />
              <Text style={styles.label}>Bio</Text>
              <TextInput testID="apply-bio" style={[styles.input, { height: 80 }]} value={bio} onChangeText={setBio} placeholder="Tell customers about your expertise" placeholderTextColor={theme.color.muted} multiline />
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {cats.map((c) => (
                  <Pressable key={c.category_id} onPress={() => setCatId(c.category_id)} style={[styles.chip, catId === c.category_id && styles.chipActive]}>
                    <Text style={[styles.chipText, catId === c.category_id && styles.chipTextActive]}>{c.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>Hourly rate (USD)</Text>
              <TextInput testID="apply-rate" style={styles.input} value={rate} onChangeText={setRate} keyboardType="numeric" placeholder="60" placeholderTextColor={theme.color.muted} />
              <Pressable testID="apply-submit" style={styles.primaryBtn} onPress={submitApply} disabled={applying}>
                {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit application</Text>}
              </Pressable>
              <Pressable onPress={() => setShowApply(false)} style={{ marginTop: 8, alignSelf: 'center' }}>
                <Text style={{ color: theme.color.muted }}>Cancel</Text>
              </Pressable>
            </View>
          )}

          {user?.role === 'admin' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Admin dashboard</Text>
              {statsLoading ? (
                <ActivityIndicator color={theme.color.brand} />
              ) : stats ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  {[
                    { k: 'Users', v: stats.users, i: 'people' },
                    { k: 'Providers', v: stats.providers, i: 'briefcase' },
                    { k: 'Bookings', v: stats.bookings, i: 'calendar' },
                    { k: 'Unverified', v: stats.unverified, i: 'alert-circle' },
                  ].map((s) => (
                    <View key={s.k} style={styles.statBox}>
                      <Ionicons name={s.i as any} size={16} color={theme.color.brand} />
                      <Text style={styles.statVal}>{s.v}</Text>
                      <Text style={styles.statKey}>{s.k}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}

          <Pressable testID="logout-button" style={styles.logout} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={18} color={theme.color.error} />
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginBottom: theme.spacing.xl },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  name: { fontSize: 20, fontWeight: '800', color: theme.color.onSurface },
  email: { fontSize: 13, color: theme.color.muted, marginTop: 2 },
  roleBadge: { marginTop: 8, backgroundColor: theme.color.brandTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  roleText: { color: theme.color.onBrandTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.color.border },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconTint: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: theme.color.onSurface },
  rowSub: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  applyCard: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.color.border },
  applyTitle: { fontSize: 17, fontWeight: '800', color: theme.color.onSurface, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '700', color: theme.color.onSurfaceTertiary, marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.color.onSurface,
  },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { fontSize: 12, color: theme.color.onSurfaceTertiary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  primaryBtn: { backgroundColor: theme.color.brand, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.color.onSurface, marginBottom: 4 },
  statBox: { flexBasis: '47%', flexGrow: 1, backgroundColor: theme.color.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, gap: 4 },
  statVal: { fontSize: 22, fontWeight: '800', color: theme.color.onSurface },
  statKey: { fontSize: 11, color: theme.color.muted, fontWeight: '600', letterSpacing: 0.5 },
  logout: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 14, marginTop: 8, borderWidth: 1, borderColor: theme.color.border, borderRadius: 12, backgroundColor: theme.color.surfaceSecondary },
  logoutText: { color: theme.color.error, fontWeight: '700' },
});
