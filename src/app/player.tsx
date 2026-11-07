import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, ActivityIndicator, BackHandler, Platform, StyleSheet, Pressable, ScrollView, FlatList, Image, TextInput, KeyboardAvoidingView } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import { useGlobal, API_URL, Channel } from '../contexts/GlobalContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import VodPlayer from '../components/tv/VodPlayer';
import { LinearGradient } from 'expo-linear-gradient';
import { scale } from '../lib/scale';
import { C } from '../lib/tvColors';
import { SkipBack, SkipForward, Clock, List, Minimize, X, Tv } from 'lucide-react-native';

const useTVEventHandlerSafe: (handler: (evt: any) => void) => void =
  Platform.OS !== 'web'
    ? (require('react-native') as any).useTVEventHandler ?? (() => {})
    : () => {};

import WebPlayer from '../components/tv/WebPlayer';

// ── OSD Button Component ──
function OSDButton({ icon: Icon, label, onPress, onFocus, onBlur }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      focusable
      onPress={onPress}
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => { setFocused(false); onBlur?.(); }}
      style={[s.osdBtn, focused && s.osdBtnFocused]}
    >
      <Icon size={scale(20)} color={focused ? '#000' : '#fff'} />
      {focused && <Text style={s.osdBtnLabel}>{label}</Text>}
    </Pressable>
  );
}

export default function PlayerScreen() {
  const { slug, episodeId, channelId, channelUrl } = useLocalSearchParams<{
    slug?: string;
    episodeId?: string;
    channelId?: string;
    channelUrl?: string;
  }>();

  if (slug) {
    return <VodPlayer slug={String(slug)} episodeId={episodeId ? String(episodeId) : undefined} />;
  }

  return (
    <ChannelPlayer
      initialChannelId={channelId ? String(channelId) : undefined}
      initialChannelUrl={channelUrl ? String(channelUrl) : undefined}
    />
  );
}

function ChannelPlayer({
  initialChannelId,
  initialChannelUrl,
}: {
  initialChannelId?: string;
  initialChannelUrl?: string;
}) {
  const { activeChannel, setActiveChannel, channels } = useGlobal();
  const router = useRouter();
  const videoRef = useRef<VideoRef | null>(null);

  useEffect(() => {
    if (initialChannelId || initialChannelUrl) {
      if (!activeChannel || (initialChannelId && activeChannel.id !== initialChannelId)) {
        const found = channels.find((c) => c.id === initialChannelId);
        if (found) {
          setActiveChannel(found);
        } else if (initialChannelUrl) {
          setActiveChannel({
            id: initialChannelId || 'temp-ch',
            name: 'Canal en vivo',
            url: initialChannelUrl,
          } as Channel);
        }
      }
    }
  }, [initialChannelId, initialChannelUrl, channels]);

  const [isNativeBuffering, setIsNativeBuffering] = useState(true);
  const [isNativeError, setIsNativeError] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [showOSD, setShowOSD] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  
  // For forcing a reload when "Sincronizar directo" is pressed
  const [reloadKey, setReloadKey] = useState(0);

  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentList = useMemo(() => {
    if (!activeChannel) return channels;
    return channels.filter(c => c.category?.name === activeChannel.category?.name);
  }, [activeChannel, channels]);

  const activeIndex = useMemo(
    () => currentList.findIndex(c => c.id === activeChannel?.id),
    [activeChannel, currentList],
  );

  const filteredChannels = useMemo(() => {
    if (!searchQuery) return channels;
    const q = searchQuery.toLowerCase();
    return channels.filter(c => c.name.toLowerCase().includes(q) || c.category?.name?.toLowerCase().includes(q));
  }, [channels, searchQuery]);

  const triggerOSD = useCallback(() => {
    setShowOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    // Auto hide after 5s only if panel is closed
    if (!showPanel) {
      osdTimerRef.current = setTimeout(() => setShowOSD(false), 5000);
    }
  }, [showPanel]);

  useEffect(() => {
    setWebError(null);
    triggerOSD();
    return () => { if (osdTimerRef.current) clearTimeout(osdTimerRef.current); };
  }, [activeChannel, triggerOSD]);

  // Keep OSD visible while panel is open
  useEffect(() => {
    if (showPanel) {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
      setShowOSD(true);
    } else {
      triggerOSD();
    }
  }, [showPanel, triggerOSD]);

  const nextChannel = useCallback(() => {
    if (currentList.length === 0) return;
    const nextIdx = (activeIndex + 1) % currentList.length;
    setActiveChannel(currentList[nextIdx]);
  }, [activeIndex, currentList, setActiveChannel]);

  const prevChannel = useCallback(() => {
    if (currentList.length === 0) return;
    const prevIdx = (activeIndex - 1 + currentList.length) % currentList.length;
    setActiveChannel(currentList[prevIdx]);
  }, [activeIndex, currentList, setActiveChannel]);

  const syncLive = () => {
    // Faking jump to live by reloading the stream
    setReloadKey(prev => prev + 1);
  };

  const lastZapRef = useRef(0);

  // TV remote zapping (only active if panel is closed so it doesn't interfere)
  useTVEventHandlerSafe((evt: any) => {
    if (showPanel) return;
    if (showOSD) {
      if (evt.eventType === 'select') triggerOSD();
      return;
    }
    
    const now = Date.now();
    if (evt.eventType === 'up') {
      if (now - lastZapRef.current > 250) {
        lastZapRef.current = now;
        nextChannel();
      }
    } else if (evt.eventType === 'down') {
      if (now - lastZapRef.current > 250) {
        lastZapRef.current = now;
        prevChannel();
      }
    } else if (evt.eventType === 'right') {
      setShowPanel(true);
    } else if (evt.eventType === 'select') {
      triggerOSD();
    }
  });

  // Hardware back button
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const backAction = () => {
      if (showPanel) {
        setShowPanel(false);
        return true;
      }
      if (showOSD) {
        setShowOSD(false);
        return true;
      }
      router.back();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showPanel, showOSD]);

  if (!activeChannel) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const proxyUrl = Platform.OS === 'web' 
    ? `${API_URL}/proxy?url=${encodeURIComponent(activeChannel.url)}` 
    : activeChannel.url;
  const isError = Platform.OS === 'web' ? Boolean(webError) : isNativeError;
  const isBuffering = Platform.OS === 'web' ? false : isNativeBuffering;

  return (
    <View style={s.root}>

      {/* ── Video ── */}
      {Platform.OS === 'web' ? (
        <WebPlayer
          key={reloadKey}
          uri={proxyUrl}
          fallbackUri={activeChannel.url}
          onError={(msg: string) => setWebError(msg)}
        />
      ) : (
        <Video
          key={reloadKey}
          ref={videoRef}
          style={s.videoAbsolute}
          source={{ uri: proxyUrl }}
          controls={false}
          resizeMode="contain"
          paused={false}
          onLoad={() => {
            setIsNativeBuffering(false);
            setIsNativeError(false);
          }}
          onBuffer={({ isBuffering: b }: { isBuffering: boolean }) => {
            setIsNativeBuffering(b);
          }}
          onError={(err: any) => {
            console.warn('[ChannelPlayer] Playback error:', err);
            setIsNativeError(true);
            setIsNativeBuffering(false);
          }}
        />
      )}

      {/* ── Native loading / error states ── */}
      {Platform.OS !== 'web' && !isError && isBuffering && (
        <View style={s.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      )}
      {Platform.OS !== 'web' && isError && (
        <View style={[s.overlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]} pointerEvents="none">
          <Text style={s.errorTitle}>Error al cargar la señal</Text>
        </View>
      )}

      {/* ── Web error ── */}
      {Platform.OS === 'web' && webError && (
        <View style={[s.overlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]} pointerEvents="none">
          <Text style={s.errorTitle}>Error al cargar la señal</Text>
          <Text style={s.errorSub}>{webError}</Text>
        </View>
      )}

      {/* ── INTERACTIVE OSD ── */}
      {showOSD && (
        <View style={s.osd} pointerEvents="box-none">
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.95)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={s.osdContent} pointerEvents="box-none">
            
            {/* Metadata (Left) */}
            <View style={s.osdLeft} pointerEvents="none">
              {activeChannel.category?.name ? (
                <View style={s.osdCatBadge}>
                  <Text style={s.osdCatText}>
                    {activeChannel.category.name.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              <Text style={s.osdChannelName} numberOfLines={1}>{activeChannel.name}</Text>
              <Text style={s.osdMeta}>
                {activeChannel.country || 'Internacional'}
                {activeChannel.language ? ` • ${activeChannel.language}` : ''}
              </Text>
            </View>

            {/* Controls (Right) */}
            <View style={s.osdControls} pointerEvents="box-none">
              <OSDButton icon={SkipBack} label="Anterior" onPress={prevChannel} onFocus={triggerOSD} />
              <OSDButton icon={Clock} label="Sincronizar Vivo" onPress={syncLive} onFocus={triggerOSD} />
              <OSDButton icon={SkipForward} label="Siguiente" onPress={nextChannel} onFocus={triggerOSD} />
              <OSDButton icon={List} label="Canales" onPress={() => setShowPanel(!showPanel)} onFocus={triggerOSD} />
              <OSDButton icon={Minimize} label="Salir" onPress={() => router.back()} onFocus={triggerOSD} />
            </View>

          </View>
        </View>
      )}

      {/* ── SIDE PANEL (Half Screen Channels) ── */}
      {showPanel && (
        <KeyboardAvoidingView 
          style={s.panelContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <LinearGradient
            colors={['rgba(9,9,11,0.95)', 'rgba(9,9,11,1)']}
            start={{x: 0, y:0}}
            end={{x: 1, y:0}}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>CANALES</Text>
            <Pressable focusable onPress={() => setShowPanel(false)} style={({focused}: any) => [s.panelClose, focused && s.panelCloseFocused]}>
              <X size={scale(24)} color="#fff" />
            </Pressable>
          </View>

          <View style={s.panelSearchContainer}>
            <TextInput
              style={[s.panelSearchInput, searchFocused && s.panelSearchInputFocused]}
              placeholder="Buscar canal..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => {
                setSearchFocused(true);
                triggerOSD();
              }}
              onBlur={() => setSearchFocused(false)}
            />
          </View>
          
          <FlatList
            data={filteredChannels}
            keyExtractor={ch => ch.id}
            style={s.panelList}
            contentContainerStyle={{ paddingBottom: scale(100) }}
            initialNumToRender={10}
            windowSize={5}
            removeClippedSubviews={true}
            renderItem={({ item: ch }) => {
              const isActive = ch.id === activeChannel.id;
              return (
                <Pressable
                  focusable
                  onPress={() => {
                    setActiveChannel(ch);
                    setShowPanel(false);
                  }}
                  style={({focused}: any) => [
                    s.panelItem,
                    isActive && s.panelItemActive,
                    focused && s.panelItemFocused
                  ]}
                >
                  <View style={s.panelItemIcon}>
                    {ch.logo ? (
                      <Image source={{ uri: ch.logo }} style={s.panelItemLogo} resizeMode="contain" />
                    ) : (
                      <Tv size={scale(16)} color={C.textSecondary} />
                    )}
                  </View>
                  <View style={s.panelItemInfo}>
                    <Text style={[s.panelItemName, isActive && s.panelItemNameActive]} numberOfLines={1}>{ch.name}</Text>
                    {ch.groupTitle && <Text style={s.panelItemCat} numberOfLines={1}>{ch.groupTitle}</Text>}
                  </View>
                </Pressable>
              );
            }}
          />
        </KeyboardAvoidingView>
      )}

    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    ...(Platform.OS === 'web' ? { width: '100vw' as any, height: '100vh' as any, position: 'fixed' as any, top: 0, left: 0 } : {}),
  },
  videoAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: scale(28),
    fontWeight: '800',
    color: '#f87171',
    marginBottom: scale(10),
  },
  errorSub: {
    fontSize: scale(16),
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    maxWidth: scale(600),
  },

  // ── OSD ──
  osd: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(260),
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  osdContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: scale(48),
    paddingBottom: scale(48),
  },
  osdLeft: {
    flex: 1,
    gap: scale(8),
    paddingRight: scale(40),
  },
  osdCatBadge: {
    backgroundColor: C.accentGlow,
    borderWidth: 1,
    borderColor: C.accentBorder,
    paddingVertical: scale(4),
    paddingHorizontal: scale(14),
    borderRadius: scale(20),
    alignSelf: 'flex-start',
  },
  osdCatText: {
    fontSize: scale(12),
    fontWeight: '800',
    color: C.accentLight,
    letterSpacing: 1.5,
  },
  osdChannelName: {
    fontSize: scale(44),
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  osdMeta: {
    fontSize: scale(18),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },

  // ── OSD Controls ──
  osdControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  osdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: scale(14),
    borderRadius: scale(40),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  osdBtnFocused: {
    backgroundColor: '#fff',
    borderColor: C.accent,
    transform: [{ scale: 1.05 }],
  },
  osdBtnLabel: {
    fontSize: scale(14),
    fontWeight: '800',
    color: '#000',
    marginLeft: scale(4),
  },

  // ── Side Panel ──
  panelContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '45%',
    backgroundColor: C.bgPanel,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.1)',
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: -10, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(32),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  panelTitle: {
    fontSize: scale(22),
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  panelClose: {
    padding: scale(8),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  panelCloseFocused: {
    backgroundColor: C.accent,
    transform: [{ scale: 1.1 }],
  },
  panelSearchContainer: {
    paddingHorizontal: scale(24),
    paddingTop: scale(16),
  },
  panelSearchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: scale(16),
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  panelSearchInputFocused: {
    borderColor: C.accent,
    backgroundColor: 'rgba(255,255,255,0.15)',
    transform: [{ scale: 1.02 }],
  },
  panelList: {
    flex: 1,
    padding: scale(24),
  },
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
    padding: scale(16),
    borderRadius: scale(16),
    marginBottom: scale(8),
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  panelItemActive: {
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  panelItemFocused: {
    backgroundColor: 'rgba(255,183,3,0.18)',
    borderColor: C.accent,
    transform: [{ scale: 1.02 }],
  },
  panelItemIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelItemLogo: {
    width: '70%',
    height: '70%',
  },
  panelItemInfo: {
    flex: 1,
  },
  panelItemName: {
    fontSize: scale(18),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: scale(4),
  },
  panelItemNameActive: {
    color: C.accentLight,
    fontWeight: '900',
  },
  panelItemCat: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.4)',
  },
});
