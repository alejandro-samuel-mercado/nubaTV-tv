import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, BackHandler } from 'react-native';
// @ts-ignore
import { useTVEventHandler } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useGlobal, API_URL, Channel } from '../contexts/GlobalContext';
import { useRouter } from 'expo-router';

export default function PlayerScreen() {
  const { activeChannel, setActiveChannel, channels } = useGlobal();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  
  // Show OSD (On Screen Display) for a few seconds when changing channels
  const [showOSD, setShowOSD] = useState(true);
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentList = useMemo(() => {
    if (!activeChannel) return channels;
    return channels.filter(c => c.category?.name === activeChannel.category?.name);
  }, [activeChannel, channels]);

  const activeIndex = useMemo(() => {
    return currentList.findIndex(c => c.id === activeChannel?.id);
  }, [activeChannel, currentList]);

  const triggerOSD = () => {
    setShowOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      setShowOSD(false);
    }, 4000);
  };

  useEffect(() => {
    triggerOSD();
    return () => {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    };
  }, [activeChannel]);

  // Handle Smart TV Remote Control Zapping
  useTVEventHandler((evt:any) => {
    if (evt.eventType === 'up' || evt.eventType === 'right') {
      // Next channel
      if (activeIndex !== -1 && activeIndex < currentList.length - 1) {
        setActiveChannel(currentList[activeIndex + 1]);
      }
    } else if (evt.eventType === 'down' || evt.eventType === 'left') {
      // Prev channel
      if (activeIndex > 0) {
        setActiveChannel(currentList[activeIndex - 1]);
      }
    } else if (evt.eventType === 'select') {
      // Show info/OSD
      triggerOSD();
    }
  });

  // Handle hardware back button to return to menu
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  if (!activeChannel) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  const proxyUrl = `${API_URL}/proxy?url=${encodeURIComponent(activeChannel.url)}`;

  return (
    <View className="flex-1 bg-black">
      <Video
        ref={videoRef}
        className="flex-1 w-full h-full"
        source={{ uri: proxyUrl }}
        useNativeControls={false} // Hide native controls for pure TV experience
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        onPlaybackStatusUpdate={setStatus}
      />
      
      {/* Loading & Error Indicator */}
      {status && !status.isLoaded && 'error' in status ? (
        <View className="absolute inset-0 items-center justify-center bg-black/80 pointer-events-none">
          <Text className="text-red-400 font-bold text-2xl mb-2">Error al cargar la señal</Text>
          <Text className="text-white/50 text-lg text-center px-24">{status.error}</Text>
        </View>
      ) : (!status?.isLoaded || (status.isLoaded && status.isBuffering)) ? (
        <View className="absolute inset-0 items-center justify-center pointer-events-none">
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      ) : null}

      {/* OSD (On Screen Display) - Shows on channel change or "OK" press */}
      {showOSD && (
        <View className="absolute bottom-0 left-0 right-0 p-12 pointer-events-none">
          <View className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
          <View className="flex-row items-end justify-between relative z-10">
            <View>
              <View className="bg-cyan-500/20 self-start px-3 py-1 rounded-md mb-3 border border-cyan-500/30">
                <Text className="text-cyan-300 text-sm font-bold uppercase tracking-widest">{activeChannel.category?.name || 'General'}</Text>
              </View>
              <Text className="text-white text-5xl font-black mb-2 shadow-xl shadow-black">{activeChannel.name}</Text>
              <Text className="text-white/60 text-lg font-bold">{activeChannel.country} • {activeChannel.language}</Text>
            </View>
            <Text className="text-white/30 text-lg font-bold">
              {activeIndex + 1} / {currentList.length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
