import { Bangers_400Regular, useFonts } from "@expo-google-fonts/bangers";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Play } from "lucide-react-native";
import { memo, startTransition, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  getContentList,
  getContentListSync,
  getHomepage,
  getHomepageSync,
  getPageCache,
  NexoContentItem,
  NexoHomepageData,
  setPageCache,
} from "../../services/nexoplay";

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
const CONTENT_LEFT_PAD = scale(112);

// Cards del selector de portadas dentro del Hero (tamaño uniforme vertical)
const HS_CARD_W = scale(116);
const HS_CARD_H = scale(162);

// Cards de secciones de catálogo (filas inferiores)
const POSTER_W = scale(112);
const POSTER_H = scale(160);
const CARD_GAP = scale(12);

const keyById = (i: any) => i.id;
const getHeroSelectorItemLayout = (_: any, index: number) => ({
  length: HS_CARD_W + CARD_GAP,
  offset: (HS_CARD_W + CARD_GAP) * index,
  index,
});
const getRowItemLayout = (_: any, index: number) => ({
  length: POSTER_W + CARD_GAP,
  offset: (POSTER_W + CARD_GAP) * index,
  index,
});

// ── HeroSelectorCard: card memoizada con tamaño fijo uniforme ──
const HeroSelectorCard = memo(function HeroSelectorCard({
  item,
  index,
  isActive,
  isLast,
  sidebarHandle,
  onSelectHero,
  onSectionFocus,
}: {
  item: NexoContentItem;
  index: number;
  isActive: boolean;
  isLast: boolean;
  sidebarHandle?: number | null;
  onSelectHero: (idx: number, item: NexoContentItem, immediate?: boolean) => void;
  onSectionFocus?: (key: string) => void;
}) {
  const handleFocus = useCallback(() => {
    onSelectHero(index, item, true);
    onSectionFocus?.("hero_selector");
  }, [onSelectHero, onSectionFocus, index, item]);
  const handlePress = useCallback(() => onSelectHero(index, item, true), [onSelectHero, index, item]);

  const posterUri = item.posterUrl || item.backdropUrl;

  return (
    <Focusable
      throttleMs={0}
      onFocus={handleFocus}
      onPress={handlePress}
      nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
      trapFocusRight={isLast}
      scaleFocused={1.05}
      style={[s.hsCard, isActive && s.hsCardActive]}
      focusedStyle={s.hsCardFocused}
    >
      {({ focused }) => {
        const showActive = isActive || focused;
        return (
          <View style={s.hsCardInner}>
            <RemoteImage
              uri={posterUri}
              style={StyleSheet.absoluteFill as any}
              contentFit="cover"
              contentPosition="center"
              transition={0}
              disableRecycling
            />

            {showActive ? (
              <>
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.88)"]}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.hsCardInfo}>
                  <Text style={s.hsCardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
              </>
            ) : (
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.22)"]}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
        );
      }}
    </Focusable>
  );
});

// ── HeroSelector: Tira de cards de portadas dentro del Hero ──
const HeroSelector = memo(function HeroSelector({
  items,
  activeIdx,
  userInteracted,
  onSelectHero,
  onSectionFocus,
}: {
  items: NexoContentItem[];
  activeIdx: number;
  userInteracted: boolean;
  onSelectHero: (idx: number, item: NexoContentItem, immediate?: boolean) => void;
  onSectionFocus?: (key: string) => void;
}) {
  const sidebarHandle = useSidebarHandle();
  const listRef = useRef<FlatList>(null);

  // Solo desplazar programáticamente durante la auto-rotación (cuando el usuario navega
  // con el D-pad, el motor nativo de Android TV desplaza la fila con fluidez sin cortes).
  useEffect(() => {
    if (!userInteracted && activeIdx >= 0 && items.length > 0) {
      try {
        listRef.current?.scrollToIndex({
          index: activeIdx,
          animated: true,
          viewPosition: 0.25,
        });
      } catch {}
    }
  }, [activeIdx, items.length, userInteracted]);

  const lastIdx = items.length - 1;
  const renderCard = useCallback(
    ({ item, index }: { item: NexoContentItem; index: number }) => (
      <HeroSelectorCard
        item={item}
        index={index}
        isActive={index === activeIdx}
        isLast={index === lastIdx}
        sidebarHandle={sidebarHandle}
        onSelectHero={onSelectHero}
        onSectionFocus={onSectionFocus}
      />
    ),
    [activeIdx, lastIdx, sidebarHandle, onSelectHero, onSectionFocus],
  );

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
        getItemLayout={getHeroSelectorItemLayout}
        style={{ overflow: "visible" }}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }}
        renderItem={renderCard}
      />
    </View>
  );
});

// ── HeroInfo: Título, Metadatos y Botón Principal en el Hero (Altura 100% Fija) ──
const HeroInfo = memo(function HeroInfo({
  item,
  onDetails,
  onHeroFocus,
}: {
  item: NexoContentItem;
  onDetails: (item: NexoContentItem) => void;
  onHeroFocus?: () => void;
}) {
  const sidebarHandle = useSidebarHandle();

  return (
    <View style={s.heroInfo} pointerEvents="box-none">
      {/* Título Principal (Caja de altura fija para no empujar ni subir nada) */}
      <View style={s.heroTitleBox}>
        <Text
          style={s.heroTitle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {item.title}
        </Text>
      </View>

      {/* Metadatos (Tipo • Género • Duración • Año) */}
      <View style={s.heroMeta}>
        <Text style={s.heroMetaText} numberOfLines={1}>
          {TYPE_LABEL[item.type] || item.type}
          {item.genres?.[0] ? ` • ${item.genres[0].name}` : ""}
          {item.duration ? ` • ${formatDuration(item.duration)}` : ""}
          {item.releaseYear ? ` • ${item.releaseYear}` : ""}
        </Text>
      </View>

      {/* Badges de calificación y lenguaje (Altura fija) */}
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

      {/* Sinopsis en contenedor de altura fija (4 líneas exactas siempre reservadas) */}
      <View style={s.heroDescBox}>
        <Text style={s.heroDesc} numberOfLines={4}>
          {item.description?.trim() || " "}
        </Text>
      </View>

      {/* Botón único general de acción (Posición vertical fija e inamovible) */}
      <View style={s.heroButtons}>
        <Focusable
          hasTVPreferredFocus
          onPress={() => onDetails(item)}
          onFocus={onHeroFocus}
          nextFocusLeft={sidebarHandle ?? undefined}
          trapFocusRight
          style={s.btnPlay}
          focusedStyle={s.btnPlayFocused}
        >
          {({ focused }) => (
            <>
              <Play size={scale(15)} color="#000000" fill="#000000" />
              <Text style={[s.btnPlayText, focused && { color: "#000000" }]}>
                Ver ahora
              </Text>
            </>
          )}
        </Focusable>
      </View>
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
  isLastSection,
}: {
  sectionKey: string;
  title: string;
  items: NexoContentItem[];
  onPress: (item: NexoContentItem) => void;
  accentColor?: string;
  onViewAll?: () => void;
  viewAllSublabel?: string;
  onSectionFocus?: (key: string) => void;
  isLastSection?: boolean;
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
        getItemLayout={getRowItemLayout}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={5}
        renderItem={({ item, index }) => (
          <PosterCard
            item={item}
            width={POSTER_W}
            height={POSTER_H}
            onPressItem={onPress}
            onFocusItem={handleCardFocus}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
            trapFocusLeft={index === 0 && !sidebarHandle}
            trapFocusRight={!onViewAll && index === items.length - 1}
            trapFocusDown={isLastSection}
          />
        )}
        ListFooterComponent={
          onViewAll ? (
            <View style={{ marginLeft: CARD_GAP }}>
              <ViewAllCard
                width={POSTER_W}
                height={POSTER_H}
                onPress={onViewAll}
                onFocus={handleCardFocus}
                label="Ver todo"
                sublabel={viewAllSublabel}
                accentColor={accent}
                trapFocusDown={isLastSection}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
});

interface HomePageState {
  heroItems: NexoContentItem[];
  movies: NexoContentItem[];
  series: NexoContentItem[];
}

function buildHomePageState(
  hp: NexoHomepageData,
  mv: NexoContentItem[],
  sr: NexoContentItem[],
  an: NexoContentItem[],
): HomePageState {
  const currentYear = new Date().getFullYear();
  const isCurrentYear = (x: NexoContentItem) =>
    Boolean(x && (x.releaseYear || 0) >= currentYear);

  const mvCur = mv.filter(isCurrentYear);
  const srCur = sr.filter(isCurrentYear);
  const anCur = an.filter(isCurrentYear);
  const hpCur = (hp.heroItems || []).filter(isCurrentYear);

  const seenHero = new Set<string>();
  const heroCandidateList: NexoContentItem[] = [];
  const addHero = (item?: NexoContentItem) => {
    if (!item || !item.id || seenHero.has(item.id)) return;
    if (!item.backdropUrl && !item.posterUrl) return;
    seenHero.add(item.id);
    heroCandidateList.push(item);
  };

  for (const h of hpCur) addHero(h);
  const maxLen = Math.max(mvCur.length, srCur.length, anCur.length);
  for (let i = 0; i < maxLen && heroCandidateList.length < 12; i++) {
    addHero(mvCur[i]);
    addHero(srCur[i]);
    addHero(anCur[i]);
  }

  const heroes =
    heroCandidateList.length > 0
      ? heroCandidateList.slice(0, 12)
      : (hp.heroItems.length ? hp.heroItems : hp.trending).slice(0, 8);

  return {
    heroItems: heroes,
    movies: (mvCur.length > 0 ? mvCur : mv).slice(0, 18),
    series: (srCur.length > 0 ? srCur : sr).slice(0, 18),
  };
}

function getInitialHomeState(): HomePageState | null {
  const cached = getPageCache<HomePageState>("page:home");
  if (cached) return cached;
  const hp = getHomepageSync();
  const mv = getContentListSync({ type: "MOVIE", limit: 45, sort: "recent" });
  const sr = getContentListSync({ type: "SERIES", limit: 45, sort: "recent" });
  const an = getContentListSync({ type: "ANIME", limit: 45, sort: "recent" });
  if (hp && mv && sr && an) {
    const built = buildHomePageState(hp, mv, sr, an);
    setPageCache("page:home", built);
    return built;
  }
  return null;
}

// ── PÁGINA PRINCIPAL TV ───────────────────────────────────────────────────────
export default function HomeTvScreen() {
  const router = useRouter();
  useFonts({ Bangers: Bangers_400Regular });

  const initialData = useRef(getInitialHomeState()).current;
  const [loading, setLoading] = useState(!initialData);
  const [heroItems, setHeroItems] = useState<NexoContentItem[]>(
    initialData?.heroItems ?? [],
  );
  const [heroIdx, setHeroIdx] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);

  // Secciones (solo películas y series recién agregadas)
  const [movies, setMovies] = useState<NexoContentItem[]>(
    initialData?.movies ?? [],
  );
  const [series, setSeries] = useState<NexoContentItem[]>(
    initialData?.series ?? [],
  );

  // Hero actual seleccionado
  const currentHero = heroItems[heroIdx] ?? null;

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
      if (!scrollRef.current) return;
      if (sectionKey === "hero_selector") {
        scrollRef.current.scrollTo({ y: 0, animated: true });
        return;
      }
      if (sectionKey === "series") {
        scrollRef.current.scrollToEnd({ animated: true });
        return;
      }
      const targetY = sectionLayouts.current[sectionKey];
      if (typeof targetY === "number") {
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
    if (initialData) return;
    let cancelled = false;
    (async () => {
      try {
        const [hp, mv, sr, an] = await Promise.all([
          getHomepage(),
          getContentList({ type: "MOVIE", limit: 45, sort: "recent" }),
          getContentList({ type: "SERIES", limit: 45, sort: "recent" }),
          getContentList({ type: "ANIME", limit: 45, sort: "recent" }),
        ]);
        if (cancelled) return;

        const built = buildHomePageState(hp, mv, sr, an);
        setPageCache("page:home", built);

        setHeroItems(built.heroItems);
        setMovies(built.movies);
        setSeries(built.series);

        // Precarga de fondos y posters del hero para crossfade instantáneo
        prefetchImages([
          ...built.heroItems.map((h) => h.backdropUrl),
          ...built.heroItems.map((h) => h.posterUrl),
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
  }, [initialData]);

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
        // Prioridad baja: el foco nativo y el realce de la card responden al instante,
        // y el resto del Hero (fondo, título) se actualiza sin bloquear la navegación.
        startTransition(() => setHeroIdx(idx));
      } else {
        selectHeroTimer.current = setTimeout(() => {
          setHeroIdx(idx);
        }, 75);
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

  if (loading && heroItems.length === 0) {
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

      {/* ── 1. SECTOR HERO FIJO (INFO, TÍTULO, SINOPSIS Y BOTÓN PRINCIPAL) ── */}
      <View style={s.fixedHeroContainer}>
        {currentHero && (
          <HeroInfo
            item={currentHero}
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
                userInteracted={userInteracted}
                onSelectHero={handleSelectHero}
                onSectionFocus={handleSectionFocus}
              />
            </View>
          )}

          {/* 1. Películas recién agregadas */}
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
              isLastSection={series.length === 0}
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type: "MOVIE", sort: "recent" },
                } as any)
              }
            />
          </View>

          {/* 2. Series recién agregadas */}
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
              isLastSection={true}
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type: "SERIES", sort: "recent" },
                } as any)
              }
            />
          </View>
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

  // ── 1. Sector Hero Fijo (Altura bloqueada para que nunca suban ni bajen botones ni cards) ──
  fixedHeroContainer: {
    height: scale(296),
    paddingTop: scale(48),
    paddingBottom: scale(10),
    justifyContent: "flex-start",
    zIndex: 10,
  },

  heroInfo: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    maxWidth: scale(700),
    height: scale(238),
    justifyContent: "flex-start",
    zIndex: 2,
  },

  heroTitleBox: {
    height: scale(44),
    justifyContent: "center",
    marginBottom: scale(12),
  },

  heroTitle: {
    fontFamily: "Bangers",
    fontSize: scale(35),
    color: C.accent,
    letterSpacing: 0.8,
    lineHeight: scale(40),
    includeFontPadding: false,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 8,
  },

  heroMeta: {
    height: scale(20),
    flexDirection: "row",
    alignItems: "center",
    marginBottom: scale(6),
  },
  heroMetaText: {
    fontSize: scale(13.5),
    color: "rgba(255,255,255,0.88)",
    fontWeight: "600",
  },

  heroBadges: {
    height: scale(24),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginBottom: scale(8),
  },
  badge: {
    backgroundColor: "rgba(40,40,40,0.75)",
    paddingHorizontal: scale(9),
    paddingVertical: scale(2.5),
    borderRadius: scale(5),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  badgeAccent: {
    borderColor: "rgba(255,183,3,0.45)",
    backgroundColor: "rgba(255,183,3,0.15)",
  },
  badgeText: { fontSize: scale(11.5), color: "#fff", fontWeight: "700" },

  heroDescBox: {
    height: scale(74),
    justifyContent: "flex-start",
    marginBottom: scale(12),
    maxWidth: scale(470),
  },

  heroDesc: {
    fontSize: scale(13.5),
    color: "rgba(255,255,255,0.85)",
    lineHeight: scale(18.5),
    maxWidth: scale(470),
  },

  heroButtons: {
    height: scale(41),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
  },
  btnPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: C.accent,
    paddingHorizontal: scale(22),
    height: scale(41),
    borderRadius: scale(9),
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnPlayFocused: {
    backgroundColor: "#ffffff",
    borderColor: C.accent,
  },
  btnPlayText: { color: "#000000", fontSize: scale(14), fontWeight: "900" },

  // ── Hero Selector (Cards de portada integradas al scroll con mismo tamaño fijo) ──
  heroSelectorWrapper: {
    marginTop: scale(12),
    marginBottom: scale(8),
    paddingTop: scale(6),
    overflow: "visible",
  },
  heroSelectorTrack: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    paddingVertical: scale(8),
    gap: CARD_GAP,
    alignItems: "center",
  },
  hsCard: {
    width: HS_CARD_W,
    height: HS_CARD_H,
    borderRadius: scale(10),
    backgroundColor: "#161616",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
  },
  hsCardInner: {
    flex: 1,
    borderRadius: scale(8),
    overflow: "hidden",
    backgroundColor: "#161616",
    position: "relative",
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
    paddingHorizontal: scale(8),
    paddingVertical: scale(6),
  },
  hsCardTitle: {
    color: "#fff",
    fontSize: scale(11.5),
    fontWeight: "800",
    letterSpacing: 0.2,
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
    paddingBottom: scale(16),
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
});
