import { Bangers_400Regular, useFonts } from "@expo-google-fonts/bangers";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Compass,
  Film,
  Flame,
  Info,
  Play,
  Sparkles,
  Star,
  Swords,
  Tv,
  Zap,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Focusable from "../../components/tv/Focusable";
import HeroGridSeeAllCard from "../../components/tv/HeroGridSeeAllCard";
import RemoteImage, { prefetchImages } from "../../components/tv/RemoteImage";
import ViewAllCard from "../../components/tv/ViewAllCard";
import { useHeroScrollToTop, useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  getContentList,
  getContentListSync,
  getPageCache,
  NexoContentItem,
  setPageCache,
} from "../../services/nexoplay";

const { height: SH } = Dimensions.get("window");

// ── Medidas del Layout Anime ──────────────────────────────────────────────────
const CONTENT_LEFT_PAD = scale(96);
const CARD_GAP = scale(14);
const HERO_H = Math.max(scale(374), Math.round(SH * 0.55));

// Cards del catálogo Anime (Filas inferiores)
const POSTER_W = scale(125);
const POSTER_H = scale(180);

// Paleta de colores vibrante, eléctrica y estética para Anime
const ANIME_COLORS = {
  bgDark: "#070512",
  bgSurface: "#120a26",
  crimson: "#ff2a6d",
  cyan: "#05d9e8",
  yellow: "#ffdd00",
  orange: "#ff5e00",
  violet: "#8b5cf6",
  mint: "#00f5d4",
};

const keyById = (i: NexoContentItem) => i.id;
const getRowItemLayout = (_: any, index: number) => ({
  length: POSTER_W + CARD_GAP,
  offset: (POSTER_W + CARD_GAP) * index,
  index,
});

// Verifica si un ítem es realmente Anime (excluyendo caricaturas occidentales y contenido Kids/Familia)
const WESTERN_OR_KIDS_PATTERN =
  /\b(simpson|rick|morty|gumball|among us|digman|casagrande|t\.u\.f\.f|wylde|invader zim|invasor zim|little margo|kung fu panda|x-men|primal|secret level|gatitos explosivos|exploding kittens|avatar|bojack|adventure time|hora de aventuras|invencible|invincible|star trek|velma|teen titans|smiling friends|pobre diablo|fugget about it|haunted hotel|gary and his demons|por cuatro perras|dang!|boonie|wendell|barbie|hilda|larva|minions|toy story|shrek|klaus|monstruos|cars|coco|turbo|tadeo|mitchell|la casa)\b/i;

const KNOWN_ANIME_PATTERN =
  /(bleach|monster|cyberpunk:\s*edgerunners|rooster fighter|sanda|pluto|cowboy bebop|trigun|dr\.?\s*stone|edens zero|dragon ball|naruto|one piece|kimetsu|yaiba|demon slayer|jujutsu|solo leveling|hunter|attack on|shingeki|evangelion|ghibli|castillo ambulante|my hero academia|chainsaw|fullmetal|death note|code geass|castlevania|hellsing|berserk|gintama|baki|kengan|vinland|dorohedoro|blue eye samurai|slime|akira|paprika|mononoke|gundam|overlord|resident evil)/i;

function isTrueAnime(item: NexoContentItem): boolean {
  const genres = item.genres?.map((g) => g.name.toLowerCase()) || [];
  if (genres.some((g) => g.includes("kids") || g.includes("infantil") || g.includes("familia"))) {
    return false;
  }

  const origTitle = item.originalTitle || "";
  const titleText = `${item.title || ""} ${origTitle}`;
  if (WESTERN_OR_KIDS_PATTERN.test(titleText)) return false;

  // Para películas obtenidas por género Animación, exigir escritura japonesa (kana/puntuación JP) o franquicia anime
  if (item.type === "MOVIE") {
    if (/[\u3040-\u30ff\u300c-\u3011]/.test(origTitle)) return true;
    if ((item as any).originalLanguage === "ja") return true;
    return KNOWN_ANIME_PATTERN.test(titleText);
  }

  if (/[\u3040-\u30ff\u4e00-\u9faf\u300c-\u3011]/.test(origTitle)) return true;
  if ((item as any).originalLanguage === "ja") return true;
  return KNOWN_ANIME_PATTERN.test(titleText);
}

// Filtro para anime de acción, aventuras o shonen
function isShonenOrAction(item: NexoContentItem): boolean {
  const genres = item.genres?.map((g) => g.name.toLowerCase()) || [];
  const actionKws = [
    "action",
    "acción",
    "accion",
    "adventure",
    "aventura",
    "fantasia",
    "fantasía",
    "fantasy",
    "sci-fi",
    "sobrenatural",
  ];
  return genres.some((g) => actionKws.some((k) => g.includes(k)));
}

// ── Tarjeta de Contenido Anime para las Filas ─────────────────────────────────
const AnimeCard = memo(function AnimeCard({
  item,
  onPress,
  onFocus,
  accentColor = ANIME_COLORS.crimson,
  nextFocusLeft,
  nextFocusRight,
  trapFocusLeft,
  trapFocusRight,
}: {
  item: NexoContentItem;
  onPress: (item: NexoContentItem) => void;
  onFocus?: () => void;
  accentColor?: string;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  trapFocusLeft?: boolean;
  trapFocusRight?: boolean;
}) {
  return (
    <Focusable
      onPress={() => onPress(item)}
      onFocus={onFocus}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      trapFocusLeft={trapFocusLeft}
      trapFocusRight={trapFocusRight}
      style={s.card}
      focusedStyle={[s.cardFocused, { borderColor: accentColor }]}
      scaleFocused={1.02}
    >
      <View style={s.cardInner}>
        <RemoteImage
          uri={item.posterUrl || item.backdropUrl}
          style={StyleSheet.absoluteFill as any}
          contentFit="cover"
          contentPosition="center"
          transition={150}
        />
        <LinearGradient
          colors={["transparent", "rgba(7,5,18,0.92)"]}
          style={s.cardGrad}
        />

        {item.rating ? (
          <View style={[s.cardRating, { backgroundColor: accentColor }]}>
            <Star size={scale(9)} color="#000" fill="#000" />
            <Text style={s.cardRatingTxt}>{item.rating.toFixed(1)}</Text>
          </View>
        ) : null}

        <View style={s.cardInfo}>
          <Text style={s.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={s.cardMetaRow}>
            <Text style={[s.cardType, { color: accentColor }]}>
              {item.genres?.[0]?.name || "Anime"}
            </Text>
            {item.releaseYear ? (
              <Text style={s.cardYear}> • {item.releaseYear}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </Focusable>
  );
});

// ── Fila de Contenido Anime con botón "Ver Todo" al final ─────────────────────
const AnimeRow = memo(function AnimeRow({
  title,
  subtitle,
  items,
  accentColor,
  icon: Icon,
  onPress,
  onRowFocus,
  onViewAll,
  viewAllSublabel = "Ver más",
}: {
  title: string;
  subtitle?: string;
  items: NexoContentItem[];
  accentColor: string;
  icon: any;
  onPress: (item: NexoContentItem) => void;
  onRowFocus?: () => void;
  onViewAll?: () => void;
  viewAllSublabel?: string;
}) {
  const sidebarHandle = useSidebarHandle();
  if (!items || items.length === 0) return null;

  return (
    <View style={s.rowContainer}>
      {/* Cabecera de la fila con icono y barra colorida */}
      <View style={s.rowHeader}>
        <View style={s.rowTitleGroup}>
          <View style={[s.rowAccentBar, { backgroundColor: accentColor }]} />
          <Icon size={scale(16)} color={accentColor} style={{ marginRight: scale(6) }} />
          <Text style={s.rowTitle}>{title}</Text>
          {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={keyById}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ overflow: "visible" }}
        contentContainerStyle={s.rowTrack}
        getItemLayout={getRowItemLayout}
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={3}
        renderItem={({ item, index }) => (
          <AnimeCard
            item={item}
            onPress={onPress}
            onFocus={onRowFocus}
            accentColor={accentColor}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
            trapFocusLeft={index === 0 && !sidebarHandle}
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
                onFocus={onRowFocus}
                label="Ver todo"
                sublabel={viewAllSublabel}
                accentColor={accentColor}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
});

interface AnimePageState {
  heroPool: NexoContentItem[];
  trendingAnime: NexoContentItem[];
  recentAnime: NexoContentItem[];
  animatedMovies: NexoContentItem[];
  shonenAdventures: NexoContentItem[];
  topRatedAnime: NexoContentItem[];
}

function buildAnimePageState(
  popularRaw: NexoContentItem[],
  recentRaw: NexoContentItem[],
  topRatedRaw: NexoContentItem[],
  animPopRaw: NexoContentItem[],
  animRecRaw: NexoContentItem[],
  p2AnimeRaw: NexoContentItem[],
): AnimePageState {
  const popular = popularRaw.filter(isTrueAnime);
  const recent = recentRaw.filter(isTrueAnime);
  const topRated = topRatedRaw.filter(isTrueAnime);
  const p2Anime = p2AnimeRaw.filter(isTrueAnime);
  const animMovies = [...animPopRaw, ...animRecRaw].filter(isTrueAnime);

  const pickDistinct = (items: NexoContentItem[], used: Set<string>, limit = 16) => {
    const list: NexoContentItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || !it.id || used.has(it.id)) continue;
      used.add(it.id);
      list.push(it);
      if (list.length >= limit) break;
    }
    return list;
  };

  const usedIds = new Set<string>();
  const currentYear = new Date().getFullYear();
  const sortByYear = (arr: NexoContentItem[]) =>
    [...arr].sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));

  const trending = pickDistinct(popular, usedIds, 16);
  const recentList = pickDistinct(
    recent.filter((x) => (x.releaseYear || 0) >= currentYear),
    usedIds,
    16,
  );
  const animList = pickDistinct(animMovies, usedIds, 16);
  const shonenList = pickDistinct(p2Anime, usedIds, 16);
  const topRatedList = pickDistinct(topRated, usedIds, 16);

  const recentAnimMovies = animRecRaw.filter(isTrueAnime);
  const allAnimeWithArt = [
    ...recent,
    ...recentAnimMovies,
    ...popular,
    ...topRated,
    ...p2Anime,
    ...animMovies,
  ].filter((x) => Boolean(x && (x.backdropUrl || x.posterUrl)));

  const heroUsed = new Set<string>();
  const currentYearAnime = pickDistinct(
    allAnimeWithArt.filter((x) => (x.releaseYear || 0) >= currentYear),
    heroUsed,
    14,
  );
  const rawPool =
    currentYearAnime.length >= 4
      ? currentYearAnime
      : [
          ...currentYearAnime,
          ...pickDistinct(
            sortByYear(allAnimeWithArt),
            heroUsed,
            14 - currentYearAnime.length,
          ),
        ];

  const pool = [...rawPool];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return {
    heroPool: pool,
    trendingAnime: trending,
    recentAnime: recentList,
    animatedMovies: animList,
    shonenAdventures: shonenList,
    topRatedAnime: topRatedList,
  };
}

function getInitialAnimeState(): AnimePageState | null {
  const cached = getPageCache<AnimePageState>("page:anime");
  if (cached) return cached;
  const popularRaw = getContentListSync({ type: "ANIME", sort: "popular", limit: 45 });
  const recentRaw = getContentListSync({ type: "ANIME", sort: "recent", limit: 45 });
  const topRatedRaw = getContentListSync({ type: "ANIME", sort: "rating", limit: 35 });
  const animPopRaw = getContentListSync({ type: "MOVIE", genreId: "cmoywh4rc000excl6ffu8fp29", sort: "popular", limit: 45 });
  const animRecRaw = getContentListSync({ type: "MOVIE", genreId: "cmoywh4rc000excl6ffu8fp29", sort: "recent", limit: 45 });
  const p2AnimeRaw = getContentListSync({ type: "ANIME", page: 2, limit: 35 });
  if (popularRaw && recentRaw && topRatedRaw && animPopRaw && animRecRaw && p2AnimeRaw) {
    const built = buildAnimePageState(popularRaw, recentRaw, topRatedRaw, animPopRaw, animRecRaw, p2AnimeRaw);
    setPageCache("page:anime", built);
    return built;
  }
  return null;
}

export default function AnimeScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();
  const { scrollRef, handleHeroFocus, cancelHeroScroll } = useHeroScrollToTop();

  useFonts({
    Bangers: Bangers_400Regular,
  });

  const initialData = useRef(getInitialAnimeState()).current;
  const [loading, setLoading] = useState(!initialData);
  const [heroIdx, setHeroIdx] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);

  // Colecciones de contenido para Anime
  const [heroPool, setHeroPool] = useState<NexoContentItem[]>(initialData?.heroPool ?? []);
  const [trendingAnime, setTrendingAnime] = useState<NexoContentItem[]>(initialData?.trendingAnime ?? []);
  const [recentAnime, setRecentAnime] = useState<NexoContentItem[]>(initialData?.recentAnime ?? []);
  const [animatedMovies, setAnimatedMovies] = useState<NexoContentItem[]>(initialData?.animatedMovies ?? []);
  const [shonenAdventures, setShonenAdventures] = useState<NexoContentItem[]>(initialData?.shonenAdventures ?? []);
  const [topRatedAnime, setTopRatedAnime] = useState<NexoContentItem[]>(initialData?.topRatedAnime ?? []);

  // ── Cargar contenido de anime de la API con distribución única ──────────────
  useEffect(() => {
    if (initialData) return;
    let cancelled = false;

    (async () => {
      try {
        const [popularRaw, recentRaw, topRatedRaw, animPopRaw, animRecRaw, p2AnimeRaw] = await Promise.all([
          getContentList({ type: "ANIME", sort: "popular", limit: 45 }),
          getContentList({ type: "ANIME", sort: "recent", limit: 45 }),
          getContentList({ type: "ANIME", sort: "rating", limit: 35 }),
          getContentList({ type: "MOVIE", genreId: "cmoywh4rc000excl6ffu8fp29", sort: "popular", limit: 45 }),
          getContentList({ type: "MOVIE", genreId: "cmoywh4rc000excl6ffu8fp29", sort: "recent", limit: 45 }),
          getContentList({ type: "ANIME", page: 2, limit: 35 }), // Aventuras y sagas
        ]);

        if (cancelled) return;

        const built = buildAnimePageState(popularRaw, recentRaw, topRatedRaw, animPopRaw, animRecRaw, p2AnimeRaw);
        setPageCache("page:anime", built);

        setHeroPool(built.heroPool);
        setTrendingAnime(built.trendingAnime);
        setRecentAnime(built.recentAnime);
        setAnimatedMovies(built.animatedMovies);
        setShonenAdventures(built.shonenAdventures);
        setTopRatedAnime(built.topRatedAnime);

        prefetchImages(built.heroPool.slice(0, 6).map((x) => x.backdropUrl || x.posterUrl || ""));
      } catch (err) {
        console.warn("Error cargando AnimeScreen:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialData]);

  // El Hero y las 3 portadas del 2x2 se mantienen estáticos durante toda la sesión de la app
  const activeHero = heroPool[heroIdx] || heroPool[0] || null;

  // Las 3 portadas que acompañan a la tarjeta "Ver Todo" en la cuadrícula 2x2 derecha
  const candidateCovers = useMemo(() => {
    if (heroPool.length <= 1) return [];
    const len = heroPool.length;
    return [
      heroPool[(heroIdx + 1) % len],
      heroPool[(heroIdx + 2) % len],
      heroPool[(heroIdx + 3) % len],
    ].filter(Boolean);
  }, [heroPool, heroIdx]);

  // ── Navegación a Detalle y Reproductor ──────────────────────────────────────
  const handleOpenDetail = useCallback(
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

  if (loading && heroPool.length === 0) {
    return (
      <View style={s.centerLoad}>
        <ActivityIndicator size="large" color={ANIME_COLORS.crimson} />
        <Text style={s.loadTxt}>Cargando Universo Anime...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Fondo ambiental cósmico y electrizante para Anime */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={["#160824", "#0a0618", "#05030c"]}
          style={StyleSheet.absoluteFill}
        />
        {/* Velo de nebulosa anime rojizo-carmesí y cian */}
        <LinearGradient
          colors={["rgba(255, 42, 109, 0.14)", "rgba(5, 217, 232, 0.08)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.65 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* ── SECCIÓN HERO ANIME: 3/4 A LA IZQUIERDA + 2X2 A LA DERECHA ── */}
        {activeHero && (
          <View style={s.heroContainer}>
            {/* 1. HERO PRINCIPAL (Rectángulo curvo que ocupa 3/4) */}
            <View style={s.heroMainLeft}>
              <RemoteImage
                uri={activeHero.backdropUrl || activeHero.posterUrl}
                style={StyleSheet.absoluteFill as any}
                contentFit="cover"
                contentPosition="center"
                transition={360}
                priority="high"
                disableRecycling
              />
              {/* Degradados cinematográficos para lectura clara */}
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(7,5,18,0.45)",
                  "rgba(7,5,18,0.88)",
                  "rgba(7,5,18,0.98)",
                ]}
                locations={[0, 0.4, 0.75, 1]}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={[
                  "rgba(7,5,18,0.85)",
                  "rgba(7,5,18,0.6)",
                  "transparent",
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0.75, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Contenido dentro del Hero Principal */}
              <View style={s.heroMainContent}>
                {/* Chip con estilo anime */}
                <View style={s.heroTagChip}>
                  <Flame size={scale(12)} color={ANIME_COLORS.crimson} />
                  <Text style={s.heroTagTxt}>
                    {activeHero.tagline || "UNIVERSO ANIME · SHONEN, SEINEN Y ANIMACIÓN"}
                  </Text>
                </View>

                {/* Título en tipografía cómic/bangers impactante */}
                <Text style={s.heroTitle} numberOfLines={2}>
                  {activeHero.title}
                </Text>

                {/* Metadatos y badges */}
                <View style={s.heroMetaRow}>
                  {activeHero.rating ? (
                    <View style={s.metaBadgeRating}>
                      <Star size={scale(11)} color="#000" fill="#000" />
                      <Text style={s.metaBadgeRatingTxt}>
                        {activeHero.rating.toFixed(1)}
                      </Text>
                    </View>
                  ) : null}

                  <View style={s.metaBadge}>
                    <Text style={s.metaBadgeTxt}>Anime</Text>
                  </View>

                  {activeHero.genres?.[0]?.name ? (
                    <View style={[s.metaBadge, s.metaBadgeAlt]}>
                      <Text style={[s.metaBadgeTxt, { color: ANIME_COLORS.cyan }]}>
                        {activeHero.genres[0].name}
                      </Text>
                    </View>
                  ) : null}

                  {activeHero.releaseYear ? (
                    <Text style={s.metaYearText}>{activeHero.releaseYear}</Text>
                  ) : null}
                </View>

                {/* Sinopsis breve */}
                {activeHero.description ? (
                  <Text style={s.heroDesc} numberOfLines={3}>
                    {activeHero.description}
                  </Text>
                ) : null}

                {/* Botones de acción principales */}
                <View style={s.heroBtnRow}>
                  <Focusable
                    hasTVPreferredFocus
                    onPress={() => handlePlay(activeHero)}
                    onFocus={handleHeroFocus}
                    nextFocusLeft={sidebarHandle ?? undefined}
                    style={s.btnPlay}
                    focusedStyle={s.btnPlayFocused}
                  >
                    {({ focused }) => (
                      <>
                        <Play
                          size={scale(16)}
                          color={focused ? "#000000" : "#ffffff"}
                          fill={focused ? "#000000" : "#ffffff"}
                        />
                        <Text style={[s.btnPlayTxt, focused && { color: "#000000" }]}>
                          Reproducir
                        </Text>
                      </>
                    )}
                  </Focusable>

                  <Focusable
                    onPress={() => handleOpenDetail(activeHero)}
                    onFocus={handleHeroFocus}
                    style={s.btnDetail}
                    focusedStyle={s.btnDetailFocused}
                  >
                    {({ focused }) => (
                      <>
                        <Info size={scale(15)} color={focused ? "#000000" : "#ffffff"} />
                        <Text
                          style={[
                            s.btnDetailTxt,
                            focused && { color: "#000000", fontWeight: "900" },
                          ]}
                        >
                          Ver Información
                        </Text>
                      </>
                    )}
                  </Focusable>
                </View>
              </View>
            </View>

            {/* 2. REJILLA DERECHA 2X2 DE RECTÁNGULOS CURVOS */}
            <View style={s.heroRightGrid}>
              {candidateCovers.map((item, idx) => {
                return (
                  <Focusable
                    key={`hero-slot-${idx}`}
                    onPress={() => handleOpenDetail(item)}
                    onFocus={handleHeroFocus}
                    trapFocusRight={idx === 1}
                    scaleFocused={1.02}
                    style={s.gridCard}
                    focusedStyle={s.gridCardFocused}
                  >
                    <View style={s.gridCardInner}>
                      <RemoteImage
                        uri={item.posterUrl || item.backdropUrl}
                        style={StyleSheet.absoluteFill as any}
                        contentFit="cover"
                        contentPosition="center"
                        transition={240}
                        disableRecycling
                      />
                      <LinearGradient
                        colors={["transparent", "rgba(7,5,18,0.88)"]}
                        style={s.gridCardGrad}
                      />
                      {item.rating ? (
                        <View style={s.gridCardRating}>
                          <Star size={scale(8.5)} color="#000" fill="#000" />
                          <Text style={s.gridCardRatingTxt}>
                            {item.rating.toFixed(1)}
                          </Text>
                        </View>
                      ) : null}
                      <View style={s.gridCardInfo}>
                        <Text style={s.gridCardTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={s.gridCardSub} numberOfLines={1}>
                          {item.genres?.[0]?.name || "Anime"}
                        </Text>
                      </View>
                    </View>
                  </Focusable>
                );
              })}

              {/* 4. Botón circular "Ver todo" hacia /explore con filtro 'ANIME' */}
              <HeroGridSeeAllCard
                accentColor={ANIME_COLORS.crimson}
                title="Ver todo"
                onFocus={handleHeroFocus}
                onPress={() =>
                  router.push({
                    pathname: "/(tv)/explore",
                    params: { type: "ANIME" },
                  } as any)
                }
              />
            </View>
          </View>
        )}

        {/* ── FILAS DE CONTENIDO ANIME ────────────────────────────────────── */}
        <View style={s.contentArea}>
          {/* 1. Tendencias Anime */}
          <AnimeRow
            title="Tendencias del Anime"
            subtitle="Lo más visto y comentado por la comunidad"
            items={trendingAnime}
            accentColor={ANIME_COLORS.crimson}
            icon={Flame}
            onPress={handleOpenDetail}
            onRowFocus={cancelHeroScroll}
            viewAllSublabel="Más tendencias"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "ANIME", sort: "popular" },
              } as any)
            }
          />

          {/* 2. Estrenos y Nuevos Capítulos */}
          <AnimeRow
            title="Estrenos y Nuevos Capítulos"
            subtitle="Las últimas temporadas y episodios recién agregados"
            items={recentAnime}
            accentColor={ANIME_COLORS.cyan}
            icon={Zap}
            onPress={handleOpenDetail}
            onRowFocus={cancelHeroScroll}
            viewAllSublabel="Todos los estrenos"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "ANIME", sort: "recent" },
              } as any)
            }
          />

          {/* 3. Películas de Animación y Cine Anime */}
          <AnimeRow
            title="Películas de Anime"
            subtitle="Largometrajes japoneses con animación de alto nivel"
            items={animatedMovies}
            accentColor={ANIME_COLORS.yellow}
            icon={Film}
            onPress={handleOpenDetail}
            onRowFocus={cancelHeroScroll}
            viewAllSublabel="Todo el anime"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "ANIME", sort: "popular" },
              } as any)
            }
          />

          {/* 4. Acción, Shonen y Aventuras Épicas */}
          <AnimeRow
            title="Acción, Shonen y Aventuras Épicas"
            subtitle="Batallas legendarias, poderes y grandes viajes"
            items={shonenAdventures}
            accentColor={ANIME_COLORS.orange}
            icon={Swords}
            onPress={handleOpenDetail}
            onRowFocus={cancelHeroScroll}
            viewAllSublabel="Más shonen"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "ANIME", genre: "Acción" },
              } as any)
            }
          />

          {/* 5. Obras Maestras del Anime */}
          <AnimeRow
            title="Obras Maestras del Anime"
            subtitle="Series de culto con las mejores calificaciones del público"
            items={topRatedAnime}
            accentColor={ANIME_COLORS.violet}
            icon={Star}
            onPress={handleOpenDetail}
            onRowFocus={cancelHeroScroll}
            viewAllSublabel="Top valoradas"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "ANIME", sort: "rating" },
              } as any)
            }
          />

          <View style={{ height: scale(60) }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ── ESTILOS DE LA PÁGINA ANIME ────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ANIME_COLORS.bgDark,
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    paddingTop: scale(20),
    paddingBottom: scale(30),
  },

  centerLoad: {
    flex: 1,
    backgroundColor: ANIME_COLORS.bgDark,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(12),
  },
  loadTxt: {
    color: ANIME_COLORS.crimson,
    fontSize: scale(15),
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // ── Contenedor Hero ──
  heroContainer: {
    height: HERO_H,
    flexDirection: "row",
    alignItems: "stretch",
    gap: scale(12),
    marginBottom: scale(24),
  },

  // ── Hero Principal Izquierdo (3/4 de ancho) ──
  heroMainLeft: {
    flex: 2.35,
    height: "100%",
    borderRadius: scale(18),
    overflow: "hidden",
    backgroundColor: ANIME_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255, 42, 109, 0.45)",
    shadowColor: ANIME_COLORS.crimson,
    shadowOpacity: 0.25,
    shadowRadius: scale(10),
    elevation: 8,
    position: "relative",
    justifyContent: "flex-end",
  },
  heroMainContent: {
    paddingHorizontal: scale(22),
    paddingBottom: scale(14),
    zIndex: 2,
    maxWidth: scale(580),
  },
  heroTagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    backgroundColor: "rgba(255, 42, 109, 0.18)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 42, 109, 0.5)",
    paddingHorizontal: scale(10),
    paddingVertical: scale(3),
    borderRadius: scale(10),
    alignSelf: "flex-start",
    marginBottom: scale(6),
  },
  heroTagTxt: {
    color: ANIME_COLORS.crimson,
    fontSize: scale(10),
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  heroTitle: {
    fontFamily: "Bangers",
    fontSize: scale(28),
    color: "#ffffff",
    lineHeight: scale(31),
    letterSpacing: 1,
    marginBottom: scale(12),
    includeFontPadding: false,
    textShadowColor: "rgba(255, 42, 109, 0.6)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 10,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(7),
    marginBottom: scale(7),
  },
  metaBadgeRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: ANIME_COLORS.yellow,
    paddingHorizontal: scale(7),
    paddingVertical: scale(2),
    borderRadius: scale(5),
  },
  metaBadgeRatingTxt: {
    fontSize: scale(10),
    fontWeight: "900",
    color: "#000",
  },
  metaBadge: {
    backgroundColor: "rgba(255, 42, 109, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 42, 109, 0.5)",
    paddingHorizontal: scale(7),
    paddingVertical: scale(2),
    borderRadius: scale(5),
  },
  metaBadgeAlt: {
    backgroundColor: "rgba(5, 217, 232, 0.15)",
    borderColor: "rgba(5, 217, 232, 0.45)",
  },
  metaBadgeTxt: {
    fontSize: scale(10),
    fontWeight: "800",
    color: ANIME_COLORS.crimson,
  },
  metaYearText: {
    fontSize: scale(11.5),
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
  },
  heroDesc: {
    fontSize: scale(12),
    color: "rgba(255,255,255,0.88)",
    lineHeight: scale(16.5),
    marginBottom: scale(11),
    maxWidth: scale(480),
  },
  heroBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  btnPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(7),
    backgroundColor: ANIME_COLORS.crimson,
    paddingHorizontal: scale(18),
    height: scale(36),
    borderRadius: scale(9),
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnPlayFocused: {
    backgroundColor: "#ffffff",
    borderColor: ANIME_COLORS.crimson,
  },
  btnPlayTxt: {
    color: "#ffffff",
    fontSize: scale(12.5),
    fontWeight: "900",
  },
  btnDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(7),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: scale(16),
    height: scale(36),
    borderRadius: scale(9),
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  btnDetailFocused: {
    backgroundColor: ANIME_COLORS.cyan,
    borderColor: "#ffffff",
  },
  btnDetailTxt: {
    color: "#ffffff",
    fontSize: scale(12),
    fontWeight: "800",
  },

  // ── Rejilla Derecha 2x2 de Rectángulos Curvos ──
  heroRightGrid: {
    flex: 1.65,
    height: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "space-between",
    overflow: "visible",
    padding: scale(3),
  },
  gridCard: {
    width: "48.5%",
    height: "48.5%",
    borderRadius: scale(14),
    backgroundColor: ANIME_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  gridCardInner: {
    flex: 1,
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: ANIME_COLORS.bgSurface,
    position: "relative",
    justifyContent: "flex-end",
  },
  gridCardFocused: {
    borderColor: ANIME_COLORS.crimson,
    zIndex: 10,
  },
  gridCardGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "65%",
  },
  gridCardRating: {
    position: "absolute",
    top: scale(5),
    right: scale(5),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    backgroundColor: ANIME_COLORS.yellow,
    paddingHorizontal: scale(5),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  gridCardRatingTxt: {
    fontSize: scale(9.5),
    fontWeight: "900",
    color: "#000",
  },
  gridCardInfo: {
    padding: scale(8),
    zIndex: 2,
  },
  gridCardTitle: {
    color: "#ffffff",
    fontSize: scale(11),
    fontWeight: "900",
    lineHeight: scale(13.5),
  },
  gridCardSub: {
    color: ANIME_COLORS.cyan,
    fontSize: scale(9.5),
    fontWeight: "800",
    marginTop: scale(2),
  },

  // ── Filas de Catálogo ──
  contentArea: {
    marginTop: scale(8),
  },
  rowContainer: {
    marginBottom: scale(22),
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(10),
  },
  rowTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowAccentBar: {
    width: scale(4),
    height: scale(18),
    borderRadius: scale(2),
    marginRight: scale(8),
  },
  rowTitle: {
    fontSize: scale(17.5),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  rowSub: {
    fontSize: scale(12),
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    marginLeft: scale(12),
  },
  rowTrack: {
    paddingVertical: scale(14),
    paddingHorizontal: scale(6),
    gap: CARD_GAP,
  },

  // ── Tarjeta de Catálogo Anime ──
  card: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: scale(12),
    backgroundColor: ANIME_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardInner: {
    flex: 1,
    borderRadius: scale(10),
    overflow: "hidden",
    backgroundColor: ANIME_COLORS.bgSurface,
    position: "relative",
  },
  cardFocused: {
    zIndex: 10,
  },
  cardGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  cardRating: {
    position: "absolute",
    top: scale(6),
    right: scale(6),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    paddingHorizontal: scale(5),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  cardRatingTxt: {
    fontSize: scale(9.5),
    fontWeight: "900",
    color: "#000",
  },
  cardInfo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: scale(8),
  },
  cardTitle: {
    fontSize: scale(12),
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: scale(14.5),
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: scale(2.5),
  },
  cardType: {
    fontSize: scale(10),
    fontWeight: "800",
  },
  cardYear: {
    fontSize: scale(10),
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
  },
});
