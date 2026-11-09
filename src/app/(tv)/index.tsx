import { Bangers_400Regular, useFonts } from "@expo-google-fonts/bangers";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight, Clapperboard, Info, Play, Sparkles } from "lucide-react-native";
import { memo, useCallback, useEffect, useRef, useState } from "react";
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
import ViewAllCard from "../../components/tv/ViewAllCard";
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

// ── Escalas adaptadas a pantalla TV (con sidebar a la izquierda) ────────
const SIDEBAR_OFFSET = scale(64);
const CONTENT_LEFT_PAD = scale(112);

// Cards del selector de portadas dentro del Hero (reducido sutilmente y uniforme)
const HS_CARD_W = scale(170);
const HS_CARD_H = scale(110);

// Cards de secciones de catálogo (filas inferiores)
const POSTER_W = scale(130);
const POSTER_H = scale(185);
const CARD_GAP = scale(14);
const TREND_W = scale(230);
const TREND_H = scale(140);
const CONT_CARD_W = scale(200);
const CONT_CARD_H = scale(125);
const CHANNEL_CARD_W = scale(115);

const keyById = (i: any) => i.id;

// ── HeroSelector: Tira de cards de portadas dentro del Hero ──
const HeroSelector = memo(function HeroSelector({
  items,
  activeIdx,
  onSelectHero,
}: {
  items: NexoContentItem[];
  activeIdx: number;
  onSelectHero: (idx: number, item: NexoContentItem, immediate?: boolean) => void;
}) {
  const sidebarHandle = useSidebarHandle();
  const listRef = useRef<FlatList>(null);
  const scrollTimer = useRef<any>(null);

  useEffect(() => {
    if (activeIdx >= 0 && items.length > 0) {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({
            index: activeIdx,
            animated: true,
            viewPosition: 0.25,
          });
        } catch { }
      }, 70);
    }
    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [activeIdx, items.length]);

  return (
    <View style={s.heroSelectorWrapper}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={keyById}
        extraData={activeIdx}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.heroSelectorTrack}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }}
        renderItem={({ item, index }) => {
          const isActive = index === activeIdx;
          const bgImg = isActive
            ? item.backdropUrl || item.posterUrl
            : item.posterUrl || item.backdropUrl;

          return (
            <Focusable
              onFocus={() => onSelectHero(index, item, false)}
              onPress={() => onSelectHero(index, item, true)}
              nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
              trapFocusRight={index === items.length - 1}
              scaleFocused={1.06}
              style={[
                s.hsCard,
                isActive && s.hsCardActive,
              ]}
              focusedStyle={s.hsCardFocused}
            >
              <RemoteImage
                uri={bgImg}
                style={StyleSheet.absoluteFill as any}
                contentFit="cover"
                transition={180}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.88)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.hsCardInfo}>
                <Text style={s.hsCardTitle} numberOfLines={1}>
                  {item.title.toUpperCase()}
                </Text>
                <Text style={s.hsCardSub} numberOfLines={1}>
                  {TYPE_LABEL[item.type] || item.type}
                  {item.releaseYear ? ` • ${item.releaseYear}` : ""}
                  {item.rating ? ` • ★ ${item.rating.toFixed(1)}` : ""}
                </Text>
              </View>
            </Focusable>
          );
        }}
      />
    </View>
  );
});

// ── Hero Info (Textos, rating, sinopsis y botón Reproducir) ─────────
const HeroInfo = memo(function HeroInfo({
  item,
  onPlay,
  onDetails,
}: {
  item: NexoContentItem;
  onPlay: (item: NexoContentItem) => void;
  onDetails?: (item: NexoContentItem) => void;
}) {
  const sidebarHandle = useSidebarHandle();

  return (
    <View style={s.heroInfo} pointerEvents="box-none">
      {/* Tagline / Tipo Chip */}
      <View style={s.taglineChip}>
        <Sparkles size={scale(10)} color="#f59e0b" />
        <Text style={s.taglineChipText}>
          {item.tagline || (TYPE_LABEL[item.type] || item.type).toUpperCase()}
        </Text>
      </View>

      {/* Título Principal */}
      <Text style={s.heroTitle} numberOfLines={2}>
        {item.title}
      </Text>

      {/* Metadatos (Tipo • Género • Duración • Año) */}
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

      {/* Badges de calificación y lenguaje */}
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
        {item.rating ? (
          <View style={[s.badge, s.badgeAccent]}>
            <Text style={[s.badgeText, { color: C.accent }]}>
              ★ {item.rating.toFixed(1)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Sinopsis */}
      {item.description ? (
        <Text style={s.heroDesc} numberOfLines={3}>
          {item.description}
        </Text>
      ) : null}

      {/* Botones de acción */}
      <View style={s.heroButtons}>
        <Focusable
          hasTVPreferredFocus
          onPress={() => onPlay(item)}
          nextFocusLeft={sidebarHandle ?? undefined}
          scaleFocused={1.05}
          style={s.btnPlay}
          focusedStyle={s.btnPlayFocused}
        >
          <Play size={scale(15)} color="#000" fill="#000" />
          <Text style={s.btnPlayText}>Reproducir</Text>
        </Focusable>

        {onDetails ? (
          <Focusable
            onPress={() => onDetails(item)}
            scaleFocused={1.05}
            style={s.btnDetails}
            focusedStyle={s.btnDetailsFocused}
          >
            <Info size={scale(15)} color="#ffffff" />
            <Text style={s.btnDetailsText}>Detalles</Text>
          </Focusable>
        ) : null}
      </View>
    </View>
  );
});

// ── Fila de Tendencia con banners panorámicos suaves ─────────────────────────
const TrendingRow = memo(function TrendingRow({
  items,
  onPress,
  onViewAll,
}: {
  items: NexoContentItem[];
  onPress: (item: NexoContentItem) => void;
  onViewAll?: () => void;
}) {
  const sidebarHandle = useSidebarHandle();

  return (
    <View style={s.contentSection}>
      <View style={s.sectionHeader}>
        <View style={s.sectionTitleGroup}>
          <View style={[s.sectionAccentBar, { backgroundColor: C.accent }]} />
          <Text style={s.sectionTitle}>Tendencia</Text>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={keyById}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowTrack}
        renderItem={({ item, index }) => (
          <Focusable
            onPress={() => onPress(item)}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
            trapFocusRight={!onViewAll && index === items.length - 1}
            scaleFocused={1.06}
            style={s.trendCard}
            focusedStyle={s.trendCardActiveBorder}
          >
            <RemoteImage
              uri={item.backdropUrl || item.posterUrl}
              style={StyleSheet.absoluteFill as any}
              contentFit="cover"
              transition={150}
            />
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
          </Focusable>
        )}
        ListFooterComponent={
          onViewAll ? (
            <View style={{ marginLeft: CARD_GAP }}>
              <ViewAllCard
                width={TREND_W}
                height={TREND_H}
                onPress={onViewAll}
                label="Ver todo"
                sublabel="Más populares"
                accentColor={C.accent}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
});


// ── Fila de Contenido Genérico (Poster Cards) ────────────────────────────────
const ContentRow = memo(function ContentRow({
  title,
  items,
  onPress,
  accentColor,
  onViewAll,
  viewAllSublabel,
}: {
  title: string;
  items: NexoContentItem[];
  onPress: (item: NexoContentItem) => void;
  accentColor?: string;
  onViewAll?: () => void;
  viewAllSublabel?: string;
}) {
  const sidebarHandle = useSidebarHandle();
  if (!items.length) return null;
  const accent = accentColor || C.accent;

  return (
    <View style={s.contentSection}>
      <View style={s.sectionHeader}>
        <View style={s.sectionTitleGroup}>
          <View style={[s.sectionAccentBar, { backgroundColor: accent }]} />
          <Text style={s.sectionTitle}>{title}</Text>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={keyById}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowTrack}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        renderItem={({ item, index }) => (
          <PosterCard
            item={item}
            width={POSTER_W}
            height={POSTER_H}
            onPressItem={onPress}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
            trapFocusRight={!onViewAll && index === items.length - 1}
          />
        )}
        ListFooterComponent={
          onViewAll ? (
            <View style={{ marginLeft: CARD_GAP }}>
              <ViewAllCard
                width={POSTER_W}
                height={POSTER_H}
                onPress={onViewAll}
                label="Ver todo"
                sublabel={viewAllSublabel || "Explorar catálogo"}
                accentColor={accent}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
});

// ── Continuar Viendo (Historial VOD) ──────────────────────────────────────────
const ContinueWatchingRow = memo(function ContinueWatchingRow({
  items,
  onPress,
}: {
  items: any[];
  onPress: (item: any) => void;
}) {
  const sidebarHandle = useSidebarHandle();
  if (!items || !items.length) return null;

  return (
    <View style={s.contentSection}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionAccentBar, { backgroundColor: C.accentOrange }]} />
        <Text style={s.sectionTitle}>Continuar viendo</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.slug || i.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowTrack}
        renderItem={({ item, index }) => (
          <Focusable
            onPress={() => onPress(item)}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
            trapFocusRight={index === items.length - 1}
            scaleFocused={1.06}
            style={s.continueCard}
            focusedStyle={s.continueCardFocused}
          >
            <View style={s.continueCardImgWrap}>
              {item.backdropUrl || item.posterUrl ? (
                <RemoteImage
                  uri={item.backdropUrl || item.posterUrl}
                  style={StyleSheet.absoluteFill as any}
                  contentFit="cover"
                />
              ) : (
                <View style={s.continueFallback}>
                  <Clapperboard size={scale(22)} color={C.textMuted} />
                </View>
              )}
            </View>
            {typeof item.progress === "number" ? (
              <View style={s.progressBarTrack}>
                <View
                  style={[
                    s.progressBarFill,
                    { width: `${Math.min(100, item.progress)}%` },
                  ]}
                />
              </View>
            ) : null}
            <View style={s.continueInfo}>
              <Text style={s.continueTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
          </Focusable>
        )}
      />
    </View>
  );
});

// ── PÁGINA PRINCIPAL TV ───────────────────────────────────────────────────────
export default function HomeTvScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Bangers: Bangers_400Regular });
  const { setActiveChannel } = useGlobal();

  const [loading, setLoading] = useState(true);
  const [heroItems, setHeroItems] = useState<NexoContentItem[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);

  // Secciones
  const [trending, setTrending] = useState<NexoContentItem[]>([]);
  const [recent, setRecent] = useState<NexoContentItem[]>([]);
  const [movies, setMovies] = useState<NexoContentItem[]>([]);
  const [series, setSeries] = useState<NexoContentItem[]>([]);
  const [anime, setAnime] = useState<NexoContentItem[]>([]);
  const [continueWatching] = useState<any[]>([]);

  // Hero actual seleccionado con debounce suave
  const activeHeroRaw = heroItems[heroIdx] ?? null;
  const currentHero = useDebouncedValue(activeHeroRaw, 200);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hp, mv, sr, an] = await Promise.all([
          getHomepage(),
          getContentList({ type: "MOVIE", limit: 20, sort: "recent" }),
          getContentList({ type: "SERIES", limit: 20, sort: "recent" }),
          getContentList({ type: "ANIME", limit: 20, sort: "recent" }),
        ]);
        if (cancelled) return;

        const heroes = hp.heroItems.length
          ? hp.heroItems
          : hp.trending.slice(0, 8);
        setHeroItems(heroes);
        setTrending(hp.trending.slice(0, 16));
        setRecent(hp.recent.slice(0, 18));
        setMovies(mv.slice(0, 18));
        setSeries(sr.slice(0, 18));
        setAnime(an.slice(0, 18));

        // Precarga de fondos del hero
        prefetchImages([
          ...heroes.map((h) => h.backdropUrl || h.posterUrl),
          ...hp.trending.slice(0, 6).map((h) => h.backdropUrl),
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

  // Rotación automática si el usuario no está navegando
  useEffect(() => {
    if (heroItems.length < 2 || userInteracted) return;
    const t = setInterval(() => {
      setHeroIdx((i) => (i + 1) % heroItems.length);
    }, 8500);
    return () => clearInterval(t);
  }, [heroItems.length, userInteracted]);

  // Reanudar rotación tras 25s de inactividad
  useEffect(() => {
    if (!userInteracted) return;
    const to = setTimeout(() => setUserInteracted(false), 25000);
    return () => clearTimeout(to);
  }, [userInteracted, heroIdx]);

  const selectHeroTimer = useRef<any>(null);
  useEffect(() => {
    return () => {
      if (selectHeroTimer.current) clearTimeout(selectHeroTimer.current);
    };
  }, []);
  const handleSelectHero = useCallback(
    (idx: number, _item?: NexoContentItem, immediate = false) => {
      setUserInteracted(true);
      if (selectHeroTimer.current) clearTimeout(selectHeroTimer.current);
      if (immediate) {
        setHeroIdx(idx);
      } else {
        selectHeroTimer.current = setTimeout(() => {
          setHeroIdx(idx);
        }, 100);
      }
    },
    [],
  );

  const handleContentPress = useCallback(
    (item: NexoContentItem) => {
      router.push({ pathname: "/detail", params: { slug: item.slug } } as any);
    },
    [router],
  );

  const handleChannelPress = useCallback(
    (ch: any) => {
      setActiveChannel(ch);
      router.push("/(tv)/channels" as any);
    },
    [router, setActiveChannel],
  );

  const handlePlay = useCallback(
    (item: NexoContentItem) => {
      router.push({ pathname: "/player", params: { slug: item.slug } } as any);
    },
    [router],
  );

  if (loading || !fontsLoaded) {
    return (
      <View style={s.loadWrap}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadText}>Cargando catálogo...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Fondo fijo dinámico con degradados cinematográficos y nube negra */}
      <BackdropBackground
        uri={currentHero?.backdropUrl || currentHero?.posterUrl}
        variant="home"
      />

      {/* ── 1. SECTOR HERO FIJO (INFO, TÍTULO, SINOPSIS Y BOTÓN REPRODUCIR) ── */}
      <View style={s.fixedHeroContainer}>
        {currentHero && (
          <HeroInfo
            item={currentHero}
            onPlay={handlePlay}
            onDetails={handleContentPress}
          />
        )}
      </View>

      {/* ── 2. SECTOR INFERIOR SCROLLABLE (PORTADAS DEL HERO + SECCIONES DE CATÁLOGO) ── */}
      <View style={s.bottomSectorContainer}>
        {/* Máscara de fundido superior para transición suave hacia el Hero */}
        <LinearGradient
          colors={["#080808", "rgba(8,8,8,0.75)", "rgba(8,8,8,0.2)", "transparent"]}
          locations={[0, 0.3, 0.7, 1]}
          style={s.bottomSectorTopFade}
          pointerEvents="none"
        />

        <ScrollView
          style={s.bottomScroll}
          contentContainerStyle={s.bottomScrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
        >
          {/* Cards de portadas del Hero (incluidas en el scroll con el resto) */}
          {heroItems.length > 0 && (
            <HeroSelector
              items={heroItems}
              activeIdx={heroIdx}
              onSelectHero={handleSelectHero}
            />
          )}

          <View style={s.contentArea}>
            {/* Continuar viendo si existe */}
            {continueWatching.length > 0 && (
              <ContinueWatchingRow
                items={continueWatching}
                onPress={handleContentPress}
              />
            )}

            {/* 1. Tendencia */}
            {trending.length > 0 && (
              <TrendingRow
                items={trending}
                onPress={handleContentPress}
                onViewAll={() =>
                  router.push({
                    pathname: "/(tv)/explore",
                    params: { sort: "popular" },
                  } as any)
                }
              />
            )}

            {/* 2. Películas recién agregadas */}
            <ContentRow
              title="Películas recién agregadas"
              items={movies}
              onPress={handleContentPress}
              accentColor={C.accentOrange}
              viewAllSublabel="Todas las películas"
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type: "MOVIE", sort: "recent" },
                } as any)
              }
            />

            {/* 3. Series recién agregadas */}
            <ContentRow
              title="Series recién agregadas"
              items={series}
              onPress={handleContentPress}
              accentColor={C.accentFire}
              viewAllSublabel="Todas las series"
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type: "SERIES", sort: "recent" },
                } as any)
              }
            />

            {/* 4. Agregados recientemente */}
            <ContentRow
              title="Agregados recientemente"
              items={recent}
              onPress={handleContentPress}
              accentColor={C.accent}
              viewAllSublabel="Todos los estrenos"
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { sort: "recent" },
                } as any)
              }
            />

            {/* 5. Anime y Animación */}
            {anime.length > 0 && (
              <ContentRow
                title="Anime y Animación"
                items={anime}
                onPress={handleContentPress}
                accentColor="#e11d63"
                viewAllSublabel="Todo el anime"
                onViewAll={() =>
                  router.push({
                    pathname: "/(tv)/explore",
                    params: { type: "ANIME" },
                  } as any)
                }
              />
            )}

            <View style={{ height: scale(40) }} />
          </View>
        </ScrollView>

        {/* Máscara de fundido inferior suave */}
        <LinearGradient
          colors={["transparent", "rgba(8,8,8,0.5)", "#080808"]}
          locations={[0, 0.5, 1]}
          style={s.bottomSectorBottomFade}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

// ── ESTILOS ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808", position: "relative" },

  loadWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(10),
    backgroundColor: "#080808",
  },
  loadText: { color: C.textSecondary, fontSize: scale(13) },

  // ── 1. Sector Hero Fijo (Tamaño Majestuoso Reducido Sutilmente) ──
  fixedHeroContainer: {
    paddingTop: scale(70),
    paddingBottom: scale(10),
    zIndex: 10,
  },

  heroInfo: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    maxWidth: scale(720),
    zIndex: 2,
  },

  taglineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(255, 183, 3, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.35)",
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(14),
    alignSelf: "flex-start",
    marginBottom: scale(8),
  },
  taglineChipText: {
    color: C.accent,
    fontSize: scale(11.5),
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  heroTitle: {
    fontFamily: "Bangers",
    fontSize: scale(50),
    color: C.accent,
    letterSpacing: 1,
    marginBottom: scale(8),
    lineHeight: scale(54),
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 8,
  },

  heroMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: scale(8),
  },
  heroMetaText: {
    fontSize: scale(14),
    color: "rgba(255,255,255,0.88)",
    fontWeight: "600",
  },

  heroBadges: {
    flexDirection: "row",
    gap: scale(8),
    marginBottom: scale(10),
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "rgba(40,40,40,0.75)",
    paddingHorizontal: scale(9),
    paddingVertical: scale(3),
    borderRadius: scale(5),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  badgeAccent: {
    borderColor: "rgba(255,183,3,0.45)",
    backgroundColor: "rgba(255,183,3,0.15)",
  },
  badgeText: { fontSize: scale(11.5), color: "#fff", fontWeight: "700" },

  heroDesc: {
    fontSize: scale(14),
    color: "rgba(255,255,255,0.85)",
    lineHeight: scale(20),
    marginBottom: scale(14),
    maxWidth: scale(680),
  },

  heroButtons: {
    flexDirection: "row",
    gap: scale(12),
  },
  btnPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    backgroundColor: C.accent,
    paddingHorizontal: scale(22),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnPlayFocused: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  btnPlayText: { color: "#000", fontSize: scale(14.5), fontWeight: "900" },

  btnDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: scale(20),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  btnDetailsFocused: {
    backgroundColor: "rgba(255,255,255,0.28)",
    borderColor: "#fff",
  },
  btnDetailsText: { color: "#fff", fontSize: scale(14), fontWeight: "800" },

  // ── Hero Selector (Cards de portada integradas al scroll) ──
  heroSelectorWrapper: {
    marginTop: scale(6),
    marginBottom: scale(10),
    paddingTop: scale(2),
  },
  heroSelectorHeading: {
    fontSize: scale(12),
    fontWeight: "900",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1.5,
    marginLeft: CONTENT_LEFT_PAD,
    marginBottom: scale(10),
  },
  heroSelectorTrack: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    paddingVertical: scale(6),
    gap: CARD_GAP,
    alignItems: "flex-end",
  },
  hsCard: {
    width: HS_CARD_W,
    height: HS_CARD_H,
    borderRadius: scale(10),
    overflow: "hidden",
    backgroundColor: "#161616",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
  },
  hsCardActive: {
    borderColor: C.accent,
  },
  hsCardFocused: {
    borderColor: "#ffffff",
    zIndex: 10,
  },
  hsCardInfo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: scale(10),
  },
  hsCardTitle: {
    color: "#fff",
    fontSize: scale(12),
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  hsCardSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: scale(10),
    marginTop: scale(2),
  },

  // ── 2. Sector Inferior Scrollable ──
  bottomSectorContainer: {
    flex: 1,
    position: "relative",
    zIndex: 5,
  },
  bottomSectorTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: scale(22),
    zIndex: 20,
  },
  bottomSectorBottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(16),
    zIndex: 20,
  },
  bottomScroll: {
    flex: 1,
  },
  bottomScrollContent: {
    paddingBottom: scale(28),
  },
  contentArea: {
    paddingTop: scale(8),
  },

  contentSection: {
    marginBottom: scale(16),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    marginBottom: scale(4),
  },
  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionAccentBar: {
    width: scale(4),
    height: scale(18),
    borderRadius: scale(2),
    marginRight: scale(10),
  },
  sectionTitle: {
    fontSize: scale(16.5),
    fontWeight: "800",
    color: C.textPrimary,
    letterSpacing: 0.3,
  },
  liveDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: C.live,
    marginLeft: scale(10),
  },
  headerViewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    paddingHorizontal: scale(14),
    paddingVertical: scale(6),
    borderRadius: scale(999),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  headerViewAllBtnFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  headerViewAllTxt: {
    fontSize: scale(12.5),
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  rowTrack: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    paddingVertical: scale(6),
    gap: CARD_GAP,
  },

  // ── Tendencia Suave y Fluida ──
  trendCard: {
    width: TREND_W,
    height: TREND_H,
    borderRadius: scale(10),
    overflow: "hidden",
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: "transparent",
  },
  trendCardActiveBorder: {
    borderColor: C.accent,
  },
  trendBannerGrad: {
    ...(StyleSheet.absoluteFill as any),
    justifyContent: "flex-end",
    padding: scale(8),
  },
  trendBannerTitle: {
    fontSize: scale(11.5),
    fontWeight: "900",
    color: C.accent,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  trendBannerSub: {
    fontSize: scale(9.5),
    color: "rgba(255,255,255,0.7)",
    marginTop: scale(2),
  },

  // ── Canales Card ──
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
    borderColor: C.live,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
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
    fontSize: scale(10.5),
    fontWeight: "700",
    color: C.textSecondary,
    textAlign: "center",
  },

  // ── Continuar Viendo Card ──
  continueCard: {
    width: CONT_CARD_W,
    height: CONT_CARD_H,
    borderRadius: scale(10),
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: C.borderSubtle,
    overflow: "hidden",
  },
  continueCardFocused: {
    borderColor: C.accent,
  },
  continueCardImgWrap: {
    flex: 1,
    backgroundColor: "#161616",
  },
  continueFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBarTrack: {
    height: scale(3.5),
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: C.accent,
  },
  continueInfo: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(5),
  },
  continueTitle: {
    fontSize: scale(11),
    fontWeight: "700",
    color: "#fff",
  },
});
