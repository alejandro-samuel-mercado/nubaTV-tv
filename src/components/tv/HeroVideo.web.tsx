/**
 * HeroVideo.web.tsx — Web player for the hero banner
 * Uses hls.js to avoid ORB (Opaque Response Blocking) errors on desktop browsers.
 */
import React, { useEffect, useRef } from 'react';

interface Props {
  uri: string;
  onError?: () => void;
  onCanPlay?: () => void;
}

export default function HeroVideo({ uri, onError, onCanPlay }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !uri) return;

    let hls: any = null;
    let destroyed = false;
    
    // Timeout: if no playback starts within 8 s, consider it an error
    const timeout = setTimeout(() => {
      if (!destroyed) onError?.();
    }, 8000);

    const load = async () => {
      // Safari: native HLS
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
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

      // Chrome/Firefox: HLS.js
      try {
        const Hls = (await import('hls.js')).default;
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(uri);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            clearTimeout(timeout);
            if (!destroyed) onCanPlay?.();
            video.play().catch(() => {
              if (!destroyed) onError?.();
            });
          });
          
          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (data.fatal && !destroyed) {
              onError?.();
            }
          });
        } else {
          if (!destroyed) onError?.();
        }
      } catch (e) {
        if (!destroyed) onError?.();
      }
    };

    load();

    return () => {
      destroyed = true;
      clearTimeout(timeout);
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
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
