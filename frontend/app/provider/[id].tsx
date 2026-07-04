import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/src/lib/api';
import { theme } from '@/src/theme';

export default function ProviderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setP(await api(`/providers/${id}`)); }
      catch (e) { console.warn(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.color.brand} />
      </SafeAreaView>
    );
  }

  if (!p) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.color.muted }}>Provider unavailable</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: p.image }} style={styles.heroImg} contentFit="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(28,25,23,0.85)']} style={StyleSheet.absoluteFillObject} />
          <SafeAreaView edges={['top']} style={styles.heroTopBar}>
            <Pressable testID="back-button" style={styles.iconBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <Pressable style={styles.iconBtn}>
              <Ionicons name="heart-outline" size={20} color="#fff" />
            </Pressable>
          </SafeAreaView>
          <View style={styles.heroBottom}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.heroName}>{p.business_name}</Text>
              {p.verified && <Ionicons name="checkmark-circle" size={18} color={theme.color.brandSecondary} />}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <View style={styles.heroPill}>
                <Ionicons name="star" size={12} color={theme.color.warning} />
                <Text style={styles.heroPillText}>{p.rating.toFixed(1)} ({p.review_count})</Text>
              </View>
              <View style={styles.heroPill}>
                <Ionicons name="location" size={12} color="#fff" />
                <Text style={styles.heroPillText}>{p.distance_km} km · {p.city}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bio}>{p.bio}</Text>

          <Text style={styles.sectionTitle}>Services offered</Text>
          <View style={styles.servicesRow}>
            {(p.services || []).map((s: string) => (
              <View key={s} style={styles.serviceTag}><Text style={styles.serviceTagText}>{s}</Text></View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Pricing</Text>
          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceLabel}>Hourly rate</Text>
              <Text style={styles.priceValue}>${p.hourly_rate}<Text style={styles.priceUnit}>/hr</Text></Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.priceLabel}>Response time</Text>
              <Text style={styles.responseTime}>~30 min</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Reviews</Text>
          <View style={styles.reviewCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: theme.color.onSurface }}>Sarah M.</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((i) => <Ionicons key={i} name="star" size={12} color={theme.color.warning} />)}
              </View>
            </View>
            <Text style={styles.reviewText}>Arrived on time, fixed the issue quickly, super professional. Highly recommend.</Text>
          </View>
          <View style={styles.reviewCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: theme.color.onSurface }}>Marcus L.</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((i) => <Ionicons key={i} name="star" size={12} color={theme.color.warning} />)}
              </View>
            </View>
            <Text style={styles.reviewText}>Great communication, fair price. Will book again.</Text>
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.ctaWrap}>
        <Pressable testID="book-service-button" style={styles.cta} onPress={() => router.push(`/book/${p.provider_id}`)}>
          <Text style={styles.ctaText}>Book service · from ${p.hourly_rate}/hr</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { height: 320, backgroundColor: theme.color.surfaceTertiary },
  heroImg: { width: '100%', height: '100%' },
  heroTopBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroBottom: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  heroName: { color: '#fff', fontSize: 24, fontWeight: '800' },
  heroPill: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  body: { padding: theme.spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.color.onSurface, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  bio: { fontSize: 14, color: theme.color.onSurfaceTertiary, lineHeight: 20 },
  servicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceTag: { backgroundColor: theme.color.brandTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  serviceTagText: { color: theme.color.onBrandTertiary, fontSize: 12, fontWeight: '600' },
  priceCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: theme.color.surfaceSecondary, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.color.border },
  priceLabel: { fontSize: 12, color: theme.color.muted, fontWeight: '600' },
  priceValue: { fontSize: 26, fontWeight: '800', color: theme.color.onSurface },
  priceUnit: { fontSize: 14, color: theme.color.muted, fontWeight: '500' },
  responseTime: { fontSize: 18, fontWeight: '800', color: theme.color.success, marginTop: 2 },
  reviewCard: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.color.border, marginBottom: 8 },
  reviewText: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  ctaWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.color.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.color.border, paddingHorizontal: 16, paddingTop: 12 },
  cta: { backgroundColor: theme.color.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
