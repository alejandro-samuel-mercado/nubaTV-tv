import { Bangers_400Regular, useFonts } from "@expo-google-fonts/bangers";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Clapperboard,
  Film,
  Flame,
  Info,
  Play,
  Smile,
  Sparkles,
  Star,
  Trophy,
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
import {
  getContentList,
  NexoContentItem,
} from "../../services/nexoplay";

const { height: SH } = Dimensions.get("window");

// ── Medidas del Layout Movies ────────────────────────────────────────────────
const CONTENT_LEFT_PAD = scale(96);
const CARD_GAP = scale(14);
const HERO_H = Math.max(scale(440), Math.round(SH * 0.65));

// Cards del catálogo Movies (Filas inferiores)
const POSTER_W = scale(125);
const POSTER_H = scale(180);

// Paleta de colores distintiva para Películas (Azul Zafiro de Cine, Oro y Neón)
const MOVIE_COLORS = {
  bgDark: "#030917",
  bgSurface: "#071329",
  gold: "#ffbe0b",
  cinemaBlue: "#00a8ff",
  neonRed: "#ff0055",
  emerald: "#00f59b",
  purple: "#8338ec",
  pink: "#ff007f",
};

const keyById = (i: NexoContentItem) => i.id;

// ── Tarjeta de Película para las Filas ────────────────────────────────────────
const MovieCard = memo(function MovieCard({
  item,
  onPress,
  accentColor = MOVIE_COLORS.gold,
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
        transition={150}
      />
      <LinearGradient
        colors={["transparent", "rgba(3,9,23,0.92)"]}
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
            {item.genres?.[0]?.name || "Película"}
          </Text>
          {item.releaseYear ? (
            <Text style={s.cardYear}> • {item.releaseYear}</Text>
          ) : null}
        </View>
      </View>
    </Focusable>
  );
});

// ── Fila de Películas con botón "Ver Todo" ────────────────────────────────────
const MovieRow = memo(function MovieRow({
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
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={5}
        renderItem={({ item, index }) => (
          <MovieCard
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

export default function MoviesScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();

  const [fontsLoaded] = useFonts({
    Bangers: Bangers_400Regular,
  });

  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);

  // Colecciones de Películas
  const [heroPool, setHeroPool] = useState<NexoContentItem[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<NexoContentItem[]>([]);
  const [recentMovies, setRecentMovies] = useState<NexoContentItem[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<NexoContentItem[]>([]);
  const [actionMovies, setActionMovies] = useState<NexoContentItem[]>([]);
  const [comedyMovies, setComedyMovies] = useState<NexoContentItem[]>([]);
  const [sciFiMovies, setSciFiMovies] = useState<NexoContentItem[]>([]);

  // ── Cargar películas de la API con distribución única por sección ──────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [popular, recent, rating, actionRes, comedyRes, scifiRes] = await Promise.all([
          getContentList({ type: "MOVIE", sort: "popular", limit: 35 }),
          getContentList({ type: "MOVIE", sort: "recent", limit: 35 }),
          getContentList({ type: "MOVIE", sort: "rating", limit: 35 }),
          getContentList({ type: "MOVIE", genreId: "cmoywh11k0008xcl6zo6gmt9t", limit: 35 }), // Acción
          getContentList({ type: "MOVIE", genreId: "cmoywh22d0009xcl6fxgc4vqn", limit: 35 }), // Comedia
          getContentList({ type: "MOVIE", genreId: "cmoywh3gn000cxcl621by2juo", limit: 35 }), // Ciencia Ficción
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

        // 1. Películas en Tendencia
        const trending = pickDistinct(popular, usedIds, 16);

        // 2. Estrenos Recientes (sin repetir las de tendencia)
        const recentList = pickDistinct(recent, usedIds, 16);

        // 3. Mejor Valoradas (sin repetir anteriores)
        const topRatedList = pickDistinct(rating, usedIds, 16);

        // 4. Acción y Aventuras (títulos de acción genuinos)
        const actionList = pickDistinct(actionRes, usedIds, 16);

        // 5. Comedia y Familiar
        const comedyList = pickDistinct(comedyRes, usedIds, 16);

        // 6. Ciencia Ficción, Fantasía y Terror
        const scifiList = pickDistinct(scifiRes, usedIds, 16);

        // Pool de Hero: películas con mejores backdrops
        const pool = [
          ...popular.slice(0, 6),
          ...recent.slice(0, 4),
        ].filter((x) => Boolean(x.backdropUrl || x.posterUrl));

        setHeroPool(pool);
        setTrendingMovies(trending);
        setRecentMovies(recentList);
        setTopRatedMovies(topRatedList);
        setActionMovies(actionList);
        setComedyMovies(comedyList);
        setSciFiMovies(scifiList);

        prefetchImages(pool.slice(0, 6).map((x) => x.backdropUrl || x.posterUrl || ""));
      } catch (err) {
        console.warn("Error cargando MoviesScreen:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auto-rotación del Hero cada 7.5 segundos ──────────────────────────────
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
        <ActivityIndicator size="large" color={MOVIE_COLORS.gold} />
        <Text style={s.loadTxt}>Cargando Cine & Películas...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Fondo ambiental zafiro profundo para Películas */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={["#081736", "#040c1e", "#02050e"]}
          style={StyleSheet.absoluteFill}
        />
        {/* Nebulosa azul zafiro y oro */}
        <LinearGradient
          colors={["rgba(0, 168, 255, 0.14)", "rgba(255, 190, 11, 0.08)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* ── SECCIÓN HERO MOVIES: 3/4 A LA IZQUIERDA + 2X2 A LA DERECHA ── */}
        {activeHero && (
          <View style={s.heroContainer}>
            {/* 1. HERO PRINCIPAL (Rectángulo curvo que ocupa 3/4) */}
            <View style={s.heroMainLeft}>
              <RemoteImage
                uri={activeHero.backdropUrl || activeHero.posterUrl}
                style={StyleSheet.absoluteFill as any}
                contentFit="cover"
                transition={200}
                priority="high"
              />
              {/* Degradados cinematográficos */}
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(3,9,23,0.45)",
                  "rgba(3,9,23,0.88)",
                  "rgba(3,9,23,0.98)",
                ]}
                locations={[0, 0.4, 0.75, 1]}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={[
                  "rgba(3,9,23,0.85)",
                  "rgba(3,9,23,0.6)",
                  "transparent",
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0.75, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Contenido dentro del Hero Principal */}
              <View style={s.heroMainContent}>
                {/* Chip de Películas */}
                <View style={s.heroTagChip}>
                  <Sparkles size={scale(12)} color={MOVIE_COLORS.gold} />
                  <Text style={s.heroTagTxt}>
                    {activeHero.tagline || "CINE EXCLUSIVO · GRANDES HISTORIAS"}
                  </Text>
                </View>

                {/* Título en tipografía Bangers */}
                <Text style={s.heroTitle} numberOfLines={2}>
                  {activeHero.title}
                </Text>

                {/* Metadatos y calificaciones */}
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
                    <Text style={s.metaBadgeTxt}>Película</Text>
                  </View>

                  {activeHero.genres?.[0]?.name ? (
                    <View style={[s.metaBadge, s.metaBadgeAlt]}>
                      <Text style={[s.metaBadgeTxt, { color: MOVIE_COLORS.cinemaBlue }]}>
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
                      transition={150}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(3,9,23,0.88)"]}
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
                      <Text style={s.gridCardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={s.gridCardYear}>{item.releaseYear || "Cine"}</Text>
                    </View>
                  </Focusable>
                );
              })}

              {/* 4. Botón circular "Ver todo" hacia /explore con filtro 'MOVIE' */}
              <HeroGridSeeAllCard
                accentColor={MOVIE_COLORS.gold}
                title="Ver todo"
                onPress={() =>
                  router.push({
                    pathname: "/(tv)/explore",
                    params: { type: "MOVIE" },
                  } as any)
                }
              />
            </View>
          </View>
        )}

        {/* ── FILAS TEMÁTICAS DE PELÍCULAS ────────────────────────────────────── */}
        <View style={s.rowsSection}>
          {/* 1. Películas en Tendencia */}
          <MovieRow
            title="Películas en Tendencia"
            subtitle="Las más vistas y comentadas de la cartelera"
            items={trendingMovies}
            accentColor={MOVIE_COLORS.gold}
            icon={Trophy}
            onPress={handleOpenDetail}
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "MOVIE", sort: "popular" },
              } as any)
            }
          />

          {/* 2. Estrenos Recientes */}
          <MovieRow
            title="Estrenos Recientes"
            subtitle="Llegadas recientemente al catálogo"
            items={recentMovies}
            accentColor={MOVIE_COLORS.cinemaBlue}
            icon={Film}
            onPress={handleOpenDetail}
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "MOVIE", sort: "recent" },
              } as any)
            }
          />

          {/* 3. Mejor Valoradas */}
          <MovieRow
            title="Películas Mejor Valoradas"
            subtitle="Aclamadas por la crítica y los cinéfilos"
            items={topRatedMovies}
            accentColor={MOVIE_COLORS.emerald}
            icon={Star}
            onPress={handleOpenDetail}
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "MOVIE", sort: "rating" },
              } as any)
            }
          />

          {/* 4. Acción y Aventuras */}
          <MovieRow
            title="Acción, Crimen y Aventuras"
            subtitle="Emoción, adrenalina y velocidad sin pausa"
            items={actionMovies}
            accentColor={MOVIE_COLORS.neonRed}
            icon={Flame}
            onPress={handleOpenDetail}
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "MOVIE", genre: "Acción" },
              } as any)
            }
          />

          {/* 5. Comedia y Familiar */}
          <MovieRow
            title="Comedia, Romance y Familiar"
            subtitle="Risas, romance y diversión para compartir"
            items={comedyMovies}
            accentColor={MOVIE_COLORS.pink}
            icon={Smile}
            onPress={handleOpenDetail}
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "MOVIE", genre: "Comedia" },
              } as any)
            }
          />

          {/* 6. Ciencia Ficción y Misterio */}
          <MovieRow
            title="Ciencia Ficción, Fantasía y Terror"
            subtitle="Mundos imposibles, suspenso y aventuras cósmicas"
            items={sciFiMovies}
            accentColor={MOVIE_COLORS.purple}
            icon={Sparkles}
            onPress={handleOpenDetail}
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "MOVIE", genre: "Ciencia ficción" },
              } as any)
            }
          />
        </View>

        <View style={{ height: scale(40) }} />
      </ScrollView>
    </View>
  );
}

// ── ESTILOS DEL MUNDO PELÍCULAS ───────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MOVIE_COLORS.bgDark,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(36),
    paddingTop: scale(20),
    paddingBottom: scale(30),
  },
  centerLoad: {
    flex: 1,
    backgroundColor: MOVIE_COLORS.bgDark,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(12),
  },
  loadTxt: {
    color: MOVIE_COLORS.gold,
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
    marginBottom: scale(24),
  },

  // Hero Principal (3/4 Izquierda)
  heroMainLeft: {
    flex: 2.7,
    height: "100%",
    borderRadius: scale(20),
    overflow: "hidden",
    backgroundColor: MOVIE_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(0, 168, 255, 0.35)",
    shadowColor: MOVIE_COLORS.cinemaBlue,
    shadowOpacity: 0.35,
    shadowRadius: scale(12),
    elevation: 8,
    position: "relative",
    justifyContent: "flex-end",
  },
  heroMainContent: {
    paddingHorizontal: scale(28),
    paddingBottom: scale(24),
    zIndex: 2,
  },
  heroTagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(0, 168, 255, 0.2)",
    borderWidth: 1.2,
    borderColor: MOVIE_COLORS.cinemaBlue,
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(8),
    alignSelf: "flex-start",
    marginBottom: scale(8),
  },
  heroTagTxt: {
    color: MOVIE_COLORS.cinemaBlue,
    fontSize: scale(10.5),
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: "Bangers",
    fontSize: scale(46),
    color: "#ffffff",
    letterSpacing: 0.8,
    marginBottom: scale(8),
    lineHeight: scale(48),
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 8,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginBottom: scale(10),
    flexWrap: "wrap",
  },
  metaBadgeRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: MOVIE_COLORS.gold,
    paddingHorizontal: scale(8),
    paddingVertical: scale(2.5),
    borderRadius: scale(6),
  },
  metaBadgeRatingTxt: {
    color: "#000000",
    fontSize: scale(11),
    fontWeight: "900",
  },
  metaBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: scale(8),
    paddingVertical: scale(2.5),
    borderRadius: scale(6),
  },
  metaBadgeAlt: {
    backgroundColor: "rgba(0, 168, 255, 0.15)",
    borderColor: "rgba(0, 168, 255, 0.35)",
  },
  metaBadgeTxt: {
    color: "#ffffff",
    fontSize: scale(11),
    fontWeight: "800",
  },
  metaYearText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: scale(12),
    fontWeight: "700",
  },
  heroDesc: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: scale(13),
    lineHeight: scale(19),
    marginBottom: scale(14),
    maxWidth: scale(680),
  },
  heroBtnRow: {
    flexDirection: "row",
    gap: scale(12),
  },
  btnPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: MOVIE_COLORS.gold,
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
    color: "#000000",
    fontSize: scale(14),
    fontWeight: "900",
  },
  btnDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: scale(20),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  btnDetailFocused: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderColor: "#ffffff",
  },
  btnDetailTxt: {
    color: "#ffffff",
    fontSize: scale(13.5),
    fontWeight: "800",
  },

  // 2. Rejilla Derecha 2x2
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
    backgroundColor: MOVIE_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.08)",
    position: "relative",
    justifyContent: "flex-end",
    padding: scale(10),
  },
  gridCardFocused: {
    borderColor: MOVIE_COLORS.cinemaBlue,
    shadowColor: MOVIE_COLORS.cinemaBlue,
    shadowOpacity: 0.6,
    shadowRadius: scale(8),
    elevation: 8,
    zIndex: 10,
  },
  gridCardGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "75%",
  },
  gridCardRating: {
    position: "absolute",
    top: scale(8),
    right: scale(8),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    backgroundColor: MOVIE_COLORS.gold,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  gridCardRatingTxt: {
    color: "#000000",
    fontSize: scale(9),
    fontWeight: "900",
  },
  gridCardInfo: {
    zIndex: 2,
  },
  gridCardTitle: {
    color: "#ffffff",
    fontSize: scale(11.5),
    fontWeight: "900",
  },
  gridCardYear: {
    color: MOVIE_COLORS.cinemaBlue,
    fontSize: scale(10),
    fontWeight: "700",
    marginTop: scale(2),
  },

  // ── Filas de Catálogo ──
  rowsSection: {
    gap: scale(22),
  },
  rowContainer: {},
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
    color: "#ffffff",
    fontSize: scale(17),
    fontWeight: "900",
    letterSpacing: 0.4,
    marginRight: scale(12),
  },
  rowSub: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: scale(12),
    fontWeight: "600",
  },
  rowTrack: {
    gap: CARD_GAP,
    paddingVertical: scale(8),
  },

  // Card de Catálogo
  card: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: MOVIE_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.08)",
    position: "relative",
    justifyContent: "flex-end",
    padding: scale(8),
  },
  cardFocused: {
    shadowColor: "#ffffff",
    shadowOpacity: 0.4,
    shadowRadius: scale(6),
    elevation: 6,
    zIndex: 10,
  },
  cardGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "65%",
  },
  cardRating: {
    position: "absolute",
    top: scale(7),
    right: scale(7),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    paddingHorizontal: scale(5),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  cardRatingTxt: {
    color: "#000000",
    fontSize: scale(8.5),
    fontWeight: "900",
  },
  cardInfo: {
    zIndex: 2,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: scale(11.5),
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: scale(2),
  },
  cardType: {
    fontSize: scale(10),
    fontWeight: "800",
  },
  cardYear: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: scale(10),
    fontWeight: "600",
  },
});
