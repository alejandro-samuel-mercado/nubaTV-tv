import React from 'react';
import { Redirect } from 'expo-router';
import { useGlobal } from '../contexts/GlobalContext';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { token, loading } = useGlobal();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#02050a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return <Redirect href={token ? "/(tv)" : "/(auth)/login"} />;
}
