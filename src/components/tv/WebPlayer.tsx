/**
 * WebPlayer.tsx — Native stub (TV / Android / iOS)
 * The real implementation lives in WebPlayer.web.tsx and is only bundled on web.
 * This file should never be called on native since player.tsx uses Platform.OS guards.
 */
import React from 'react';
import { View } from 'react-native';

export default function WebPlayer(_: { uri: string; onError?: (msg: string) => void }) {
  return <View />;
}
