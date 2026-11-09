/**
 * WebPlayer.web.tsx — Web-only full-screen HLS/VOD player
 * Used by player.tsx and VodPlayer.tsx on web.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';

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

// Helper to reliably load or retrieve the Hls class on web
async function getHlsClass(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).Hls) {
    return (window as any).Hls;
  }
  try {
    const mod = await import('hls.js');
    const Hls = mod.default || mod;
    if (Hls && typeof Hls.isSupported === 'function') {
      return Hls;
    }
  } catch (e) {
    console.warn('[WebPlayer] Dynamic import of hls.js failed, falling back to CDN script', e);
  }
  if (typeof document !== 'undefined') {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="hls.js"]');
      if (existing) {
        if ((window as any).Hls) return resolve((window as any).Hls);
        existing.addEventListener('load', () => resolve((window as any).Hls));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.onload = () => resolve((window as any).Hls);
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }
  return null;
}

const WebPlayer = forwardRef<WebPlayerHandle, Props>(function WebPlayer(
  {
    uri,
    fallbackUri,
    controls = false,
    paused,
    muted,
    volume,
    resizeMode = "contain",
    onPlaybackStatusUpdate,
    onError,
  },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentUri, setCurrentUri] = useState(uri);
  const hasFallbackRetried = useRef(false);

  useEffect(() => {
    setCurrentUri(uri);
    hasFallbackRetried.current = false;
  }, [uri]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) {
      video.pause();
    } else if (video.paused && video.readyState >= 2) {
      video.play().catch(() => {});
    }
  }, [paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = Boolean(muted);
    if (typeof volume === "number") {
      video.volume = Math.max(0, Math.min(1, volume));
    }
  }, [muted, volume]);

  useImperativeHandle(ref, () => ({
    playAsync: async () => {
      if (videoRef.current) await videoRef.current.play();
    },
    pauseAsync: async () => {
      if (videoRef.current) videoRef.current.pause();
    },
    setPositionAsync: async (millis: number) => {
      if (videoRef.current) videoRef.current.currentTime = millis / 1000;
    },
  }));

  const notify = useCallback(() => {
    const video = videoRef.current;
    if (!onPlaybackStatusUpdate || !video) return;
    onPlaybackStatusUpdate({
      isLoaded: video.readyState >= 1,
      isPlaying: !video.paused && !video.ended,
      positionMillis: (video.currentTime || 0) * 1000,
      durationMillis: (video.duration && !isNaN(video.duration) ? video.duration : 0) * 1000,
      isBuffering: video.readyState < 3 && !video.paused,
    });
  }, [onPlaybackStatusUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentUri) return;

    let hls: any = null;
    let isCancelled = false;

    video.addEventListener('timeupdate', notify);
    video.addEventListener('play', notify);
    video.addEventListener('pause', notify);
    video.addEventListener('loadedmetadata', notify);
    video.addEventListener('waiting', notify);
    video.addEventListener('playing', notify);

    const attemptPlay = () => {
      if (isCancelled || !video) return;
      video.play().catch((err) => {
        if (err.name === 'AbortError') return;
        if (err.name === 'NotAllowedError') {
          // Autoplay policy prevented unmuted playback; retry muted
          video.muted = true;
          video.play().catch(() => {});
        } else {
          console.warn('[WebPlayer] video.play() error:', err);
        }
      });
    };

    const triggerFallbackOrError = (errMessage: string) => {
      if (fallbackUri && currentUri !== fallbackUri && !hasFallbackRetried.current) {
        hasFallbackRetried.current = true;
        console.log('[WebPlayer] Retrying stream with direct fallbackUri...');
        setCurrentUri(fallbackUri);
      } else {
        onError?.(errMessage);
      }
    };

    const load = async () => {
      const target = currentUri;
      const cleanUrl = target.split('?')[0].toLowerCase();
      const isDirectFile =
        cleanUrl.endsWith('.mp4') ||
        cleanUrl.endsWith('.mkv') ||
        cleanUrl.endsWith('.webm') ||
        cleanUrl.endsWith('.avi');

      // 1. Direct Video files (mp4, mkv, webm)
      if (isDirectFile) {
        video.src = target;
        video.onloadedmetadata = () => {
          attemptPlay();
          notify();
        };
        video.onerror = () => {
          triggerFallbackOrError('Error al reproducir el archivo de video.');
        };
        attemptPlay();
        return;
      }

      // 2. Safari: native HLS
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = target;
        video.onloadedmetadata = () => attemptPlay();
        video.onerror = () => {
          triggerFallbackOrError('Error al cargar la señal (Safari HLS).');
        };
        attemptPlay();
        return;
      }

      // 3. Chrome / Firefox / Edge: HLS.js
      try {
        const Hls = await getHlsClass();
        if (isCancelled) return;

        if (Hls && typeof Hls.isSupported === 'function' && Hls.isSupported()) {
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 30,
            backBufferLength: 15,
          });

          hls.loadSource(target);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            attemptPlay();
          });

          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            console.warn('[WebPlayer] HLS event error:', data?.type, data?.details, data?.fatal);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  if (fallbackUri && currentUri !== fallbackUri && !hasFallbackRetried.current) {
                    hls.destroy();
                    triggerFallbackOrError('Error de red al cargar el stream.');
                  } else {
                    hls.startLoad();
                  }
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  triggerFallbackOrError('Error al cargar la señal (HLS).');
                  break;
              }
            }
          });
        } else {
          // Fallback if Hls is not supported
          video.src = target;
          video.onerror = () => triggerFallbackOrError('Tu navegador o dispositivo no soporta este stream.');
          attemptPlay();
        }
      } catch (e: any) {
        console.warn('[WebPlayer] Exception during HLS load:', e);
        triggerFallbackOrError('Error al inicializar el reproductor HLS.');
      }
    };

    load();

    return () => {
      isCancelled = true;
      video.removeEventListener('timeupdate', notify);
      video.removeEventListener('play', notify);
      video.removeEventListener('pause', notify);
      video.removeEventListener('loadedmetadata', notify);
      video.removeEventListener('waiting', notify);
      video.removeEventListener('playing', notify);

      try {
        if (hls) {
          hls.stopLoad();
          hls.detachMedia();
          hls.destroy();
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // Ignore unmount cleanup errors
      }
    };
  }, [currentUri, fallbackUri, notify, onError]);

  return (
    <View style={s.fullscreen}>
      <video
        ref={videoRef}
        controls={controls}
        playsInline
        autoPlay
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: resizeMode || 'contain',
          backgroundColor: '#000',
        }}
      />
    </View>
  );
});

const s = StyleSheet.create({
  fullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    ...(Platform.OS === 'web'
      ? {
          width: '100vw' as any,
          height: '100vh' as any,
        }
      : {}),
  },
});

export default WebPlayer;
