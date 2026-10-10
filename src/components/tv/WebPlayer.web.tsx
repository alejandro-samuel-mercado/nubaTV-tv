/**
 * WebPlayer.tsx — Web-only full-screen HLS player
 * Used by player.tsx on web instead of expo-av Video
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  uri: string;
  onError?: (msg: string) => void;
}

export default function WebPlayer({ uri, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !uri) return;

    let hls: any = null;

    const load = async () => {
      // Safari: native HLS
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = uri;
        video.onerror = () => onError?.('Error al cargar la señal.');
        video.play().catch(e => {
          if (e.name !== 'AbortError') onError?.(String(e));
        });
        return;
      }

      // Chrome/Firefox: HLS.js
      try {
        const isVOD = uri.toLowerCase().includes('.mp4') || uri.toLowerCase().includes('.mkv') || uri.toLowerCase().includes('/series/') || uri.toLowerCase().includes('/movie/');
        
        if (isVOD) {
          video.src = uri;
          video.onerror = () => onError?.('Error al cargar la señal de red.');
          video.play().catch(err => {
            if (err.name !== 'AbortError') onError?.(String(err));
          });
          return;
        }

        const Hls = (await import('hls.js')).default;
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(uri);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => {
              if (e.name !== 'AbortError') onError?.(String(e));
            });
          });
          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (data.fatal) onError?.('Error al cargar la señal (HLS).');
          });
        } else {
          onError?.('Tu navegador no soporta este tipo de stream.');
        }
      } catch (e) {
        video.src = uri;
        video.onerror = () => onError?.('Error al cargar la señal de red.');
        video.play().catch(err => {
          if (err.name !== 'AbortError') onError?.(String(err));
        });
      }
    };

    load();

    return () => { 
      try {
        if (hls) {
          hls.stopLoad();
          hls.detachMedia();
          hls.destroy();
        }
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        }
      } catch (e) {
        // Ignore unmount errors
      }
    };
  }, [uri]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <video
        ref={videoRef}
        controls
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000',
        }}
      />
    </View>
  );
}
