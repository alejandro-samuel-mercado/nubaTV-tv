/**
 * HeroVideo.tsx — Native (TV / Android / iOS) implementation
 * Reports errors via onError so the parent can cycle to the next channel.
 */
import React, { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

interface Props {
  uri: string;
  onError?: () => void;
  onCanPlay?: () => void;
}

export default function HeroVideo({ uri, onError, onCanPlay }: Props) {
  const ref = useRef<Video>(null);

  const handleStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ('error' in status) onError?.();
      return;
    }
    if (status.isPlaying) onCanPlay?.();
  };

  return (
    <Video
      ref={ref}
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      resizeMode={ResizeMode.COVER}
      shouldPlay={true}
      isMuted={true}
      isLooping={true}
      useNativeControls={false}
      onPlaybackStatusUpdate={handleStatus}
      onError={onError}
    />
  );
}
