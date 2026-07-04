import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/src/lib/auth';
import { theme } from '@/src/theme';

export default function Register() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async () => {
    setErr('');
    if (!email || !password || !name) { setErr('All fields required'); return; }
    if (password.length < 6) { setErr('Password must be 6+ chars'); return; }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace('/(tabs)');
    } catch (e: any) {
      setErr(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface }}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Book trusted local pros in minutes</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput testID="register-name-input" style={styles.input} value={name} onChangeText={setName}
              placeholder="Jane Doe" placeholderTextColor={theme.color.muted} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput testID="register-email-input" style={styles.input} value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor={theme.color.muted}
              autoCapitalize="none" keyboardType="email-address" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput testID="register-password-input" style={styles.input} value={password} onChangeText={setPassword}
              placeholder="At least 6 characters" placeholderTextColor={theme.color.muted} secureTextEntry />
          </View>

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Pressable testID="register-submit-button" style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create account</Text>}
          </Pressable>

          <Pressable testID="go-login-link" onPress={() => router.replace('/auth/login')} style={{ marginTop: theme.spacing.xl, alignSelf: 'center' }}>
            <Text style={styles.link}>
              Already have an account? <Text style={{ color: theme.color.brand, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.lg, height: 44, justifyContent: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { padding: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
  title: { fontSize: 28, fontWeight: '800', color: theme.color.onSurface, marginBottom: 6 },
  subtitle: { color: theme.color.muted, marginBottom: theme.spacing.xl, fontSize: 14 },
  field: { marginBottom: theme.spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: theme.color.onSurfaceTertiary, marginBottom: 6 },
  input: {
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: theme.color.onSurface,
  },
  err: { color: theme.color.error, marginBottom: theme.spacing.md, fontSize: 13 },
  primaryBtn: { backgroundColor: theme.color.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { color: theme.color.onSurfaceTertiary, fontSize: 14 },
});
