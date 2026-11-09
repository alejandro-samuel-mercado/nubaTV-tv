import { Bangers_400Regular, useFonts } from "@expo-google-fonts/bangers";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowRight, Compass, Info, Play, Sparkles, Star } from "lucide-react-native";
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
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import { getContentList, NexoContentItem } from "../../services/nexoplay";
import BackdropBackground from "./BackdropBackground";
import Focusable from "./Focusable";
import PosterCard from "./PosterCard";
import RemoteImage, { prefetchImages } from "./RemoteImage";
import ViewAllCard from "./ViewAllCard";

const { height: SH } = Dimensions.get("window");

const SIDEBAR_OFFSET = scale(64);
const CARD_GAP = scale(14);
const CONTENT_LEFT_PAD = scale(112);
const HERO_CONTAINER_H = Math.max(scale(580), Math.round(SH * 0.82));

// Cards del selector de portadas dentro del Hero (reducido sutilmente y uniforme)
const HS_CARD_W = scale(170);
const HS_CARD_H = scale(110);

// Cards de secciones
const TREND_W = scale(220);
const TREND_H = scale(135);
const POSTER_W = scale(115);
const POSTER_H = scale(165);

const GENRE_ACCENTS = [
  "#f97316",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#eab308",
];

const CATEGORY_META: Record<
  string,
  {
    plural: string;
    eyebrow: string;
    trendingTitle: string;
    premieresTitle: string;
    recentTitle: string;
    topRatedTitle: string;
    ctaTitle: string;
    ctaSub: string;
    accentColor: string;
    accentColorAlt: string;
  }
> = {
  MOVIE: {
    plural: "Películas",
    eyebrow: "PELÍCULAS DESTACADAS",
    trendingTitle: "Películas en tendencia",
    premieresTitle: "Estrenos de películas",
    recentTitle: "Películas recién agregadas",
    topRatedTitle: "Películas mejor valoradas",
    ctaTitle: "¿Buscas más películas?",
    ctaSub:
      "Explora el catálogo completo con filtros por género, valoración y orden.",
    accentColor: "#f59e0b",
    accentColorAlt: "#ff5500",
  },
  SERIES: {
    plural: "Series",
    eyebrow: "SERIES DESTACADAS",
    trendingTitle: "Series en tendencia",
    premieresTitle: "Estrenos de series",
    recentTitle: "Series recién agregadas",
    topRatedTitle: "Series mejor valoradas",
    ctaTitle: "¿Buscas más series?",
    ctaSub:
      "Descubre todas las series disponibles filtrando por género, popularidad o calificación.",
    accentColor: "#3b82f6",
    accentColorAlt: "#ec4899",
  },
  ANIME: {
    plural: "Anime",
    eyebrow: "ANIME DESTACADO",
    trendingTitle: "Anime en tendencia",
    premieresTitle: "Últimos estrenos de anime",
    recentTitle: "Anime recién agregado",
    topRatedTitle: "Anime mejor valorado",
    ctaTitle: "¿Buscas más anime?",
    ctaSub:
      "Recorre todo el catálogo de anime con búsqueda avanzada y filtros.",
    accentColor: "#a855f7",
    accentColorAlt: "#06b6d4",
  },
  DOCUMENTARY: {
    plural: "Documentales",
    eyebrow: "DOCUMENTALES DESTACADOS",
    trendingTitle: "Documentales en tendencia",
    premieresTitle: "Estrenos documentales",
    recentTitle: "Documentales recién agregados",
    topRatedTitle: "Documentales mejor valorados",
    ctaTitle: "¿Buscas más documentales?",
    ctaSub:
      "Explora todos los documentales disponibles en el catálogo completo.",
    accentColor: "#10b981",
    accentColorAlt: "#14b8a6",
  },
};

const DEFAULT_META = {
  plural: "Contenido",
  eyebrow: "DESTACADOS",
  trendingTitle: "En tendencia",
  premieresTitle: "Últimos estrenos",
  recentTitle: "Recién agregados",
  topRatedTitle: "Mejor valorados",
  ctaTitle: "¿Buscas más títulos?",
  ctaSub: "Explora todo el catálogo disponible con filtros avanzados.",
  accentColor: C.accent,
  accentColorAlt: C.accentOrange,
};

const formatDuration = (mins?: number) => {
  if (!mins) return "";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const keyById = (i: NexoContentItem) => i.id;

function shuffleArray<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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
        } catch {}
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
              scaleFocused={1.02}
              style={[s.hsCard, isActive && s.hsCardActive]}
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
                  {item.genres?.[0]?.name || item.type}
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

// ── Fila de Tendencias (Banners panorámicos con resorte suave) ──
const TrendingRow = memo(function TrendingRow({
  title,
  items,
  onPress,
  onViewAll,
}: {
  title: string;
  items: NexoContentItem[];
  onPress: (item: NexoContentItem) => void;
  onViewAll?: () => void;
}) {
  const sidebarHandle = useSidebarHandle();
  if (!items.length) return null;

  return (
    <View style={s.contentSection}>
      <View style={s.sectionHeader}>
        <View style={s.sectionTitleGroup}>
          <View style={[s.sectionAccentBar, { backgroundColor: C.accent }]} />
          <Text style={s.sectionTitle}>{title}</Text>
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
            scaleFocused={1.02}
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

// ── Fila de Contenido Genérico (Poster Cards) ──
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

/**
 * Pantalla completa de catálogo (/series, /peliculas y otros tipos).
 * - Hero interactivo estilo Home con información, selector de portadas y botón de reproducir.
 * - Muestra la portada real uncropped a la derecha dentro del hero.
 * - Múltiples secciones reales debajo del hero extraídas de la API (Tendencia, Estrenos, Recientes, Mejor valoradas, y Filas dinámicas por género).
 */
export default function CatalogScreen({
  type,
  typeLabel,
  sectionTitle,
}: {
  type: "MOVIE" | "SERIES" | "ANIME" | "DOCUMENTARY" | string;
  typeLabel: string;
  sectionTitle?: string;
}) {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();
  const [fontsLoaded] = useFonts({ Bangers: Bangers_400Regular });

  const [loading, setLoading] = useState(true);
  const [heroItems, setHeroItems] = useState<NexoContentItem[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [userSelected, setUserSelected] = useState(false);

  const [trending, setTrending] = useState<NexoContentItem[]>([]);
  const [premieres, setPremieres] = useState<NexoContentItem[]>([]);
  const [recent, setRecent] = useState<NexoContentItem[]>([]);
  const [topRated, setTopRated] = useState<NexoContentItem[]>([]);
  const [genreRows, setGenreRows] = useState<
    { genre: string; items: NexoContentItem[] }[]
  >([]);

  const meta = CATEGORY_META[type] || DEFAULT_META;

  // Carga paralela de datos reales igual que la versión web
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHeroIdx(0);
    setUserSelected(false);

    (async () => {
      try {
        const [popRes, recRes, ratRes, recPage2] = await Promise.all([
          getContentList({ type, sort: "popular", limit: 24, page: 1 }),
          getContentList({ type, sort: "recent", limit: 24, page: 1 }),
          getContentList({ type, sort: "rating", limit: 24, page: 1 }),
          getContentList({ type, sort: "recent", limit: 24, page: 2 }),
        ]);

        if (cancelled) return;

        // Pool de ítems únicos estrictamente del tipo solicitado
        const poolMap = new Map<string, NexoContentItem>();
        for (const it of [...recRes, ...popRes, ...ratRes, ...recPage2]) {
          if (type && it.type !== type) continue;
          if (!poolMap.has(it.id)) poolMap.set(it.id, it);
        }
        const allItems = Array.from(poolMap.values());

        // 1. Hero aleatorio con portadas válidas (prioriza backdropUrl)
        const withBackdrop = allItems.filter((it) => Boolean(it.backdropUrl));
        const heroCandidates =
          withBackdrop.length >= 5
            ? withBackdrop
            : allItems.filter((it) => Boolean(it.backdropUrl || it.posterUrl));
        const randomHero = shuffleArray(heroCandidates).slice(0, 9);

        // 2. Tendencias (populares)
        const trendingList = popRes.slice(0, 16);

        // 3. Recién agregados
        const recentList = recRes.slice(0, 16);

        // 4. Estrenos (ordenados por año más nuevo y desduplicando primeros de recientes)
        const recentTopIds = new Set(recentList.slice(0, 6).map((x) => x.id));
        const sortedByYear = [...allItems].sort((a, b) => {
          const yd = (b.releaseYear || 0) - (a.releaseYear || 0);
          if (yd !== 0) return yd;
          return (b.rating || 0) - (a.rating || 0);
        });
        const distinctPremieres = sortedByYear.filter(
          (it) => !recentTopIds.has(it.id),
        );
        const premieresList = (
          distinctPremieres.length >= 8 ? distinctPremieres : sortedByYear
        ).slice(0, 16);

        // 5. Mejor valoradas
        const topRatedList = [...ratRes]
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 16);

        // 6. Filas dinámicas por género real
        const genreBuckets = new Map<string, NexoContentItem[]>();
        for (const it of allItems) {
          for (const g of it.genres || []) {
            if (!g?.name) continue;
            const list = genreBuckets.get(g.name) || [];
            if (list.length < 16) list.push(it);
            genreBuckets.set(g.name, list);
          }
        }
        const dynamicGenres = Array.from(genreBuckets.entries())
          .filter(([, list]) => list.length >= 4)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 3)
          .map(([genre, items]) => ({ genre, items }));

        setHeroItems(randomHero);
        setTrending(trendingList);
        setPremieres(premieresList);
        setRecent(recentList);
        setTopRated(topRatedList);
        setGenreRows(dynamicGenres);

        prefetchImages(
          randomHero.map((i) => i.backdropUrl || i.posterUrl || ""),
        );
      } catch (e) {
        console.warn("CatalogScreen load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [type]);

  // Auto-rotación del Hero si no hay interacción del usuario
  useEffect(() => {
    if (heroItems.length < 2 || userSelected) return;
    const t = setInterval(() => {
      setHeroIdx((i) => (i + 1) % heroItems.length);
    }, 8500);
    return () => clearInterval(t);
  }, [heroItems.length, userSelected]);

  // Si el usuario seleccionó una card, reanudar rotación tras 20s
  useEffect(() => {
    if (!userSelected) return;
    const timeout = setTimeout(() => setUserSelected(false), 20000);
    return () => clearTimeout(timeout);
  }, [userSelected, heroIdx]);

  const selectHeroTimer = useRef<any>(null);
  useEffect(() => {
    return () => {
      if (selectHeroTimer.current) clearTimeout(selectHeroTimer.current);
    };
  }, []);

  const handleSelectHero = useCallback(
    (idx: number, _item?: NexoContentItem, immediate = false) => {
      setUserSelected(true);
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

  const handlePlay = useCallback(
    (item: NexoContentItem) => {
      router.push({
        pathname: "/player",
        params: { slug: item.slug },
      } as any);
    },
    [router],
  );

  const handleDetails = useCallback(
    (item: NexoContentItem) => {
      router.push({
        pathname: "/detail",
        params: { slug: item.slug },
      } as any);
    },
    [router],
  );

  const activeHero = heroItems[heroIdx] || heroItems[0] || null;

  if (loading || !fontsLoaded) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadingText}>Cargando {meta.plural.toLowerCase()}...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Fondo cinemático adaptado */}
      <BackdropBackground
        uri={activeHero?.backdropUrl || activeHero?.posterUrl}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* ── HERO CONTAINER ESTILO HOME + PORTADA A LA DERECHA ── */}
        <View style={s.heroContainer}>
          {activeHero && (
            <View style={s.heroTopRow}>
              {/* Información y botones a la izquierda */}
              <View style={s.heroLeft} pointerEvents="box-none">
                {/* Tagline / Chip de categoría */}
                <View style={s.taglineChip}>
                  <Sparkles size={scale(10)} color="#f59e0b" />
                  <Text style={s.taglineChipText}>
                    {activeHero.tagline || meta.eyebrow}
                  </Text>
                </View>

                {/* Título Principal */}
                <Text style={s.heroTitle} numberOfLines={2}>
                  {activeHero.title}
                </Text>

                {/* Metadatos (Tipo • Género • Duración • Año) */}
                <View style={s.heroMeta}>
                  <Text style={s.heroMetaText}>
                    {typeLabel || meta.plural}
                  </Text>
                  {activeHero.genres?.[0]?.name ? (
                    <Text style={s.heroMetaText}>
                      {" "}
                      • {activeHero.genres[0].name}
                    </Text>
                  ) : null}
                  {activeHero.duration ? (
                    <Text style={s.heroMetaText}>
                      {" "}
                      • {formatDuration(activeHero.duration)}
                    </Text>
                  ) : null}
                  {activeHero.releaseYear ? (
                    <Text style={s.heroMetaText}>
                      {" "}
                      • {activeHero.releaseYear}
                    </Text>
                  ) : null}
                </View>

                {/* Badges de calificación y lenguaje */}
                <View style={s.heroBadges}>
                  {activeHero.contentRating ? (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>
                        {activeHero.contentRating}
                      </Text>
                    </View>
                  ) : null}
                  {activeHero.language ? (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>
                        {activeHero.language.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                  {activeHero.rating ? (
                    <View style={[s.badge, s.badgeAccent]}>
                      <Star
                        size={scale(10)}
                        color={C.accent}
                        fill={C.accent}
                      />
                      <Text style={[s.badgeText, { color: C.accent }]}>
                        {activeHero.rating.toFixed(1)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Sinopsis */}
                {activeHero.description ? (
                  <Text style={s.heroDesc} numberOfLines={3}>
                    {activeHero.description}
                  </Text>
                ) : null}

                {/* Botones de acción */}
                <View style={s.heroButtons}>
                  <Focusable
                    hasTVPreferredFocus
                    onPress={() => handlePlay(activeHero)}
                    nextFocusLeft={sidebarHandle ?? undefined}
                    style={s.btnPlay}
                    focusedStyle={s.btnPlayFocused}
                  >
                    <Play size={scale(15)} color="#000" fill="#000" />
                    <Text style={s.btnPlayText}>Reproducir</Text>
                  </Focusable>

                  <Focusable
                    onPress={() => handleDetails(activeHero)}
                    style={s.btnDetails}
                    focusedStyle={s.btnDetailsFocused}
                  >
                    <Info size={scale(15)} color="#fff" />
                    <Text style={s.btnDetailsText}>Detalles</Text>
                  </Focusable>
                </View>
              </View>

              {/* Portada vertical uncropped a la derecha ("como está ahora") */}
              <View style={s.heroRight} pointerEvents="none">
                <RemoteImage
                  uri={activeHero.posterUrl || activeHero.backdropUrl}
                  style={s.heroPoster as any}
                  contentFit="contain"
                  transition={250}
                />
              </View>
            </View>
          )}

          {/* Selector de portadas del Hero estilo Home */}
          {heroItems.length > 0 && (
            <HeroSelector
              items={heroItems}
              activeIdx={heroIdx}
              onSelectHero={handleSelectHero}
            />
          )}
        </View>

        {/* ── SECCIONES REALES DEBAJO DEL HERO (ESTILO WEB) ── */}
        <View style={s.contentArea}>
          {/* 1. Tendencias */}
          {trending.length > 0 && (
            <TrendingRow
              title={meta.trendingTitle}
              items={trending}
              onPress={handleDetails}
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type, sort: "popular" },
                } as any)
              }
            />
          )}

          {/* 2. Estrenos */}
          {premieres.length > 0 && (
            <ContentRow
              title={meta.premieresTitle}
              items={premieres}
              onPress={handleDetails}
              accentColor={meta.accentColorAlt}
              viewAllSublabel={`Estrenos de ${meta.plural.toLowerCase()}`}
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type, sort: "recent" },
                } as any)
              }
            />
          )}

          {/* 3. Recién agregadas */}
          {recent.length > 0 && (
            <ContentRow
              title={meta.recentTitle}
              items={recent}
              onPress={handleDetails}
              accentColor={meta.accentColor}
              viewAllSublabel={`Recientes en ${meta.plural.toLowerCase()}`}
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type, sort: "recent" },
                } as any)
              }
            />
          )}

          {/* 4. Mejor valoradas */}
          {topRated.length > 0 && (
            <ContentRow
              title={meta.topRatedTitle}
              items={topRated}
              onPress={handleDetails}
              accentColor="#ff5500"
              viewAllSublabel={`Mejor valoradas en ${meta.plural.toLowerCase()}`}
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type, sort: "rating" },
                } as any)
              }
            />
          )}

          {/* 5. Filas dinámicas por género */}
          {genreRows.map((row, idx) => (
            <ContentRow
              key={row.genre}
              title={`${meta.plural} de ${row.genre}`}
              items={row.items}
              onPress={handleDetails}
              accentColor={GENRE_ACCENTS[idx % GENRE_ACCENTS.length]}
              viewAllSublabel={`Más de ${row.genre}`}
              onViewAll={() =>
                router.push({
                  pathname: "/(tv)/explore",
                  params: { type, genre: row.genre },
                } as any)
              }
            />
          ))}

          {/* 6. Bloque final para explorar el catálogo completo */}
          <View style={s.bottomCtaSection}>
            <View style={s.bottomCtaCard}>
              <View style={s.bottomCtaInfo}>
                <Text style={s.bottomCtaTitle}>{meta.ctaTitle}</Text>
                <Text style={s.bottomCtaSub}>{meta.ctaSub}</Text>
              </View>
              <Focusable
                onPress={() =>
                  router.push({
                    pathname: "/(tv)/explore",
                    params: { type },
                  } as any)
                }
                scaleFocused={1.05}
                style={s.bottomCtaBtn}
                focusedStyle={s.bottomCtaBtnFocused}
              >
                <Compass size={scale(16)} color="#000" />
                <Text style={s.bottomCtaBtnText}>
                  Ver todo en {meta.plural}
                </Text>
                <ArrowRight size={scale(16)} color="#000" />
              </Focusable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#080808",
  },
  loadingText: {
    marginTop: scale(14),
    fontSize: scale(14),
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  scroll: { flex: 1, zIndex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: scale(24) },

  // ── Hero Container ──
  heroContainer: {
    minHeight: HERO_CONTAINER_H,
    justifyContent: "space-between",
    paddingTop: scale(70),
    paddingBottom: scale(20),
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(40),
    paddingBottom: scale(10),
  },
  heroLeft: {
    flex: 1,
    maxWidth: "68%",
  },
  heroRight: {
    width: scale(200),
    alignItems: "center",
    justifyContent: "center",
    paddingRight: scale(10),
  },
  heroPoster: {
    width: scale(175),
    height: scale(260),
    borderRadius: scale(12),
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "transparent",
  },

  // ── Tagline Chip ──
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

  // ── Título y metadatos ──
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

  // ── Badges ──
  heroBadges: {
    flexDirection: "row",
    gap: scale(8),
    marginBottom: scale(10),
    flexWrap: "wrap",
    alignItems: "center",
  },
  badge: {
    backgroundColor: "rgba(40,40,40,0.75)",
    paddingHorizontal: scale(9),
    paddingVertical: scale(3),
    borderRadius: scale(5),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  badgeAccent: {
    borderColor: "rgba(255,183,3,0.45)",
    backgroundColor: "rgba(255,183,3,0.15)",
  },
  badgeText: { fontSize: scale(11.5), color: "#fff", fontWeight: "700" },

  // ── Sinopsis ──
  heroDesc: {
    fontSize: scale(14),
    color: "rgba(255,255,255,0.85)",
    lineHeight: scale(20),
    marginBottom: scale(14),
    maxWidth: scale(680),
  },

  // ── Botones del Hero ──
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

  // ── Hero Selector (Cards inferiores dentro del Hero) ──
  heroSelectorWrapper: {
    marginTop: scale(10),
    paddingTop: scale(10),
    overflow: "visible",
  },
  heroSelectorTrack: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    paddingVertical: scale(14),
    gap: CARD_GAP,
    alignItems: "center",
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

  // ── Secciones de Catálogo ──
  contentArea: {
    marginTop: scale(24),
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
    marginBottom: scale(6),
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
    fontSize: scale(17),
    fontWeight: "800",
    color: C.textPrimary,
    letterSpacing: 0.3,
  },
  rowTrack: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    paddingVertical: scale(14),
    gap: CARD_GAP,
  },

  // ── Tendencias Card (Landscape) ──
  trendCard: {
    width: TREND_W,
    height: TREND_H,
    borderRadius: scale(10),
    overflow: "hidden",
    backgroundColor: "#161616",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
  },
  trendCardActiveBorder: {
    borderColor: "#ffffff",
  },
  trendBannerGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    justifyContent: "flex-end",
  },
  trendBannerTitle: {
    color: "#fff",
    fontSize: scale(12),
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  trendBannerSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: scale(10),
    marginTop: scale(2),
  },

  // ── Bloque Final CTA Explorar ──
  bottomCtaSection: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    paddingTop: scale(10),
    paddingBottom: scale(28),
  },
  bottomCtaCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: scale(20),
    paddingHorizontal: scale(24),
  },
  bottomCtaInfo: {
    flex: 1,
    marginRight: scale(20),
  },
  bottomCtaTitle: {
    fontSize: scale(17.5),
    fontWeight: "800",
    color: "#fff",
    marginBottom: scale(4),
  },
  bottomCtaSub: {
    fontSize: scale(12.5),
    color: "rgba(255,255,255,0.65)",
    lineHeight: scale(18),
  },
  bottomCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: C.accent,
    paddingHorizontal: scale(20),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: "transparent",
  },
  bottomCtaBtnFocused: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  bottomCtaBtnText: {
    color: "#000",
    fontSize: scale(13.5),
    fontWeight: "800",
  },
});
