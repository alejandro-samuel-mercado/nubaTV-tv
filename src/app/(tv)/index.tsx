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

// Cards del selector de portadas dentro del Hero (diseño dinámico: vertical inactivo, horizontal expandido activo 16:9)
const HS_CARD_W = scale(105);
const HS_CARD_ACTIVE_W = scale(250);
const HS_CARD_H = scale(135);

// Cards de secciones de catálogo (filas inferiores)
const POSTER_W = scale(112);
const POSTER_H = scale(160);
const CARD_GAP = scale(12);
const TREND_W = scale(215);
const TREND_H = scale(122);
const CONT_CARD_W = scale(190);
const CONT_CARD_H = scale(115);

const keyById = (i: any) => i.id;

// ── HeroSelector: Tira de cards de portadas dentro del Hero ──
const HeroSelector = memo(function HeroSelector({
  items,
  activeIdx,
  onSelectHero,
  onSectionFocus,
}: {
  items: NexoContentItem[];
  activeIdx: number;
  onSelectHero: (idx: number, item: NexoContentItem, immediate?: boolean) => void;
  onSectionFocus?: (key: string) => void;
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
        style={{ overflow: "visible" }}
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
          const isWidePosterFallback = isActive && !item.backdropUrl && !!item.posterUrl;

          return (
            <Focusable
              onFocus={() => {
                onSelectHero(index, item, false);
                onSectionFocus?.("hero_selector");
              }}
              onPress={() => onSelectHero(index, item, true)}
              nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
              trapFocusRight={index === items.length - 1}
              scaleFocused={1.02}
              style={[
                s.hsCard,
                isActive && s.hsCardActive,
              ]}
              focusedStyle={s.hsCardFocused}
            >
              {isWidePosterFallback ? (
                <>
                  <RemoteImage
                    uri={item.posterUrl}
                    style={StyleSheet.absoluteFill as any}
                    contentFit="cover"
                    blurRadius={16}
                    transition={180}
                  />
                  <RemoteImage
                    uri={item.posterUrl}
                    style={StyleSheet.absoluteFill as any}
                    contentFit="contain"
                    contentPosition="center"
                    transition={180}
                  />
                </>
              ) : (
                <RemoteImage
                  uri={bgImg}
                  style={StyleSheet.absoluteFill as any}
                  contentFit="cover"
                  contentPosition="center"
                  transition={180}
                />
              )}
              {isActive ? (
                <>
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.92)"]}
                    locations={[0, 0.45, 1]}
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
                </>
              ) : (
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.25)"]}
                  style={StyleSheet.absoluteFill}
                />
              )}
            </Focusable>
          );
        }}
      />
    </View>
  );
});

// ── HeroInfo: Título, Metadatos y Botones de Reproducción en el Hero ──────────
const HeroInfo = memo(function HeroInfo({
  item,
  onPlay,
  onDetails,
  onHeroFocus,
}: {
  item: NexoContentItem;
  onPlay: (item: NexoContentItem) => void;
  onDetails?: (item: NexoContentItem) => void;
  onHeroFocus?: () => void;
}) {
  const sidebarHandle = useSidebarHandle();

  return (
    <View style={s.heroInfo} pointerEvents="box-none">
      {/* Tagline / Tipo Chip */}
      <View style={s.taglineChip}>
        <Sparkles size={scale(8.5)} color="#f59e0b" />
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

      {/* Sinopsis concisa (2 líneas para dejar espacio limpio al catálogo inferior) */}
      {item.description ? (
        <Text style={s.heroDesc} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      {/* Botones de acción */}
      <View style={s.heroButtons}>
        <Focusable
          hasTVPreferredFocus
          onPress={() => onPlay(item)}
          onFocus={onHeroFocus}
          nextFocusLeft={sidebarHandle ?? undefined}
          style={s.btnPlay}
          focusedStyle={s.btnPlayFocused}
        >
          <Play size={scale(12)} color="#000" fill="#000" />
          <Text style={s.btnPlayText}>Reproducir</Text>
        </Focusable>

        {onDetails ? (
          <Focusable
            onPress={() => onDetails(item)}
            onFocus={onHeroFocus}
            style={s.btnDetails}
            focusedStyle={s.btnDetailsFocused}
          >
            <Info size={scale(12)} color="#ffffff" />
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
  onSectionFocus,
}: {
  items: NexoContentItem[];
  onPress: (item: NexoContentItem) => void;
  onViewAll?: () => void;
  onSectionFocus?: (key: string) => void;
}) {
  const sidebarHandle = useSidebarHandle();

  const handleCardFocus = useCallback(() => {
    onSectionFocus?.("trending");
  }, [onSectionFocus]);

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
        style={{ overflow: "visible" }}
        renderItem={({ item, index }) => (
          <Focusable
            onPress={() => onPress(item)}
            onFocus={handleCardFocus}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
            trapFocusRight={!onViewAll && index === items.length - 1}
            scaleFocused={1.02}
            style={s.trendCard}
            focusedStyle={s.trendCardActiveBorder}
          >
            <RemoteImage
              uri={item.backdropUrl || item.posterUrl}
              style={StyleSheet.absoluteFill as any}
              contentFit="cover"
              contentPosition="center"
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
  sectionKey,
  title,
  items,
  onPress,
  accentColor,
  onViewAll,
  viewAllSublabel,
  onSectionFocus,
}: {
  sectionKey: string;
  title: string;
  items: NexoContentItem[];
  onPress: (item: NexoContentItem) => void;
  accentColor?: string;
  onViewAll?: () => void;
  viewAllSublabel?: string;
  onSectionFocus?: (key: string) => void;
}) {
  const sidebarHandle = useSidebarHandle();
  if (!items.length) return null;
  const accent = accentColor || C.accent;

  const handleCardFocus = useCallback(() => {
    onSectionFocus?.(sectionKey);
  }, [onSectionFocus, sectionKey]);

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
        style={{ overflow: "visible" }}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        renderItem={({ item, index }) => (
          <PosterCard
            item={item}
            width={POSTER_W}
            height={POSTER_H}
            onPressItem={onPress}
            onFocusItem={handleCardFocus}
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
  onSectionFocus,
}: {
  items: any[];
  onPress: (item: any) => void;
  onSectionFocus?: (key: string) => void;
}) {
  const sidebarHandle = useSidebarHandle();
  if (!items || !items.length) return null;

  const handleCardFocus = useCallback(() => {
    onSectionFocus?.("continue");
  }, [onSectionFocus]);

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
        style={{ overflow: "visible" }}
        renderItem={({ item, index }) => (
          <Focusable
            onPress={() => onPress(item)}
            onFocus={handleCardFocus}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
            trapFocusRight={index === items.length - 1}
            scaleFocused={1.02}
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

  // ── Control de Scroll y Alineación Perfecta de Secciones al Navegar ───────────
  const scrollRef = useRef<ScrollView>(null);
  const sectionLayouts = useRef<Record<string, number>>({});
  const activeSectionRef = useRef<string | null>(null);
  const scrollAnimationTimer = useRef<any>(null);

  const handleSectionFocus = useCallback((sectionKey: string) => {
    if (activeSectionRef.current === sectionKey) return;
    activeSectionRef.current = sectionKey;

    if (scrollAnimationTimer.current) clearTimeout(scrollAnimationTimer.current);

    scrollAnimationTimer.current = setTimeout(() => {
      const targetY = sectionLayouts.current[sectionKey];
      if (typeof targetY === "number" && scrollRef.current) {
        // Offset de scale(10) para dejar margen superior de respiro y encuadrar título + cards
        const scrollY = Math.max(0, targetY - scale(10));
        scrollRef.current.scrollTo({
          y: scrollY,
          animated: true,
        });
      }
    }, 40);
  }, []);

  const handleHeroFocus = useCallback(() => {
    if (activeSectionRef.current === "hero") return;
    activeSectionRef.current = "hero";

    if (scrollAnimationTimer.current) clearTimeout(scrollAnimationTimer.current);
    scrollAnimationTimer.current = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: 0,
        animated: true,
      });
    }, 40);
  }, []);

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
      if (scrollAnimationTimer.current) clearTimeout(scrollAnimationTimer.current);
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
            onHeroFocus={handleHeroFocus}
          />
        )}
      </View>

      {/* ── 2. SECTOR INFERIOR SCROLLABLE (PORTADAS DEL HERO + SECCIONES DE CATÁLOGO) ── */}
      <View style={s.bottomSectorContainer}>
        <ScrollView
          ref={scrollRef}
          style={s.bottomScroll}
          contentContainerStyle={s.bottomScrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
        >
          {/* Cards de portadas del Hero (sección 0 en el scroll) */}
          {heroItems.length > 0 && (
            <View
              onLayout={(e) => {
                sectionLayouts.current["hero_selector"] = e.nativeEvent.layout.y;
              }}
            >
              <HeroSelector
                items={heroItems}
                activeIdx={heroIdx}
                onSelectHero={handleSelectHero}
                onSectionFocus={handleSectionFocus}
              />
            </View>
          )}

          {/* Continuar viendo si existe */}
          {continueWatching.length > 0 && (
            <View
              onLayout={(e) => {
                sectionLayouts.current["continue"] = e.nativeEvent.layout.y;
              }}
            >
              <ContinueWatchingRow
                items={continueWatching}
                onPress={handleContentPress}
                onSectionFocus={handleSectionFocus}
              />
            </View>
          )}

          {/* 1. Tendencia */}
          {trending.length > 0 && (
            <View
              onLayout={(e) => {
                sectionLayouts.current["trending"] = e.nativeEvent.layout.y;
              }}
            >
              <TrendingRow
                items={trending}
                onPress={handleContentPress}
                onSectionFocus={handleSectionFocus}
                onViewAll={() =>
                  router.push({
                    pathname: "/(tv)/explore",
                    params: { sort: "popular" },
                  } as any)
                }
              />
            </View>
          )}

          {/* 2. Películas recién agregadas */}
          <View
            onLayout={(e) => {
              sectionLayouts.current["movies"] = e.nativeEvent.layout.y;
            }}
          >
            <ContentRow
              sectionKey="movies"
              title="Películas recién agregadas"
              items={movies}
              onPress={handleContentPress}
              accentColor={C.accentOrange}
              viewAllSublabel="Todas las películas"
              onSectionFocus={handleSectionFocus}
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type: "MOVIE", sort: "recent" },
                } as any)
              }
            />
          </View>

          {/* 3. Series recién agregadas */}
          <View
            onLayout={(e) => {
              sectionLayouts.current["series"] = e.nativeEvent.layout.y;
            }}
          >
            <ContentRow
              sectionKey="series"
              title="Series recién agregadas"
              items={series}
              onPress={handleContentPress}
              accentColor={C.accentFire}
              viewAllSublabel="Todas las series"
              onSectionFocus={handleSectionFocus}
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type: "SERIES", sort: "recent" },
                } as any)
              }
            />
          </View>

          {/* 4. Agregados recientemente */}
          <View
            onLayout={(e) => {
              sectionLayouts.current["recent"] = e.nativeEvent.layout.y;
            }}
          >
            <ContentRow
              sectionKey="recent"
              title="Agregados recientemente"
              items={recent}
              onPress={handleContentPress}
              accentColor={C.accent}
              viewAllSublabel="Todos los estrenos"
              onSectionFocus={handleSectionFocus}
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { sort: "recent" },
                } as any)
              }
            />
          </View>

          {/* 5. Anime y Animación */}
          {anime.length > 0 && (
            <View
              onLayout={(e) => {
                sectionLayouts.current["anime"] = e.nativeEvent.layout.y;
              }}
            >
              <ContentRow
                sectionKey="anime"
                title="Anime y Animación"
                items={anime}
                onPress={handleContentPress}
                accentColor="#e11d63"
                viewAllSublabel="Todo el anime"
                onSectionFocus={handleSectionFocus}
                onViewAll={() =>
                  router.push({
                    pathname: "/(tv)/explore",
                    params: { type: "ANIME" },
                  } as any)
                }
              />
            </View>
          )}
        </ScrollView>
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

  // ── 1. Sector Hero Fijo (Tamaño Proporcionado y Elegante) ──
  fixedHeroContainer: {
    paddingTop: scale(40),
    paddingBottom: scale(4),
    zIndex: 10,
  },

  heroInfo: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    maxWidth: scale(600),
    zIndex: 2,
  },

  taglineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4.5),
    backgroundColor: "rgba(255, 183, 3, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.35)",
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(10),
    alignSelf: "flex-start",
    marginBottom: scale(5),
  },
  taglineChipText: {
    color: C.accent,
    fontSize: scale(9.5),
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  heroTitle: {
    fontFamily: "Bangers",
    fontSize: scale(28),
    color: C.accent,
    letterSpacing: 0.8,
    marginBottom: scale(4),
    lineHeight: scale(30),
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
  },

  heroMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: scale(4),
  },
  heroMetaText: {
    fontSize: scale(11.5),
    color: "rgba(255,255,255,0.88)",
    fontWeight: "600",
  },

  heroBadges: {
    flexDirection: "row",
    gap: scale(5),
    marginBottom: scale(6),
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "rgba(40,40,40,0.75)",
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  badgeAccent: {
    borderColor: "rgba(255,183,3,0.45)",
    backgroundColor: "rgba(255,183,3,0.15)",
  },
  badgeText: { fontSize: scale(9.5), color: "#fff", fontWeight: "700" },

  heroDesc: {
    fontSize: scale(11.5),
    color: "rgba(255,255,255,0.85)",
    lineHeight: scale(16),
    marginBottom: scale(10),
    maxWidth: scale(580),
  },

  heroButtons: {
    flexDirection: "row",
    gap: scale(8),
  },
  btnPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: C.accent,
    paddingHorizontal: scale(16),
    height: scale(34),
    borderRadius: scale(7),
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnPlayFocused: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  btnPlayText: { color: "#000", fontSize: scale(12), fontWeight: "900" },

  btnDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: scale(14),
    height: scale(34),
    borderRadius: scale(7),
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  btnDetailsFocused: {
    backgroundColor: "rgba(255,255,255,0.28)",
    borderColor: "#fff",
  },
  btnDetailsText: { color: "#fff", fontSize: scale(12), fontWeight: "800" },

  // ── Hero Selector (Cards de portada integradas al scroll) ──
  heroSelectorWrapper: {
    marginTop: scale(2),
    marginBottom: scale(10),
    paddingTop: scale(4),
    overflow: "visible",
  },
  heroSelectorTrack: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    paddingVertical: scale(8),
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
    width: HS_CARD_ACTIVE_W,
    borderColor: C.accent,
    shadowColor: C.accent,
    shadowOpacity: 0.45,
    shadowRadius: scale(8),
    elevation: 8,
  },
  hsCardFocused: {
    borderColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOpacity: 0.5,
    shadowRadius: scale(8),
    elevation: 10,
    zIndex: 10,
  },
  hsCardInfo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: scale(8),
  },
  hsCardTitle: {
    color: "#fff",
    fontSize: scale(11.5),
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  hsCardSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: scale(9.5),
    marginTop: scale(1.5),
  },

  // ── 2. Sector Inferior Scrollable ──
  bottomSectorContainer: {
    flex: 1,
    position: "relative",
    zIndex: 5,
  },
  bottomScroll: {
    flex: 1,
  },
  bottomScrollContent: {
    paddingBottom: scale(220),
  },

  contentSection: {
    marginBottom: scale(20),
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
    width: scale(3.5),
    height: scale(16),
    borderRadius: scale(2),
    marginRight: scale(8),
  },
  sectionTitle: {
    fontSize: scale(15),
    fontWeight: "800",
    color: C.textPrimary,
    letterSpacing: 0.3,
  },

  rowTrack: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    paddingVertical: scale(8),
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
    borderColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOpacity: 0.4,
    shadowRadius: scale(8),
    elevation: 8,
  },
  trendBannerGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
  },
  trendBannerTitle: {
    color: "#ffffff",
    fontSize: scale(11.5),
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  trendBannerSub: {
    color: C.accent,
    fontSize: scale(10),
    fontWeight: "700",
    marginTop: scale(2),
  },

  // ── Continuar Viendo ──
  continueCard: {
    width: CONT_CARD_W,
    height: CONT_CARD_H,
    borderRadius: scale(10),
    overflow: "hidden",
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: "transparent",
  },
  continueCardFocused: {
    borderColor: "#ffffff",
    elevation: 6,
  },
  continueCardImgWrap: {
    width: "100%",
    height: scale(88),
    backgroundColor: "#111",
  },
  continueFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBarTrack: {
    height: scale(3),
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: C.accentOrange,
  },
  continueInfo: {
    padding: scale(6),
  },
  continueTitle: {
    color: C.textPrimary,
    fontSize: scale(11),
    fontWeight: "700",
  },
});
