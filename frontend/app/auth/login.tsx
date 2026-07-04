import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/src/lib/auth';
import { theme } from '@/src/theme';

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('demo@tasklocal.app');
  const [password, setPassword] = useState('Demo@12345');
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [err, setErr] = useState('');

  const onLogin = async () => {
    setErr('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setErr(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setErr('');
    setGLoading(true);
    try {
      await loginWithGoogle();
      router.replace('/(tabs)');
    } catch (e: any) {
      setErr(e.message || 'Google login failed');
    } finally {
      setGLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surface }}>
      <LinearGradient
        colors={[theme.color.brand, theme.color.brandSecondary]}
        style={styles.hero}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.heroContent}>
            <View style={styles.logoBadge}>
              <Ionicons name="location" size={26} color={theme.color.brand} />
            </View>
            <Text style={styles.heroTitle}>TaskLocal</Text>
            <Text style={styles.heroSub}>Trusted local pros, at your door.</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to book verified providers near you</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.color.muted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="login-password-input"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={theme.color.muted}
              secureTextEntry
            />
          </View>

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Pressable testID="login-submit-button" style={styles.primaryBtn} onPress={onLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign in</Text>}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable testID="login-google-button" style={styles.googleBtn} onPress={onGoogle} disabled={gLoading}>
            {gLoading ? (
              <ActivityIndicator color={theme.color.onSurface} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={theme.color.onSurface} />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <Pressable testID="go-register-link" onPress={() => router.push('/auth/register')} style={{ marginTop: theme.spacing.xl, alignSelf: 'center' }}>
            <Text style={styles.link}>
              New here? <Text style={{ color: theme.color.brand, fontWeight: '700' }}>Create account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: theme.spacing.xxl, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroContent: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg, alignItems: 'flex-start' },
  logoBadge: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md,
  },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 4 },
  body: { padding: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
  title: { fontSize: 26, fontWeight: '800', color: theme.color.onSurface, marginBottom: 6 },
  subtitle: { color: theme.color.muted, marginBottom: theme.spacing.xl, fontSize: 14 },
  field: { marginBottom: theme.spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: theme.color.onSurfaceTertiary, marginBottom: 6 },
  input: {
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: theme.color.onSurface,
  },
  err: { color: theme.color.error, marginBottom: theme.spacing.md, fontSize: 13 },
  primaryBtn: {
    backgroundColor: theme.color.brand, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: theme.spacing.sm,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: theme.spacing.xl, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.color.border },
  dividerText: { color: theme.color.muted, fontSize: 12, fontWeight: '600' },
  googleBtn: {
    flexDirection: 'row', gap: 8, backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.borderStrong, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  googleBtnText: { color: theme.color.onSurface, fontWeight: '700', fontSize: 15 },
  link: { color: theme.color.onSurfaceTertiary, fontSize: 14 },
});
