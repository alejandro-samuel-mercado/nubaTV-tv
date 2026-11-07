/**
 * HeroVideo.tsx — Universal (Web + Native TV) implementation
 * Automatically uses HTML5/Hls.js on Web, and react-native-video on Native TV.
 */
import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

interface Props {
  uri: string;
  onError?: () => void;
  onCanPlay?: () => void;
}

let NativeVideoComponent: any = null;
if (Platform.OS !== 'web') {
  try {
    const rnv = require('react-native-video');
    NativeVideoComponent = rnv.default || rnv;
  } catch (e) {
    NativeVideoComponent = null;
  }
}

function WebHeroVideo({ uri, onError, onCanPlay }: Props) {
  const videoRef = useRef<any>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !uri) return;

    let hls: any = null;
    let destroyed = false;

    const timeout = setTimeout(() => {
      if (!destroyed) onError?.();
    }, 8000);

    const load = async () => {
      if (video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = uri;
        video.oncanplay = () => {
          clearTimeout(timeout);
          if (!destroyed) onCanPlay?.();
        };
        video.onerror = () => {
          if (!destroyed) onError?.();
        };
        video.play().catch(() => {
          if (!destroyed) onError?.();
        });
        return;
      }

      try {
        const HlsModule = (await import('hls.js')).default || (await import('hls.js'));
        if (HlsModule && HlsModule.isSupported()) {
          hls = new HlsModule({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(uri);
          hls.attachMedia(video);

          hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
            clearTimeout(timeout);
            if (!destroyed) onCanPlay?.();
            video.play().catch(() => {
              if (!destroyed) onError?.();
            });
          });

          hls.on(HlsModule.Events.ERROR, (_: any, data: any) => {
            if (data?.fatal && !destroyed) {
              onError?.();
            }
          });
        } else {
          if (!destroyed) onError?.();
        }
      } catch {
        if (!destroyed) onError?.();
      }
    };

    load();

    return () => {
      destroyed = true;
      clearTimeout(timeout);
      hls?.destroy();
      if (video) {
        video.removeAttribute('src');
        video.load?.();
      }
    };
  }, [uri]);

  return (
    <video
      ref={videoRef}
      muted
      loop
      playsInline
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
}

export default function HeroVideo({ uri, onError, onCanPlay }: Props) {
  if (Platform.OS === 'web' || !NativeVideoComponent) {
    return <WebHeroVideo uri={uri} onError={onError} onCanPlay={onCanPlay} />;
  }

  const NativeVideo = NativeVideoComponent;
  return (
    <NativeVideo
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
