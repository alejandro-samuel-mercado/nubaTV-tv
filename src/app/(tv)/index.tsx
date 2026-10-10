import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, ScrollView,
  Image, Pressable, FlatList, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGlobal, Channel, API_URL } from '../../contexts/GlobalContext';
import { useRouter } from 'expo-router';
import { Maximize2, Tv, Play } from 'lucide-react-native';
import { scale } from '../../lib/scale';
import { C, rowColor } from '../../lib/tvColors';
import HeroVideo from '../../components/tv/HeroVideo';
import ChannelCard from '../../components/tv/ChannelCard';
import ScreenBackground from '../../components/tv/ScreenBackground';

const { width: SW } = Dimensions.get('window');
const MAX_CATEGORY_ROWS = 5;
const CHANNELS_PER_ROW = 15;

// ── Category Row ────────────────────────────────────────────────────────────
function CategoryRow({
  title,
  channels,
  onChannelPress,
  onChannelFocus,
}: {
  title: string;
  channels: Channel[];
  onChannelPress: (c: Channel) => void;
  onChannelFocus: (c: Channel) => void;
}) {
  const color = rowColor(title);
  
  return (
    <View style={s.row}>
      <View style={s.rowHeader}>
        <View style={[s.rowAccent, { backgroundColor: color, shadowColor: color }]} />
        <View>
          <Text style={s.rowTitle}>{title}</Text>
          <Text style={s.rowSubtitle}>{channels.length} canales</Text>
        </View>
      </View>
      <FlatList
        data={channels.slice(0, CHANNELS_PER_ROW)}
        keyExtractor={c => c.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowList}
        renderItem={({ item }) => (
          <View style={s.cardWrap}>
            <ChannelCard
              channel={item}
              onPress={() => onChannelPress(item)}
              onFocus={() => onChannelFocus(item)}
            />
          </View>
        )}
      />
    </View>
  );
}

// ── Home Screen ─────────────────────────────────────────────────────────────
export default function HomeTvScreen() {
  const { channels, activeChannel, setActiveChannel } = useGlobal();
  const router = useRouter();

  // ── Hero channel: random + auto-fallback on error ──────────────────────────
  const [heroChannel, setHeroChannel] = useState<Channel | null>(null);
  const [heroReady, setHeroReady] = useState(false);
  const [heroError, setHeroError] = useState(false);

  const pickRandomChannel = useCallback(
    (pool: Channel[]): Channel | null => {
      if (pool.length === 0) return null;
      const livePool = pool.filter(
        c => !c.url.includes('.mkv') && !c.url.includes('.mp4') && !c.url.includes('/movie/') && !c.url.includes('/series/')
      );
      const activePool = livePool.length > 0 ? livePool : pool;
      return activePool[Math.floor(Math.random() * activePool.length)];
    },
    [],
  );

  useEffect(() => {
    if (channels.length > 0 && !heroChannel) {
      setHeroReady(false);
      setHeroChannel(pickRandomChannel(channels));
    }
  }, [channels]);

  const handleHeroError = useCallback(() => {
    // Si falla, simplemente mostramos error, pero NO cambiamos el canal
    // para no volver locos a los "Canales Similares"
    setHeroError(true);
    setHeroReady(false);
  }, []);

  const handleHeroReady = useCallback(() => {
    setHeroError(false);
    setHeroReady(true);
  }, []);

  const categories = useMemo(() => {
    const countries = new Set(channels.map(c => c.country).filter(Boolean));
    const grouped = channels.reduce((acc, ch) => {
      const cat = ch.category?.name || 'General';
      if (countries.has(cat)) return acc;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(ch);
      return acc;
    }, {} as Record<string, Channel[]>);

    return Object.entries(grouped)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, MAX_CATEGORY_ROWS)
      .map(([name, items]) => ({ name, items }));
  }, [channels]);

  const featuredChannel = heroChannel ?? channels[0] ?? null;

  const relatedChannels = useMemo(() => {
    if (!featuredChannel) return [];
    const cat = featuredChannel.category?.name || 'General';
    const group = categories.find(c => c.name === cat);
    if (!group) return [];
    return group.items.filter(c => c.id !== featuredChannel.id).slice(0, 4);
  }, [featuredChannel, categories]);

  const handlePlay = useCallback((channel: Channel) => {
    setActiveChannel(channel);
    router.push('/player');
  }, []);

  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChannelFocus = useCallback((ch: Channel) => {
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = setTimeout(() => {
      setHeroChannel(ch);
    }, 300);
  }, []);

  const handleHeroPlay = () => {
    if (featuredChannel) handlePlay(featuredChannel);
  };

  const [watchBtnFocused, setWatchBtnFocused] = useState(false);

  return (
    <View style={s.root}>
      <ScreenBackground />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO SIDE-BY-SIDE (Web Style) ─────────────────────────────────── */}
      <View style={s.heroContainer}>
        {/* Left: Player */}
        <Pressable 
          focusable
          onPress={handleHeroPlay}
          style={({focused}: any) => [s.heroPlayerBox, focused && s.heroPlayerBoxFocused]}
        >
          {featuredChannel ? (
            <>
              <HeroVideo
                key={featuredChannel.id}
                uri={Platform.OS === 'web' ? `${API_URL}/proxy?url=${encodeURIComponent(featuredChannel.url)}` : featuredChannel.url}
                onError={handleHeroError}
                onCanPlay={handleHeroReady}
              />
              {!heroReady && (
                <View style={[StyleSheet.absoluteFill, s.heroLoadingOverlay]}>
                  {heroError ? (
                    <Text style={[s.heroLoadingText, { color: C.textSecondary }]}>
                      Transmisión no disponible.
                    </Text>
                  ) : (
                    <>
                      <ActivityIndicator size="large" color={C.accent} />
                      <Text style={s.heroLoadingText}>Buscando señal en vivo...</Text>
                    </>
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={s.heroLoadingOverlay}>
              <ActivityIndicator size="large" color={C.textSecondary} />
            </View>
          )}
        </Pressable>

        {/* Right: Info Panel */}
        <View style={s.heroInfoBox}>
          {featuredChannel && (
            <>
              {/* Badge & Category */}
              <View style={s.heroInfoTop}>
                <View style={s.liveBadge}>
                  <View style={s.liveBadgeDot} />
                  <Text style={s.liveBadgeText}>EN VIVO</Text>
                </View>
                <Text style={s.heroCat}>{featuredChannel.category?.name || 'GENERAL'}</Text>
              </View>

              {/* Logo */}
              {featuredChannel.logo && (
                <Image
                  source={{ uri: featuredChannel.logo }}
                  style={s.heroLogo}
                  resizeMode="contain"
                />
              )}

              {/* Title & Meta */}
              <View>
                <Text style={s.heroName} numberOfLines={2}>{featuredChannel.name}</Text>
                <Text style={s.heroMeta}>{featuredChannel.country || 'Internacional'}</Text>
              </View>

              {/* Divider */}
              <View style={s.divider} />

              {/* Related Channels */}
              <View style={s.relatedSection}>
                <Text style={s.relatedTitle}>CANALES SIMILARES</Text>
                {relatedChannels.map(ch => (
                  <Pressable 
                    key={ch.id} 
                    focusable 
                    onPress={() => {
                      setHeroChannel(ch);
                    }}
                    style={({focused}: any) => [s.relatedItem, focused && s.relatedItemFocused]}
                  >
                    <View style={s.relatedIconBox}>
                      {ch.logo ? (
                        <Image source={{ uri: ch.logo }} style={s.relatedLogo} resizeMode="contain" />
                      ) : (
                        <Tv size={scale(12)} color={C.textSecondary} />
                      )}
                    </View>
                    <View style={s.relatedTextWrap}>
                      <Text style={s.relatedName} numberOfLines={1}>{ch.name}</Text>
                      {ch.country && <Text style={s.relatedMeta} numberOfLines={1}>{ch.country}</Text>}
                    </View>
                  </Pressable>
                ))}
              </View>

            </>
          )}
        </View>
      </View>

      {/* ── CATEGORY ROWS ────────────────────────────────────── */}
      <View style={s.rows}>
        {categories.map((cat) => (
          <CategoryRow
            key={cat.name}
            title={cat.name}
            channels={cat.items}
            onChannelPress={handlePlay}
            onChannelFocus={handleChannelFocus}
          />
        ))}
      </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080808',
  },
  scrollContent: {
    paddingBottom: scale(100),
  },

  // ── Hero ──
  heroContainer: {
    flexDirection: 'row',
    gap: scale(20),
    paddingHorizontal: scale(48),
    paddingTop: scale(24),
    paddingBottom: scale(40),
  },
  heroPlayerBox: {
    flex: 1,
    aspectRatio: 16/9,
    backgroundColor: C.bgPanel,
    borderRadius: scale(20),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  heroPlayerBoxFocused: {
    borderColor: C.accent,
    borderWidth: 3,
    transform: [{ scale: 1.01 }],
    shadowOpacity: 0.8,
    shadowColor: C.accent,
  },
  heroLoadingOverlay: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: scale(16),
  },
  heroLoadingText: {
    color: C.textSecondary,
    fontSize: scale(16),
    fontWeight: '700',
    letterSpacing: 1,
  },

  heroInfoBox: {
    width: scale(340),
    backgroundColor: C.bgPanel,
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: scale(24),
    justifyContent: 'center',
  },
  heroInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginBottom: scale(16),
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  liveBadgeDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#fff',
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: scale(10),
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  heroCat: {
    color: C.textSecondary,
    fontSize: scale(10),
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroLogo: {
    height: scale(48),
    width: scale(120),
    marginBottom: scale(16),
  },
  heroName: {
    fontSize: scale(28),
    fontWeight: '900',
    color: C.textPrimary,
    lineHeight: scale(32),
  },
  heroMeta: {
    fontSize: scale(12),
    color: C.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: scale(4),
  },
  divider: {
    height: 1,
    backgroundColor: C.borderSubtle,
    marginVertical: scale(20),
  },
  relatedSection: {
    flex: 1,
    gap: scale(12),
  },
  relatedTitle: {
    fontSize: scale(10),
    fontWeight: '800',
    color: C.textSecondary,
    letterSpacing: 1.5,
  },
  relatedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    padding: scale(6),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  relatedItemFocused: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.3)',
    transform: [{ scale: 1.02 }],
  },
  relatedIconBox: {
    width: scale(36),
    height: scale(36),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedLogo: {
    width: scale(24),
    height: scale(24),
  },
  relatedTextWrap: {
    flex: 1,
  },
  relatedName: {
    fontSize: scale(12),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  relatedMeta: {
    fontSize: scale(9),
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: C.borderSubtle,
    paddingVertical: scale(12),
    borderRadius: scale(12),
    marginTop: scale(24),
  },
  watchBtnFocused: {
    backgroundColor: C.accentLight,
    borderColor: C.accentLight,
    transform: [{ scale: 1.02 }],
  },
  watchBtnText: {
    fontSize: scale(12),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },

  // ── Rows ──
  rows: {
    gap: scale(32),
  },
  row: {
    marginBottom: scale(8),
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingHorizontal: scale(48),
    marginBottom: scale(16),
  },
  rowAccent: {
    width: scale(4),
    height: scale(32),
    borderRadius: scale(2),
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
  rowTitle: {
    fontSize: scale(22),
    fontWeight: '900',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.5,
  },
  rowSubtitle: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '600',
  },
  rowList: {
    paddingHorizontal: scale(48),
    paddingBottom: scale(24),
    paddingTop: scale(8),
  },
  cardWrap: {
    width: scale(180),
    marginRight: scale(16),
  },
});
