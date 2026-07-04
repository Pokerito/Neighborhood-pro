import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/src/lib/api';
import { theme } from '@/src/theme';

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [service, setService] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [hours, setHours] = useState('1');
  const [when, setWhen] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/providers/${id}`).then((data) => {
      setP(data);
      setService(data.services?.[0] || 'Service');
    }).catch(() => {});
  }, [id]);

  const total = p ? Math.round(p.hourly_rate * (parseFloat(hours) || 1) * 100) / 100 : 0;

  const timeSlots = () => {
    const slots: Date[] = [];
    const base = new Date();
    for (let d = 0; d < 3; d++) {
      for (const h of [9, 12, 15, 18]) {
        const t = new Date(base);
        t.setDate(t.getDate() + d);
        t.setHours(h, 0, 0, 0);
        if (t > new Date()) slots.push(t);
      }
    }
    return slots;
  };

  const submit = async () => {
    setErr('');
    if (!address) { setErr('Address is required'); return; }
    setSubmitting(true);
    try {
      const b = await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          provider_id: id, service, scheduled_at: when.toISOString(),
          address, notes, estimated_hours: parseFloat(hours) || 1,
        }),
      });
      router.replace(`/checkout/${b.booking_id}`);
    } catch (e: any) {
      setErr(e.message || 'Booking failed');
    } finally { setSubmitting(false); }
  };

  if (!p) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surface }}>
        <ActivityIndicator color={theme.color.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface }} edges={['top']}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.title}>Book service</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <View style={styles.providerRow}>
            <View>
              <Text style={styles.providerName}>{p.business_name}</Text>
              <Text style={styles.providerRate}>${p.hourly_rate}/hr</Text>
            </View>
          </View>

          <Text style={styles.label}>Service</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {(p.services || []).map((s: string) => (
              <Pressable key={s} testID={`svc-${s}`} onPress={() => setService(s)} style={[styles.chip, service === s && styles.chipActive]}>
                <Text style={[styles.chipText, service === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Estimated hours</Text>
          <TextInput testID="hours-input" style={styles.input} value={hours} onChangeText={setHours} keyboardType="numeric" placeholder="1" placeholderTextColor={theme.color.muted} />

          <Text style={styles.label}>When?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {timeSlots().map((t) => {
              const label = t.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
              const active = t.getTime() === when.getTime();
              return (
                <Pressable key={t.toISOString()} testID={`slot-${t.getTime()}`} onPress={() => setWhen(t)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Service address</Text>
          <TextInput testID="address-input" style={styles.input} value={address} onChangeText={setAddress} placeholder="123 Main St, Apt 4B" placeholderTextColor={theme.color.muted} />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput testID="notes-input" style={[styles.input, { height: 90 }]} value={notes} onChangeText={setNotes} multiline placeholder="Any details the pro should know…" placeholderTextColor={theme.color.muted} />

          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>Estimated total</Text>
            <Text style={styles.summaryValue}>${total.toFixed(2)}</Text>
          </View>
          {err ? <Text style={styles.err}>{err}</Text> : null}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.ctaWrap}>
          <Pressable testID="confirm-booking-button" style={styles.cta} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Confirm booking</Text>}
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 48 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: theme.color.onSurface },
  providerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.color.surfaceSecondary, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.color.border, marginBottom: 8 },
  providerName: { fontSize: 15, fontWeight: '800', color: theme.color.onSurface },
  providerRate: { fontSize: 13, color: theme.color.muted, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '700', color: theme.color.onSurfaceTertiary, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: theme.color.onSurface },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { fontSize: 13, color: theme.color.onSurfaceTertiary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.color.border },
  summaryLabel: { color: theme.color.muted, fontWeight: '600' },
  summaryValue: { fontSize: 22, fontWeight: '800', color: theme.color.onSurface },
  err: { color: theme.color.error, marginTop: 8, fontSize: 13 },
  ctaWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.color.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.color.border, paddingHorizontal: 16, paddingTop: 12 },
  cta: { backgroundColor: theme.color.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
