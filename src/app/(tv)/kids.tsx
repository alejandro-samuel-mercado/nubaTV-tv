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

const { width: SW, height: SH } = Dimensions.get("window");

// ── Medidas del Layout Kids ──────────────────────────────────────────────────
const SIDEBAR_OFFSET = scale(64);
const CONTENT_LEFT_PAD = scale(96);
const CARD_GAP = scale(14);

const HERO_H = Math.max(scale(374), Math.round(SH * 0.55));

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
const getRowItemLayout = (_: any, index: number) => ({
  length: POSTER_W + CARD_GAP,
  offset: (POSTER_W + CARD_GAP) * index,
  index,
});

const ANIMACION_GENRE_ID = "cmoywh4rc000excl6ffu8fp29";
const FAMILIA_GENRE_ID = "cmoywr6i70003eptrk5wk7ek2";
const KIDS_GENRE_ID = "cmp5ch9ju02y28jz6fy4q0yhg";

const ANIME_TITLE_BLACKLIST =
  /dragon ball|naruto|one piece|bleach|jujutsu|kimetsu|demon slayer|shingeki|attack on titan|chainsaw|boku no hero|my hero academia|evangelion|gundam|overlord|dragon quest|earwig|haru en el reino|sailor moon|saint seiya|inuyasha|death note|fullmetal|hunter x hunter|fairy tail|black clover|tokyo revengers|solo leveling|frieren|dandadan|blue lock|haikyuu|jojo|boruto|dr\.?\s*stone|spy\s*x\s*family|isekai|tensei|mahou|shoujo|shonen|totoro|chihiro|mononoke|howl/i;

const ADULT_OR_NON_KIDS_BLACKLIST =
  /simpson|family guy|padre de familia|rick and morty|rick y morty|south park|bojack|invencible|invincible|arcane|primal|secret level|gatitos explosivos|exploding kittens|velma|smiling friends|pobre diablo|fugget about it|haunted hotel|gary and his demons|por cuatro perras|dang!|digman|among us|x-men|iron man|wendell|la casa|the house|breadwinner|pan de la guerra|mortadelo|spiderwick|kleks|13:\s*el musical|monster hunter|resident evil|solo necesitas matar|all you need is kill|quantum supremacy|corpse bride|novia cad[aá]ver|isla de perros|isle of dogs|ibelin|^74$|navidad de amor|calendario de navidad|soltero hasta navidad|receta para la despedida|pedro el escamoso|en tu mejor momento|aquellos maravillosos a[ñn]os|dangal|[uú]ltimo silbato|june & kopi/i;

const KIDS_FRANCHISE_WHITELIST =
  /lego|disney|pixar|dreamworks|barbie|peppa|bluey|paw patrol|patrulla canina|bob esponja|spongebob|ben 10|gumball|teen titans|j[oó]venes titanes|hora de aventura|adventure time|escandalosos|we bare bears|loud house|casa de locos|rugrats|padrinos m[aá]gicos|oddparents|hey arnold|garfield|pitufos|smurfs|trolls|shrek|toy story|cars|frozen|moana|vaiana|encanto|coco|zootopia|zootr[oó]polis|kung fu panda|c[oó]mo entrenar a tu drag[oó]n|madagascar|minions|mi villano favorito|despicable me|hotel transilvania|transylvania|croods|beb[eé] jefazo|boss baby|mascotas|secret life of pets|sing|¡canta!|sonic|super mario|monster high|my little pony|thomas|pocoy[oó]|masha|pj masks|ladybug|miraculous|phineas|ferb|gravity falls|amphibia|owl house|casa b[uú]ho|steven universe|looney tunes|scooby|tom y jerry|tom and jerry|picapiedra|flintstones|supers[oó]nicos|jetsons|tortugas ninja|ninja turtles|bambi|cenicienta|sirenita|aladd[ií]n|bella y la bestia|pinocho|d[aá]lmatas|rey le[oó]n|lion king|tarz[aá]n|h[eé]rcules|mul[aá]n|pocahontas|lilo|stitch|buscando a nemo|buscando a dory|wall-e|ratatouille|incre[ií]bles|incredibles|monsters,?\s*inc|monstruos s\.?a|intensa-?mente|inside out|del rev[eé]s|luca|turning red|elementos|elemental|bolt|big hero|tadeo jones|larva|boonie bears|klaus|capitan calzoncillos|captain underpants|isla olvidada|forgotten island|parque m[aá]gico|wonder park|pachamama|marmaduke|colmillo blanco|origen de los guardianes|rise of the guardians|abominable|mavka|bee movie|vecinos invasores|over the hedge|hilda|arlo/i;

const KIDS_LIVE_ACTION_WHITELIST =
  /thunderman|hathaway|escuela de rock|school of rock|mech-x4|hollywood arts|victorious|icarly|henry danger|drake & josh|hannah montana|hechiceros|wizards of waverly|zack y cody|suite life|descendientes|descendants|camp rock|high school musical|babe|cerdito valiente|hotel para perros|hotel for dogs|perro al rescate|firehouse dog|liberad a willy|free willy|pensar como un perro|think like a dog|canguro para cazar monstruos|babysitter's guide to monster hunting|eva y beba|ivy \+ bean|pap[aá]s por encargo/i;

// Filtro inteligente y estricto para garantizar que solo aparezca contenido infantil real (sin animes ni películas/series de adultos)
function isKidsFriendly(item: NexoContentItem): boolean {
  if (!item || item.type === "ANIME") return false;

  const title = (item.title || "").trim();
  const origTitle = (item.originalTitle || "").trim();
  const combinedTitle = `${title} ${origTitle}`;

  // 1. Excluir cualquier anime japonés (por idioma original, caracteres kana o franquicias anime)
  if (((item as any).originalLanguage || "").toLowerCase() === "ja") return false;
  if (/[\u3040-\u30ff]/.test(combinedTitle)) return false;
  if (ANIME_TITLE_BLACKLIST.test(combinedTitle)) return false;

  // 2. Excluir animaciones para adultos y títulos no infantiles conocidos
  if (ADULT_OR_NON_KIDS_BLACKLIST.test(combinedTitle)) return false;

  // 3. Excluir clasificaciones por edad de adolescentes/adultos
  const rating = (item.contentRating || "").toUpperCase();
  if (
    rating.includes("18") ||
    rating.includes("16") ||
    rating === "R" ||
    rating.includes("TV-MA") ||
    rating.includes("TV-14") ||
    rating.includes("NC-17")
  ) {
    return false;
  }

  // 4. Analizar géneros del título
  const genres = item.genres?.map((g) => g.name.toLowerCase()) || [];
  const forbiddenGenres = [
    "terror",
    "horror",
    "crimen",
    "crime",
    "suspense",
    "thriller",
    "misterio",
    "bélica",
    "belica",
    "war",
    "guerra",
    "historia",
    "documental",
    "soap",
    "reality",
    "talk",
    "western",
  ];
  // Excepción: Gru Mi villano favorito (Despicable Me) tiene etiqueta "Crimen" en TMDB pero es infantil
  const isDespicableMe = /mi villano favorito|despicable me|minions/i.test(combinedTitle);
  if (!isDespicableMe && genres.some((g) => forbiddenGenres.some((fg) => g.includes(fg)))) {
    return false;
  }

  const hasAnimation = genres.some((g) => g.includes("animación") || g.includes("animacion"));
  const hasFamily = genres.some((g) => g.includes("familia"));
  const hasKids = genres.some((g) => g.includes("kids") || g.includes("infantil"));

  // 5. Regla de inclusión inteligente:
  // - Todo contenido con género explícito "Kids" / "Infantil" (sin drama adulto)
  if (hasKids) return true;
  // - Películas y series de Animación que además sean de Familia o de franquicias infantiles reconocidas
  if (hasAnimation && (hasFamily || KIDS_FRANCHISE_WHITELIST.test(combinedTitle))) {
    return true;
  }
  // - Live-action únicamente si pertenece a series/películas infantiles verificadas (Nickelodeon, Disney Channel, etc.)
  if (hasFamily && KIDS_LIVE_ACTION_WHITELIST.test(combinedTitle)) {
    return true;
  }

  return false;
}

// ── Tarjeta de Contenido Kids para las Filas ─────────────────────────────────
const KidsCard = memo(function KidsCard({
  item,
  onPress,
  onFocus,
  accentColor = KIDS_COLORS.yellow,
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
          <KidsCard
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

interface KidsPageState {
  pool: NexoContentItem[];
  trending: NexoContentItem[];
  moviesList: NexoContentItem[];
  adventureList: NexoContentItem[];
  seriesList: NexoContentItem[];
  topRatedList: NexoContentItem[];
}

function buildKidsPageState(
  animMoviesRecent: NexoContentItem[],
  animMoviesPop: NexoContentItem[],
  animSeriesRecent: NexoContentItem[],
  kidsGenreSeries: NexoContentItem[],
  familyAllRecent: NexoContentItem[],
  animTopRated: NexoContentItem[],
): KidsPageState {
  const dedupe = (arr: NexoContentItem[]) => {
    const seen = new Set<string>();
    return arr.filter((it) => {
      if (!it || !it.id || seen.has(it.id)) return false;
      seen.add(it.id);
      return true;
    });
  };

  // Filtrar estrictamente elementos aptos para niños (0% anime, 0% pelis/series de adultos)
  const kidsRecentMovies = dedupe([
    ...animMoviesRecent,
    ...familyAllRecent.filter((x) => x.type === "MOVIE"),
  ]).filter(isKidsFriendly);

  const kidsPopMovies = dedupe([
    ...animMoviesPop,
    ...kidsRecentMovies,
  ]).filter(isKidsFriendly);

  const kidsSer = dedupe([
    ...kidsGenreSeries,
    ...animSeriesRecent,
    ...familyAllRecent.filter((x) => x.type === "SERIES"),
  ]).filter(isKidsFriendly);

  const kidsTop = dedupe([
    ...animTopRated,
    ...kidsPopMovies,
    ...kidsSer,
  ])
    .filter(isKidsFriendly)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const currentYear = new Date().getFullYear();
  const sortByYear = (arr: NexoContentItem[]) =>
    [...arr].sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));

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

  const allKidsWithArt = dedupe([
    ...kidsRecentMovies,
    ...kidsSer,
    ...kidsPopMovies,
    ...kidsTop,
  ]).filter((x) => Boolean(x && (x.backdropUrl || x.posterUrl)));

  const heroUsed = new Set<string>();
  const currentYearKids = pickDistinct(
    allKidsWithArt.filter((x) => (x.releaseYear || 0) >= currentYear),
    heroUsed,
    16,
  );
  const rawPool =
    currentYearKids.length >= 4
      ? currentYearKids
      : [
          ...currentYearKids,
          ...pickDistinct(
            sortByYear(allKidsWithArt),
            heroUsed,
            16 - currentYearKids.length,
          ),
        ];

  const pool = [...rawPool];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  const trending = pickDistinct([...kidsPopMovies, ...kidsSer], usedIds, 16);
  const moviesList = pickDistinct(
    sortByYear(kidsRecentMovies),
    new Set<string>(),
    16,
  );
  const seriesList = pickDistinct(kidsSer, usedIds, 16);

  const adventurePool = dedupe([...kidsRecentMovies, ...kidsPopMovies, ...kidsSer]).filter(
    (x) =>
      x.genres?.some((g) => {
        const n = g.name.toLowerCase();
        return n.includes("aventura") || n.includes("fantasía") || n.includes("fantasia") || n.includes("comedia");
      }),
  );
  const adventureList = pickDistinct(adventurePool, usedIds, 16);
  const topRatedList = pickDistinct(kidsTop, usedIds, 16);

  const state: KidsPageState = {
    pool,
    trending,
    moviesList,
    adventureList,
    seriesList,
    topRatedList,
  };
  setPageCache("page:kids", state);
  return state;
}

function getInitialKidsState(): KidsPageState | null {
  const cached = getPageCache<KidsPageState>("page:kids");
  if (cached && cached.pool.length > 0) return cached;
  const animMoviesRecent = getContentListSync({ type: "MOVIE", genreId: ANIMACION_GENRE_ID, sort: "recent", limit: 45 });
  const animMoviesPop = getContentListSync({ type: "MOVIE", genreId: ANIMACION_GENRE_ID, sort: "popular", limit: 45 });
  const animSeriesRecent = getContentListSync({ type: "SERIES", genreId: ANIMACION_GENRE_ID, sort: "recent", limit: 45 });
  const kidsGenreSeries = getContentListSync({ type: "SERIES", genreId: KIDS_GENRE_ID, sort: "recent", limit: 40 });
  const familyAllRecent = getContentListSync({ genreId: FAMILIA_GENRE_ID, sort: "recent", limit: 45 });
  const animTopRated = getContentListSync({ genreId: ANIMACION_GENRE_ID, sort: "rating", limit: 45 });
  if (
    animMoviesRecent &&
    animMoviesPop &&
    animSeriesRecent &&
    kidsGenreSeries &&
    familyAllRecent &&
    animTopRated
  ) {
    return buildKidsPageState(
      animMoviesRecent,
      animMoviesPop,
      animSeriesRecent,
      kidsGenreSeries,
      familyAllRecent,
      animTopRated,
    );
  }
  return null;
}

export default function KidsScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();
  const { scrollRef, handleHeroFocus, cancelHeroScroll } = useHeroScrollToTop();

  useFonts({
    Bangers: Bangers_400Regular,
  });

  const initialKids = useMemo(() => getInitialKidsState(), []);
  const [loading, setLoading] = useState(() => !initialKids);
  const [heroIdx, setHeroIdx] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);

  // Colecciones de contenido para Kids
  const [heroPool, setHeroPool] = useState<NexoContentItem[]>(() => initialKids?.pool ?? []);
  const [trendingKids, setTrendingKids] = useState<NexoContentItem[]>(() => initialKids?.trending ?? []);
  const [animatedMovies, setAnimatedMovies] = useState<NexoContentItem[]>(() => initialKids?.moviesList ?? []);
  const [animeAdventures, setAnimeAdventures] = useState<NexoContentItem[]>(() => initialKids?.adventureList ?? []);
  const [kidsSeries, setKidsSeries] = useState<NexoContentItem[]>(() => initialKids?.seriesList ?? []);
  const [topRatedKids, setTopRatedKids] = useState<NexoContentItem[]>(() => initialKids?.topRatedList ?? []);

  // ── Cargar contenido de la API filtrado para Kids con distribución única ───
  useEffect(() => {
    if (initialKids) {
      prefetchImages(initialKids.pool.slice(0, 6).map((x) => x.backdropUrl || x.posterUrl || ""));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [
          animMoviesRecent,
          animMoviesPop,
          animSeriesRecent,
          kidsGenreSeries,
          familyAllRecent,
          animTopRated,
        ] = await Promise.all([
          getContentList({ type: "MOVIE", genreId: ANIMACION_GENRE_ID, sort: "recent", limit: 45 }),
          getContentList({ type: "MOVIE", genreId: ANIMACION_GENRE_ID, sort: "popular", limit: 45 }),
          getContentList({ type: "SERIES", genreId: ANIMACION_GENRE_ID, sort: "recent", limit: 45 }),
          getContentList({ type: "SERIES", genreId: KIDS_GENRE_ID, sort: "recent", limit: 40 }),
          getContentList({ genreId: FAMILIA_GENRE_ID, sort: "recent", limit: 45 }),
          getContentList({ genreId: ANIMACION_GENRE_ID, sort: "rating", limit: 45 }),
        ]);

        if (cancelled) return;

        const state = buildKidsPageState(
          animMoviesRecent,
          animMoviesPop,
          animSeriesRecent,
          kidsGenreSeries,
          familyAllRecent,
          animTopRated,
        );

        setHeroPool(state.pool);
        setTrendingKids(state.trending);
        setAnimatedMovies(state.moviesList);
        setAnimeAdventures(state.adventureList);
        setKidsSeries(state.seriesList);
        setTopRatedKids(state.topRatedList);

        prefetchImages(state.pool.slice(0, 6).map((x) => x.backdropUrl || x.posterUrl || ""));
      } catch (err) {
        console.warn("Error cargando KidsScreen:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialKids]);

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
        ref={scrollRef}
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
                transition={360}
                priority="high"
                disableRecycling
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
                      {activeHero.type === "SERIES" ? "Serie Kids" : "Película Kids"}
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
                    onFocus={handleHeroFocus}
                    nextFocusLeft={sidebarHandle ?? undefined}
                    style={s.btnPlay}
                    focusedStyle={s.btnPlayFocused}
                  >
                    {({ focused }) => (
                      <>
                        <Play size={scale(16)} color="#000000" fill="#000000" />
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

            {/* 2. REJILLA DERECHA 2X2 DE RECTÁNGULOS CURVOS (AL CLICK ABREN DETALLES) */}
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
                        transition={240}
                        disableRecycling
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
                          {item.genres?.[0]?.name || "Kids"}
                        </Text>
                      </View>
                    </View>
                  </Focusable>
                );
              })}

              {/* 4. Botón circular "Ver todo" hacia /explore con filtro Animación/Kids */}
              <HeroGridSeeAllCard
                accentColor={KIDS_COLORS.cyan}
                title="Ver todo"
                onFocus={handleHeroFocus}
                onPress={() =>
                  router.push({
                    pathname: "/(tv)/explore",
                    params: { genreId: "cmoywh4rc000excl6ffu8fp29" },
                  } as any)
                }
              />
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
            onRowFocus={cancelHeroScroll}
            viewAllSublabel="Más tendencias"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { genreId: "cmoywh4rc000excl6ffu8fp29", sort: "popular" },
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
            onRowFocus={cancelHeroScroll}
            viewAllSublabel="Todas las pelis"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { type: "MOVIE", genreId: "cmoywh4rc000excl6ffu8fp29" },
              } as any)
            }
          />

          {/* 3. Aventuras y Fantasía Infantil */}
          <KidsRow
            title="Aventuras y Fantasía Infantil"
            subtitle="Mundos mágicos y personajes inolvidables"
            items={animeAdventures}
            accentColor={KIDS_COLORS.yellow}
            icon={Sparkles}
            onPress={handleOpenDetail}
            onRowFocus={cancelHeroScroll}
            viewAllSublabel="Más aventuras"
            onViewAll={() =>
              router.push({
                pathname: "/(tv)/explore",
                params: { genreId: FAMILIA_GENRE_ID },
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
            onRowFocus={cancelHeroScroll}
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
            onRowFocus={cancelHeroScroll}
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
    gap: scale(12),
    marginBottom: scale(24),
  },

  // ── Hero Principal Izquierdo (3/4 de ancho) ──
  heroMainLeft: {
    flex: 2.35,
    height: "100%",
    borderRadius: scale(18),
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
    paddingHorizontal: scale(22),
    paddingBottom: scale(14),
    zIndex: 2,
    maxWidth: scale(580),
  },
  heroTagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    backgroundColor: "rgba(255, 190, 11, 0.18)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 190, 11, 0.5)",
    paddingHorizontal: scale(10),
    paddingVertical: scale(3),
    borderRadius: scale(10),
    alignSelf: "flex-start",
    marginBottom: scale(6),
  },
  heroTagTxt: {
    color: KIDS_COLORS.yellow,
    fontSize: scale(10),
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  heroTitle: {
    fontFamily: "Bangers",
    fontSize: scale(28),
    color: KIDS_COLORS.yellow,
    lineHeight: scale(31),
    letterSpacing: 1,
    marginBottom: scale(12),
    includeFontPadding: false,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 8,
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
    backgroundColor: KIDS_COLORS.yellow,
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
    backgroundColor: "rgba(255, 0, 127, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 0, 127, 0.5)",
    paddingHorizontal: scale(7),
    paddingVertical: scale(2),
    borderRadius: scale(5),
  },
  metaBadgeAlt: {
    backgroundColor: "rgba(0, 240, 255, 0.15)",
    borderColor: "rgba(0, 240, 255, 0.45)",
  },
  metaBadgeTxt: {
    fontSize: scale(10),
    fontWeight: "800",
    color: KIDS_COLORS.pink,
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
    backgroundColor: KIDS_COLORS.yellow,
    paddingHorizontal: scale(18),
    height: scale(36),
    borderRadius: scale(9),
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnPlayFocused: {
    backgroundColor: "#ffffff",
    borderColor: KIDS_COLORS.yellow,
  },
  btnPlayTxt: {
    color: "#000000",
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
    backgroundColor: KIDS_COLORS.cyan,
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
    backgroundColor: KIDS_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  gridCardInner: {
    flex: 1,
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: KIDS_COLORS.bgSurface,
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
    paddingVertical: scale(14),
    paddingHorizontal: scale(6),
    gap: CARD_GAP,
  },

  // ── Tarjeta de Catálogo Kids ──
  card: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: scale(12),
    backgroundColor: KIDS_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardInner: {
    flex: 1,
    borderRadius: scale(10),
    overflow: "hidden",
    backgroundColor: KIDS_COLORS.bgSurface,
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
