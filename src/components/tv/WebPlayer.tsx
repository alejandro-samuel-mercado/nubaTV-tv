/**
 * WebPlayer.tsx — Native stub (TV / Android / iOS)
 * The real implementation lives in WebPlayer.web.tsx and is only bundled on web.
 * This file should never be called on native since player.tsx uses Platform.OS guards.
 */
import React from 'react';
import { View } from 'react-native';

export interface WebPlayerHandle {
  playAsync: () => Promise<void>;
  pauseAsync: () => Promise<void>;
  setPositionAsync: (millis: number) => Promise<void>;
}

interface Props {
  uri: string;
  fallbackUri?: string;
  controls?: boolean;
  paused?: boolean;
  muted?: boolean;
  volume?: number;
  resizeMode?: 'contain' | 'cover';
  onPlaybackStatusUpdate?: (status: {
    isLoaded: boolean;
    isPlaying?: boolean;
    positionMillis?: number;
    durationMillis?: number;
    isBuffering?: boolean;
  }) => void;
  onError?: (msg: string) => void;
}

const WebPlayer = React.forwardRef<WebPlayerHandle, Props>((_, ref) => {
  return <View />;
});

export default WebPlayer;
