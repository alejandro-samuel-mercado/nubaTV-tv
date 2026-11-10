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
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  getContentList,
  NexoContentItem,
} from "../../services/nexoplay";

const { height: SH } = Dimensions.get("window");

// ── Medidas del Layout Anime ──────────────────────────────────────────────────
const CONTENT_LEFT_PAD = scale(96);
const CARD_GAP = scale(14);
const HERO_H = Math.max(scale(440), Math.round(SH * 0.65));

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
  accentColor = ANIME_COLORS.crimson,
  nextFocusLeft,
  nextFocusRight,
  trapFocusLeft,
  trapFocusRight,
}: {
  item: NexoContentItem;
  onPress: (item: NexoContentItem) => void;
  accentColor?: string;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  trapFocusLeft?: boolean;
  trapFocusRight?: boolean;
}) {
  return (
    <Focusable
      onPress={() => onPress(item)}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      trapFocusLeft={trapFocusLeft}
      trapFocusRight={trapFocusRight}
      style={s.card}
      focusedStyle={[s.cardFocused, { borderColor: accentColor }]}
      scaleFocused={1.02}
    >
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
  onViewAll,
  viewAllSublabel = "Ver más",
}: {
  title: string;
  subtitle?: string;
  items: NexoContentItem[];
  accentColor: string;
  icon: any;
  onPress: (item: NexoContentItem) => void;
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
        contentContainerStyle={s.rowTrack}
        initialNumToRender={items.length || 16}
        maxToRenderPerBatch={items.length || 16}
        windowSize={11}
        removeClippedSubviews={false}
        renderItem={({ item, index }) => (
          <AnimeCard
            item={item}
            onPress={onPress}
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

export default function AnimeScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();

  const [fontsLoaded] = useFonts({
    Bangers: Bangers_400Regular,
  });

  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);

  // Colecciones de contenido para Anime
  const [heroPool, setHeroPool] = useState<NexoContentItem[]>([]);
  const [trendingAnime, setTrendingAnime] = useState<NexoContentItem[]>([]);
  const [recentAnime, setRecentAnime] = useState<NexoContentItem[]>([]);
  const [animatedMovies, setAnimatedMovies] = useState<NexoContentItem[]>([]);
  const [shonenAdventures, setShonenAdventures] = useState<NexoContentItem[]>([]);
  const [topRatedAnime, setTopRatedAnime] = useState<NexoContentItem[]>([]);

  // ── Cargar contenido de anime de la API con distribución única ──────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [popular, recent, topRated, animMovies, p2Anime] = await Promise.all([
          getContentList({ type: "ANIME", sort: "popular", limit: 35 }),
          getContentList({ type: "ANIME", sort: "recent", limit: 35 }),
          getContentList({ type: "ANIME", sort: "rating", limit: 35 }),
          getContentList({ type: "MOVIE", genreId: "cmoywh4rc000excl6ffu8fp29", limit: 35 }), // Películas de animación
          getContentList({ type: "ANIME", page: 2, limit: 35 }), // Aventuras y sagas
        ]);

        if (cancelled) return;

        // Función de extracción única: garantiza que ninguna fila repita contenido de otra
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

        // 1. Tendencias del Anime
        const trending = pickDistinct(popular, usedIds, 16);

        // 2. Estrenos y Nuevos Capítulos (sin repetir)
        const recentList = pickDistinct(recent, usedIds, 16);

        // 3. Películas de Animación (largometrajes reales)
        const animList = pickDistinct(animMovies, usedIds, 16);

        // 4. Aventuras Shonen y Acción
        const shonenList = pickDistinct(p2Anime, usedIds, 16);

        // 5. Obras Maestras Mejor Valoradas (sin repetir)
        const topRatedList = pickDistinct(topRated, usedIds, 16);

        // Armar el pool del Hero con los mejores contenidos
        const pool = [
          ...popular.slice(0, 6),
          ...topRated.slice(0, 4),
          ...animMovies.slice(0, 3),
        ].filter(Boolean);

        setHeroPool(pool);
        setTrendingAnime(trending);
        setRecentAnime(recentList);
        setAnimatedMovies(animList);
        setShonenAdventures(shonenList);
        setTopRatedAnime(topRatedList);

        prefetchImages(pool.slice(0, 6).map((x) => x.backdropUrl || x.posterUrl || ""));
      } catch (err) {
        console.warn("Error cargando AnimeScreen:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auto-rotación del Hero Anime cada 7.5 segundos ─────────────────────────
  useEffect(() => {
    if (heroPool.length < 5 || userInteracted) return;
    const timer = setInterval(() => {
      setHeroIdx((i) => (i + 1) % heroPool.length);
    }, 7500);
    return () => clearInterval(timer);
  }, [heroPool.length, userInteracted]);

  // Si el usuario interactúa, reanudar rotación tras 22 segundos
  useEffect(() => {
    if (!userInteracted) return;
    const timeout = setTimeout(() => setUserInteracted(false), 22000);
    return () => clearTimeout(timeout);
  }, [userInteracted, heroIdx]);

  // Item principal del Hero (3/4 de la pantalla izquierda)
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

  if (loading || !fontsLoaded) {
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
                transition={200}
                priority="high"
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
                    nextFocusLeft={sidebarHandle ?? undefined}
                    style={s.btnPlay}
                    focusedStyle={s.btnPlayFocused}
                  >
                    <Play size={scale(16)} color="#000" fill="#000" />
                    <Text style={s.btnPlayTxt}>Reproducir</Text>
                  </Focusable>

                  <Focusable
                    onPress={() => handleOpenDetail(activeHero)}
                    style={s.btnDetail}
                    focusedStyle={s.btnDetailFocused}
                  >
                    <Info size={scale(15)} color="#ffffff" />
                    <Text style={s.btnDetailTxt}>Ver Información</Text>
                  </Focusable>
                </View>
              </View>
            </View>

            {/* 2. REJILLA DERECHA 2X2 DE RECTÁNGULOS CURVOS */}
            <View style={s.heroRightGrid}>
              {candidateCovers.map((item, idx) => {
                return (
                  <Focusable
                    key={item.id || idx}
                    onPress={() => handleOpenDetail(item)}
                    trapFocusRight={idx === 1}
                    scaleFocused={1.02}
                    style={s.gridCard}
                    focusedStyle={s.gridCardFocused}
                  >
                    <RemoteImage
                      uri={item.posterUrl || item.backdropUrl}
                      style={StyleSheet.absoluteFill as any}
                      contentFit="cover"
                      contentPosition="center"
                      transition={150}
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
                  </Focusable>
                );
              })}

              {/* 4. Botón circular "Ver todo" hacia /explore con filtro 'ANIME' */}
              <HeroGridSeeAllCard
                accentColor={ANIME_COLORS.crimson}
                title="Ver todo"
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
            title="Cine de Animación y Películas Anime"
            subtitle="Largometrajes inolvidables con animación de alto nivel"
            items={animatedMovies}
            accentColor={ANIME_COLORS.yellow}
            icon={Film}
            onPress={handleOpenDetail}
            viewAllSublabel="Todas las películas"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { genre: "Animación", type: "MOVIE" },
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
    gap: scale(14),
    marginBottom: scale(26),
  },

  // ── Hero Principal Izquierdo (3/4 de ancho) ──
  heroMainLeft: {
    flex: 2.7,
    height: "100%",
    borderRadius: scale(20),
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
    paddingHorizontal: scale(26),
    paddingBottom: scale(24),
    zIndex: 2,
    maxWidth: scale(620),
  },
  heroTagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(255, 42, 109, 0.18)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 42, 109, 0.5)",
    paddingHorizontal: scale(12),
    paddingVertical: scale(4.5),
    borderRadius: scale(12),
    alignSelf: "flex-start",
    marginBottom: scale(10),
  },
  heroTagTxt: {
    color: ANIME_COLORS.crimson,
    fontSize: scale(11.5),
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: "Bangers",
    fontSize: scale(48),
    color: "#ffffff",
    lineHeight: scale(52),
    letterSpacing: 1,
    marginBottom: scale(8),
    textShadowColor: "rgba(255, 42, 109, 0.6)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 10,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginBottom: scale(10),
  },
  metaBadgeRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: ANIME_COLORS.yellow,
    paddingHorizontal: scale(7),
    paddingVertical: scale(3),
    borderRadius: scale(5),
  },
  metaBadgeRatingTxt: {
    fontSize: scale(11),
    fontWeight: "900",
    color: "#000",
  },
  metaBadge: {
    backgroundColor: "rgba(255, 42, 109, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 42, 109, 0.5)",
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(5),
  },
  metaBadgeAlt: {
    backgroundColor: "rgba(5, 217, 232, 0.15)",
    borderColor: "rgba(5, 217, 232, 0.45)",
  },
  metaBadgeTxt: {
    fontSize: scale(11),
    fontWeight: "800",
    color: ANIME_COLORS.crimson,
  },
  metaYearText: {
    fontSize: scale(13),
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
  },
  heroDesc: {
    fontSize: scale(13.5),
    color: "rgba(255,255,255,0.88)",
    lineHeight: scale(19),
    marginBottom: scale(16),
  },
  heroBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
  },
  btnPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: ANIME_COLORS.crimson,
    paddingHorizontal: scale(22),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnPlayFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  btnPlayTxt: {
    color: "#ffffff",
    fontSize: scale(14),
    fontWeight: "900",
  },
  btnDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: scale(18),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  btnDetailFocused: {
    backgroundColor: ANIME_COLORS.cyan,
    borderColor: ANIME_COLORS.cyan,
  },
  btnDetailTxt: {
    color: "#ffffff",
    fontSize: scale(13.5),
    fontWeight: "800",
  },

  // ── Rejilla Derecha 2x2 de Rectángulos Curvos ──
  heroRightGrid: {
    flex: 1.3,
    height: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "space-between",
  },
  gridCard: {
    width: "48.5%",
    height: "48.5%",
    borderRadius: scale(14),
    overflow: "hidden",
    backgroundColor: ANIME_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.12)",
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
    gap: CARD_GAP,
  },

  // ── Tarjeta de Catálogo Anime ──
  card: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: ANIME_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardFocused: {
    borderWidth: 2.5,
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
