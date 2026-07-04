import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { theme } from '@/src/theme';

// Stripe redirects here after checkout success/cancel on web.
// On mobile the WebView intercepts navigation before we ever land here.
export default function PaymentReturn() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/(tabs)/bookings'), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surface, gap: 12 }}>
      <ActivityIndicator color={theme.color.brand} size="large" />
      <Text style={{ color: theme.color.muted }}>Finalizing your booking…</Text>
    </View>
  );
}
