import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GlobalProvider, useGlobal } from '../contexts/GlobalContext';
import { View, ActivityIndicator, LogBox } from 'react-native';
import '../../global.css';

LogBox.ignoreLogs([
  'The fetching process for the media resource was aborted',
]);

function RootLayoutNav() {
  const { token, loading } = useGlobal();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      if (inAuthGroup) {
        router.replace('/(tv)');
      }
    }
  }, [token, loading, segments]);

  if (loading) {
    return (
      <View className="flex-1 bg-[#02050a] items-center justify-center">
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(tv)" />
      <Stack.Screen name="player" />
      <Stack.Screen name="detail" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GlobalProvider>
      <RootLayoutNav />
    </GlobalProvider>
  );
}
