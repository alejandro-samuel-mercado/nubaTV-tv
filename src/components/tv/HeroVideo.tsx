/**
 * HeroVideo.tsx — Universal (Web + Native TV) implementation
 * Automatically uses HTML5/Hls.js on Web, and react-native-video on Native TV.
 */
import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

interface Props {
  uri: string;
  muted?: boolean;
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

function WebHeroVideo({ uri, muted = false, onError, onCanPlay }: Props) {
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
        const tryPlay = () => {
          video.play().catch(() => {
            if (destroyed) return;
            // Si el navegador bloquea autoplay con sonido sin interacción previa, intentar muted
            if (!video.muted) {
              video.muted = true;
              video.play().catch(() => {
                if (!destroyed) onError?.();
              });
            } else {
              if (!destroyed) onError?.();
            }
          });
        };

        if (video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = uri;
          video.oncanplay = () => {
            clearTimeout(timeout);
            if (!destroyed) onCanPlay?.();
          };
          video.onerror = () => {
            if (!destroyed) onError?.();
          };
          tryPlay();
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
              tryPlay();
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
          video.pause?.();
          video.removeAttribute('src');
          video.load?.();
        }
      };
  }, [uri]);

  return (
    <video
      ref={videoRef}
      muted={muted}
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

export default function HeroVideo({ uri, muted = false, onError, onCanPlay }: Props) {
  if (Platform.OS === 'web' || !NativeVideoComponent) {
    return <WebHeroVideo uri={uri} muted={muted} onError={onError} onCanPlay={onCanPlay} />;
  }

  const NativeVideo = NativeVideoComponent;
  return (
    <NativeVideo
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      paused={false}
      muted={muted}
      repeat={true}
      controls={false}
      onReadyForDisplay={onCanPlay}
      onError={onError}
    />
  );
}
