import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, usePathname, useRouter } from "expo-router";
import {
  Clapperboard,
  Compass,
  Film,
  Globe,
  Heart,
  MapPin,
  Maximize2,
  Music,
  Play,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  Smile,
  Sparkles,
  Star,
  Trophy,
  Tv,
  Tv2,
  X
} from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  findNodeHandle,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const { width: SW, height: SH } = Dimensions.get("window");

const TVFocusGuide: any =
  (require("react-native") as any).TVFocusGuideView ?? View;

const safeFindNodeHandle = (node: any): number | undefined => {
  if (Platform.OS === "web" || !node) return undefined;
  try {
    const handle = findNodeHandle(node);
    return typeof handle === "number" && handle > 0 ? handle : undefined;
  } catch {
    return undefined;
  }
};

const useTVEventHandlerSafe: (handler: (evt: any) => void) => void =
  Platform.OS !== "web"
    ? (require("react-native") as any).useTVEventHandler ?? (() => { })
    : () => { };

// ── Medidas del Layout TV ────────────────────────────────────────────────────
const CONTENT_LEFT_PAD = scale(96);
const CARD_GAP = scale(12);

// Dimensiones de tarjetas de películas destacadas (16:9 panorámico compacto)
const MOVIE_CARD_W = scale(164);
const MOVIE_CARD_H = scale(94);

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
    keywords: ["sport", "deport", "futbol", "fútbol", "soccer", "espn", "tyc", "fox", "dazn", "nba", "racing", "dsports", "laliga"],
  },
  {
    id: "movies",
    name: "Cine y Películas",
    subtitle: "Estrenos, clásicos y las mejores historias de Hollywood",
    color: LIVE_COLORS.moviesGold,
    icon: Film,
    keywords: ["movie", "cine", "pelicul", "film", "hbo", "star", "cinema", "max", "action", "paramount", "amc", "space", "tnt"],
  },
  {
    id: "series",
    name: "Series y Ficción",
    subtitle: "Temporadas completas, dramas y producciones originales",
    color: LIVE_COLORS.seriesPurple,
    icon: Clapperboard,
    keywords: ["series", "serie", "ficcion", "ficción", "drama", "warner", "sony", "universal", "axn", "fx", "comedy"],
  },
  {
    id: "news",
    name: "Noticias y Directo",
    subtitle: "Información minuto a minuto de Argentina y el mundo",
    color: LIVE_COLORS.newsCyan,
    icon: Globe,
    keywords: ["news", "noticia", "actualidad", "cnn", "tn", "c5n", "bbc", "al jazeera", "ln+", "cronica", "a24", "canal 26", "telefe", "eltrece", "tv publica"],
  },
  {
    id: "kids",
    name: "Mundo Infantil",
    subtitle: "Caricaturas, animación y diversión para chicos",
    color: LIVE_COLORS.kidsPink,
    icon: Smile,
    keywords: ["kid", "infantil", "family", "familiar", "cartoon", "disney", "nick", "junior", "animacion", "anime", "toon", "boomerang"],
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
    keywords: ["music", "musica", "música", "mtv", "vh1", "radio", "hit", "pop", "rock", "urbano", "htv", "cm"],
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

// ── Medidas de Elementos de Lista para Virtualización de Alto Rendimiento ────
const CH_ITEM_H = scale(46);
const CH_ITEM_GAP = scale(4);

// ── Chip de Filtro Superior (Abre la Guía Dual de Canales al Presionar) ───────
const FilterPill = memo(function FilterPill({
  id,
  label,
  count,
  isActive,
  color,
  icon: Icon,
  onPress,
  nextFocusLeft,
  nextFocusUp,
  trapFocusRight,
}: {
  id: string;
  label: string;
  count?: number;
  isActive: boolean;
  color: string;
  icon: any;
  onPress: (id: string) => void;
  nextFocusLeft?: number;
  nextFocusUp?: number;
  trapFocusRight?: boolean;
}) {
  const handlePress = useCallback(() => {
    onPress(id);
  }, [onPress, id]);

  return (
    <Focusable
      onPress={handlePress}
      nextFocusLeft={nextFocusLeft}
      nextFocusUp={nextFocusUp}
      trapFocusRight={trapFocusRight}
      scaleFocused={1.03}
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
        size={scale(12)}
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

// ── Item de Categoría en la Guía Dual (Ultra-Optimizado con React.memo) ───────
interface CategoryItemProps {
  cat: {
    id: string;
    label: string;
    count: number;
    color: string;
    icon: any;
  };
  isSelected: boolean;
  onFocus: (id: string) => void;
  onPress: (id: string) => void;
  nextFocusRight?: number;
  nodeRef?: (node: any) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const CategoryItem = memo(
  function CategoryItem({
    cat,
    isSelected,
    onFocus,
    onPress,
    nextFocusRight,
    nodeRef,
    isFirst,
    isLast,
  }: CategoryItemProps) {
    const Icon = cat.icon;
    const handleFocus = useCallback(() => onFocus(cat.id), [onFocus, cat.id]);
    const handlePress = useCallback(() => onPress(cat.id), [onPress, cat.id]);

    return (
      <Focusable
        ref={nodeRef}
        onFocus={handleFocus}
        onPress={handlePress}
        nextFocusRight={nextFocusRight}
        trapFocusLeft={true}
        trapFocusUp={isFirst}
        trapFocusDown={isLast}
        throttleMs={80}
        animateScale={false}
        showFocusRing={false}
        style={[s.catPill, isSelected && s.catPillActive]}
        focusedStyle={s.catPillFocused}
      >
        {({ focused }) => (
          <>
            <View
              style={[
                s.catIconWrap,
                {
                  backgroundColor: isSelected
                    ? "rgba(255, 183, 3, 0.2)"
                    : "rgba(255,255,255,0.06)",
                },
                focused && { backgroundColor: "#000000" },
              ]}
            >
              <Icon
                size={scale(14)}
                color={
                  focused
                    ? "#000000"
                    : isSelected
                      ? LIVE_COLORS.accentAmber
                      : cat.color
                }
              />
            </View>

            <Text
              style={[
                s.catLabel,
                isSelected && s.catLabelActive,
                focused && s.catLabelFocused,
              ]}
              numberOfLines={1}
            >
              {cat.label}
            </Text>

            <View
              style={[
                s.catCountBadge,
                isSelected && s.catCountBadgeActive,
                focused && s.catCountBadgeFocused,
              ]}
            >
              <Text
                style={[
                  s.catCountTxt,
                  isSelected && s.catCountTxtActive,
                  focused && s.catCountTxtFocused,
                ]}
              >
                {cat.count}
              </Text>
            </View>
          </>
        )}
      </Focusable>
    );
  },
  (prev, next) => {
    return (
      prev.cat.id === next.cat.id &&
      prev.cat.count === next.cat.count &&
      prev.isSelected === next.isSelected &&
      prev.nextFocusRight === next.nextFocusRight
    );
  }
);

// ── Fila de Canal en la Guía Dual (Ultra-Optimizado con React.memo) ───────────
interface ChannelListItemProps {
  item: Channel;
  index: number;
  isCurrent: boolean;
  onPress: (item: Channel) => void;
  onFocus: () => void;
  nextFocusLeft?: number;
  firstChannelRef?: any;
  isLast?: boolean;
}

const ChannelListItem = memo(
  function ChannelListItem({
    item,
    index,
    isCurrent,
    onPress,
    onFocus,
    nextFocusLeft,
    firstChannelRef,
    isLast,
  }: ChannelListItemProps) {
    const handlePress = useCallback(() => {
      onPress(item);
    }, [onPress, item]);

    return (
      <Focusable
        ref={index === 0 ? firstChannelRef : undefined}
        onFocus={onFocus}
        onPress={handlePress}
        nextFocusLeft={nextFocusLeft}
        trapFocusRight={true}
        trapFocusDown={isLast}
        throttleMs={80}
        animateScale={false}
        showFocusRing={false}
        style={[s.chItem, isCurrent && s.chItemCurrent]}
        focusedStyle={s.chItemFocused}
      >
        {({ focused }) => (
          <>
            {/* Logo del Canal (transition=0 para máxima fluidez en TV) */}
            <View style={[s.chLogoBox, focused && s.chLogoBoxFocused]}>
              {item.logo ? (
                <RemoteImage
                  uri={item.logo}
                  style={s.chLogoImg as any}
                  contentFit="contain"
                  transition={0}
                />
              ) : (
                <Tv
                  size={scale(16)}
                  color={focused ? "#000000" : "rgba(255,255,255,0.7)"}
                />
              )}
            </View>

            {/* Info del Canal */}
            <View style={s.chInfoBox}>
              <Text
                style={[
                  s.chName,
                  isCurrent && s.chNameCurrent,
                  focused && s.chNameFocused,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>

              <View style={s.chMetaRow}>
                {item.country ? (
                  <Text
                    style={[s.chMetaTxt, focused && s.chMetaTxtFocused]}
                    numberOfLines={1}
                  >
                    {item.country}
                  </Text>
                ) : null}
                {item.language ? (
                  <Text
                    style={[s.chMetaTxt, focused && s.chMetaTxtFocused]}
                    numberOfLines={1}
                  >
                    {item.country ? " • " : ""}
                    {item.language}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Indicador de EN PANTALLA */}
            <View style={s.chBadgesWrap}>
              {isCurrent && (
                <View
                  style={[s.badgeLiveOn, focused && s.badgeLiveOnFocused]}
                >
                  <View style={s.liveOnDot} />
                  <Text
                    style={[
                      s.badgeLiveOnTxt,
                      focused && s.badgeLiveOnTxtFocused,
                    ]}
                  >
                    EN PANTALLA
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </Focusable>
    );
  },
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.isCurrent === next.isCurrent &&
      prev.nextFocusLeft === next.nextFocusLeft &&
      prev.index === next.index
    );
  }
);

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
      scaleFocused={1.03}
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
          <Film size={scale(9)} color="#000000" />
          <Text style={s.movieBadgeDestacadoTxt}>CINE</Text>
        </View>

        {item.rating ? (
          <View style={s.movieRatingBadge}>
            <Star
              size={scale(9)}
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

  // Mapa de canal por ID para búsquedas O(1) instantáneas
  const channelMap = useMemo(() => {
    const map = new Map<string, Channel>();
    for (let i = 0; i < allowedChannels.length; i++) {
      map.set(allowedChannels[i].id, allowedChannels[i]);
    }
    return map;
  }, [allowedChannels]);

  // Canales agrupados por temáticas (SOLO se computa cuando cambia allowedChannels)
  const themedGroups = useMemo(() => {
    const map = new Map<string, Channel[]>();
    CATEGORY_THEMES.forEach((t) => map.set(t.id, []));

    const others: Channel[] = [];

    for (let i = 0; i < allowedChannels.length; i++) {
      const ch = allowedChannels[i];
      const theme = getChannelCategory(ch);
      if (theme) {
        map.get(theme.id)?.push(ch);
      } else {
        others.push(ch);
      }
    }

    return { map, others };
  }, [allowedChannels]);

  // Canales Favoritos con Set O(1)
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const favChannels = useMemo(() => {
    return allowedChannels.filter((c) => favSet.has(c.id));
  }, [allowedChannels, favSet]);

  // ── Últimos Canales Vistos para la Cuadrícula 2x2 Lateral en el Hero (O(1)) ─
  const recentDisplayChannels = useMemo(() => {
    if (allowedChannels.length === 0) return [];

    const resolved: Channel[] = [];
    for (let i = 0; i < recentIds.length; i++) {
      const ch = channelMap.get(recentIds[i]);
      if (ch) resolved.push(ch);
    }

    const seen = new Set<string>();
    const uniqueRecent: Channel[] = [];

    for (let i = 0; i < resolved.length; i++) {
      const ch = resolved[i];
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
    for (let i = 0; i < allowedChannels.length; i++) {
      if (pool.length >= 4) break;
      const ch = allowedChannels[i];
      if (!seen.has(ch.id)) {
        seen.add(ch.id);
        pool.push(ch);
      }
    }

    return pool.slice(0, 4);
  }, [allowedChannels, recentIds, channelMap, activeChannel]);

  // ── Categorías Estáticas (Temas, Países, M3U) — SOLO calculadas 1 vez ───────
  const baseCategories = useMemo(() => {
    const list: {
      id: string;
      label: string;
      count: number;
      color: string;
      icon: any;
      channels: Channel[];
    }[] = [];

    // 1. Categorías temáticas inteligentes
    for (let i = 0; i < CATEGORY_THEMES.length; i++) {
      const theme = CATEGORY_THEMES[i];
      const chs = themedGroups.map.get(theme.id) || [];
      if (chs.length > 0) {
        list.push({
          id: theme.id,
          label: theme.name,
          count: chs.length,
          color: theme.color,
          icon: theme.icon,
          channels: chs,
        });
      }
    }

    // 2. Agrupación por Países
    const countryMap = new Map<string, Channel[]>();
    for (let i = 0; i < allowedChannels.length; i++) {
      const ch = allowedChannels[i];
      const c = (ch.country || "").trim();
      if (c && c.toLowerCase() !== "internacional" && c.toLowerCase() !== "mundo") {
        const norm = c.charAt(0).toUpperCase() + c.slice(1);
        const curr = countryMap.get(norm) || [];
        curr.push(ch);
        countryMap.set(norm, curr);
      }
    }
    const sortedCountries = Array.from(countryMap.entries())
      .filter(([_, arr]) => arr.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);

    for (let i = 0; i < Math.min(8, sortedCountries.length); i++) {
      const [countryName, chs] = sortedCountries[i];
      list.push({
        id: `country_${countryName.toLowerCase()}`,
        label: countryName,
        count: chs.length,
        icon: MapPin,
        color: "#38bdf8",
        channels: chs,
      });
    }

    // 3. Agrupaciones m3u adicionales
    const groupMap = new Map<string, Channel[]>();
    for (let i = 0; i < allowedChannels.length; i++) {
      const ch = allowedChannels[i];
      const grp = (ch.groupTitle || ch.category?.name || "").trim();
      if (grp && grp.length > 2 && !getChannelCategory(ch)) {
        const curr = groupMap.get(grp) || [];
        curr.push(ch);
        groupMap.set(grp, curr);
      }
    }

    const dynamicPalette = ["#a78bfa", "#f472b6", "#34d399", "#fb923c"];
    let palIdx = 0;
    for (const [groupName, grpChannels] of groupMap.entries()) {
      if (grpChannels.length >= 2 && list.length < 22) {
        list.push({
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

    return list;
  }, [allowedChannels, themedGroups]);

  // ── Generación de Categorías Completas para la Guía y la Cinta ──────────────
  const guideCategories = useMemo(() => {
    const list: {
      id: string;
      label: string;
      count: number;
      color: string;
      icon: any;
      channels: Channel[];
    }[] = [
      {
        id: "all",
        label: "Todos los Canales",
        count: allowedChannels.length,
        color: LIVE_COLORS.accentAmber,
        icon: Tv,
        channels: allowedChannels,
      },
    ];

    // Mis Favoritos (si existen)
    if (favChannels.length > 0) {
      list.push({
        id: "favorites",
        label: "Mis Favoritos",
        count: favChannels.length,
        color: LIVE_COLORS.favHeart,
        icon: Heart,
        channels: favChannels,
      });
    }

    // Recientes (si existen)
    if (recentIds.length > 0) {
      const validRecents: Channel[] = [];
      for (let i = 0; i < recentIds.length; i++) {
        const ch = channelMap.get(recentIds[i]);
        if (ch) validRecents.push(ch);
      }
      if (validRecents.length > 0) {
        list.push({
          id: "recent",
          label: "Recientes",
          count: validRecents.length,
          color: LIVE_COLORS.newsCyan,
          icon: RotateCcw,
          channels: validRecents,
        });
      }
    }

    return list.concat(baseCategories);
  }, [allowedChannels, favChannels, recentIds, channelMap, baseCategories]);

  // Cinta de Etiquetas para la vista principal
  const smartRibbonCategories = useMemo(() => {
    return guideCategories.map((c) => ({
      id: c.id,
      label: c.label.split(" ")[0] || c.label,
      fullLabel: c.label,
      count: c.count,
      color: c.color,
      icon: c.icon,
      channels: c.channels,
    }));
  }, [guideCategories]);

  // ── ESTADO DE LA GUÍA DUAL DE FILTRO DE CANALES ─────────────────────────────
  const [showGuide, setShowGuide] = useState(false);
  const [selectedGuideCategory, setSelectedGuideCategory] = useState<string>("all");
  const [guideSearch, setGuideSearch] = useState<string>("");
  const [guidePane, setGuidePane] = useState<"categories" | "channels">("channels");
  const [catHandles, setCatHandles] = useState<Record<string, number>>({});
  const [firstChannelHandle, setFirstChannelHandle] = useState<number | undefined>(undefined);
  const catRefs = useRef<Record<string, any>>({});
  const firstChannelRef = useRef<any>(null);
  const catDebounceTimer = useRef<any>(null);

  // Referencia y handle nativo del reproductor para recibir foco desde las etiquetas
  const playerStageRef = useRef<any>(null);
  const [playerStageHandle, setPlayerStageHandle] = useState<number | undefined>(undefined);

  // Toast HUD flotante
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 2400);
  }, []);

  // Cerrar la guía de filtro
  const closeGuide = useCallback(() => {
    if (catDebounceTimer.current) {
      clearTimeout(catDebounceTimer.current);
      catDebounceTimer.current = null;
    }
    setShowGuide(false);
    setGuideSearch("");
  }, []);

  // Abrir la guía dual desde una etiqueta de categoría (sin agregar botón extra)
  const handleCategoryPillPress = useCallback((catId: string) => {
    if (catDebounceTimer.current) {
      clearTimeout(catDebounceTimer.current);
      catDebounceTimer.current = null;
    }
    setSelectedCatId(catId);
    setSelectedGuideCategory(catId);
    setGuideSearch("");
    setGuidePane("channels");
    setShowGuide(true);
  }, []);

  // Handlers estables con debounce para evitar congelamientos o desbordes al mantener presionado d-pad
  const handleCategoryItemFocus = useCallback((id: string) => {
    setGuidePane("categories");
    if (catDebounceTimer.current) clearTimeout(catDebounceTimer.current);
    catDebounceTimer.current = setTimeout(() => {
      setSelectedGuideCategory(id);
      catDebounceTimer.current = null;
    }, 130);
  }, []);

  const handleCategoryItemPress = useCallback((id: string) => {
    if (catDebounceTimer.current) {
      clearTimeout(catDebounceTimer.current);
      catDebounceTimer.current = null;
    }
    setSelectedGuideCategory(id);
    setGuidePane("channels");
  }, []);

  const handleChannelItemFocus = useCallback(() => {
    setGuidePane("channels");
  }, []);

  // Categoría activa seleccionada en la guía
  const activeGuideCategoryObj = useMemo(() => {
    return (
      guideCategories.find((c) => c.id === selectedGuideCategory) ||
      guideCategories[0]
    );
  }, [guideCategories, selectedGuideCategory]);

  // Canales filtrados por categoría y búsqueda en tiempo real
  const displayedGuideChannels = useMemo(() => {
    const base = activeGuideCategoryObj?.channels || allowedChannels;
    if (!guideSearch.trim()) return base;
    const q = guideSearch.toLowerCase().trim();
    return base.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.country || "").toLowerCase().includes(q) ||
        (c.language || "").toLowerCase().includes(q) ||
        (c.category?.name || "").toLowerCase().includes(q) ||
        (c.groupTitle || "").toLowerCase().includes(q),
    );
  }, [activeGuideCategoryObj, allowedChannels, guideSearch]);

  // Actualizar handles de nodos en categorías SOLO cuando la guía está abierta
  useEffect(() => {
    if (Platform.OS === "web" || !showGuide) return;
    const handles: Record<string, number> = {};
    for (let i = 0; i < guideCategories.length; i++) {
      const cat = guideCategories[i];
      const node = catRefs.current[cat.id];
      if (node) {
        const h = safeFindNodeHandle(node);
        if (typeof h === "number" && h > 0) handles[cat.id] = h;
      }
    }
    setCatHandles(handles);
  }, [guideCategories, showGuide]);

  // Actualizar handle del primer canal para nextFocusRight SOLO cuando la guía está abierta
  const updateFirstChannelHandle = useCallback(() => {
    if (Platform.OS === "web" || !showGuide) return;
    if (firstChannelRef.current) {
      const h = safeFindNodeHandle(firstChannelRef.current);
      if (typeof h === "number" && h > 0) setFirstChannelHandle(h);
    }
  }, [showGuide]);

  useEffect(() => {
    if (!showGuide) return;
    updateFirstChannelHandle();
  }, [displayedGuideChannels, showGuide, updateFirstChannelHandle]);

  // ── Eventos de Control Remoto / Teclado TV ──────────────────────────────────
  useTVEventHandlerSafe((evt: any) => {
    if (!evt || !evt.eventType) return;
    // Si la guía dual está abierta, se mantiene contenida sin escapes
    if (showGuide) {
      return;
    }
  });

  // Botón Atrás del control remoto: cierra la guía de UNA sola vez
  useEffect(() => {
    if (Platform.OS === "web") return;
    const backAction = () => {
      if (showGuide) {
        closeGuide();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => sub.remove();
  }, [showGuide, closeGuide]);

  // Eventos de Teclado y Click en Navegador Web
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === "input" || targetTag === "textarea";

      // Tecla Atrás / Escape / Backspace: cierra de UNA sola vez
      if (e.key === "Escape" || (!isInput && e.key === "Backspace")) {
        if (showGuide) {
          e.preventDefault();
          closeGuide();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showGuide, guidePane, closeGuide]);

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

  // Manejar click en canal de la Guía Dual
  const handleGuideChannelPress = useCallback(
    (item: Channel) => {
      recordRecentChannel(item.id);
      if (activeChannel?.id === item.id) {
        closeGuide();
        handleOpenFullscreen(item);
      } else {
        setActiveChannel(item);
        showToast(`Sintonizando: ${item.name}`);
      }
    },
    [activeChannel?.id, closeGuide, handleOpenFullscreen, setActiveChannel, showToast],
  );

  // Manejar click en la rejilla 2x2 lateral de últimos vistos
  const handleHeroGridPress = useCallback(
    (item: Channel) => {
      recordRecentChannel(item.id);
      if (activeChannel?.id === item.id) {
        handleOpenFullscreen(item);
      } else {
        setActiveChannel(item);
        showToast(`Sintonizando: ${item.name}`);
      }
    },
    [activeChannel?.id, handleOpenFullscreen, setActiveChannel, showToast],
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

  // Layout matemático fijo para FlatList de canales de la guía (60 FPS sin medir)
  const getChannelItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CH_ITEM_H + CH_ITEM_GAP,
      offset: (CH_ITEM_H + CH_ITEM_GAP) * index,
      index,
    }),
    [],
  );

  const activeChannelId = activeChannel?.id;

  const currentCategoryHandle =
    catHandles[selectedGuideCategory] || catHandles[guideCategories[0]?.id];

  // Renderizador memoizado de fila de canal
  const renderChannelItem = useCallback(
    ({ item, index }: { item: Channel; index: number }) => (
      <ChannelListItem
        item={item}
        index={index}
        isCurrent={item.id === activeChannelId}
        onPress={handleGuideChannelPress}
        onFocus={handleChannelItemFocus}
        nextFocusLeft={currentCategoryHandle}
        firstChannelRef={index === 0 ? firstChannelRef : undefined}
        isLast={index === displayedGuideChannels.length - 1}
      />
    ),
    [activeChannelId, handleGuideChannelPress, handleChannelItemFocus, currentCategoryHandle, displayedGuideChannels.length],
  );

  // Renderizador memoizado de películas destacadas
  const renderMovieItem = useCallback(
    ({ item, index }: { item: NexoContentItem; index: number }) => (
      <MovieHeroCard
        item={item}
        index={index}
        total={heroMovies.length}
        onPress={handleMoviePress}
      />
    ),
    [heroMovies.length, handleMoviePress],
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

      {/* Toast HUD temporal para sintonización */}
      {toastMsg && (
        <View style={s.toastPill} pointerEvents="none">
          <Tv size={scale(15)} color={LIVE_COLORS.accentAmber} />
          <Text style={s.toastTxt}>{toastMsg}</Text>
        </View>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          CONTENEDOR PRINCIPAL QUE AJUSTA AL 100% DE LA PANTALLA (SIN SCROLL)
         ════════════════════════════════════════════════════════════════════ */}
      <View style={s.mainContainer}>
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
                    <Tv2 size={scale(56)} color={activeTheme.color} />
                  )}
                  <Text style={s.heroFallbackTxt}>Señal en Directo</Text>
                </View>
              )}

              {/* Ventana de reproducción interactiva y enfocable con marco de foco activo */}
              <Focusable
                ref={playerStageRef}
                onPress={() => handleOpenFullscreen()}
                onLayout={() => {
                  if (playerStageRef.current) {
                    const h = safeFindNodeHandle(playerStageRef.current);
                    if (typeof h === "number" && h > 0) {
                      setPlayerStageHandle(h);
                    }
                  }
                }}
                nextFocusLeft={sidebarHandle ?? undefined}
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: scale(18), zIndex: 10 },
                ]}
                focusedStyle={{
                  borderWidth: scale(3.5),
                  borderColor: "#ffffff",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  shadowColor: activeTheme.color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: scale(14),
                }}
              >
                {({ focused }) =>
                  focused ? (
                    <View style={s.heroPlayerFocusHint} pointerEvents="none">
                      <View style={s.heroPlayerFocusBadge}>
                        <Maximize2 size={scale(13)} color="#000000" />
                        <Text style={s.heroPlayerFocusTxt}>
                          Presiona OK para Pantalla Completa
                        </Text>
                      </View>
                    </View>
                  ) : null
                }
              </Focusable>

              {/* Degradados cinematográficos sobre el reproductor */}
              <LinearGradient
                colors={[
                  "rgba(7,5,18,0.25)",
                  "transparent",
                  "rgba(7,5,18,0.70)",
                  "rgba(7,5,18,0.96)",
                ]}
                locations={[0, 0.25, 0.65, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["rgba(7,5,18,0.85)", "rgba(7,5,18,0.35)", "transparent"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0.65, y: 0.5 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
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
                  <activeTheme.icon size={scale(11)} color={activeTheme.color} />

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
                    <Play size={scale(15)} color="#000000" fill="#000000" />
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
                      size={scale(14)}
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
                    <SkipBack size={scale(15)} color="#ffffff" />
                  </Focusable>

                  <Focusable
                    onPress={handleNextChannel}
                    style={s.btnHeroIcon}
                    focusedStyle={s.btnHeroIconFocused}
                  >
                    <SkipForward size={scale(15)} color="#ffffff" />
                  </Focusable>
                </View>
              </View>
            </View>

            {/* Lado Derecho (30%): Últimos Canales Vistos (Real & Persistente) */}
            <View style={s.heroRightContainer}>
              <View style={s.recentHeaderRow}>
                <View style={s.recentHeaderIconWrap}>
                  <RotateCcw size={scale(11)} color={LIVE_COLORS.accentAmber} />
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
                      scaleFocused={1.03}
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
                            transition={0}
                          />
                        ) : (
                          <Tv2 size={scale(18)} color={itemTheme.color} />
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
            2. CINTA DE ETIQUETAS Y CATEGORÍAS (AL PRESIONAR ABRE LA GUÍA DUAL)
           ════════════════════════════════════════════════════════════════════ */}
        <View style={s.filterRibbonSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterRibbonTrack}
          >
            {smartRibbonCategories.map((cat, idx, arr) => {
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
                  nextFocusUp={playerStageHandle}
                  trapFocusRight={isLast}
                  onPress={handleCategoryPillPress}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* ════════════════════════════════════════════════════════════════════
            3. PRIMERA Y ÚNICA SECCIÓN: PELÍCULAS DESTACADAS (HORIZONTAL)
           ════════════════════════════════════════════════════════════════════ */}
        <View style={s.movieSectionWrapper}>
          {/* Cabecera de la Sección de Películas */}
          <View style={s.movieSectionHeader}>
            <View style={s.movieSectionTitleGroup}>
              <View style={s.movieAccentBar} />
              <Film
                size={scale(15)}
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
              initialNumToRender={7}
              maxToRenderPerBatch={5}
              windowSize={3}
              getItemLayout={getMovieItemLayout}
              removeClippedSubviews={Platform.OS === "android"}
              renderItem={renderMovieItem}
            />
          )}
        </View>
      </View>

      {/* ════════════════════════════════════════════════════════════════════
          4. GUÍA DUAL INTERACTIVA DE CANALES (DRAWER MODAL CON BUSCADOR)
         ════════════════════════════════════════════════════════════════════ */}
      {showGuide && (
        <View style={s.guideBackdrop} pointerEvents="box-none">
          {/* 1. Backdrop clickeable: click en otro lado cierra la guía de inmediato */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeGuide}
          />

          {/* Sombra de viñeta suave lateral para el fondo */}
          <LinearGradient
            colors={["rgba(5, 5, 8, 0.96)", "rgba(5, 5, 8, 0.70)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={s.guideBackdropGrad}
            pointerEvents="none"
          />

          <TVFocusGuide style={s.dualContainer}>
            {/* ── VENTANA 1: CATEGORÍAS & CLASIFICACIONES INTELIGENTES ── */}
            <View style={s.windowCategories}>
              <View style={s.guideHead}>
                <View style={s.guideHeadRow}>
                  <Compass size={scale(16)} color={LIVE_COLORS.accentAmber} />
                  <Text style={s.guideHeadTitle}>CATEGORÍAS</Text>
                </View>
                <Text style={s.guideHeadSub}>Explorar Guía TV</Text>
              </View>

              <ScrollView
                style={s.catScroll}
                contentContainerStyle={s.catScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {guideCategories.map((cat, idx) => (
                  <CategoryItem
                    key={cat.id}
                    cat={cat}
                    isSelected={cat.id === selectedGuideCategory}
                    isFirst={idx === 0}
                    isLast={idx === guideCategories.length - 1}
                    onFocus={handleCategoryItemFocus}
                    onPress={handleCategoryItemPress}
                    nextFocusRight={firstChannelHandle}
                    nodeRef={(node: any) => {
                      catRefs.current[cat.id] = node;
                    }}
                  />
                ))}
              </ScrollView>
            </View>

            {/* ── VENTANA 2: CANALES EN VIVO CON BUSCADOR INTEGRADO ── */}
            <View style={s.windowChannels}>
              <View style={s.chHeader}>
                <View style={s.chHeaderTop}>
                  <View style={s.chHeaderTitleWrap}>
                    <activeGuideCategoryObj.icon
                      size={scale(16)}
                      color={activeGuideCategoryObj.color}
                    />
                    <Text style={s.chHeaderTitle} numberOfLines={1}>
                      {activeGuideCategoryObj.label.toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.chHeaderRightRow}>
                    <Text style={s.chHeaderCount}>
                      {displayedGuideChannels.length}{" "}
                      {displayedGuideChannels.length === 1 ? "canal" : "canales"}
                    </Text>
                    <Pressable onPress={closeGuide} style={s.guideCloseBtn}>
                      <X size={scale(13)} color="rgba(255,255,255,0.8)" />
                    </Pressable>
                  </View>
                </View>

                {/* Buscador Rápido de Canales por nombre o país */}
                <View style={s.searchWrap}>
                  <Search size={scale(14)} color="rgba(255,255,255,0.5)" />
                  <TextInput
                    value={guideSearch}
                    onChangeText={setGuideSearch}
                    placeholder="Buscar canal por nombre o país…"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={s.searchInput}
                  />
                  {guideSearch.length > 0 && (
                    <Pressable onPress={() => setGuideSearch("")} style={s.searchClear}>
                      <X size={scale(13)} color="#fff" />
                    </Pressable>
                  )}
                </View>
              </View>

              <FlatList
                data={displayedGuideChannels}
                keyExtractor={(item) => item.id}
                style={s.chList}
                contentContainerStyle={s.chListContent}
                initialNumToRender={12}
                maxToRenderPerBatch={8}
                windowSize={5}
                getItemLayout={getChannelItemLayout}
                removeClippedSubviews={Platform.OS === "android"}
                renderItem={renderChannelItem}
                ListEmptyComponent={
                  <View style={s.chEmpty}>
                    <Tv size={scale(26)} color="rgba(255,255,255,0.3)" />
                    <Text style={s.chEmptyTxt}>
                      {guideSearch
                        ? `No se encontraron canales para "${guideSearch}"`
                        : "No hay canales disponibles en esta categoría"}
                    </Text>
                  </View>
                }
              />
            </View>
          </TVFocusGuide>
        </View>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ESTILOS DE LA PANTALLA
// ═════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: {
    flex: 1,
    height: "100%",
    width: "100%",
    backgroundColor: LIVE_COLORS.bgDark,
    overflow: "hidden",
  },
  mainContainer: {
    flex: 1,
    height: "100%",
    paddingLeft: CONTENT_LEFT_PAD,
    paddingRight: scale(30),
    paddingTop: scale(12),
    paddingBottom: scale(12),
    justifyContent: "space-between",
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

  // Toast HUD de sintonización
  toastPill: {
    position: "absolute",
    top: scale(18),
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(18, 14, 36, 0.95)",
    borderWidth: 1.5,
    borderColor: LIVE_COLORS.accentAmber,
    paddingHorizontal: scale(16),
    paddingVertical: scale(7),
    borderRadius: scale(20),
    zIndex: 150,
    shadowColor: "#000000",
    shadowOpacity: 0.6,
    shadowRadius: scale(10),
    elevation: 10,
  },
  toastTxt: {
    color: "#ffffff",
    fontSize: scale(12),
    fontWeight: "800",
  },

  // ── 1. Master Broadcast Hero Stage ──
  heroContainer: {
    flex: 1,
    minHeight: scale(280),
    flexDirection: "row",
    alignItems: "stretch",
    gap: scale(14),
    marginBottom: scale(8),
  },

  // Lado Izquierdo (70%): Gran Escenario de Reproducción
  heroMainStage: {
    flex: 2.7,
    height: "100%",
    borderRadius: scale(18),
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
    gap: scale(8),
  },
  heroFallbackLogo: {
    width: scale(130),
    height: scale(72),
  },
  heroFallbackTxt: {
    color: "rgba(255,255,255,0.6)",
    fontSize: scale(13),
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  heroLoadingOverlay: {
    position: "absolute",
    top: scale(16),
    right: scale(16),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: scale(12),
    paddingVertical: scale(5),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    zIndex: 10,
  },
  heroLoadingTxt: {
    fontSize: scale(11),
    fontWeight: "800",
  },

  // Badges Flotantes Superiores
  heroTopBar: {
    position: "absolute",
    top: scale(14),
    left: scale(18),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(7),
    zIndex: 5,
  },
  heroPlayerFocusHint: {
    position: "absolute",
    top: scale(14),
    right: scale(18),
    zIndex: 20,
  },
  heroPlayerFocusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "#ffffff",
    paddingHorizontal: scale(12),
    paddingVertical: scale(5),
    borderRadius: scale(8),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  heroPlayerFocusTxt: {
    color: "#000000",
    fontSize: scale(11),
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  heroLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    backgroundColor: "rgba(255, 0, 85, 0.25)",
    borderWidth: 1.2,
    borderColor: LIVE_COLORS.neonRed,
    paddingHorizontal: scale(9),
    paddingVertical: scale(3.5),
    borderRadius: scale(6),
  },
  heroLiveDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: LIVE_COLORS.neonRed,
  },
  heroLiveTxt: {
    color: "#ffffff",
    fontSize: scale(10),
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  heroCatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    paddingHorizontal: scale(9),
    paddingVertical: scale(3.5),
    borderRadius: scale(6),
    borderWidth: 1,
  },
  heroCatBadgeTxt: {
    fontSize: scale(10),
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  heroQualityBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: scale(8),
    paddingVertical: scale(3.5),
    borderRadius: scale(6),
  },
  heroQualityTxt: {
    color: "rgba(255,255,255,0.85)",
    fontSize: scale(9.5),
    fontWeight: "800",
  },

  // Contenido Inferior del Hero
  heroBottomContent: {
    paddingHorizontal: scale(20),
    paddingBottom: scale(16),
    zIndex: 5,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    marginBottom: scale(10),
  },
  heroChannelLogoWrap: {
    width: scale(58),
    height: scale(44),
    borderRadius: scale(10),
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    padding: scale(3),
  },
  heroChannelLogo: {
    width: "100%",
    height: "100%",
  },
  heroTitleTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: scale(26),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.4,
    marginBottom: scale(2),
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
    fontSize: scale(12),
    fontWeight: "800",
  },
  heroMetaItem: {
    fontSize: scale(11.5),
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
  },

  // Botones de Acción en el Hero
  heroBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  btnFullscreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(7),
    paddingHorizontal: scale(16),
    height: scale(38),
    borderRadius: scale(9),
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnFullscreenFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  btnFullscreenTxt: {
    color: "#000000",
    fontSize: scale(13),
    fontWeight: "900",
  },
  btnHeroSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: scale(14),
    height: scale(38),
    borderRadius: scale(9),
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  btnHeroSecondaryTxt: {
    color: "#ffffff",
    fontSize: scale(12.5),
    fontWeight: "800",
  },
  btnHeroIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(9),
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
    marginBottom: scale(6),
    gap: scale(6),
  },
  recentHeaderIconWrap: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: "rgba(255, 183, 3, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  recentHeaderTitle: {
    fontSize: scale(11),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.8,
  },
  recentBadge: {
    paddingHorizontal: scale(5),
    paddingVertical: scale(1),
    borderRadius: scale(5),
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  recentBadgeTxt: {
    fontSize: scale(9.5),
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
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: LIVE_COLORS.bgSurfaceElevated,
    borderWidth: 2,
    borderColor: LIVE_COLORS.borderSubtle,
    position: "relative",
    justifyContent: "space-between",
    padding: scale(8),
  },
  gridCardFocused: {
    zIndex: 10,
  },
  gridCardLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: scale(5),
    paddingVertical: scale(1.5),
    borderRadius: scale(4),
    alignSelf: "flex-end",
  },
  gridCardLiveDot: {
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: "#ffffff",
  },
  gridCardLiveTxt: {
    fontSize: scale(8),
    fontWeight: "900",
    color: "#fff",
  },
  gridCardLogoBox: {
    width: "100%",
    height: scale(36),
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardLogo: {
    width: "75%",
    height: "100%",
  },
  gridCardInfo: {
    marginTop: scale(2),
  },
  gridCardTitle: {
    color: "#ffffff",
    fontSize: scale(11),
    fontWeight: "900",
  },
  gridCardCat: {
    fontSize: scale(9.5),
    fontWeight: "800",
    marginTop: scale(1),
  },

  // ── 2. Cinta de Filtros y Etiquetas Inteligentes ──
  filterRibbonSection: {
    marginVertical: scale(6),
  },
  filterRibbonTrack: {
    flexDirection: "row",
    gap: scale(8),
    paddingVertical: scale(2),
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(8),
  },
  filterPillTxt: {
    fontSize: scale(12),
    fontWeight: "800",
  },
  filterPillBadge: {
    marginLeft: scale(6),
    paddingHorizontal: scale(5),
    paddingVertical: scale(1),
    borderRadius: scale(6),
  },
  filterPillBadgeTxt: {
    fontSize: scale(10),
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
    marginBottom: scale(6),
  },
  movieSectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  movieAccentBar: {
    width: scale(4),
    height: scale(15),
    borderRadius: scale(2),
    backgroundColor: LIVE_COLORS.moviesGold,
    marginRight: scale(8),
  },
  movieSectionTitle: {
    fontSize: scale(15),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.3,
    marginRight: scale(10),
  },
  movieSectionSubtitle: {
    fontSize: scale(11.5),
    color: "rgba(255,255,255,0.55)",
    fontWeight: "600",
  },
  movieCountPill: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(7),
    borderWidth: 1,
    borderColor: `${LIVE_COLORS.moviesGold}40`,
    backgroundColor: "rgba(255, 190, 11, 0.08)",
  },
  movieCountTxt: {
    fontSize: scale(10.5),
    fontWeight: "800",
    color: LIVE_COLORS.moviesGold,
  },
  movieTrack: {
    flexDirection: "row",
    gap: CARD_GAP,
    paddingVertical: scale(2),
  },
  movieLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    paddingVertical: scale(14),
  },
  movieLoadingTxt: {
    color: LIVE_COLORS.moviesGold,
    fontSize: scale(12),
    fontWeight: "700",
  },

  // Tarjeta Panorámica de Película (16:9)
  movieCard: {
    width: MOVIE_CARD_W,
    height: MOVIE_CARD_H,
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: LIVE_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: LIVE_COLORS.borderSubtle,
    position: "relative",
    justifyContent: "space-between",
    padding: scale(8),
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
    gap: scale(3),
    backgroundColor: LIVE_COLORS.moviesGold,
    paddingHorizontal: scale(5),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  movieBadgeDestacadoTxt: {
    fontSize: scale(8.5),
    fontWeight: "900",
    color: "#000000",
    letterSpacing: 0.5,
  },
  movieRatingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: scale(5),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    borderWidth: 1,
    borderColor: "rgba(255, 190, 11, 0.4)",
  },
  movieRatingTxt: {
    color: "#ffffff",
    fontSize: scale(9.5),
    fontWeight: "800",
  },
  movieCardInfo: {
    zIndex: 2,
  },
  movieCardTitle: {
    color: "#ffffff",
    fontSize: scale(11.5),
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
    fontSize: scale(9.5),
    fontWeight: "800",
    color: LIVE_COLORS.moviesGold,
  },
  movieCardYear: {
    fontSize: scale(9.5),
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // ESTILOS DE LA GUÍA DUAL (FILTRO INTERACTIVO CON BUSCADOR)
  // ═════════════════════════════════════════════════════════════════════════════
  guideBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    flexDirection: "row",
  },
  guideBackdropGrad: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: scale(720),
  },
  dualContainer: {
    position: "absolute",
    top: 0,
    left: scale(64), // Colocado justo al lado de la barra lateral (collapsed 64px)
    bottom: 0,
    width: Math.min(scale(580), Math.round(SW * 0.68)),
    flexDirection: "row",
    zIndex: 10,
    backgroundColor: "rgba(9, 7, 18, 0.96)",
    borderRightWidth: 1.5,
    borderRightColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000000",
    shadowOpacity: 0.8,
    shadowRadius: scale(20),
    elevation: 25,
  },

  // Ventana 1: Categorías
  windowCategories: {
    width: scale(215),
    backgroundColor: "rgba(14, 11, 28, 0.94)",
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.08)",
    display: "flex",
    flexDirection: "column",
  },
  guideHead: {
    paddingHorizontal: scale(14),
    paddingTop: scale(20),
    paddingBottom: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  guideHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(7),
    marginBottom: scale(2),
  },
  guideHeadTitle: {
    color: LIVE_COLORS.accentAmber,
    fontSize: scale(12),
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  guideHeadSub: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: scale(10.5),
    fontWeight: "600",
  },
  catScroll: {
    flex: 1,
  },
  catScrollContent: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(8),
    gap: scale(4),
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(10),
    paddingVertical: scale(8),
    borderRadius: scale(9),
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: scale(8),
  },
  catPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  catPillFocused: {
    backgroundColor: LIVE_COLORS.accentAmber,
    borderColor: "#ffffff",
    shadowColor: LIVE_COLORS.accentAmber,
    shadowOpacity: 0.5,
    shadowRadius: scale(6),
  },
  catIconWrap: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(7),
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: {
    flex: 1,
    fontSize: scale(12),
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.8)",
  },
  catLabelActive: {
    color: "#ffffff",
    fontWeight: "900",
  },
  catLabelFocused: {
    color: "#000000",
    fontWeight: "900",
  },
  catCountBadge: {
    paddingHorizontal: scale(5),
    paddingVertical: scale(1.5),
    borderRadius: scale(5),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  catCountBadgeActive: {
    backgroundColor: "rgba(255, 183, 3, 0.2)",
  },
  catCountBadgeFocused: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  catCountTxt: {
    fontSize: scale(10),
    fontWeight: "800",
    color: "rgba(255, 255, 255, 0.6)",
  },
  catCountTxtActive: {
    color: LIVE_COLORS.accentAmber,
  },
  catCountTxtFocused: {
    color: "#000000",
  },

  // Ventana 2: Canales con Buscador
  windowChannels: {
    flex: 1,
    backgroundColor: "rgba(7, 5, 18, 0.90)",
    display: "flex",
    flexDirection: "column",
  },
  chHeader: {
    paddingHorizontal: scale(14),
    paddingTop: scale(18),
    paddingBottom: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  chHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(8),
  },
  chHeaderTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(7),
    flex: 1,
  },
  chHeaderTitle: {
    fontSize: scale(13),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  chHeaderRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  chHeaderCount: {
    fontSize: scale(11),
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.55)",
  },
  guideCloseBtn: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(6),
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Buscador Rápido
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: scale(10),
    height: scale(34),
    gap: scale(7),
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: scale(12),
    fontWeight: "600",
    padding: 0,
  },
  searchClear: {
    padding: scale(4),
  },

  chList: {
    flex: 1,
  },
  chListContent: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(8),
    gap: scale(4),
  },
  chItem: {
    height: CH_ITEM_H,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(10),
    borderRadius: scale(9),
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: scale(10),
  },
  chItemCurrent: {
    backgroundColor: "rgba(255, 183, 3, 0.12)",
    borderColor: "rgba(255, 183, 3, 0.35)",
  },
  chItemFocused: {
    backgroundColor: LIVE_COLORS.accentAmber,
    borderColor: "#ffffff",
    shadowColor: LIVE_COLORS.accentAmber,
    shadowOpacity: 0.5,
    shadowRadius: scale(6),
  },
  chLogoBox: {
    width: scale(38),
    height: scale(28),
    borderRadius: scale(6),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    padding: scale(2),
  },
  chLogoBoxFocused: {
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  chLogoImg: {
    width: "100%",
    height: "100%",
  },
  chInfoBox: {
    flex: 1,
  },
  chName: {
    fontSize: scale(12.5),
    fontWeight: "800",
    color: "#ffffff",
  },
  chNameCurrent: {
    color: LIVE_COLORS.accentAmber,
  },
  chNameFocused: {
    color: "#000000",
    fontWeight: "900",
  },
  chMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: scale(1),
  },
  chMetaTxt: {
    fontSize: scale(10),
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
  },
  chMetaTxtFocused: {
    color: "rgba(0, 0, 0, 0.7)",
  },
  chBadgesWrap: {
    alignItems: "flex-end",
  },
  badgeLiveOn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: "rgba(255, 183, 3, 0.2)",
    borderWidth: 1,
    borderColor: LIVE_COLORS.accentAmber,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  badgeLiveOnFocused: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  liveOnDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(2.5),
    backgroundColor: LIVE_COLORS.accentAmber,
  },
  badgeLiveOnTxt: {
    fontSize: scale(8.5),
    fontWeight: "900",
    color: LIVE_COLORS.accentAmber,
  },
  badgeLiveOnTxtFocused: {
    color: "#ffffff",
  },
  chEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: scale(36),
    gap: scale(10),
    paddingHorizontal: scale(20),
  },
  chEmptyTxt: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: scale(12),
    fontWeight: "600",
    textAlign: "center",
  },
});
