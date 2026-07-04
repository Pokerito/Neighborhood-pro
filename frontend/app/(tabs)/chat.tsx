import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { theme } from '@/src/theme';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'My kitchen faucet is leaking',
  'Need to charge my EV, low battery',
  'Help me move a sofa this weekend',
  'Looking for a math tutor',
  'Book a deep house clean',
];

function newSessionId() {
  return `chat_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export default function Chat() {
  const [session] = useState(newSessionId());
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi! I\'m your TaskLocal concierge. Describe what you need and I\'ll recommend the right service.' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setSending(true);
    try {
      const res = await api('/chat', { method: 'POST', body: JSON.stringify({ session_id: session, message: text }) });
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry, I hit an error: ${e.message || 'unknown'}` }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, session]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [messages, sending]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Concierge</Text>
        <Text style={styles.subtitle}>Describe your need, get instant recommendations</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.chat} keyboardShouldPersistTaps="handled">
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={m.role === 'user' ? styles.userText : styles.aiText}>{m.content}</Text>
            </View>
          ))}
          {sending && (
            <View style={[styles.bubble, styles.aiBubble, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
              <ActivityIndicator size="small" color={theme.color.brand} />
              <Text style={styles.aiText}>Thinking…</Text>
            </View>
          )}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestRow}>
          {SUGGESTIONS.map((s) => (
            <Pressable key={s} testID={`suggest-${s.slice(0, 8)}`} style={styles.suggest} onPress={() => send(s)}>
              <Text style={styles.suggestText}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message the concierge…"
            placeholderTextColor={theme.color.muted}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            multiline
          />
          <Pressable testID="chat-send-button" style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]} onPress={() => send()} disabled={!input.trim() || sending}>
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  title: { fontSize: 26, fontWeight: '800', color: theme.color.onSurface },
  subtitle: { fontSize: 13, color: theme.color.muted, marginTop: 4 },
  chat: { padding: theme.spacing.lg, gap: 10, paddingBottom: theme.spacing.md },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 16 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: theme.color.brand, borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: theme.color.surfaceTertiary, borderBottomLeftRadius: 4 },
  userText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  aiText: { color: theme.color.onSurface, fontSize: 14, lineHeight: 20 },
  suggestRow: { gap: 8, paddingHorizontal: theme.spacing.lg, paddingBottom: 10 },
  suggest: { flexShrink: 0, height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  suggestText: { color: theme.color.onBrandTertiary, fontSize: 12, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: theme.spacing.lg, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: theme.color.surfaceTertiary, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: theme.color.onSurface,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.color.brand, alignItems: 'center', justifyContent: 'center' },
});
