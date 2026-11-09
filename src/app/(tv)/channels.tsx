import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, usePathname, useRouter } from "expo-router";
import {
  Compass,
  Film,
  Globe,
  Heart,
  Layers,
  Music,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Smile,
  Sparkles,
  Star,
  Trophy,
  Tv,
  Tv2,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Focusable from "../../components/tv/Focusable";
import HeroVideo from "../../components/tv/HeroVideo";
import RemoteImage, { prefetchImages } from "../../components/tv/RemoteImage";
import { Channel, useGlobal } from "../../contexts/GlobalContext";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import {
  getContentList,
  getHomepage,
  NexoContentItem,
} from "../../services/nexoplay";
import {
  AppSettings,
  contentIsRestricted,
  loadAppSettings,
} from "../../utils/appSettings";
import {
  getRecentChannelIds,
  recordRecentChannel,
  subscribeRecentChannels,
} from "../../utils/recentChannels";

const { height: SH } = Dimensions.get("window");

// ── Medidas del Layout TV ────────────────────────────────────────────────────
const CONTENT_LEFT_PAD = scale(96);
const CARD_GAP = scale(14);
const HERO_H = Math.max(scale(440), Math.round(SH * 0.65));

// Dimensiones de tarjetas de películas destacadas (formato panorámico 16:9)
const MOVIE_CARD_W = scale(220);
const MOVIE_CARD_H = scale(135);

// ── Paleta Vibrante de Televisión en Vivo ─────────────────────────────────────
const LIVE_COLORS = {
  bgDark: "#070512",
  bgSurface: "#120e24",
  bgSurfaceElevated: "#1b1436",
  accentAmber: "#ffb703",
  neonRed: "#ff0055",
  sportsGreen: "#00f59b",
  moviesGold: "#ffbe0b",
  seriesPurple: "#8338ec",
  newsCyan: "#00f0ff",
  kidsPink: "#ff007f",
  musicMagenta: "#e040fb",
  entertainmentOrange: "#ff5400",
  docsMint: "#06d6a0",
  favHeart: "#f43f5e",
  borderSubtle: "rgba(255, 255, 255, 0.08)",
};

// ── Definición de Categorías Temáticas Inteligentes ──────────────────────────
interface CategoryTheme {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  icon: any;
  keywords: string[];
}

const CATEGORY_THEMES: CategoryTheme[] = [
  {
    id: "sports",
    name: "Deportes en Vivo",
    subtitle: "Fútbol, automovilismo, tenis, básquet y torneos mundiales",
    color: LIVE_COLORS.sportsGreen,
    icon: Trophy,
    keywords: ["sport", "deport", "futbol", "fútbol", "soccer", "espn", "tyc", "fox", "dazn", "nba", "racing"],
  },
  {
    id: "movies",
    name: "Cine y Películas",
    subtitle: "Estrenos, clásicos y las mejores historias de Hollywood",
    color: LIVE_COLORS.moviesGold,
    icon: Film,
    keywords: ["movie", "cine", "pelicul", "film", "hbo", "star", "cinema", "max", "action", "paramount"],
  },
  {
    id: "series",
    name: "Series y Ficción",
    subtitle: "Temporadas completas, dramas y producciones originales",
    color: LIVE_COLORS.seriesPurple,
    icon: Tv,
    keywords: ["series", "serie", "ficcion", "ficción", "drama", "warner", "sony", "universal", "axn", "fx"],
  },
  {
    id: "news",
    name: "Noticias y Directo",
    subtitle: "Información minuto a minuto de Argentina y el mundo",
    color: LIVE_COLORS.newsCyan,
    icon: Globe,
    keywords: ["news", "noticia", "actualidad", "cnn", "tn", "c5n", "bbc", "al jazeera", "ln+", "cronica"],
  },
  {
    id: "kids",
    name: "Mundo Infantil",
    subtitle: "Caricaturas, animación y diversión para chicos",
    color: LIVE_COLORS.kidsPink,
    icon: Smile,
    keywords: ["kid", "infantil", "family", "familiar", "cartoon", "disney", "nick", "junior", "animacion", "anime", "toon"],
  },
  {
    id: "entertainment",
    name: "Entretenimiento",
    subtitle: "Comedia, talk shows, realities y programación estelar",
    color: LIVE_COLORS.entertainmentOrange,
    icon: Sparkles,
    keywords: ["entertain", "entretenimiento", "comedia", "humor", "comedy", "show", "variety", "e!", "tbs"],
  },
  {
    id: "music",
    name: "Música y Ritmo",
    subtitle: "Videoclips, recitales y tus bandas preferidas",
    color: LIVE_COLORS.musicMagenta,
    icon: Music,
    keywords: ["music", "musica", "música", "mtv", "vh1", "radio", "hit", "pop", "rock", "urbano"],
  },
  {
    id: "documentary",
    name: "Documentales",
    subtitle: "Naturaleza salvaje, historia, descubrimientos y viajes",
    color: LIVE_COLORS.docsMint,
    icon: Compass,
    keywords: ["docu", "cultur", "educat", "ciencia", "discovery", "natgeo", "national geographic", "history", "animal"],
  },
];

// Helper con caché para clasificar canal en una categoría temática
const channelThemeCache = new Map<string, CategoryTheme | null>();

function getChannelCategory(ch: Channel): CategoryTheme | null {
  const cached = channelThemeCache.get(ch.id);
  if (cached !== undefined) return cached;

  const target = `${ch.name} ${ch.category?.name || ""} ${ch.groupTitle || ""}`.toLowerCase();
  for (let i = 0; i < CATEGORY_THEMES.length; i++) {
    const theme = CATEGORY_THEMES[i];
    const kws = theme.keywords;
    for (let j = 0; j < kws.length; j++) {
      if (target.includes(kws[j])) {
        channelThemeCache.set(ch.id, theme);
        return theme;
      }
    }
  }
  channelThemeCache.set(ch.id, null);
  return null;
}

// ── Chip de Filtro Superior ──────────────────────────────────────────────────
const FilterPill = memo(function FilterPill({
  id: _id,
  label,
  count,
  isActive,
  color,
  icon: Icon,
  onPress,
  nextFocusLeft,
  trapFocusRight,
}: {
  id: string;
  label: string;
  count?: number;
  isActive: boolean;
  color: string;
  icon: any;
  onPress: () => void;
  nextFocusLeft?: number;
  trapFocusRight?: boolean;
}) {
  return (
    <Focusable
      onPress={onPress}
      nextFocusLeft={nextFocusLeft}
      trapFocusRight={trapFocusRight}
      scaleFocused={1.02}
      style={[
        s.filterPill,
        isActive && {
          backgroundColor: color,
          borderColor: color,
        },
      ]}
      focusedStyle={{
        backgroundColor: color,
        borderColor: "#ffffff",
      }}
    >
      <Icon
        size={scale(13)}
        color={isActive ? "#000000" : color}
        style={{ marginRight: scale(5) }}
      />
      <Text
        style={[
          s.filterPillTxt,
          { color: isActive ? "#000000" : "#ffffff" },
        ]}
      >
        {label}
      </Text>
      {count !== undefined && count > 0 ? (
        <View
          style={[
            s.filterPillBadge,
            {
              backgroundColor: isActive
                ? "rgba(0,0,0,0.25)"
                : "rgba(255,255,255,0.14)",
            },
          ]}
        >
          <Text
            style={[
              s.filterPillBadgeTxt,
              { color: isActive ? "#000000" : "#ffffff" },
            ]}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Focusable>
  );
});

// ── Tarjeta de Película Destacada del Hero (16:9 Panorámica) ────────────────
const MovieHeroCard = memo(function MovieHeroCard({
  item,
  index,
  total,
  onPress,
}: {
  item: NexoContentItem;
  index: number;
  total: number;
  onPress: (item: NexoContentItem) => void;
}) {
  const sidebarHandle = useSidebarHandle();
  const bgImg = item.backdropUrl || item.posterUrl;

  const handlePress = useCallback(() => {
    onPress(item);
  }, [onPress, item]);

  return (
    <Focusable
      onPress={handlePress}
      nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
      trapFocusRight={index === total - 1}
      scaleFocused={1.02}
      style={s.movieCard}
      focusedStyle={s.movieCardFocused}
    >
      <RemoteImage
        uri={bgImg}
        style={StyleSheet.absoluteFill as any}
        contentFit="cover"
        transition={150}
      />
      <LinearGradient
        colors={["transparent", "rgba(7,5,18,0.45)", "rgba(7,5,18,0.94)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Badges superiores: CINE y Calificación */}
      <View style={s.movieTopRow}>
        <View style={s.movieBadgeDestacado}>
          <Film size={scale(10)} color="#000000" />
          <Text style={s.movieBadgeDestacadoTxt}>CINE</Text>
        </View>

        {item.rating ? (
          <View style={s.movieRatingBadge}>
            <Star
              size={scale(10)}
              color={LIVE_COLORS.moviesGold}
              fill={LIVE_COLORS.moviesGold}
            />
            <Text style={s.movieRatingTxt}>{item.rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      {/* Info Inferior de la Película */}
      <View style={s.movieCardInfo}>
        <Text style={s.movieCardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={s.movieCardMetaRow}>
          {item.genres?.[0]?.name ? (
            <Text style={s.movieCardGenre}>{item.genres[0].name}</Text>
          ) : null}
          {item.releaseYear ? (
            <Text style={s.movieCardYear}> • {item.releaseYear}</Text>
          ) : null}
          {item.duration ? (
            <Text style={s.movieCardYear}> • {item.duration}m</Text>
          ) : null}
        </View>
      </View>
    </Focusable>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: ChannelsScreen
// ═════════════════════════════════════════════════════════════════════════════
export default function ChannelsScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();
  const pathname = usePathname();
  const isChannelsRoute = pathname.includes("channels");

  const {
    channels,
    activeChannel,
    setActiveChannel,
    favorites,
    toggleFavorite,
    loading: channelsLoading,
  } = useGlobal();

  // Control parental
  const [settings, setSettings] = useState<Pick<AppSettings, "parentalLock" | "hideRestricted">>({
    parentalLock: false,
    hideRestricted: false,
  });

  useEffect(() => {
    loadAppSettings().then((s) => {
      setSettings({
        parentalLock: !!s.parentalLock,
        hideRestricted: !!s.hideRestricted,
      });
    });
  }, []);

  // Filtro de categoría seleccionada
  const [selectedCatId, setSelectedCatId] = useState<string>("all");

  // Estado del reproductor de video en el Hero
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const debounceTimerRef = useRef<any>(null);
  const initialRandomDoneRef = useRef(false);

  // ── Historial Real de Canales Vistos (Persistente en Storage) ─────────────
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    getRecentChannelIds().then(setRecentIds);
    const unsubscribe = subscribeRecentChannels(setRecentIds);
    return () => unsubscribe();
  }, []);

  // ── Películas del Hero (Manuales desde el Panel / Más relevantes) ──────────
  const [heroMovies, setHeroMovies] = useState<NexoContentItem[]>([]);
  const [moviesLoading, setMoviesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMoviesLoading(true);
        const hp = await getHomepage().catch(() => null);
        const manualMovies = (hp?.heroItems || []).filter(
          (it) => it.type === "MOVIE" || !it.type,
        );
        if (!cancelled && manualMovies.length > 0) {
          setHeroMovies(manualMovies);
          prefetchImages(
            manualMovies
              .map((m) => m.backdropUrl || m.posterUrl)
              .filter(Boolean) as string[],
          );
          return;
        }

        // Si no hay manuales del panel, cargar las películas más populares y relevantes
        const popMovies = await getContentList({
          type: "MOVIE",
          sort: "popular",
          limit: 18,
        }).catch(() => []);
        if (!cancelled) {
          setHeroMovies(popMovies);
          prefetchImages(
            popMovies
              .map((m) => m.backdropUrl || m.posterUrl)
              .filter(Boolean) as string[],
          );
        }
      } catch (err) {
        console.warn("Error cargando películas destacadas en ChannelsScreen:", err);
      } finally {
        if (!cancelled) setMoviesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtrar canales bloqueados por control parental
  const allowedChannels = useMemo(() => {
    if (!settings.parentalLock && !settings.hideRestricted) return channels;
    return channels.filter(
      (ch) => !contentIsRestricted(ch.groupTitle || ch.category?.name || ""),
    );
  }, [channels, settings]);

  // Apagar inmediatamente el video al cambiar de ruta para liberar recursos
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);

      return () => {
        setIsScreenFocused(false);
        setPreviewUrl(null);
        setVideoLoading(false);
      };
    }, []),
  );

  // Seleccionar canal inicial sólo una vez al cargar si no hay ninguno activo
  useEffect(() => {
    if (!initialRandomDoneRef.current && allowedChannels.length > 0) {
      initialRandomDoneRef.current = true;
      if (!activeChannel) {
        // Si hay un canal reciente guardado, inicializar con el más reciente
        if (recentIds.length > 0) {
          const firstRecent = allowedChannels.find((c) => c.id === recentIds[0]);
          if (firstRecent) {
            setActiveChannel(firstRecent);
            return;
          }
        }
        const randomIdx = Math.floor(Math.random() * allowedChannels.length);
        const randomCh = allowedChannels[randomIdx];
        if (randomCh) {
          setActiveChannel(randomCh);
        }
      }
    }
  }, [allowedChannels, activeChannel, setActiveChannel, recentIds]);

  // Debounce optimizado (650ms) para cargar vista previa en el Hero
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!isScreenFocused || !isChannelsRoute || !activeChannel?.url) {
      setPreviewUrl(null);
      setVideoLoading(false);
      return;
    }

    setVideoLoading(true);
    setVideoError(false);

    debounceTimerRef.current = setTimeout(() => {
      setPreviewUrl(activeChannel.url);
    }, 650);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [activeChannel?.url, isScreenFocused, isChannelsRoute]);

  // Registrar en historial reciente cada vez que activeChannel cambia
  useEffect(() => {
    if (activeChannel?.id) {
      recordRecentChannel(activeChannel.id);
    }
  }, [activeChannel?.id]);

  // Tema activo correspondiente al canal seleccionado
  const activeTheme = useMemo(() => {
    if (!activeChannel) return CATEGORY_THEMES[0];
    return getChannelCategory(activeChannel) || CATEGORY_THEMES[0];
  }, [activeChannel]);

  // Canales agrupados por temáticas
  const themedGroups = useMemo(() => {
    const map = new Map<string, Channel[]>();
    CATEGORY_THEMES.forEach((t) => map.set(t.id, []));

    const others: Channel[] = [];

    allowedChannels.forEach((ch) => {
      const theme = getChannelCategory(ch);
      if (theme) {
        map.get(theme.id)?.push(ch);
      } else {
        others.push(ch);
      }
    });

    return { map, others };
  }, [allowedChannels]);

  // Canales Favoritos con Set O(1)
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const favChannels = useMemo(() => {
    return allowedChannels.filter((c) => favSet.has(c.id));
  }, [allowedChannels, favSet]);

  // ── Últimos Canales Vistos para la Cuadrícula 2x2 Lateral en el Hero ────────
  const recentDisplayChannels = useMemo(() => {
    if (allowedChannels.length === 0) return [];

    const resolved = recentIds
      .map((id) => allowedChannels.find((c) => c.id === id))
      .filter((c): c is Channel => Boolean(c));

    const seen = new Set<string>();
    const uniqueRecent: Channel[] = [];

    for (const ch of resolved) {
      if (!seen.has(ch.id)) {
        seen.add(ch.id);
        uniqueRecent.push(ch);
      }
    }

    // Asegurar que el canal activo actual esté incluido al inicio
    if (activeChannel && !seen.has(activeChannel.id)) {
      uniqueRecent.unshift(activeChannel);
      seen.add(activeChannel.id);
    }

    // Completar hasta 4 si aún hay menos de 4 canales en el historial
    const pool = [...uniqueRecent];
    for (const ch of allowedChannels) {
      if (pool.length >= 4) break;
      if (!seen.has(ch.id)) {
        seen.add(ch.id);
        pool.push(ch);
      }
    }

    return pool.slice(0, 4);
  }, [allowedChannels, recentIds, activeChannel]);

  // ── Generación de Etiquetas / Categorías Inteligentes del Sistema ───────────
  const smartCategories = useMemo(() => {
    const result: {
      id: string;
      label: string;
      count: number;
      color: string;
      icon: any;
      channels: Channel[];
    }[] = [];

    // 1. Todos los Canales
    result.push({
      id: "all",
      label: "Todos los Canales",
      count: allowedChannels.length,
      color: LIVE_COLORS.accentAmber,
      icon: Layers,
      channels: allowedChannels,
    });

    // 2. Mis Favoritos (si existen)
    if (favChannels.length > 0) {
      result.push({
        id: "favorites",
        label: "Mis Favoritos",
        count: favChannels.length,
        color: LIVE_COLORS.favHeart,
        icon: Heart,
        channels: favChannels,
      });
    }

    // 3. Recientes (si existen)
    const validRecents = recentIds
      .map((id) => allowedChannels.find((c) => c.id === id))
      .filter((c): c is Channel => Boolean(c));
    if (validRecents.length > 0) {
      result.push({
        id: "recent",
        label: "Recientes",
        count: validRecents.length,
        color: LIVE_COLORS.newsCyan,
        icon: RotateCcw,
        channels: validRecents,
      });
    }

    // 4. Categorías temáticas con canales reales
    for (const theme of CATEGORY_THEMES) {
      const list = themedGroups.map.get(theme.id) || [];
      if (list.length > 0) {
        result.push({
          id: theme.id,
          label: theme.name.split(" ")[0],
          count: list.length,
          color: theme.color,
          icon: theme.icon,
          channels: list,
        });
      }
    }

    // 5. Categorías dinámicas detectadas en los metadatos de las listas
    const groupMap = new Map<string, Channel[]>();
    for (const ch of allowedChannels) {
      const grp = (ch.groupTitle || ch.category?.name || "").trim();
      if (grp && grp.length > 2 && !getChannelCategory(ch)) {
        const curr = groupMap.get(grp) || [];
        curr.push(ch);
        groupMap.set(grp, curr);
      }
    }

    const dynamicPalette = ["#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#fb923c"];
    let palIdx = 0;
    for (const [groupName, grpChannels] of groupMap.entries()) {
      if (grpChannels.length >= 2 && result.length < 15) {
        result.push({
          id: `dyn_${groupName.toLowerCase().replace(/\s+/g, "_")}`,
          label: groupName,
          count: grpChannels.length,
          color: dynamicPalette[palIdx % dynamicPalette.length],
          icon: Globe,
          channels: grpChannels,
        });
        palIdx++;
      }
    }

    return result;
  }, [allowedChannels, favChannels, recentIds, themedGroups]);

  // Navegar a Pantalla Completa
  const handleOpenFullscreen = useCallback(
    (ch?: Channel) => {
      const target = ch || activeChannel;
      if (!target) return;
      recordRecentChannel(target.id);
      router.push({
        pathname: "/player",
        params: { channelId: target.id, channelUrl: target.url },
      } as any);
    },
    [activeChannel, router],
  );

  // Manejar click en la rejilla 2x2 lateral de últimos vistos
  const handleHeroGridPress = useCallback(
    (item: Channel) => {
      recordRecentChannel(item.id);
      if (activeChannel?.id === item.id) {
        handleOpenFullscreen(item);
      } else {
        setActiveChannel(item);
      }
    },
    [activeChannel?.id, handleOpenFullscreen, setActiveChannel],
  );

  // Manejar selección de etiqueta/categoría: sintoniza canal de esa categoría
  const handleCategoryPillPress = useCallback(
    (cat: { id: string; channels: Channel[] }) => {
      setSelectedCatId(cat.id);
      if (cat.channels.length > 0) {
        const currentIdx = cat.channels.findIndex((c) => c.id === activeChannel?.id);
        if (currentIdx !== -1) {
          // Si ya está reproduciendo esa categoría, hacer zapping al siguiente canal
          const nextIdx = (currentIdx + 1) % cat.channels.length;
          const nextCh = cat.channels[nextIdx];
          setActiveChannel(nextCh);
          recordRecentChannel(nextCh.id);
        } else {
          const firstCh = cat.channels[0];
          setActiveChannel(firstCh);
          recordRecentChannel(firstCh.id);
        }
      }
    },
    [activeChannel?.id, setActiveChannel],
  );

  // Manejar click en película destacada
  const handleMoviePress = useCallback(
    (item: NexoContentItem) => {
      router.push({
        pathname: "/detail",
        params: { slug: item.slug },
      } as any);
    },
    [router],
  );

  // Zapping: Canal Anterior
  const handlePrevChannel = useCallback(() => {
    if (allowedChannels.length === 0 || !activeChannel) return;
    const idx = allowedChannels.findIndex((c) => c.id === activeChannel.id);
    const prevIdx = idx <= 0 ? allowedChannels.length - 1 : idx - 1;
    const prevCh = allowedChannels[prevIdx];
    setActiveChannel(prevCh);
    recordRecentChannel(prevCh.id);
  }, [allowedChannels, activeChannel, setActiveChannel]);

  // Zapping: Canal Siguiente
  const handleNextChannel = useCallback(() => {
    if (allowedChannels.length === 0 || !activeChannel) return;
    const idx = allowedChannels.findIndex((c) => c.id === activeChannel.id);
    const nextIdx = (idx + 1) % allowedChannels.length;
    const nextCh = allowedChannels[nextIdx];
    setActiveChannel(nextCh);
    recordRecentChannel(nextCh.id);
  }, [allowedChannels, activeChannel, setActiveChannel]);

  // Toggle Favorito del canal actual
  const handleToggleFav = useCallback(() => {
    if (activeChannel) {
      toggleFavorite(activeChannel.id);
    }
  }, [activeChannel, toggleFavorite]);

  const isCurrentFav = !!activeChannel && favSet.has(activeChannel.id);

  // Layout matemático fijo para FlatList de películas a 60fps
  const getMovieItemLayout = useCallback(
    (_: any, index: number) => ({
      length: MOVIE_CARD_W + CARD_GAP,
      offset: (MOVIE_CARD_W + CARD_GAP) * index,
      index,
    }),
    [],
  );

  // ── Pantalla de Carga ──────────────────────────────────────────────────────
  if (channelsLoading && allowedChannels.length === 0) {
    return (
      <View style={s.centerLoad}>
        <ActivityIndicator size="large" color={LIVE_COLORS.accentAmber} />
        <Text style={s.loadTxt}>Sintonizando Canales en Vivo...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Fondo ambiental profundo y nebulosa neón */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={["#0e0921", "#070512", "#04030a"]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[
            "rgba(255, 183, 3, 0.08)",
            "rgba(0, 240, 255, 0.05)",
            "rgba(131, 56, 236, 0.04)",
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === "android"}
      >
        {/* ════════════════════════════════════════════════════════════════════
            1. MASTER BROADCAST HERO STAGE (70% Player + 30% Canales Recientes)
           ════════════════════════════════════════════════════════════════════ */}
        {activeChannel && (
          <View style={s.heroContainer}>
            {/* Lado Izquierdo (70%): Gran Escenario de Transmisión con Video */}
            <View
              style={[
                s.heroMainStage,
                {
                  borderColor: `${activeTheme.color}50`,
                  shadowColor: activeTheme.color,
                },
              ]}
            >
              {/* Video en Vivo con HeroVideo universal */}
              {isScreenFocused && isChannelsRoute && previewUrl && !videoError ? (
                <HeroVideo
                  key={previewUrl}
                  uri={previewUrl}
                  muted={false}
                  onError={() => {
                    setVideoLoading(false);
                    setVideoError(true);
                  }}
                  onCanPlay={() => {
                    setVideoLoading(false);
                    setVideoError(false);
                  }}
                />
              ) : (
                <View style={s.heroFallbackStage}>
                  {activeChannel.logo ? (
                    <RemoteImage
                      uri={activeChannel.logo}
                      style={s.heroFallbackLogo as any}
                      contentFit="contain"
                    />
                  ) : (
                    <Tv2 size={scale(64)} color={activeTheme.color} />
                  )}
                  <Text style={s.heroFallbackTxt}>Señal en Directo</Text>
                </View>
              )}

              {/* Degradados cinematográficos sobre el reproductor */}
              <LinearGradient
                colors={[
                  "rgba(7,5,18,0.3)",
                  "transparent",
                  "rgba(7,5,18,0.75)",
                  "rgba(7,5,18,0.96)",
                ]}
                locations={[0, 0.25, 0.65, 1]}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={["rgba(7,5,18,0.85)", "rgba(7,5,18,0.4)", "transparent"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0.65, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Indicador de Buffering / Cargando */}
              {videoLoading && (
                <View style={s.heroLoadingOverlay}>
                  <ActivityIndicator size="small" color={activeTheme.color} />
                  <Text style={[s.heroLoadingTxt, { color: activeTheme.color }]}>
                    Conectando transmisión...
                  </Text>
                </View>
              )}

              {/* Badges Flotantes Superiores en el Hero */}
              <View style={s.heroTopBar}>
                <View style={s.heroLivePill}>
                  <View style={s.heroLiveDot} />
                  <Text style={s.heroLiveTxt}>EN VIVO</Text>
                </View>

                <View
                  style={[
                    s.heroCatBadge,
                    {
                      backgroundColor: `${activeTheme.color}25`,
                      borderColor: activeTheme.color,
                    },
                  ]}
                >
                  <activeTheme.icon size={scale(12)} color={activeTheme.color} />
                  <Text style={[s.heroCatBadgeTxt, { color: activeTheme.color }]}>
                    {activeTheme.name.toUpperCase()}
                  </Text>
                </View>

                <View style={s.heroQualityBadge}>
                  <Text style={s.heroQualityTxt}>1080p FULL HD</Text>
                </View>
              </View>

              {/* Contenido Inferior del Hero: Info y Botones de Control Remoto */}
              <View style={s.heroBottomContent}>
                <View style={s.heroTitleRow}>
                  {activeChannel.logo ? (
                    <View style={s.heroChannelLogoWrap}>
                      <RemoteImage
                        uri={activeChannel.logo}
                        style={s.heroChannelLogo as any}
                        contentFit="contain"
                      />
                    </View>
                  ) : null}

                  <View style={s.heroTitleTextWrap}>
                    <Text style={s.heroTitle} numberOfLines={1}>
                      {activeChannel.name}
                    </Text>
                    <View style={s.heroMetaLine}>
                      <Text style={[s.heroMetaHighlight, { color: activeTheme.color }]}>
                        {activeChannel.category?.name || activeChannel.groupTitle || "General"}
                      </Text>
                      {activeChannel.country ? (
                        <Text style={s.heroMetaItem}> • {activeChannel.country}</Text>
                      ) : null}
                      {activeChannel.language ? (
                        <Text style={s.heroMetaItem}> • {activeChannel.language}</Text>
                      ) : null}
                      <Text style={s.heroMetaItem}> • 60 FPS • Estéreo</Text>
                    </View>
                  </View>
                </View>

                {/* Fila de Botones de Control Remoto */}
                <View style={s.heroBtnRow}>
                  <Focusable
                    hasTVPreferredFocus
                    onPress={() => handleOpenFullscreen()}
                    nextFocusLeft={sidebarHandle ?? undefined}
                    style={[s.btnFullscreen, { backgroundColor: activeTheme.color }]}
                    focusedStyle={s.btnFullscreenFocused}
                  >
                    <Play size={scale(16)} color="#000000" fill="#000000" />
                    <Text style={s.btnFullscreenTxt}>Pantalla Completa</Text>
                  </Focusable>

                  <Focusable
                    onPress={handleToggleFav}
                    style={[
                      s.btnHeroSecondary,
                      isCurrentFav && {
                        borderColor: LIVE_COLORS.favHeart,
                        backgroundColor: "rgba(244, 63, 94, 0.2)",
                      },
                    ]}
                    focusedStyle={{
                      backgroundColor: LIVE_COLORS.favHeart,
                      borderColor: "#ffffff",
                    }}
                  >
                    <Heart
                      size={scale(15)}
                      color="#ffffff"
                      fill={isCurrentFav ? "#ffffff" : "transparent"}
                    />
                    <Text style={s.btnHeroSecondaryTxt}>
                      {isCurrentFav ? "En Favoritos" : "Favorito"}
                    </Text>
                  </Focusable>

                  <Focusable
                    onPress={handlePrevChannel}
                    style={s.btnHeroIcon}
                    focusedStyle={s.btnHeroIconFocused}
                  >
                    <SkipBack size={scale(16)} color="#ffffff" />
                  </Focusable>

                  <Focusable
                    onPress={handleNextChannel}
                    style={s.btnHeroIcon}
                    focusedStyle={s.btnHeroIconFocused}
                  >
                    <SkipForward size={scale(16)} color="#ffffff" />
                  </Focusable>
                </View>
              </View>
            </View>

            {/* Lado Derecho (30%): Últimos Canales Vistos (Real & Persistente) */}
            <View style={s.heroRightContainer}>
              <View style={s.recentHeaderRow}>
                <View style={s.recentHeaderIconWrap}>
                  <RotateCcw size={scale(12)} color={LIVE_COLORS.accentAmber} />
                </View>
                <Text style={s.recentHeaderTitle}>ÚLTIMOS CANALES VISTOS</Text>
                <View style={s.recentBadge}>
                  <Text style={s.recentBadgeTxt}>{recentDisplayChannels.length}</Text>
                </View>
              </View>

              <View style={s.heroRightGrid}>
                {recentDisplayChannels.map((item, idx) => {
                  const itemTheme = getChannelCategory(item) || CATEGORY_THEMES[0];
                  const isCurrentActive = activeChannel?.id === item.id;
                  return (
                    <Focusable
                      key={item.id}
                      onPress={() => handleHeroGridPress(item)}
                      trapFocusRight={idx % 2 === 1}
                      scaleFocused={1.02}
                      style={[
                        s.gridCard,
                        isCurrentActive && {
                          borderColor: LIVE_COLORS.accentAmber,
                          backgroundColor: "rgba(255, 183, 3, 0.14)",
                        },
                      ]}
                      focusedStyle={[
                        s.gridCardFocused,
                        {
                          borderColor: itemTheme.color,
                        },
                      ]}
                    >
                      {/* Badge VIVO / ACTUAL */}
                      <View
                        style={[
                          s.gridCardLive,
                          isCurrentActive && {
                            backgroundColor: "rgba(255,183,3,0.25)",
                            borderColor: LIVE_COLORS.accentAmber,
                          },
                        ]}
                      >
                        <View
                          style={[
                            s.gridCardLiveDot,
                            isCurrentActive && { backgroundColor: LIVE_COLORS.accentAmber },
                          ]}
                        />
                        <Text
                          style={[
                            s.gridCardLiveTxt,
                            isCurrentActive && { color: LIVE_COLORS.accentAmber },
                          ]}
                        >
                          {isCurrentActive ? "ACTUAL" : "VISTO"}
                        </Text>
                      </View>

                      {/* Logo del Canal */}
                      <View style={s.gridCardLogoBox}>
                        {item.logo ? (
                          <RemoteImage
                            uri={item.logo}
                            style={s.gridCardLogo as any}
                            contentFit="contain"
                            transition={100}
                          />
                        ) : (
                          <Tv2 size={scale(20)} color={itemTheme.color} />
                        )}
                      </View>

                      {/* Nombre y categoría */}
                      <View style={s.gridCardInfo}>
                        <Text style={s.gridCardTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text
                          style={[s.gridCardCat, { color: itemTheme.color }]}
                          numberOfLines={1}
                        >
                          {item.category?.name || item.groupTitle || "General"}
                        </Text>
                      </View>
                    </Focusable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            2. CINTA DE ETIQUETAS Y CATEGORÍAS INTELIGENTES DEL SISTEMA
           ════════════════════════════════════════════════════════════════════ */}
        <View style={s.filterRibbonSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterRibbonTrack}
          >
            {smartCategories.map((cat, idx, arr) => {
              const isFirst = idx === 0;
              const isLast = idx === arr.length - 1;
              return (
                <FilterPill
                  key={cat.id}
                  id={cat.id}
                  label={cat.label}
                  count={cat.count}
                  isActive={selectedCatId === cat.id}
                  color={cat.color}
                  icon={cat.icon}
                  nextFocusLeft={isFirst ? sidebarHandle ?? undefined : undefined}
                  trapFocusRight={isLast}
                  onPress={() => handleCategoryPillPress(cat)}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* ════════════════════════════════════════════════════════════════════
            3. PRIMERA Y ÚNICA SECCIÓN: PELÍCULAS DESTACADAS (HERO DE PELÍCULAS)
           ════════════════════════════════════════════════════════════════════ */}
        <View style={s.movieSectionWrapper}>
          {/* Cabecera de la Sección de Películas */}
          <View style={s.movieSectionHeader}>
            <View style={s.movieSectionTitleGroup}>
              <View style={s.movieAccentBar} />
              <Film
                size={scale(18)}
                color={LIVE_COLORS.moviesGold}
                style={{ marginRight: scale(8) }}
              />
              <Text style={s.movieSectionTitle}>Películas Destacadas</Text>
              <Text style={s.movieSectionSubtitle}>
                Cartelera estelar y títulos recomendados
              </Text>
            </View>

            <View style={s.movieCountPill}>
              <Text style={s.movieCountTxt}>
                {heroMovies.length} {heroMovies.length === 1 ? "título" : "títulos"}
              </Text>
            </View>
          </View>

          {/* Carrusel Horizontal de Películas */}
          {moviesLoading && heroMovies.length === 0 ? (
            <View style={s.movieLoadingRow}>
              <ActivityIndicator size="small" color={LIVE_COLORS.moviesGold} />
              <Text style={s.movieLoadingTxt}>Cargando cartelera destacada...</Text>
            </View>
          ) : (
            <FlatList
              data={heroMovies}
              keyExtractor={(item) => String(item.id || item.slug)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.movieTrack}
              initialNumToRender={6}
              maxToRenderPerBatch={4}
              windowSize={3}
              getItemLayout={getMovieItemLayout}
              removeClippedSubviews={Platform.OS === "android"}
              renderItem={({ item, index }) => (
                <MovieHeroCard
                  item={item}
                  index={index}
                  total={heroMovies.length}
                  onPress={handleMoviePress}
                />
              )}
            />
          )}
        </View>

        <View style={{ height: scale(40) }} />
      </ScrollView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ESTILOS DE LA PANTALLA
// ═════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LIVE_COLORS.bgDark,
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
    backgroundColor: LIVE_COLORS.bgDark,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(12),
  },
  loadTxt: {
    color: LIVE_COLORS.accentAmber,
    fontSize: scale(15),
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // ── 1. Master Broadcast Hero Stage ──
  heroContainer: {
    height: HERO_H,
    flexDirection: "row",
    alignItems: "stretch",
    gap: scale(14),
    marginBottom: scale(20),
  },

  // Lado Izquierdo (70%): Gran Escenario de Reproducción
  heroMainStage: {
    flex: 2.7,
    height: "100%",
    borderRadius: scale(20),
    overflow: "hidden",
    backgroundColor: LIVE_COLORS.bgSurface,
    borderWidth: 2,
    shadowOpacity: 0.25,
    shadowRadius: scale(10),
    elevation: 8,
    position: "relative",
    justifyContent: "flex-end",
  },
  heroFallbackStage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d0a1c",
    gap: scale(10),
  },
  heroFallbackLogo: {
    width: scale(140),
    height: scale(80),
  },
  heroFallbackTxt: {
    color: "rgba(255,255,255,0.6)",
    fontSize: scale(14),
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  heroLoadingOverlay: {
    position: "absolute",
    top: scale(20),
    right: scale(20),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    zIndex: 10,
  },
  heroLoadingTxt: {
    fontSize: scale(11.5),
    fontWeight: "800",
  },

  // Badges Flotantes Superiores
  heroTopBar: {
    position: "absolute",
    top: scale(18),
    left: scale(22),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    zIndex: 5,
  },
  heroLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(255, 0, 85, 0.25)",
    borderWidth: 1.2,
    borderColor: LIVE_COLORS.neonRed,
    paddingHorizontal: scale(10),
    paddingVertical: scale(4.5),
    borderRadius: scale(8),
  },
  heroLiveDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(3.5),
    backgroundColor: LIVE_COLORS.neonRed,
  },
  heroLiveTxt: {
    color: "#ffffff",
    fontSize: scale(11),
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  heroCatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    paddingHorizontal: scale(10),
    paddingVertical: scale(4.5),
    borderRadius: scale(8),
    borderWidth: 1,
  },
  heroCatBadgeTxt: {
    fontSize: scale(11),
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  heroQualityBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: scale(9),
    paddingVertical: scale(4.5),
    borderRadius: scale(8),
  },
  heroQualityTxt: {
    color: "rgba(255,255,255,0.85)",
    fontSize: scale(10.5),
    fontWeight: "800",
  },

  // Contenido Inferior del Hero
  heroBottomContent: {
    paddingHorizontal: scale(26),
    paddingBottom: scale(22),
    zIndex: 4,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(16),
    marginBottom: scale(14),
  },
  heroChannelLogoWrap: {
    width: scale(68),
    height: scale(52),
    borderRadius: scale(12),
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    padding: scale(4),
  },
  heroChannelLogo: {
    width: "100%",
    height: "100%",
  },
  heroTitleTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: scale(34),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.5,
    marginBottom: scale(4),
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
  },
  heroMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: scale(4),
  },
  heroMetaHighlight: {
    fontSize: scale(13),
    fontWeight: "800",
  },
  heroMetaItem: {
    fontSize: scale(12.5),
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
  },

  // Botones de Acción en el Hero
  heroBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  btnFullscreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    paddingHorizontal: scale(20),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnFullscreenFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  btnFullscreenTxt: {
    color: "#000000",
    fontSize: scale(14),
    fontWeight: "900",
  },
  btnHeroSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(7),
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: scale(16),
    height: scale(42),
    borderRadius: scale(10),
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  btnHeroSecondaryTxt: {
    color: "#ffffff",
    fontSize: scale(13.5),
    fontWeight: "800",
  },
  btnHeroIcon: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(10),
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnHeroIconFocused: {
    backgroundColor: LIVE_COLORS.accentAmber,
    borderColor: "#ffffff",
    shadowColor: LIVE_COLORS.accentAmber,
    shadowOpacity: 0.5,
    shadowRadius: scale(6),
  },

  // Lado Derecho (30%): Contenedor de Últimos Canales Vistos
  heroRightContainer: {
    flex: 1.3,
    height: "100%",
    justifyContent: "space-between",
  },
  recentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: scale(8),
    gap: scale(7),
  },
  recentHeaderIconWrap: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: "rgba(255, 183, 3, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  recentHeaderTitle: {
    fontSize: scale(11.5),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.8,
  },
  recentBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(1.5),
    borderRadius: scale(6),
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  recentBadgeTxt: {
    fontSize: scale(10),
    fontWeight: "800",
    color: LIVE_COLORS.accentAmber,
  },

  // Rejilla 2x2
  heroRightGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "space-between",
  },
  gridCard: {
    width: "48.5%",
    height: "47.5%",
    borderRadius: scale(14),
    overflow: "hidden",
    backgroundColor: LIVE_COLORS.bgSurfaceElevated,
    borderWidth: 2,
    borderColor: LIVE_COLORS.borderSubtle,
    position: "relative",
    justifyContent: "space-between",
    padding: scale(10),
  },
  gridCardFocused: {
    zIndex: 10,
  },
  gridCardLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    alignSelf: "flex-end",
  },
  gridCardLiveDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(2.5),
    backgroundColor: "#ffffff",
  },
  gridCardLiveTxt: {
    fontSize: scale(8.5),
    fontWeight: "900",
    color: "#fff",
  },
  gridCardLogoBox: {
    width: "100%",
    height: scale(42),
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardLogo: {
    width: "75%",
    height: "100%",
  },
  gridCardInfo: {
    marginTop: scale(4),
  },
  gridCardTitle: {
    color: "#ffffff",
    fontSize: scale(11.5),
    fontWeight: "900",
  },
  gridCardCat: {
    fontSize: scale(10),
    fontWeight: "800",
    marginTop: scale(2),
  },

  // ── 2. Cinta de Filtros y Etiquetas Inteligentes ──
  filterRibbonSection: {
    marginBottom: scale(20),
  },
  filterRibbonTrack: {
    flexDirection: "row",
    gap: scale(10),
    paddingVertical: scale(4),
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: scale(14),
    paddingVertical: scale(7),
    borderRadius: scale(10),
  },
  filterPillTxt: {
    fontSize: scale(12.5),
    fontWeight: "800",
  },
  filterPillBadge: {
    marginLeft: scale(8),
    paddingHorizontal: scale(6),
    paddingVertical: scale(1.5),
    borderRadius: scale(8),
  },
  filterPillBadgeTxt: {
    fontSize: scale(10.5),
    fontWeight: "800",
  },

  // ── 3. Sección Única de Películas Destacadas ──
  movieSectionWrapper: {
    marginTop: scale(4),
  },
  movieSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(12),
  },
  movieSectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  movieAccentBar: {
    width: scale(4),
    height: scale(18),
    borderRadius: scale(2),
    backgroundColor: LIVE_COLORS.moviesGold,
    marginRight: scale(10),
  },
  movieSectionTitle: {
    fontSize: scale(18),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.3,
    marginRight: scale(12),
  },
  movieSectionSubtitle: {
    fontSize: scale(12.5),
    color: "rgba(255,255,255,0.55)",
    fontWeight: "600",
  },
  movieCountPill: {
    paddingHorizontal: scale(9),
    paddingVertical: scale(3.5),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: `${LIVE_COLORS.moviesGold}40`,
    backgroundColor: "rgba(255, 190, 11, 0.08)",
  },
  movieCountTxt: {
    fontSize: scale(11),
    fontWeight: "800",
    color: LIVE_COLORS.moviesGold,
  },
  movieTrack: {
    flexDirection: "row",
    gap: CARD_GAP,
    paddingVertical: scale(12),
  },
  movieLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    paddingVertical: scale(24),
  },
  movieLoadingTxt: {
    color: LIVE_COLORS.moviesGold,
    fontSize: scale(13),
    fontWeight: "700",
  },

  // Tarjeta Panorámica de Película (16:9)
  movieCard: {
    width: MOVIE_CARD_W,
    height: MOVIE_CARD_H,
    borderRadius: scale(14),
    overflow: "hidden",
    backgroundColor: LIVE_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: LIVE_COLORS.borderSubtle,
    position: "relative",
    justifyContent: "space-between",
    padding: scale(10),
  },
  movieCardFocused: {
    borderColor: LIVE_COLORS.moviesGold,
    shadowColor: LIVE_COLORS.moviesGold,
    shadowOpacity: 0.5,
    shadowRadius: scale(8),
    elevation: 8,
    zIndex: 10,
  },
  movieTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  movieBadgeDestacado: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: LIVE_COLORS.moviesGold,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  movieBadgeDestacadoTxt: {
    fontSize: scale(9),
    fontWeight: "900",
    color: "#000000",
    letterSpacing: 0.5,
  },
  movieRatingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    borderWidth: 1,
    borderColor: "rgba(255, 190, 11, 0.4)",
  },
  movieRatingTxt: {
    color: "#ffffff",
    fontSize: scale(10),
    fontWeight: "800",
  },
  movieCardInfo: {
    zIndex: 2,
  },
  movieCardTitle: {
    color: "#ffffff",
    fontSize: scale(13),
    fontWeight: "900",
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  movieCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: scale(2),
  },
  movieCardGenre: {
    fontSize: scale(10.5),
    fontWeight: "800",
    color: LIVE_COLORS.moviesGold,
  },
  movieCardYear: {
    fontSize: scale(10.5),
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
});
