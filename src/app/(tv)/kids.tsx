import { Bangers_400Regular, useFonts } from "@expo-google-fonts/bangers";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Compass,
  Film,
  Heart,
  Info,
  Play,
  Smile,
  Sparkles,
  Star,
  Tv,
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
import RemoteImage, { prefetchImages } from "../../components/tv/RemoteImage";
import ViewAllCard from "../../components/tv/ViewAllCard";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  getContentList,
  NexoContentItem,
} from "../../services/nexoplay";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Medidas del Layout Kids ──────────────────────────────────────────────────
const SIDEBAR_OFFSET = scale(64);
const CONTENT_LEFT_PAD = scale(96);
const CARD_GAP = scale(14);

const HERO_H = Math.max(scale(440), Math.round(SH * 0.65));

// Cards del catálogo Kids (Filas inferiores)
const POSTER_W = scale(125);
const POSTER_H = scale(180);

// Paleta de colores vibrante, mágica e infantil para Kids
const KIDS_COLORS = {
  bgDark: "#090714",
  bgSurface: "#130f28",
  pink: "#ff007f",
  yellow: "#ffbe0b",
  cyan: "#00f0ff",
  mint: "#06d6a0",
  violet: "#8338ec",
  orange: "#ff5400",
};

const keyById = (i: NexoContentItem) => i.id;

// Función para determinar si un contenido es apto para Kids / Familia / Animación
function isKidsFriendly(item: NexoContentItem): boolean {
  if (item.type === "ANIME") return true;
  const genres = item.genres?.map((g) => g.name.toLowerCase()) || [];
  const kidsKeywords = [
    "animación",
    "animacion",
    "familia",
    "kids",
    "infantil",
    "aventura",
    "fantasía",
    "fantasia",
    "comedia",
  ];
  const hasKidGenre = genres.some((g) =>
    kidsKeywords.some((k) => g.includes(k)),
  );
  const rating = (item.contentRating || "").toUpperCase();
  const isAdultRating =
    rating.includes("18") ||
    rating.includes("R") ||
    rating.includes("TV-MA") ||
    rating.includes("NC-17");
  return hasKidGenre && !isAdultRating;
}

// ── Tarjeta de Contenido Kids para las Filas ─────────────────────────────────
const KidsCard = memo(function KidsCard({
  item,
  onPress,
  accentColor = KIDS_COLORS.yellow,
  trapFocusRight,
}: {
  item: NexoContentItem;
  onPress: (item: NexoContentItem) => void;
  accentColor?: string;
  trapFocusRight?: boolean;
}) {
  return (
    <Focusable
      onPress={() => onPress(item)}
      trapFocusRight={trapFocusRight}
      style={s.card}
      focusedStyle={[s.cardFocused, { borderColor: accentColor }]}
      scaleFocused={1.06}
    >
      <RemoteImage
        uri={item.posterUrl || item.backdropUrl}
        style={StyleSheet.absoluteFill as any}
        contentFit="cover"
        transition={150}
      />
      <LinearGradient
        colors={["transparent", "rgba(9,7,20,0.92)"]}
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
            {item.genres?.[0]?.name || (item.type === "ANIME" ? "Anime" : "Kids")}
          </Text>
          {item.releaseYear ? (
            <Text style={s.cardYear}> • {item.releaseYear}</Text>
          ) : null}
        </View>
      </View>
    </Focusable>
  );
});

// ── Fila de Contenido Kids con botón "Ver Todo" al final ─────────────────────
const KidsRow = memo(function KidsRow({
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
        initialNumToRender={6}
        windowSize={5}
        renderItem={({ item, index }) => (
          <KidsCard
            item={item}
            onPress={onPress}
            accentColor={accentColor}
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

export default function KidsScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();

  const [fontsLoaded] = useFonts({
    Bangers: Bangers_400Regular,
  });

  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);

  // Colecciones de contenido para Kids
  const [heroPool, setHeroPool] = useState<NexoContentItem[]>([]);
  const [trendingKids, setTrendingKids] = useState<NexoContentItem[]>([]);
  const [animatedMovies, setAnimatedMovies] = useState<NexoContentItem[]>([]);
  const [animeAdventures, setAnimeAdventures] = useState<NexoContentItem[]>([]);
  const [kidsSeries, setKidsSeries] = useState<NexoContentItem[]>([]);
  const [topRatedKids, setTopRatedKids] = useState<NexoContentItem[]>([]);

  // ── Cargar contenido de la API filtrado para Kids ───────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [animes, movies, series, topRated] = await Promise.all([
          getContentList({ type: "ANIME", limit: 30 }),
          getContentList({ type: "MOVIE", limit: 50, sort: "popular" }),
          getContentList({ type: "SERIES", limit: 40 }),
          getContentList({ sort: "rating", limit: 35 }),
        ]);

        if (cancelled) return;

        // Filtrar elementos aptos para niños y familia
        const kidsMovies = movies.filter(isKidsFriendly);
        const kidsSer = series.filter(isKidsFriendly);
        const kidsTop = topRated.filter(isKidsFriendly);

        // Armar el pool del Hero con los mejores contenidos animados e infantiles
        const pool = [
          ...animes.slice(0, 5),
          ...kidsMovies.slice(0, 5),
          ...kidsSer.slice(0, 3),
        ].filter(Boolean);

        setHeroPool(pool);
        setTrendingKids([...kidsMovies.slice(0, 10), ...animes.slice(0, 6)]);
        setAnimatedMovies(kidsMovies.slice(0, 16));
        setAnimeAdventures(animes.slice(0, 16));
        setKidsSeries(kidsSer.slice(0, 16));
        setTopRatedKids(kidsTop.slice(0, 16));

        prefetchImages(pool.slice(0, 6).map((x) => x.backdropUrl || x.posterUrl || ""));
      } catch (err) {
        console.warn("Error cargando KidsScreen:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auto-rotación del Hero Kids cada 7.5 segundos ──────────────────────────
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

  // Las 4 portadas que faltan para la cuadrícula 2x2 derecha
  const candidateCovers = useMemo(() => {
    if (heroPool.length <= 1) return [];
    const len = heroPool.length;
    return [
      heroPool[(heroIdx + 1) % len],
      heroPool[(heroIdx + 2) % len],
      heroPool[(heroIdx + 3) % len],
      heroPool[(heroIdx + 4) % len],
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
        <ActivityIndicator size="large" color={KIDS_COLORS.yellow} />
        <Text style={s.loadTxt}>Cargando Mundo Kids...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Fondo ambiental mágico y colorido para Kids */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={["#160c33", "#0b081b", "#06040e"]}
          style={StyleSheet.absoluteFill}
        />
        {/* Velo de nebulosa mágica rosada y cian */}
        <LinearGradient
          colors={["rgba(255, 0, 127, 0.12)", "rgba(0, 240, 255, 0.08)", "transparent"]}
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
        {/* ── SECCIÓN HERO KIDS: 3/4 A LA IZQUIERDA + 2X2 A LA DERECHA ── */}
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
              {/* Degradados cinematográficos para lectura clara */}
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(9,7,20,0.45)",
                  "rgba(9,7,20,0.88)",
                  "rgba(9,7,20,0.98)",
                ]}
                locations={[0, 0.4, 0.75, 1]}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={[
                  "rgba(9,7,20,0.85)",
                  "rgba(9,7,20,0.6)",
                  "transparent",
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0.75, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Contenido dentro del Hero Principal */}
              <View style={s.heroMainContent}>
                {/* Chip divertido */}
                <View style={s.heroTagChip}>
                  <Sparkles size={scale(12)} color={KIDS_COLORS.yellow} />
                  <Text style={s.heroTagTxt}>
                    {activeHero.tagline || "MUNDO KIDS · DIVERSIÓN Y AVENTURAS"}
                  </Text>
                </View>

                {/* Título en tipografía cómic/bangers llamativa */}
                <Text style={s.heroTitle} numberOfLines={2}>
                  {activeHero.title}
                </Text>

                {/* Metadatos infantiles y calificaciones */}
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
                    <Text style={s.metaBadgeTxt}>
                      {activeHero.type === "ANIME" ? "Anime Kids" : "Animación"}
                    </Text>
                  </View>

                  {activeHero.genres?.[0]?.name ? (
                    <View style={[s.metaBadge, s.metaBadgeAlt]}>
                      <Text style={[s.metaBadgeTxt, { color: KIDS_COLORS.cyan }]}>
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
                    scaleFocused={1.06}
                    style={s.btnPlay}
                    focusedStyle={s.btnPlayFocused}
                  >
                    <Play size={scale(16)} color="#000" fill="#000" />
                    <Text style={s.btnPlayTxt}>Ver Ahora</Text>
                  </Focusable>

                  <Focusable
                    onPress={() => handleOpenDetail(activeHero)}
                    scaleFocused={1.06}
                    style={s.btnDetail}
                    focusedStyle={s.btnDetailFocused}
                  >
                    <Info size={scale(15)} color="#ffffff" />
                    <Text style={s.btnDetailTxt}>Detalles</Text>
                  </Focusable>
                </View>
              </View>
            </View>

            {/* 2. REJILLA DERECHA 2X2 DE RECTÁNGULOS CURVOS (AL CLICK ABREN DETALLES) */}
            <View style={s.heroRightGrid}>
              {candidateCovers.map((item, idx) => {
                return (
                  <Focusable
                    key={item.id || idx}
                    onPress={() => handleOpenDetail(item)}
                    trapFocusRight={idx % 2 === 1}
                    scaleFocused={1.06}
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
                      colors={["transparent", "rgba(9,7,20,0.88)"]}
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
                        {item.genres?.[0]?.name || (item.type === "ANIME" ? "Anime" : "Kids")}
                      </Text>
                    </View>
                  </Focusable>
                );
              })}
            </View>
          </View>
        )}

        {/* ── FILAS DE CONTENIDO KIDS ────────────────────────────────────── */}
        <View style={s.contentArea}>
          {/* 1. Tendencias Kids */}
          <KidsRow
            title="Tendencias Infantiles y Familiares"
            subtitle="Los favoritos de todos los peques"
            items={trendingKids}
            accentColor={KIDS_COLORS.pink}
            icon={Smile}
            onPress={handleOpenDetail}
            viewAllSublabel="Más tendencias"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { genre: "Familia" },
              } as any)
            }
          />

          {/* 2. Películas de Animación */}
          <KidsRow
            title="Películas Animadas de Ensueño"
            subtitle="Grandes historias para disfrutar en familia"
            items={animatedMovies}
            accentColor={KIDS_COLORS.cyan}
            icon={Film}
            onPress={handleOpenDetail}
            viewAllSublabel="Todas las pelis"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "MOVIE", genre: "Animación" },
              } as any)
            }
          />

          {/* 3. Anime y Aventuras Mágicas */}
          <KidsRow
            title="Anime y Aventuras Mágicas"
            subtitle="Series fantásticas y héroes asombrosos"
            items={animeAdventures}
            accentColor={KIDS_COLORS.yellow}
            icon={Sparkles}
            onPress={handleOpenDetail}
            viewAllSublabel="Todo el anime"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "ANIME" },
              } as any)
            }
          />

          {/* 4. Series y Dibujos Favoritos */}
          <KidsRow
            title="Series y Dibujos Favoritos"
            subtitle="Capítulos llenos de diversión y risas"
            items={kidsSeries}
            accentColor={KIDS_COLORS.mint}
            icon={Tv}
            onPress={handleOpenDetail}
            viewAllSublabel="Todas las series"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "SERIES", genre: "Animación" },
              } as any)
            }
          />

          {/* 5. Mejor Valoradas */}
          <KidsRow
            title="Las Mejor Valoradas para Niños"
            subtitle="Aclamadas por chicos y grandes"
            items={topRatedKids}
            accentColor={KIDS_COLORS.violet}
            icon={Star}
            onPress={handleOpenDetail}
            viewAllSublabel="Top catálogo"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { sort: "rating" },
              } as any)
            }
          />

          <View style={{ height: scale(60) }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ── ESTILOS DE LA PÁGINA KIDS ────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: KIDS_COLORS.bgDark,
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
    backgroundColor: KIDS_COLORS.bgDark,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(12),
  },
  loadTxt: {
    color: KIDS_COLORS.yellow,
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
    backgroundColor: KIDS_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255, 190, 11, 0.45)",
    shadowColor: KIDS_COLORS.yellow,
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
    backgroundColor: "rgba(255, 190, 11, 0.18)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 190, 11, 0.5)",
    paddingHorizontal: scale(12),
    paddingVertical: scale(4.5),
    borderRadius: scale(12),
    alignSelf: "flex-start",
    marginBottom: scale(10),
  },
  heroTagTxt: {
    color: KIDS_COLORS.yellow,
    fontSize: scale(11.5),
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: "Bangers",
    fontSize: scale(48),
    color: KIDS_COLORS.yellow,
    lineHeight: scale(52),
    letterSpacing: 1,
    marginBottom: scale(8),
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 8,
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
    backgroundColor: KIDS_COLORS.yellow,
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
    backgroundColor: "rgba(255, 0, 127, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 0, 127, 0.5)",
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(5),
  },
  metaBadgeAlt: {
    backgroundColor: "rgba(0, 240, 255, 0.15)",
    borderColor: "rgba(0, 240, 255, 0.45)",
  },
  metaBadgeTxt: {
    fontSize: scale(11),
    fontWeight: "800",
    color: KIDS_COLORS.pink,
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
    backgroundColor: KIDS_COLORS.yellow,
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
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: scale(18),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  btnDetailFocused: {
    backgroundColor: KIDS_COLORS.cyan,
    borderColor: KIDS_COLORS.cyan,
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
    backgroundColor: KIDS_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    position: "relative",
    justifyContent: "flex-end",
  },
  gridCardFocused: {
    borderColor: KIDS_COLORS.yellow,
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
    backgroundColor: KIDS_COLORS.yellow,
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
    color: KIDS_COLORS.cyan,
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
    paddingVertical: scale(6),
    gap: CARD_GAP,
  },

  // ── Tarjeta de Catálogo Kids ──
  card: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: KIDS_COLORS.bgSurface,
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
