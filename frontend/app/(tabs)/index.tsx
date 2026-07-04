import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/lib/auth';
import { theme } from '@/src/theme';

type Category = { category_id: string; name: string; icon: string; color: string; image: string; services: string[] };
type Provider = {
  provider_id: string; business_name: string; category_id: string; bio: string;
  hourly_rate: number; services: string[]; rating: number; review_count: number;
  city: string; image: string; distance_km: number; verified: boolean;
};

const ALL: Category = { category_id: 'all', name: 'All', icon: 'star', color: theme.color.brand, image: '', services: [] };

export default function Discover() {
  const { user } = useAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected, setSelected] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        api('/categories'),
        api(`/providers${selected !== 'all' ? `?category=${selected}` : ''}${q ? `${selected !== 'all' ? '&' : '?'}search=${encodeURIComponent(q)}` : ''}`),
      ]);
      setCats(c);
      setProviders(p);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selected, q]);

  useEffect(() => { load(); }, [load]);

  const hero = useMemo(() => cats.find((c) => c.category_id === 'home_repairs')?.image, [cats]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.color.brand} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hi}>Hi, {user?.name?.split(' ')[0] || 'there'} 👋</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Ionicons name="location-outline" size={14} color={theme.color.muted} />
              <Text style={styles.loc}>Your neighborhood</Text>
            </View>
          </View>
          <Pressable testID="profile-shortcut" onPress={() => router.push('/(tabs)/profile')} style={styles.avatar}>
            <Ionicons name="person" size={20} color={theme.color.brand} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={theme.color.muted} />
          <TextInput
            testID="home-search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search plumber, EV charging, tutor…"
            placeholderTextColor={theme.color.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        {hero && (
          <View style={styles.heroWrap}>
            <Image source={{ uri: hero }} style={styles.heroImg} contentFit="cover" />
            <LinearGradient colors={['transparent', 'rgba(28,25,23,0.85)']} style={styles.heroScrim} />
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroBadge}>FEATURED</Text>
              <Text style={styles.heroTitle}>Same-day home fixes</Text>
              <Text style={styles.heroSub}>Verified plumbers, electricians & handymen at your door in 60 min.</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {[ALL, ...cats].map((c) => {
            const active = selected === c.category_id;
            return (
              <Pressable
                key={c.category_id}
                testID={`chip-${c.category_id}`}
                onPress={() => setSelected(c.category_id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>Top-rated near you</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: theme.spacing.xl }} color={theme.color.brand} />
        ) : providers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="search-outline" size={40} color={theme.color.muted} />
            <Text style={styles.emptyText}>No providers match your search yet.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            {providers.map((p) => (
              <Pressable
                key={p.provider_id}
                testID={`provider-card-${p.provider_id}`}
                onPress={() => router.push(`/provider/${p.provider_id}`)}
                style={styles.card}
              >
                <Image source={{ uri: p.image }} style={styles.cardImg} contentFit="cover" />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{p.business_name}</Text>
                    {p.verified && <Ionicons name="checkmark-circle" size={14} color={theme.color.success} />}
                  </View>
                  <Text style={styles.cardBio} numberOfLines={2}>{p.bio}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="star" size={13} color={theme.color.warning} />
                      <Text style={styles.metaBold}>{p.rating.toFixed(1)}</Text>
                      <Text style={styles.meta}>({p.review_count})</Text>
                    </View>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.meta}>{p.distance_km} km</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaBold}>${p.hourly_rate}/hr</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md },
  hi: { fontSize: 22, fontWeight: '800', color: theme.color.onSurface },
  loc: { color: theme.color.muted, fontSize: 13, marginLeft: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: theme.color.onSurface, fontSize: 15 },
  heroWrap: { marginTop: theme.spacing.lg, marginHorizontal: theme.spacing.lg, borderRadius: 20, overflow: 'hidden', height: 180, backgroundColor: theme.color.surfaceTertiary },
  heroImg: { width: '100%', height: '100%' },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '75%' },
  heroTextWrap: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  heroBadge: { color: theme.color.brandSecondary, fontWeight: '800', fontSize: 11, letterSpacing: 1.5, marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: theme.color.onSurface, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  chipRow: { gap: 8, paddingHorizontal: theme.spacing.lg, paddingRight: theme.spacing.xl },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.color.onSurfaceTertiary },
  chipTextActive: { color: '#fff' },
  card: {
    flexDirection: 'row', gap: 12,
    backgroundColor: theme.color.surfaceSecondary, borderRadius: 16,
    padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.color.border,
  },
  cardImg: { width: 72, height: 72, borderRadius: 12, backgroundColor: theme.color.surfaceTertiary },
  cardName: { fontSize: 15, fontWeight: '700', color: theme.color.onSurface, flexShrink: 1 },
  cardBio: { color: theme.color.muted, fontSize: 12, lineHeight: 16 },
  meta: { color: theme.color.muted, fontSize: 12 },
  metaBold: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: '700' },
  metaDot: { color: theme.color.muted },
  emptyBox: { alignItems: 'center', marginTop: theme.spacing.xxl, gap: 8, paddingHorizontal: theme.spacing.xl },
  emptyText: { color: theme.color.muted, textAlign: 'center' },
});
