import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/src/lib/auth';
import { theme } from '@/src/theme';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surface }}>
        <ActivityIndicator color={theme.color.brand} size="large" />
      </View>
    );
  }
  if (!user) return <Redirect href="/auth/login" />;
  return <Redirect href="/(tabs)" />;
}
