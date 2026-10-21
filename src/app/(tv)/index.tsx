import { Bangers_400Regular, useFonts } from "@expo-google-fonts/bangers";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight, Star } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useGlobal } from "../../contexts/GlobalContext";
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

function TrendingRow({
  items,
  onSelect,
}: {
  items: NexoContentItem[];
  onSelect: (item: NexoContentItem) => void;
}) {
  const [focusedIdx, setFocusedIdx] = useState(0);
  const listRef = useRef<FlatList>(null);

  const handleFocus = (idx: number, item: NexoContentItem) => {
    setFocusedIdx(idx);
    onSelect(item);
  };

  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={(i) => i.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.trendingList}
      renderItem={({ item, index }) => {
        const isFocused = index === focusedIdx;
        const poster = item.posterUrl || item.backdropUrl;
        return (
          <Pressable
            focusable
            onFocus={() => handleFocus(index, item)}
            onPress={() => onSelect(item)}
            style={[
              s.trendCard,
              isFocused ? s.trendCardFocused : s.trendCardNormal,
            ]}
          >
            {isFocused ? (
              <ImageBackground
                source={{ uri: item.backdropUrl || item.posterUrl || "" }}
                style={s.trendBanner}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.85)"]}
                  style={s.trendBannerGrad}
                >
                  <Text style={s.trendBannerTitle} numberOfLines={2}>
                    {item.title.toUpperCase()}
                  </Text>
                  {item.tagline ? (
                    <Text style={s.trendBannerSub} numberOfLines={1}>
                      {item.tagline}
                    </Text>
                  ) : null}
                </LinearGradient>
              </ImageBackground>
            ) : (
              <Image
                source={{ uri: poster || "" }}
                style={s.trendPoster}
                resizeMode="cover"
              />
            )}
          </Pressable>
        );
      }}
    />
  );
}

function ContentRow({
  title,
  items,
  onPress,
  accentColor,
}: {
  title: string;
  items: NexoContentItem[];
  onPress: (item: NexoContentItem) => void;
  accentColor?: string;
}) {
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
        keyExtractor={(i) => i.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowList}
        renderItem={({ item }) => (
          <Pressable
            focusable
            onPress={() => onPress(item)}
            style={({ focused }: any) => [
              s.posterCard,
              focused && s.posterCardFocused,
            ]}
          >
            <Image
              source={{ uri: item.posterUrl || item.backdropUrl || "" }}
              style={s.posterImg}
              resizeMode="cover"
            />
            {item.rating ? (
              <View style={s.posterRating}>
                <Star size={scale(9)} color={C.accent} fill={C.accent} />
                <Text style={s.posterRatingText}>{item.rating.toFixed(1)}</Text>
              </View>
            ) : null}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.7)"]}
              style={s.posterGrad}
            >
              <Text style={s.posterTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </LinearGradient>
          </Pressable>
        )}
      />
    </View>
  );
}

function ChannelRow({ onPress }: { onPress: (ch: any) => void }) {
  const { channels } = useGlobal();
  const topChannels = channels.slice(0, 20);
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
        keyExtractor={(c) => c.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowList}
        renderItem={({ item: ch }) => (
          <Pressable
            focusable
            onPress={() => onPress(ch)}
            style={({ focused }: any) => [
              s.channelCard,
              focused && s.channelCardFocused,
            ]}
          >
            {ch.logo ? (
              <Image
                source={{ uri: ch.logo }}
                style={s.channelLogo}
                resizeMode="contain"
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
          </Pressable>
        )}
      />
    </View>
  );
}

export default function HomeTvScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Bangers: Bangers_400Regular });

  const [loading, setLoading] = useState(true);
  const [heroItems, setHeroItems] = useState<NexoContentItem[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [trending, setTrending] = useState<NexoContentItem[]>([]);
  const [recent, setRecent] = useState<NexoContentItem[]>([]);
  const [movies, setMovies] = useState<NexoContentItem[]>([]);
  const [series, setSeries] = useState<NexoContentItem[]>([]);

  const heroItem = heroItems[heroIdx] || null;

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
        setHeroItems(
          hp.heroItems.length ? hp.heroItems : hp.trending.slice(0, 5),
        );
        setTrending(hp.trending.slice(0, 12));
        setRecent(hp.recent.slice(0, 16));
        setMovies(mv.slice(0, 16));
        setSeries(sr.slice(0, 16));
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
    const t = setInterval(
      () => setHeroIdx((i) => (i + 1) % heroItems.length),
      8000,
    );
    return () => clearInterval(t);
  }, [heroItems.length]);

  const handleContentPress = useCallback(
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
      {/* Fondo fijo: no se desplaza con el contenido. */}
      <View style={s.backgroundLayer} pointerEvents="none">
        {heroItem?.backdropUrl ? (
          <Image
            source={{ uri: heroItem.backdropUrl }}
            style={s.backgroundImage}
            resizeMode="cover"
          />
        ) : heroItem?.posterUrl ? (
          <Image
            source={{ uri: heroItem.posterUrl }}
            style={s.backgroundImage}
            resizeMode="cover"
          />
        ) : null}

        {/* Bruma gris localizada en el borde izquierdo. */}
        <LinearGradient
          colors={[
            "rgba(31, 33, 34, 0.59)",
            "rgba(48, 50, 53, 0.57)",
            "rgba(8, 8, 8, 0.06)",
          ]}
          locations={[0, 0.42, 1]}
          style={s.backgroundLeftFog}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />

        {/* Bruma inferior, combinada con una transición oscura suave. */}
        <LinearGradient
          colors={[
            "rgba(22, 23, 24, 0.02)",
            "rgba(13, 13, 14, 0.3)",
            "rgba(8,8,8,0.52)",
          ]}
          locations={[0, 0.48, 1]}
          style={s.backgroundBottomFog}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </View>

      <ScrollView
        style={s.sectionsScroll}
        contentContainerStyle={s.sectionsContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroContainer}>
          {heroItem && (
            <View style={s.heroInfo} pointerEvents="none">
              <Text style={s.heroTitle}>{heroItem.title}</Text>
              <View style={s.heroMeta}>
                <Text style={s.heroMetaText}>
                  {TYPE_LABEL[heroItem.type] || heroItem.type}
                </Text>
                {heroItem.genres?.[0] && (
                  <Text style={s.heroMetaText}>
                    {" "}
                    • {heroItem.genres[0].name}
                  </Text>
                )}
                {heroItem.duration ? (
                  <Text style={s.heroMetaText}>
                    {" "}
                    • {formatDuration(heroItem.duration)}
                  </Text>
                ) : null}
                {heroItem.releaseYear ? (
                  <Text style={s.heroMetaText}> • {heroItem.releaseYear}</Text>
                ) : null}
              </View>

              <View style={s.heroBadges}>
                <View style={s.badge}>
                  <Text style={s.badgeText}>
                    {heroItem.contentRating
                      ? `${heroItem.contentRating} | ESTRENADA`
                      : "ESTRENADA"}
                  </Text>
                </View>
                {heroItem.rating ? (
                  <View style={[s.badge, s.badgeImdb]}>
                    <Text style={[s.badgeText, s.badgeImdbText]}>
                      IMDb {heroItem.rating.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
                {heroItem.language ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>
                      {heroItem.language.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
              </View>

              {heroItem.description ? (
                <Text style={s.heroDesc} numberOfLines={3}>
                  {heroItem.description}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {trending.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Tendencia</Text>
            <TrendingRow
              items={trending}
              onSelect={(item) => {
                const idx = heroItems.findIndex((h) => h.id === item.id);
                if (idx >= 0) setHeroIdx(idx);
              }}
            />
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

const HERO_H = Math.min(SH * 0.64, scale(520));
const CARD_W = scale(130);
const CARD_H = scale(180);
const TREND_FOCUSED_W = scale(260);
const TREND_FOCUSED_H = scale(160);
const CHANNEL_CARD_W = scale(110);

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

  backgroundLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
    overflow: "hidden",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  backgroundLeftFog: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "40%",
  },
  backgroundBottomFog: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: scale(250),
  },
  heroContainer: {
    height: HERO_H,
    width: "100%",
    position: "relative",
    backgroundColor: "transparent",
  },
  heroInfo: {
    position: "absolute",
    top: scale(110),
    left: scale(28),
    right: "30%",
    zIndex: 2,
  },
  heroTitle: {
    fontFamily: "Bangers",
    fontSize: scale(36),
    color: C.accent,
    letterSpacing: 0.3,
    marginBottom: scale(35),
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", marginBottom: scale(10) },
  heroMetaText: { fontSize: scale(13), color: "rgba(255,255,255,0.78)" },
  heroBadges: {
    flexDirection: "row",
    gap: scale(6),
    marginBottom: scale(10),
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
  badgeImdb: { backgroundColor: "#f5c518" },
  badgeImdbText: { color: "#000" },
  heroDesc: {
    fontSize: scale(13),
    color: "rgba(255,255,255,0.75)",
    lineHeight: scale(18),
  },

  sectionsScroll: {
    flex: 1,
    backgroundColor: "transparent",
    marginTop: 0,
    zIndex: 1,
  },
  sectionsContent: {
    paddingTop: scale(8),
    paddingBottom: scale(40),
    paddingLeft: scale(64),
  },
  section: { marginTop: -20, marginBottom: scale(4) },
  sectionTitle: {
    fontSize: scale(18),
    fontWeight: "800",
    color: C.textPrimary,
    marginLeft: scale(24),
    marginBottom: scale(12),
    marginTop: 0,
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
  },
  rowTitle: { fontSize: scale(16), fontWeight: "800", color: C.textPrimary },
  liveDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: C.live,
    marginLeft: scale(12),
  },
  rowList: { paddingLeft: scale(24), paddingRight: scale(16), gap: scale(12) },
  trendingList: {
    paddingLeft: scale(24),
    paddingRight: scale(16),
    gap: scale(12),
  },
  trendCard: { borderRadius: scale(12), overflow: "hidden" },
  trendCardNormal: { width: CARD_W, height: CARD_H },
  trendCardFocused: {
    width: TREND_FOCUSED_W,
    height: TREND_FOCUSED_H,
    borderWidth: 2,
    borderColor: C.accent,
    shadowColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  trendPoster: { width: "100%", height: "100%" },
  trendBanner: { width: "100%", height: "100%" },
  trendBannerGrad: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    padding: scale(10),
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
  posterCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: scale(10),
    overflow: "hidden",
    backgroundColor: C.bgCard,
  },
  posterCardFocused: {
    borderWidth: 2,
    borderColor: C.accent,
    transform: [{ scale: 1.01 }],
    shadowColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  posterImg: { ...StyleSheet.absoluteFill },
  posterGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: scale(8),
  },
  posterTitle: { fontSize: scale(11), fontWeight: "700", color: "#fff" },
  posterRating: {
    position: "absolute",
    top: scale(6),
    right: scale(6),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: scale(5),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  posterRatingText: { fontSize: scale(9), fontWeight: "800", color: C.accent },
  channelCard: {
    width: CHANNEL_CARD_W,
    height: scale(80),
    borderRadius: scale(10),
    backgroundColor: C.bgCard,
    alignItems: "center",
    justifyContent: "center",
    padding: scale(8),
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  channelCardFocused: {
    borderColor: C.accent,
    backgroundColor: C.bgCardHover,
    transform: [{ scale: 1.02 }],
    shadowColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
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
