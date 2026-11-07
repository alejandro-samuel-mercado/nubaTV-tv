import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Compass,
  Film,
  Globe,
  Heart,
  Layers,
  List,
  Maximize2,
  Music,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Smile,
  Sparkles,
  Trophy,
  Tv,
  Tv2,
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
import Video from "react-native-video";
import HeroVideo from "../../components/tv/HeroVideo";
import Focusable from "../../components/tv/Focusable";
import RemoteImage from "../../components/tv/RemoteImage";
import ViewAllCard from "../../components/tv/ViewAllCard";
import { Channel, useGlobal } from "../../contexts/GlobalContext";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  AppSettings,
  contentIsRestricted,
  loadAppSettings,
} from "../../utils/appSettings";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Medidas del Layout TV ────────────────────────────────────────────────────
const CONTENT_LEFT_PAD = scale(96);
const CARD_GAP = scale(14);
const HERO_H = Math.max(scale(440), Math.round(SH * 0.65));

// Dimensiones de tarjetas de canal (formato panorámico 16:10 de transmisión)
const CH_CARD_W = scale(190);
const CH_CARD_H = scale(115);

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

// ── Definición de Categorías Temáticas ─────────────────────────────────────────
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
    name: "Estadios y Deportes en Vivo",
    subtitle: "Fútbol, automovilismo, tenis, básquet y torneos mundiales",
    color: LIVE_COLORS.sportsGreen,
    icon: Trophy,
    keywords: ["sport", "deport", "futbol", "fútbol", "soccer", "espn", "tyc", "fox", "dazn", "nba", "racing"],
  },
  {
    id: "movies",
    name: "Cine y Películas 24 Horas",
    subtitle: "Estrenos, clásicos y las mejores historias de Hollywood",
    color: LIVE_COLORS.moviesGold,
    icon: Film,
    keywords: ["movie", "cine", "pelicul", "film", "hbo", "star", "cinema", "max", "action", "paramount"],
  },
  {
    id: "series",
    name: "Series, Maratones y Ficción",
    subtitle: "Temporadas completas, dramas y producciones originales",
    color: LIVE_COLORS.seriesPurple,
    icon: Tv,
    keywords: ["series", "serie", "ficcion", "ficción", "drama", "warner", "sony", "universal", "axn", "fx"],
  },
  {
    id: "news",
    name: "Noticias y Cobertura en Directo",
    subtitle: "Información minuto a minuto de Argentina y el mundo",
    color: LIVE_COLORS.newsCyan,
    icon: Globe,
    keywords: ["news", "noticia", "actualidad", "cnn", "tn", "c5n", "bbc", "al jazeera", "ln+", "cronica"],
  },
  {
    id: "kids",
    name: "Mundo Infantil y Animación",
    subtitle: "Diversión asegurada con caricaturas y aventuras para chicos",
    color: LIVE_COLORS.kidsPink,
    icon: Smile,
    keywords: ["kid", "infantil", "family", "familiar", "cartoon", "disney", "nick", "junior", "animacion", "anime", "toon"],
  },
  {
    id: "entertainment",
    name: "Entretenimiento y Humor",
    subtitle: "Comedia, talk shows, realities y programación estelar",
    color: LIVE_COLORS.entertainmentOrange,
    icon: Sparkles,
    keywords: ["entertain", "entretenimiento", "comedia", "humor", "comedy", "show", "variety", "e!", "tbs"],
  },
  {
    id: "music",
    name: "Música, Ritmo y Conciertos",
    subtitle: "Tus bandas preferidas, videoclips y transmisiones en vivo",
    color: LIVE_COLORS.musicMagenta,
    icon: Music,
    keywords: ["music", "musica", "música", "mtv", "vh1", "radio", "hit", "pop", "rock", "urbano"],
  },
  {
    id: "documentary",
    name: "Documentales, Ciencia y Cultura",
    subtitle: "Naturaleza salvaje, historia, descubrimientos y viajes",
    color: LIVE_COLORS.docsMint,
    icon: Compass,
    keywords: ["docu", "cultur", "educat", "ciencia", "discovery", "natgeo", "national geographic", "history", "animal"],
  },
];

// Helper para clasificar canal en una categoría temática
function getChannelCategory(ch: Channel): CategoryTheme | null {
  const target = `${ch.name} ${ch.category?.name || ""} ${ch.groupTitle || ""}`.toLowerCase();
  for (const theme of CATEGORY_THEMES) {
    if (theme.keywords.some((kw) => target.includes(kw))) {
      return theme;
    }
  }
  return null;
}

// ── Chip de Filtro Superior ──────────────────────────────────────────────────
const FilterPill = memo(function FilterPill({
  id,
  label,
  count,
  isActive,
  color,
  icon: Icon,
  onPress,
  nextFocusLeft,
}: {
  id: string;
  label: string;
  count?: number;
  isActive: boolean;
  color: string;
  icon: any;
  onPress: () => void;
  nextFocusLeft?: number;
}) {
  return (
    <Focusable
      onPress={onPress}
      nextFocusLeft={nextFocusLeft}
      scaleFocused={1.05}
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
        shadowColor: color,
        shadowOpacity: 0.6,
        shadowRadius: scale(8),
        elevation: 6,
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

// ── Tarjeta Panorámica de Canal (Uso en Filas y Grilla) ──────────────────────
const LiveChannelCard = memo(function LiveChannelCard({
  channel,
  isActive,
  isFav,
  themeColor,
  onPress,
  nextFocusLeft,
}: {
  channel: Channel;
  isActive: boolean;
  isFav: boolean;
  themeColor: string;
  onPress: () => void;
  nextFocusLeft?: number;
}) {
  return (
    <Focusable
      onPress={onPress}
      nextFocusLeft={nextFocusLeft}
      scaleFocused={1.06}
      style={[
        s.channelCard,
        isActive && {
          borderColor: themeColor,
          backgroundColor: "rgba(255, 183, 3, 0.12)",
        },
      ]}
      focusedStyle={[
        s.channelCardFocused,
        {
          borderColor: themeColor,
          shadowColor: themeColor,
        },
      ]}
    >
      {/* Fondo de tarjeta con degradado oscuro suave */}
      <LinearGradient
        colors={[
          "rgba(255,255,255,0.05)",
          "rgba(18, 14, 36, 0.8)",
          "rgba(7, 5, 18, 0.98)",
        ]}
        style={StyleSheet.absoluteFill}
      />

      {/* Indicador superior derecho: En Pantalla o Favorito */}
      <View style={s.cardTopRow}>
        {isActive ? (
          <View style={[s.cardLiveBadge, { backgroundColor: themeColor }]}>
            <View style={s.cardLiveDot} />
            <Text style={s.cardLiveTxt}>EN PANTALLA</Text>
          </View>
        ) : (
          <View style={s.cardLivePill}>
            <View style={[s.cardLiveDot, { backgroundColor: LIVE_COLORS.neonRed }]} />
            <Text style={s.cardLiveTxt}>VIVO</Text>
          </View>
        )}

        {isFav ? (
          <View style={s.cardFavBadge}>
            <Heart size={scale(10)} color="#fff" fill={LIVE_COLORS.favHeart} />
          </View>
        ) : null}
      </View>

      {/* Logo Central del Canal en cápsula glassmorphism */}
      <View style={s.cardLogoContainer}>
        {channel.logo ? (
          <RemoteImage
            uri={channel.logo}
            style={s.cardLogo as any}
            contentFit="contain"
            transition={150}
          />
        ) : (
          <View style={[s.cardFallbackIcon, { borderColor: `${themeColor}40` }]}>
            <Tv2 size={scale(24)} color={themeColor} />
          </View>
        )}
      </View>

      {/* Información inferior de canal */}
      <View style={s.cardBottomInfo}>
        <Text style={s.cardTitle} numberOfLines={1}>
          {channel.name}
        </Text>
        <View style={s.cardMetaRow}>
          <Text style={[s.cardCategoryTxt, { color: themeColor }]} numberOfLines={1}>
            {channel.category?.name || channel.groupTitle || "General"}
          </Text>
          {channel.country ? (
            <Text style={s.cardCountryTxt}> • {channel.country}</Text>
          ) : null}
        </View>
      </View>
    </Focusable>
  );
});

// ── Fila Horizontal de Canales con Temática ──────────────────────────────────
const ThemedChannelRow = memo(function ThemedChannelRow({
  theme,
  channels,
  activeChannelId,
  favorites,
  onPressChannel,
  onViewAll,
}: {
  theme: CategoryTheme;
  channels: Channel[];
  activeChannelId?: string;
  favorites: string[];
  onPressChannel: (ch: Channel) => void;
  onViewAll?: () => void;
}) {
  const sidebarHandle = useSidebarHandle();
  if (!channels || channels.length === 0) return null;

  const Icon = theme.icon;

  return (
    <View style={s.rowWrapper}>
      {/* Cabecera de la Fila con icono, barra de acento neón y título */}
      <View style={s.rowHeader}>
        <View style={s.rowTitleGroup}>
          <View style={[s.rowAccentBar, { backgroundColor: theme.color }]} />
          <Icon
            size={scale(17)}
            color={theme.color}
            style={{ marginRight: scale(8) }}
          />
          <Text style={s.rowTitle}>{theme.name}</Text>
          <Text style={s.rowSubtitle}>{theme.subtitle}</Text>
        </View>
        <View style={[s.rowCountPill, { borderColor: `${theme.color}40` }]}>
          <Text style={[s.rowCountTxt, { color: theme.color }]}>
            {channels.length} {channels.length === 1 ? "señal" : "señales"}
          </Text>
        </View>
      </View>

      {/* Carrusel Horizontal de Canales */}
      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowTrack}
        initialNumToRender={6}
        windowSize={5}
        renderItem={({ item, index }) => (
          <LiveChannelCard
            channel={item}
            isActive={item.id === activeChannelId}
            isFav={favorites.includes(item.id)}
            themeColor={theme.color}
            onPress={() => onPressChannel(item)}
            nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
          />
        )}
        ListFooterComponent={
          onViewAll ? (
            <View style={{ marginLeft: CARD_GAP }}>
              <ViewAllCard
                width={CH_CARD_W}
                height={CH_CARD_H}
                onPress={onViewAll}
                label="Ver todas"
                sublabel={`${channels.length} señales`}
                accentColor={theme.color}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: Live Channels Screen
// ═════════════════════════════════════════════════════════════════════════════
export default function ChannelsScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();

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

  // Filtro de categoría seleccionada en el ribbon superior ("all" por defecto)
  const [selectedCatId, setSelectedCatId] = useState<string>("all");

  // Estado del reproductor de video en el Hero
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const debounceTimerRef = useRef<any>(null);

  // Filtrar canales bloqueados por control parental
  const allowedChannels = useMemo(() => {
    if (!settings.parentalLock && !settings.hideRestricted) return channels;
    return channels.filter(
      (ch) =>
        !contentIsRestricted(ch.groupTitle || ch.category?.name || ""),
    );
  }, [channels, settings]);

  // Si no hay canal activo pero hay canales disponibles, seleccionar el primero
  useEffect(() => {
    if (!activeChannel && allowedChannels.length > 0) {
      setActiveChannel(allowedChannels[0]);
    }
  }, [activeChannel, allowedChannels, setActiveChannel]);

  // Debounce para cargar la vista previa del video en el Hero
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!activeChannel?.url) {
      setPreviewUrl(null);
      setVideoLoading(false);
      return;
    }

    setVideoLoading(true);
    setVideoError(false);

    debounceTimerRef.current = setTimeout(() => {
      setPreviewUrl(activeChannel.url);
    }, 200);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [activeChannel?.url]);

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

  // Canales Favoritos
  const favChannels = useMemo(() => {
    return allowedChannels.filter((c) => favorites.includes(c.id));
  }, [allowedChannels, favorites]);

  // 4 Canales alternativos para la cuadrícula 2x2 rápida en el Hero (estilo Kids)
  const candidateChannels = useMemo(() => {
    if (allowedChannels.length <= 1) return [];
    const list = allowedChannels.filter((c) => !activeChannel || c.id !== activeChannel.id);
    return list.slice(0, 4);
  }, [allowedChannels, activeChannel]);

  // Navegar a Pantalla Completa
  const handleOpenFullscreen = useCallback(
    (ch?: Channel) => {
      const target = ch || activeChannel;
      if (!target) return;
      router.push({
        pathname: "/player",
        params: { channelId: target.id, channelUrl: target.url },
      } as any);
    },
    [activeChannel, router],
  );

  // Manejar click en tarjeta de canal
  const handleChannelPress = useCallback(
    (ch: Channel) => {
      if (activeChannel?.id === ch.id) {
        // Doble click o click en el canal ya activo: ingresar a pantalla completa
        handleOpenFullscreen(ch);
      } else {
        // Cambiar canal activo en el Hero
        setActiveChannel(ch);
      }
    },
    [activeChannel?.id, handleOpenFullscreen, setActiveChannel],
  );

  // Zapping: Canal Anterior
  const handlePrevChannel = useCallback(() => {
    if (allowedChannels.length === 0 || !activeChannel) return;
    const idx = allowedChannels.findIndex((c) => c.id === activeChannel.id);
    const prevIdx = idx <= 0 ? allowedChannels.length - 1 : idx - 1;
    setActiveChannel(allowedChannels[prevIdx]);
  }, [allowedChannels, activeChannel, setActiveChannel]);

  // Zapping: Canal Siguiente
  const handleNextChannel = useCallback(() => {
    if (allowedChannels.length === 0 || !activeChannel) return;
    const idx = allowedChannels.findIndex((c) => c.id === activeChannel.id);
    const nextIdx = (idx + 1) % allowedChannels.length;
    setActiveChannel(allowedChannels[nextIdx]);
  }, [allowedChannels, activeChannel, setActiveChannel]);

  // Toggle Favorito del canal actual
  const handleToggleFav = useCallback(() => {
    if (activeChannel) {
      toggleFavorite(activeChannel.id);
    }
  }, [activeChannel, toggleFavorite]);

  const isCurrentFav = !!activeChannel && favorites.includes(activeChannel.id);

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
      {/* Fondo ambiental profundo y nebulosa cósmica neón */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={["#0e0921", "#070512", "#04030a"]}
          style={StyleSheet.absoluteFill}
        />
        {/* Velo de nebulosa ámbar y cian ambiental */}
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
      >
        {/* ════════════════════════════════════════════════════════════════════
            1. MASTER BROADCAST HERO STAGE (70% Player + 30% 2x2 Quick Grid)
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
              {previewUrl && !videoError ? (
                <HeroVideo
                  key={previewUrl}
                  uri={previewUrl}
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
                    scaleFocused={1.06}
                    style={[s.btnFullscreen, { backgroundColor: activeTheme.color }]}
                    focusedStyle={s.btnFullscreenFocused}
                  >
                    <Play size={scale(16)} color="#000000" fill="#000000" />
                    <Text style={s.btnFullscreenTxt}>Pantalla Completa</Text>
                  </Focusable>

                  <Focusable
                    onPress={handleToggleFav}
                    scaleFocused={1.06}
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
                    scaleFocused={1.06}
                    style={s.btnHeroIcon}
                    focusedStyle={s.btnHeroIconFocused}
                  >
                    <SkipBack size={scale(16)} color="#ffffff" />
                  </Focusable>

                  <Focusable
                    onPress={handleNextChannel}
                    scaleFocused={1.06}
                    style={s.btnHeroIcon}
                    focusedStyle={s.btnHeroIconFocused}
                  >
                    <SkipForward size={scale(16)} color="#ffffff" />
                  </Focusable>
                </View>
              </View>
            </View>

            {/* Lado Derecho (30%): Rejilla 2x2 Zapping Rápido (Inspirado en Kids) */}
            <View style={s.heroRightGrid}>
              {candidateChannels.map((item) => {
                const itemTheme = getChannelCategory(item) || CATEGORY_THEMES[0];
                return (
                  <Focusable
                    key={item.id}
                    onPress={() => handleChannelPress(item)}
                    scaleFocused={1.06}
                    style={s.gridCard}
                    focusedStyle={[
                      s.gridCardFocused,
                      {
                        borderColor: itemTheme.color,
                        shadowColor: itemTheme.color,
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.06)",
                        "rgba(18,14,36,0.85)",
                        "rgba(7,5,18,0.98)",
                      ]}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Badge VIVO superior */}
                    <View style={s.gridCardLive}>
                      <View style={s.gridCardLiveDot} />
                      <Text style={s.gridCardLiveTxt}>VIVO</Text>
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
        )}

        {/* ════════════════════════════════════════════════════════════════════
            2. CINTA DE ACCESO RÁPIDO Y FILTRADO POR CATEGORÍAS
           ════════════════════════════════════════════════════════════════════ */}
        <View style={s.filterRibbonSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterRibbonTrack}
          >
            {/* Botón "Todos los Canales" */}
            <FilterPill
              id="all"
              label="Todos los Canales"
              count={allowedChannels.length}
              isActive={selectedCatId === "all"}
              color={LIVE_COLORS.accentAmber}
              icon={Layers}
              onPress={() => setSelectedCatId("all")}
              nextFocusLeft={sidebarHandle ?? undefined}
            />

            {/* Botón Favoritos (si hay canales en favoritos) */}
            {favChannels.length > 0 && (
              <FilterPill
                id="favorites"
                label="Mis Favoritos"
                count={favChannels.length}
                isActive={selectedCatId === "favorites"}
                color={LIVE_COLORS.favHeart}
                icon={Heart}
                onPress={() => setSelectedCatId("favorites")}
              />
            )}

            {/* Categorías Temáticas */}
            {CATEGORY_THEMES.map((theme) => {
              const count = themedGroups.map.get(theme.id)?.length || 0;
              if (count === 0) return null;
              return (
                <FilterPill
                  key={theme.id}
                  id={theme.id}
                  label={theme.name.split(" ")[0]}
                  count={count}
                  isActive={selectedCatId === theme.id}
                  color={theme.color}
                  icon={theme.icon}
                  onPress={() => setSelectedCatId(theme.id)}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* ════════════════════════════════════════════════════════════════════
            3. CATÁLOGO VISUAL DE CANALES (Filas Temáticas o Grilla Filtrada)
           ════════════════════════════════════════════════════════════════════ */}
        <View style={s.catalogArea}>
          {selectedCatId === "all" ? (
            <>
              {/* Fila 0: Favoritos si existen */}
              {favChannels.length > 0 && (
                <ThemedChannelRow
                  theme={{
                    id: "favorites",
                    name: "⭐ Mis Canales Favoritos",
                    subtitle: "Tus señales preferidas siempre a mano",
                    color: LIVE_COLORS.favHeart,
                    icon: Heart,
                    keywords: [],
                  }}
                  channels={favChannels}
                  activeChannelId={activeChannel?.id}
                  favorites={favorites}
                  onPressChannel={handleChannelPress}
                />
              )}

              {/* Filas Temáticas */}
              {CATEGORY_THEMES.map((theme) => {
                const list = themedGroups.map.get(theme.id) || [];
                if (list.length === 0) return null;
                return (
                  <ThemedChannelRow
                    key={theme.id}
                    theme={theme}
                    channels={list}
                    activeChannelId={activeChannel?.id}
                    favorites={favorites}
                    onPressChannel={handleChannelPress}
                    onViewAll={() => setSelectedCatId(theme.id)}
                  />
                );
              })}

              {/* Fila de Otros Canales y Señales */}
              {themedGroups.others.length > 0 && (
                <ThemedChannelRow
                  theme={{
                    id: "others",
                    name: "🌐 Más Señales y Transmisiones",
                    subtitle: "Canales generales y señales de todo el país",
                    color: "#38bdf8",
                    icon: Tv,
                    keywords: [],
                  }}
                  channels={themedGroups.others}
                  activeChannelId={activeChannel?.id}
                  favorites={favorites}
                  onPressChannel={handleChannelPress}
                />
              )}
            </>
          ) : selectedCatId === "favorites" ? (
            /* Vista Específica de Favoritos */
            <View style={s.filteredSection}>
              <View style={s.filteredHeader}>
                <Heart size={scale(22)} color={LIVE_COLORS.favHeart} fill={LIVE_COLORS.favHeart} />
                <Text style={s.filteredTitle}>Mis Canales Favoritos</Text>
                <Text style={s.filteredSubtitle}>
                  {favChannels.length} canales guardados
                </Text>
              </View>
              <View style={s.gridContainer}>
                {favChannels.map((item, idx) => (
                  <View key={item.id} style={s.gridCell}>
                    <LiveChannelCard
                      channel={item}
                      isActive={item.id === activeChannel?.id}
                      isFav={true}
                      themeColor={LIVE_COLORS.favHeart}
                      onPress={() => handleChannelPress(item)}
                      nextFocusLeft={idx % 4 === 0 ? sidebarHandle ?? undefined : undefined}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : (
            /* Vista Específica de una Categoría */
            (() => {
              const theme =
                CATEGORY_THEMES.find((t) => t.id === selectedCatId) || CATEGORY_THEMES[0];
              const list = themedGroups.map.get(theme.id) || [];
              const Icon = theme.icon;

              return (
                <View style={s.filteredSection}>
                  <View style={s.filteredHeader}>
                    <Icon size={scale(24)} color={theme.color} style={{ marginRight: scale(10) }} />
                    <View>
                      <Text style={s.filteredTitle}>{theme.name}</Text>
                      <Text style={s.filteredSubtitle}>{theme.subtitle}</Text>
                    </View>
                  </View>

                  <View style={s.gridContainer}>
                    {list.map((item, idx) => (
                      <View key={item.id} style={s.gridCell}>
                        <LiveChannelCard
                          channel={item}
                          isActive={item.id === activeChannel?.id}
                          isFav={favorites.includes(item.id)}
                          themeColor={theme.color}
                          onPress={() => handleChannelPress(item)}
                          nextFocusLeft={idx % 4 === 0 ? sidebarHandle ?? undefined : undefined}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()
          )}

          <View style={{ height: scale(60) }} />
        </View>
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
    shadowColor: "#ffffff",
    shadowOpacity: 0.6,
    shadowRadius: scale(8),
    elevation: 8,
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

  // Lado Derecho (30%): Cuadrícula 2x2 Zapping Rápido
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
    backgroundColor: LIVE_COLORS.bgSurfaceElevated,
    borderWidth: 2,
    borderColor: LIVE_COLORS.borderSubtle,
    position: "relative",
    justifyContent: "space-between",
    padding: scale(10),
  },
  gridCardFocused: {
    shadowOpacity: 0.6,
    shadowRadius: scale(8),
    elevation: 8,
  },
  gridCardLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: "rgba(255,0,85,0.2)",
    borderWidth: 1,
    borderColor: LIVE_COLORS.neonRed,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    alignSelf: "flex-end",
  },
  gridCardLiveDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(2.5),
    backgroundColor: LIVE_COLORS.neonRed,
  },
  gridCardLiveTxt: {
    fontSize: scale(9),
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

  // ── 2. Cinta de Filtros Superior ──
  filterRibbonSection: {
    marginBottom: scale(22),
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

  // ── 3. Filas Temáticas ──
  catalogArea: {
    marginTop: scale(4),
  },
  rowWrapper: {
    marginBottom: scale(24),
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(12),
  },
  rowTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rowAccentBar: {
    width: scale(4),
    height: scale(18),
    borderRadius: scale(2),
    marginRight: scale(10),
  },
  rowTitle: {
    fontSize: scale(18),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.3,
    marginRight: scale(12),
  },
  rowSubtitle: {
    fontSize: scale(12.5),
    color: "rgba(255,255,255,0.55)",
    fontWeight: "600",
  },
  rowCountPill: {
    paddingHorizontal: scale(9),
    paddingVertical: scale(3.5),
    borderRadius: scale(8),
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  rowCountTxt: {
    fontSize: scale(11),
    fontWeight: "800",
  },
  rowTrack: {
    flexDirection: "row",
    gap: CARD_GAP,
    paddingVertical: scale(6),
  },

  // ── Tarjeta de Canal Individual ──
  channelCard: {
    width: CH_CARD_W,
    height: CH_CARD_H,
    borderRadius: scale(16),
    overflow: "hidden",
    backgroundColor: LIVE_COLORS.bgSurface,
    borderWidth: 2,
    borderColor: LIVE_COLORS.borderSubtle,
    position: "relative",
    justifyContent: "space-between",
    padding: scale(10),
  },
  channelCardFocused: {
    shadowOpacity: 0.6,
    shadowRadius: scale(10),
    elevation: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  cardLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  cardLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: "rgba(255,0,85,0.15)",
    borderWidth: 1,
    borderColor: LIVE_COLORS.neonRed,
    paddingHorizontal: scale(5),
    paddingVertical: scale(1.5),
    borderRadius: scale(4),
  },
  cardLiveDot: {
    width: scale(4.5),
    height: scale(4.5),
    borderRadius: scale(2.25),
    backgroundColor: "#ffffff",
  },
  cardLiveTxt: {
    fontSize: scale(8.5),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  cardFavBadge: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: "rgba(244, 63, 94, 0.25)",
    borderWidth: 1,
    borderColor: LIVE_COLORS.favHeart,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLogoContainer: {
    width: "100%",
    height: scale(44),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  cardLogo: {
    width: "70%",
    height: "100%",
  },
  cardFallbackIcon: {
    width: scale(46),
    height: scale(46),
    borderRadius: scale(10),
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBottomInfo: {
    zIndex: 2,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: scale(13),
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: scale(2),
  },
  cardCategoryTxt: {
    fontSize: scale(10.5),
    fontWeight: "800",
  },
  cardCountryTxt: {
    fontSize: scale(10.5),
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
  },

  // ── Vista Filtrada (Grilla Multicolumna) ──
  filteredSection: {
    marginTop: scale(10),
  },
  filteredHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: scale(18),
  },
  filteredTitle: {
    fontSize: scale(22),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  filteredSubtitle: {
    fontSize: scale(13),
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
    marginTop: scale(2),
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(14),
  },
  gridCell: {
    marginBottom: scale(8),
  },
});
