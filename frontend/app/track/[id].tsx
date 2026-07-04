import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/src/lib/api';
import { useBookingSocket, type BookingUpdate } from '@/src/lib/useBookingSocket';
import { theme } from '@/src/theme';

const STATUS_ORDER = ['requested', 'accepted', 'en_route', 'in_progress', 'completed'];
const STATUS_LABELS: Record<string, string> = {
  requested: 'Waiting on pro',
  accepted: 'Pro accepted',
  en_route: 'On the way',
  in_progress: 'Working on it',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const STATUS_COLORS: Record<string, string> = {
  requested: theme.color.warning,
  accepted: theme.color.info,
  en_route: theme.color.brand,
  in_progress: theme.color.brandSecondary,
  completed: theme.color.success,
  cancelled: theme.color.muted,
};

export default function Track() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [b, setB] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewErr, setReviewErr] = useState('');
  const [reviewed, setReviewed] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api(`/bookings/${id}`);
      setB(data);
      if (data.review_id) setReviewed(true);
    } catch (e) {
      console.warn(e);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onWs = useCallback((u: BookingUpdate) => {
    setB((prev: any) => prev ? { ...prev, status: u.status, eta_minutes: u.eta_minutes } : prev);
    if (u.status === 'completed') {
      // auto-prompt review after a beat
      setTimeout(() => setShowReview(true), 600);
    }
  }, []);

  const { connected } = useBookingSocket(id, onWs);

  const submitReview = async () => {
    setReviewErr('');
    setSubmitting(true);
    try {
      await api(`/bookings/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      });
      setReviewed(true);
      setShowReview(false);
    } catch (e: any) {
      setReviewErr(e.message || 'Could not submit review');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.color.brand} />
      </SafeAreaView>
    );
  }
  if (!b) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.color.muted }}>Booking not found.</Text>
      </SafeAreaView>
    );
  }

  const status = b.status || 'requested';
  const stepIdx = Math.max(0, STATUS_ORDER.indexOf(status));
  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed';
  const statusColor = STATUS_COLORS[status] || theme.color.muted;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface }} edges={['top']}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Live tracking</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.dot, { backgroundColor: connected ? theme.color.success : theme.color.warning }]} />
            <Text style={styles.headerSub}>{connected ? 'Live' : 'Reconnecting…'}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}>
        <View style={[styles.statusHero, { borderColor: statusColor }]}>
          {b.provider?.image && (
            <Image source={{ uri: b.provider.image }} style={styles.providerImg} contentFit="cover" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName}>{b.provider?.business_name || b.provider_name}</Text>
            <Text style={styles.svcText}>{b.service}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
              <Text style={styles.statusPillText}>{STATUS_LABELS[status] || status}</Text>
            </View>
          </View>
        </View>

        {!isCancelled && b.eta_minutes != null && (
          <View style={styles.etaCard}>
            <Ionicons name="time" size={22} color={theme.color.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.etaLabel}>{status === 'in_progress' ? 'Estimated completion' : 'Estimated arrival'}</Text>
              <Text style={styles.etaValue}>~{b.eta_minutes} min</Text>
            </View>
          </View>
        )}

        {!isCancelled && (
          <View style={styles.timeline}>
            {STATUS_ORDER.map((s, i) => {
              const done = i <= stepIdx;
              const current = i === stepIdx && !isCompleted;
              return (
                <View key={s} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, done && { backgroundColor: theme.color.brand, borderColor: theme.color.brand }, current && styles.timelineDotCurrent]}>
                      {done && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    {i < STATUS_ORDER.length - 1 && <View style={[styles.timelineLine, done && i < stepIdx && { backgroundColor: theme.color.brand }]} />}
                  </View>
                  <View style={{ paddingBottom: 20, flex: 1 }}>
                    <Text style={[styles.stepLabel, done && { color: theme.color.onSurface, fontWeight: '700' }]}>{STATUS_LABELS[s]}</Text>
                    {current && <Text style={styles.stepSub}>Current step</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Booking details</Text>
          <DetailRow icon="location" label="Address" value={b.address} />
          <DetailRow icon="calendar" label="Scheduled" value={new Date(b.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} />
          <DetailRow icon="cash" label="Total" value={`$${b.total_amount.toFixed(2)}`} />
          {b.notes ? <DetailRow icon="document-text" label="Notes" value={b.notes} /> : null}
        </View>

        {isCompleted && !reviewed && (
          <Pressable testID="rate-provider-button" style={styles.rateBtn} onPress={() => setShowReview(true)}>
            <Ionicons name="star" size={18} color="#fff" />
            <Text style={styles.rateBtnText}>Rate your experience</Text>
          </Pressable>
        )}
        {reviewed && (
          <View style={styles.reviewedRow}>
            <Ionicons name="checkmark-circle" size={18} color={theme.color.success} />
            <Text style={{ color: theme.color.success, fontWeight: '700' }}>Thanks for your review!</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showReview} transparent animationType="slide" onRequestClose={() => setShowReview(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowReview(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Rate {b.provider?.business_name || 'your pro'}</Text>
            <Text style={styles.sheetSub}>Your feedback helps other neighbors find great pros.</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} testID={`star-${n}`} onPress={() => setRating(n)} hitSlop={6}>
                  <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={38} color={theme.color.warning} />
                </Pressable>
              ))}
            </View>
            <TextInput
              testID="review-comment-input"
              style={styles.commentInput}
              placeholder="Optional: tell us what went well…"
              placeholderTextColor={theme.color.muted}
              value={comment}
              onChangeText={setComment}
              multiline
            />
            {reviewErr ? <Text style={{ color: theme.color.error, marginBottom: 8 }}>{reviewErr}</Text> : null}
            <Pressable testID="submit-review-button" style={styles.submitBtn} onPress={submitReview} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit review</Text>}
            </Pressable>
            <Pressable style={{ alignSelf: 'center', marginTop: 8, padding: 8 }} onPress={() => setShowReview(false)}>
              <Text style={{ color: theme.color.muted }}>Maybe later</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={theme.color.muted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 52 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: theme.color.onSurface },
  headerSub: { fontSize: 11, color: theme.color.muted },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusHero: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: theme.color.surfaceSecondary, borderWidth: 2, borderRadius: 18, padding: 14 },
  providerImg: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.color.surfaceTertiary },
  providerName: { fontSize: 16, fontWeight: '800', color: theme.color.onSurface },
  svcText: { fontSize: 13, color: theme.color.muted, marginTop: 2 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  statusPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  etaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.color.brandTertiary, borderRadius: 14, padding: 14, marginTop: 12 },
  etaLabel: { fontSize: 12, color: theme.color.onBrandTertiary, fontWeight: '600' },
  etaValue: { fontSize: 22, fontWeight: '800', color: theme.color.brand, marginTop: 2 },
  timeline: { marginTop: theme.spacing.xl, paddingLeft: 4 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 24 },
  timelineDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.color.borderStrong, backgroundColor: theme.color.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  timelineDotCurrent: { borderColor: theme.color.brand, backgroundColor: theme.color.brandTertiary },
  timelineLine: { width: 2, flex: 1, backgroundColor: theme.color.borderStrong, marginVertical: 2 },
  stepLabel: { fontSize: 14, color: theme.color.muted, fontWeight: '500' },
  stepSub: { fontSize: 11, color: theme.color.brand, marginTop: 2, fontWeight: '700' },
  detailCard: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.color.border, marginTop: theme.spacing.lg },
  detailTitle: { fontSize: 15, fontWeight: '800', color: theme.color.onSurface, marginBottom: 10 },
  detailRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6 },
  detailLabel: { fontSize: 11, color: theme.color.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: theme.color.onSurface, marginTop: 2 },
  rateBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.brand, borderRadius: 14, paddingVertical: 14, marginTop: theme.spacing.lg },
  rateBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  reviewedRow: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.lg, padding: 14, backgroundColor: '#D1FAE5', borderRadius: 12 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.color.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.color.borderStrong, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: theme.color.onSurface, textAlign: 'center' },
  sheetSub: { fontSize: 13, color: theme.color.muted, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 16 },
  commentInput: { backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, borderRadius: 12, padding: 12, minHeight: 80, textAlignVertical: 'top', color: theme.color.onSurface, fontSize: 14, marginBottom: 12 },
  submitBtn: { backgroundColor: theme.color.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
