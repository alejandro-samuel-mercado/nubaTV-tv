/**
 * HeroVideo.tsx — Native (TV / Android / iOS) implementation
 * Reports errors via onError so the parent can cycle to the next channel.
 */
import React, { useRef } from 'react';
import { StyleSheet } from 'react-native';
import Video, { VideoRef } from 'react-native-video';

interface Props {
  uri: string;
  onError?: () => void;
  onCanPlay?: () => void;
}

export default function HeroVideo({ uri, onError, onCanPlay }: Props) {
  const ref = useRef<VideoRef>(null);

  return (
    <Video
      ref={ref}
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      paused={false}
      muted={true}
      repeat={true}
      controls={false}
      onReadyForDisplay={onCanPlay}
      onError={onError}
    />
  );
}
