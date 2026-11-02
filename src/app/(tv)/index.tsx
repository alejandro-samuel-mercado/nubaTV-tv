import { Bangers_400Regular, useFonts } from "@expo-google-fonts/bangers";
import { useRouter } from "expo-router";
import { ChevronRight, Info, Play } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
      ActivityIndicator,
      Dimensions,
      FlatList,
      ScrollView,
      StyleSheet,
      Text,
      View,
} from "react-native";
import BackdropBackground from "../../components/tv/BackdropBackground";
import Focusable from "../../components/tv/Focusable";
import PosterCard from "../../components/tv/PosterCard";
import RemoteImage, { prefetchImages } from "../../components/tv/RemoteImage";
import { useGlobal } from "../../contexts/GlobalContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
      getContentList,
      getHomepage,
      NexoContentItem,
} from "../../services/nexoplay";

const { height: SH } = Dimensions.get("window");

const TYPE_LABEL: Record<string, string> = {
  MOVIE: "Película",
  SERIES: "Serie",
  DOCUMENTARY: "Documental",
  ANIME: "Anime",
};

const formatDuration = (mins?: number) => {
  if (!mins) return "";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const HERO_H = Math.min(SH * 0.5, scale(400));
const CARD_W = scale(130);
const CARD_H = scale(180);
const CARD_GAP = scale(12);
const TREND_FOCUSED_W = scale(260);
const TREND_FOCUSED_H = scale(160);
const CHANNEL_CARD_W = scale(110);

const keyById = (i: { id: string }) => i.id;

// ── Tendencia: la card enfocada se expande y cambia el hero ─────────────────
const TrendingRow = memo(function TrendingRow({
  items,
  onSelect,
}: {
  items: NexoContentItem[];
  onSelect: (item: NexoContentItem) => void;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const sidebarHandle = useSidebarHandle();

  return (
    <FlatList
      data={items}
      keyExtractor={keyById}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.trendingList}
      initialNumToRender={8}
      windowSize={5}
      extraData={focusedId}
      renderItem={({ item, index }) => {
        const isFocused = item.id === focusedId;
        return (
          <Focusable
            onFocus={() => {
              setFocusedId(item.id);
              onSelect(item);
            }}
            onBlur={() => setFocusedId((cur) => (cur === item.id ? null : cur))}
            onPress={() => onSelect(item)}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
            style={[
              s.trendCard,
              isFocused ? s.trendCardFocused : s.trendCardNormal,
            ]}
          >
            <RemoteImage
              uri={
                isFocused
                  ? item.backdropUrl || item.posterUrl
                  : item.posterUrl || item.backdropUrl
              }
              style={StyleSheet.absoluteFill as any}
              transition={150}
            />
            {isFocused ? (
              <View style={s.trendBannerGrad}>
                <Text style={s.trendBannerTitle} numberOfLines={2}>
                  {item.title.toUpperCase()}
                </Text>
                {item.tagline ? (
                  <Text style={s.trendBannerSub} numberOfLines={1}>
                    {item.tagline}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Focusable>
        );
      }}
    />
  );
});

// ── Fila de contenido: cada card abre los DETALLES ──────────────────────────
const ContentRow = memo(function ContentRow({
  title,
  items,
  onPress,
  accentColor,
  preferFocus,
}: {
  title: string;
  items: NexoContentItem[];
  onPress: (item: NexoContentItem) => void;
  accentColor?: string;
  preferFocus?: boolean;
}) {
  const sidebarHandle = useSidebarHandle();
  if (!items.length) return null;
  const accent = accentColor || C.accent;

  return (
    <View style={s.contentRow}>
      <View style={s.rowHeader}>
        <View style={[s.rowAccent, { backgroundColor: accent }]} />
        <Text style={s.rowTitle}>{title}</Text>
        <ChevronRight
          size={scale(16)}
          color={accent}
          style={{ marginLeft: scale(8) }}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={keyById}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowList}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        renderItem={({ item, index }) => (
          <PosterCard
            item={item}
            width={CARD_W}
            height={CARD_H}
            onPressItem={onPress}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
            hasTVPreferredFocus={preferFocus && index === 0}
          />
        )}
      />
    </View>
  );
});

const ChannelRow = memo(function ChannelRow({
  onPress,
}: {
  onPress: (ch: any) => void;
}) {
  const { channels } = useGlobal();
  const sidebarHandle = useSidebarHandle();
  const topChannels = useMemo(() => channels.slice(0, 20), [channels]);
  if (!topChannels.length) return null;

  return (
    <View style={s.contentRow}>
      <View style={s.rowHeader}>
        <View style={[s.rowAccent, { backgroundColor: C.live }]} />
        <Text style={s.rowTitle}>Canales en Vivo</Text>
        <View style={s.liveDot} />
        <Text style={[s.rowTitle, { color: C.live, marginLeft: scale(6) }]}>
          EN VIVO
        </Text>
      </View>
      <FlatList
        data={topChannels}
        keyExtractor={keyById}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowList}
        initialNumToRender={8}
        windowSize={5}
        renderItem={({ item: ch, index }) => (
          <Focusable
            onPress={() => onPress(ch)}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
            style={s.channelCard}
            focusedStyle={s.channelCardFocused}
          >
            {ch.logo ? (
              <RemoteImage
                uri={ch.logo}
                style={s.channelLogo as any}
                contentFit="contain"
              />
            ) : (
              <View style={s.channelLogoFallback}>
                <Text style={s.channelLogoText}>
                  {ch.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={s.channelName} numberOfLines={2}>
              {ch.name}
            </Text>
          </Focusable>
        )}
      />
    </View>
  );
});

// ── Info del hero (sin "ESTRENADA" ni IMDb) + botón Reproducir ──────────────
const HeroInfo = memo(function HeroInfo({
  item,
  onPlay,
  onDetails,
}: {
  item: NexoContentItem;
  onPlay: (item: NexoContentItem) => void;
  onDetails: (item: NexoContentItem) => void;
}) {
  const sidebarHandle = useSidebarHandle();
  return (
    <View style={s.heroInfo} pointerEvents="box-none">
      <Text style={s.heroTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={s.heroMeta}>
        <Text style={s.heroMetaText}>{TYPE_LABEL[item.type] || item.type}</Text>
        {item.genres?.[0] && (
          <Text style={s.heroMetaText}> • {item.genres[0].name}</Text>
        )}
        {item.duration ? (
          <Text style={s.heroMetaText}> • {formatDuration(item.duration)}</Text>
        ) : null}
        {item.releaseYear ? (
          <Text style={s.heroMetaText}> • {item.releaseYear}</Text>
        ) : null}
      </View>

      <View style={s.heroBadges}>
        {item.contentRating ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{item.contentRating}</Text>
          </View>
        ) : null}
        {item.language ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{item.language.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      {item.description ? (
        <Text style={s.heroDesc} numberOfLines={3}>
          {item.description}
        </Text>
      ) : null}

      <View style={s.heroButtons}>
        <Focusable
          hasTVPreferredFocus
          onPress={() => onPlay(item)}
          nextFocusLeft={sidebarHandle ?? undefined}
          style={s.btnPlay}
          focusedStyle={s.btnPlayFocused}
        >
          <Play size={scale(16)} color="#000" fill="#000" />
          <Text style={s.btnPlayText}>Reproducir</Text>
        </Focusable>
        <Focusable
          onPress={() => onDetails(item)}
          style={s.btnInfo}
          focusedStyle={s.btnInfoFocused}
        >
          {({ focused }) => (
            <>
              <Info size={scale(16)} color={focused ? "#000" : "#fff"} />
              <Text style={[s.btnInfoText, focused && { color: "#000" }]}>
                Más info
              </Text>
            </>
          )}
        </Focusable>
      </View>
    </View>
  );
});

export default function HomeTvScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Bangers: Bangers_400Regular });

  const [loading, setLoading] = useState(true);
  const [heroItems, setHeroItems] = useState<NexoContentItem[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [override, setOverride] = useState<NexoContentItem | null>(null);
  const [trending, setTrending] = useState<NexoContentItem[]>([]);
  const [recent, setRecent] = useState<NexoContentItem[]>([]);
  const [movies, setMovies] = useState<NexoContentItem[]>([]);
  const [series, setSeries] = useState<NexoContentItem[]>([]);

  // El hero sólo cambia cuando el foco se detiene → sin lag al recorrer cards.
  const heroRaw = override ?? heroItems[heroIdx] ?? null;
  const heroItem = useDebouncedValue(heroRaw, 250);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hp, mv, sr] = await Promise.all([
          getHomepage(),
          getContentList({ type: "MOVIE", limit: 20, sort: "recent" }),
          getContentList({ type: "SERIES", limit: 20, sort: "recent" }),
        ]);
        if (cancelled) return;
        const heroes = hp.heroItems.length
          ? hp.heroItems
          : hp.trending.slice(0, 5);
        setHeroItems(heroes);
        setTrending(hp.trending.slice(0, 12));
        setRecent(hp.recent.slice(0, 16));
        setMovies(mv.slice(0, 16));
        setSeries(sr.slice(0, 16));
        // Precarga fondos para que el cambio de banner sea instantáneo.
        prefetchImages([
          ...heroes.map((h) => h.backdropUrl || h.posterUrl),
          ...hp.trending.slice(0, 8).map((h) => h.backdropUrl),
        ]);
      } catch (e) {
        console.warn("Home load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (heroItems.length < 2) return;
    const t = setInterval(() => {
      setOverride(null);
      setHeroIdx((i) => (i + 1) % heroItems.length);
    }, 9000);
    return () => clearInterval(t);
  }, [heroItems.length]);

  // Cards → DETALLES
  const handleContentPress = useCallback(
    (item: NexoContentItem) => {
      router.push({ pathname: "/detail", params: { slug: item.slug } } as any);
    },
    [router],
  );

  const handlePlay = useCallback(
    (item: NexoContentItem) => {
      router.push({ pathname: "/player", params: { slug: item.slug } } as any);
    },
    [router],
  );

  const handleChannelPress = useCallback(
    (ch: any) => {
      router.push({
        pathname: "/player",
        params: { channelId: ch.id, channelUrl: ch.url },
      } as any);
    },
    [router],
  );

  const handleTrendSelect = useCallback(
    (item: NexoContentItem) => setOverride(item),
    [],
  );

  if (loading || !fontsLoaded) {
    return (
      <View style={s.loadWrap}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadText}>Cargando...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <BackdropBackground
        uri={heroItem?.backdropUrl || heroItem?.posterUrl}
        variant="home"
      />

      <ScrollView
        style={s.sectionsScroll}
        contentContainerStyle={s.sectionsContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroContainer}>
          {heroItem && (
            <HeroInfo
              item={heroItem}
              onPlay={handlePlay}
              onDetails={handleContentPress}
            />
          )}
        </View>

        {trending.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Tendencia</Text>
            <TrendingRow items={trending} onSelect={handleTrendSelect} />
          </View>
        )}

        <ChannelRow onPress={handleChannelPress} />
        <ContentRow
          title="Películas recién agregadas"
          items={movies}
          onPress={handleContentPress}
          accentColor={C.accentOrange}
        />
        <ContentRow
          title="Series recién agregadas"
          items={series}
          onPress={handleContentPress}
          accentColor={C.accentFire}
        />
        <ContentRow
          title="Agregados recientemente"
          items={recent}
          onPress={handleContentPress}
        />
        <View style={{ height: scale(60) }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808", position: "relative" },
  loadWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(12),
    backgroundColor: "#080808",
  },
  loadText: { color: C.textSecondary, fontSize: scale(14) },

  heroContainer: {
    height: HERO_H * 0.82,
    width: "100%",
    position: "relative",
    backgroundColor: "transparent",
  },
  heroInfo: {
    position: "absolute",
    top: scale(30),
    left: scale(28),
    maxWidth: scale(440),
    width: "35%",
    zIndex: 2,
  },
  heroTitle: {
    fontFamily: "Bangers",
    fontSize: scale(36),
    color: C.accent,
    letterSpacing: 0.3,
    marginBottom: scale(34),
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", marginBottom: scale(10) },
  heroMetaText: { fontSize: scale(13), color: "rgba(255,255,255,0.78)" },
  heroBadges: {
    flexDirection: "row",
    gap: scale(6),
    marginBottom: scale(3),
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "rgba(80,80,80,0.7)",
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(4),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  badgeText: { fontSize: scale(13), color: "#fff", fontWeight: "700" },
  heroDesc: {
    fontSize: scale(13),
    color: "rgba(255,255,255,0.75)",
    lineHeight: scale(18),
  },
  heroButtons: {
    flexDirection: "row",
    gap: scale(12),
    marginTop: scale(16),
  },
  btnPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: C.accent,
    paddingHorizontal: scale(22),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnPlayFocused: {
    backgroundColor: "#fff",
  },
  btnPlayText: { color: "#000", fontSize: scale(14), fontWeight: "900" },
  btnInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: scale(20),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnInfoFocused: {
    backgroundColor: "#fff",
  },
  btnInfoText: { color: "#fff", fontSize: scale(14), fontWeight: "800" },

  sectionsScroll: {
    flex: 1,
    backgroundColor: "transparent",
    zIndex: 1,
  },
  sectionsContent: {
    paddingTop: scale(56),
    paddingBottom: scale(20),
    paddingLeft: scale(64),
  },
  section: { marginTop: 40, marginBottom: scale(4) },
  sectionTitle: {
    fontSize: scale(18),
    fontWeight: "800",
    color: C.textPrimary,
    marginLeft: scale(24),
   
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: scale(24),
    marginBottom: scale(10),
    marginTop: scale(20),
  },
  rowAccent: {
    width: scale(4),
    height: scale(18),
    borderRadius: scale(2),
    marginRight: scale(10),
    marginBottom:scale(30)
  },
  rowTitle: { fontSize: scale(16), fontWeight: "800", color: C.textPrimary },
  liveDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: C.live,
    marginLeft: scale(12),
  },
  rowList: {
    paddingLeft: scale(24),
    paddingRight: scale(16),
    paddingVertical: scale(6),
    gap: CARD_GAP,
  },
  trendingList: {
    paddingLeft: scale(24),
    paddingRight: scale(16),
    paddingVertical: scale(6),
    gap: CARD_GAP,
    alignItems: "flex-start",
  },
  trendCard: {
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: "transparent",
  },
  trendCardNormal: { width: CARD_W, height: CARD_H },
  trendCardFocused: {
    width: TREND_FOCUSED_W,
    height: TREND_FOCUSED_H,
    backgroundColor: "rgba(255,183,3,0.12)",
  },
  trendBannerGrad: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    padding: scale(10),
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  trendBannerTitle: {
    fontSize: scale(14),
    fontWeight: "900",
    color: C.accent,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  trendBannerSub: {
    fontSize: scale(10),
    color: "rgba(255,255,255,0.7)",
    marginTop: scale(2),
  },
  channelCard: {
    width: CHANNEL_CARD_W,
    height: scale(80),
    borderRadius: scale(10),
    backgroundColor: C.bgCard,
    alignItems: "center",
    justifyContent: "center",
    padding: scale(8),
    borderWidth: 2,
    borderColor: C.borderSubtle,
  },
  channelCardFocused: {
    borderColor: C.accent,
    backgroundColor: C.bgCardHover,
  },
  channelLogo: { width: scale(50), height: scale(36), marginBottom: scale(4) },
  channelLogoFallback: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(8),
    backgroundColor: "rgba(255,183,3,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scale(4),
  },
  channelLogoText: { fontSize: scale(14), fontWeight: "900", color: C.accent },
  channelName: {
    fontSize: scale(10),
    fontWeight: "700",
    color: C.textSecondary,
    textAlign: "center",
  },
  contentRow: { marginBottom: scale(4) },
});
