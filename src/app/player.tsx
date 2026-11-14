import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Clock,
  Compass,
  Film,
  Globe,
  Heart,
  Languages,
  List,
  MapPin,
  Maximize2,
  Minimize,
  Music,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  Smile,
  Sparkles,
  Star,
  Trophy,
  Tv,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Focusable from '../components/tv/Focusable';
import RemoteImage from '../components/tv/RemoteImage';
import VodPlayer from '../components/tv/VodPlayer';
import WebPlayer from '../components/tv/WebPlayer';
import { API_URL, Channel, useGlobal } from '../contexts/GlobalContext';
import { useTVRemoteKey } from '../hooks/useNavThrottle';
import { recordRecentChannel } from '../utils/recentChannels';
import { scale } from '../lib/scale';
import { C } from '../lib/tvColors';

const TVFocusGuide: any =
  (require('react-native') as any).TVFocusGuideView ?? View;

// Medidas fijas de fila de canal en la Guía para scroll instantáneo al canal activo
const PLAYER_CH_ITEM_H = scale(60);
const PLAYER_CH_ITEM_GAP = scale(6);
const PLAYER_CH_STRIDE = PLAYER_CH_ITEM_H + PLAYER_CH_ITEM_GAP;

const safeFindNodeHandle = (node: any): number | undefined => {
  if (Platform.OS === 'web' || !node) return undefined;
  try {
    const handle = findNodeHandle(node);
    return typeof handle === 'number' && handle > 0 ? handle : undefined;
  } catch {
    return undefined;
  }
};

export default function PlayerScreen() {
  const { slug, episodeId, channelId, channelUrl } = useLocalSearchParams<{
    slug?: string;
    episodeId?: string;
    channelId?: string;
    channelUrl?: string;
  }>();

  if (slug) {
    return <VodPlayer slug={String(slug)} episodeId={episodeId ? String(episodeId) : undefined} />;
  }

  return (
    <ChannelPlayer
      initialChannelId={channelId ? String(channelId) : undefined}
      initialChannelUrl={channelUrl ? String(channelUrl) : undefined}
    />
  );
}

// ── Interfaz de Categoría Inteligente para la Guía ────────────────────────────
interface GuideCategory {
  key: string;
  label: string;
  icon: any;
  color: string;
  filter: (ch: Channel) => boolean;
}

// ── Botón de Acción Profesional del OSD (Compacto y Estilizado) ──────────────
function OSDActionButton({
  icon: Icon,
  onPress,
  onFocus,
  active,
  accentColor,
  hasPreferredFocus,
  isHero,
  trapFocusLeft,
  trapFocusRight,
  trapFocusUp = true,
}: {
  icon: any;
  label?: string;
  onPress: () => void;
  onFocus?: () => void;
  active?: boolean;
  accentColor?: string;
  hasPreferredFocus?: boolean;
  isHero?: boolean;
  trapFocusLeft?: boolean;
  trapFocusRight?: boolean;
  trapFocusUp?: boolean;
}) {
  const iconSize = isHero ? scale(24) : scale(18);

  return (
    <Focusable
      hasTVPreferredFocus={hasPreferredFocus}
      onPress={onPress}
      onFocus={onFocus}
      throttleMs={0}
      trapFocusLeft={trapFocusLeft}
      trapFocusRight={trapFocusRight}
      trapFocusUp={trapFocusUp}
      trapFocusDown={true}
      animateScale={false}
      showFocusRing={false}
      style={[
        s.osdActionBtn,
        isHero && s.osdActionBtnHero,
        active && {
          borderColor: accentColor || C.accent,
          backgroundColor: accentColor ? `${accentColor}25` : 'rgba(255, 183, 3, 0.2)',
        },
      ]}
      focusedStyle={[
        s.osdActionBtnFocused,
        isHero && s.osdActionBtnHeroFocused,
        accentColor ? { borderColor: accentColor } : undefined,
      ]}
    >
      {({ focused }) => {
        let iconColor = '#ffffff';
        if (focused) {
          iconColor = '#000000';
        } else if (active) {
          iconColor = accentColor || C.accent;
        }

        return (
          <Icon
            size={iconSize}
            color={iconColor}
            strokeWidth={focused ? 2.5 : 2}
            fill={active && (Icon === Heart || Icon === Play) ? iconColor : 'none'}
          />
        );
      }}
    </Focusable>
  );
}

// ── Reproductor de Canales de TV en Vivo ─────────────────────────────────────
function ChannelPlayer({
  initialChannelId,
  initialChannelUrl,
}: {
  initialChannelId?: string;
  initialChannelUrl?: string;
}) {
  const { activeChannel, setActiveChannel, channels, favorites, toggleFavorite } = useGlobal();
  const router = useRouter();
  const videoRef = useRef<VideoRef | null>(null);

  // Inicializar canal desde parámetros si corresponde
  useEffect(() => {
    if (initialChannelId || initialChannelUrl) {
      if (!activeChannel || (initialChannelId && activeChannel.id !== initialChannelId)) {
        const found = channels.find((c) => c.id === initialChannelId);
        if (found) {
          setActiveChannel(found);
        } else if (initialChannelUrl) {
          setActiveChannel({
            id: initialChannelId || 'temp-ch',
            name: 'Canal en vivo',
            url: initialChannelUrl,
          } as Channel);
        }
      }
    }
  }, [initialChannelId, initialChannelUrl, channels]);

  // Estados de reproducción y video
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [resizeMode, setResizeMode] = useState<'contain' | 'cover'>('contain');
  const [isNativeBuffering, setIsNativeBuffering] = useState(true);
  const [isNativeError, setIsNativeError] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Estados de interfaz OSD y Guía Dual
  const [showOSD, setShowOSD] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [guidePane, setGuidePane] = useState<'categories' | 'channels'>('categories');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState('all');
  const [guideSearch, setGuideSearch] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [focusedAction, setFocusedAction] = useState('Pausar Transmisión');
  const focusedDockIdxRef = useRef(1);
  const isDockFocusedRef = useRef(false);
  const dockEdgeEnteredAtRef = useRef(0);
  const lastZapTimeRef = useRef(0);
  const updateDockIdx = useCallback((idx: number) => {
    const prev = focusedDockIdxRef.current;
    focusedDockIdxRef.current = idx;
    isDockFocusedRef.current = true;
    if ((idx === 0 || idx === 8) && prev !== idx) {
      dockEdgeEnteredAtRef.current = Date.now();
    }
  }, []);
  const [osdFocusReady, setOsdFocusReady] = useState(false);
  const [guideFocusReady, setGuideFocusReady] = useState(false);

  // HUD de notificación flotante rápida (Volumen, Silencio, Sincronizado, etc.)
  const [hud, setHud] = useState<{ text: string; icon?: any } | null>(null);
  const hudTimerRef = useRef<any>(null);
  const osdTimerRef = useRef<any>(null);

  // Refs y Handles para sincronizar foco entre Ventana 1 y Ventana 2 de la Guía
  const catRefs = useRef<Record<string, any>>({});
  const [catHandles, setCatHandles] = useState<Record<string, number>>({});
  const channelsListRef = useRef<FlatList<Channel>>(null);
  const guidePaneRef = useRef<'categories' | 'channels'>('categories');
  const focusedCategoryKeyRef = useRef<string>('all');
  const selectedCategoryKeyRef = useRef<string>('all');
  selectedCategoryKeyRef.current = selectedCategoryKey;
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const categoriesRef = useRef<GuideCategory[]>([]);

  // Reloj digital en vivo en el OSD
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${h}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const isCurrentFav = !!activeChannel && favSet.has(activeChannel.id);

  // Disparar mensaje HUD flotante
  const showHudMessage = useCallback((text: string, icon?: any) => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    setHud({ text, icon });
    hudTimerRef.current = setTimeout(() => {
      setHud(null);
    }, 2400);
  }, []);

  // Mostrar OSD con temporizador de auto-ocultado (10s)
  const triggerOSD = useCallback(() => {
    setShowOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    if (!showGuide) {
      osdTimerRef.current = setTimeout(() => {
        setShowOSD(false);
      }, 10000);
    }
  }, [showGuide]);

  useEffect(() => {
    return () => {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (showOSD && !showGuide) {
      focusedDockIdxRef.current = 1;
      setOsdFocusReady(false);
      const t = setTimeout(() => setOsdFocusReady(true), 50);
      return () => clearTimeout(t);
    }
    isDockFocusedRef.current = false;
    focusedDockIdxRef.current = 1;
    setOsdFocusReady(false);
  }, [showOSD, showGuide]);

  // Al cambiar de canal activo, resetear estado de error/buffering y registrar en recientes
  // (sin forzar la apertura del menú OSD para permitir cambio directo con Arriba/Abajo)
  useEffect(() => {
    setWebError(null);
    setIsNativeError(false);
    setIsNativeBuffering(true);
    if (activeChannel?.id) {
      recordRecentChannel(activeChannel.id);
    }
  }, [activeChannel]);

  // Iniciar temporizador del OSD al montar y ocultar el OSD cuando se abre la Guía
  useEffect(() => {
    triggerOSD();
  }, [triggerOSD]);

  useEffect(() => {
    if (showGuide) {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
      setShowOSD(false); // Ocultar OSD inferior para dejar libre la vista de la Guía dual
    }
  }, [showGuide]);

  // ── Controles de Reproducción ──────────────────────────────────────────────
  const togglePlayPause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      showHudMessage(next ? 'Pausado' : 'Reanudando señal en vivo', next ? Pause : Play);
      return next;
    });
    triggerOSD();
  }, [showHudMessage, triggerOSD]);

  const syncLive = useCallback(() => {
    setIsPaused(false);
    setReloadKey((prev) => prev + 1);
    showHudMessage('Señal en vivo sincronizada', RotateCcw);
    triggerOSD();
  }, [showHudMessage, triggerOSD]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      showHudMessage(next ? 'Silenciado' : `Sonido: ${Math.round(volume * 100)}%`, next ? VolumeX : Volume2);
      return next;
    });
    triggerOSD();
  }, [volume, showHudMessage, triggerOSD]);

  const volumeUp = useCallback(() => {
    setIsMuted(false);
    setVolume((prev) => {
      const next = Math.min(1.0, +(prev + 0.1).toFixed(1));
      showHudMessage(`Volumen: ${Math.round(next * 100)}%`, Volume2);
      return next;
    });
    triggerOSD();
  }, [showHudMessage, triggerOSD]);

  const volumeDown = useCallback(() => {
    setIsMuted(false);
    setVolume((prev) => {
      const next = Math.max(0.0, +(prev - 0.1).toFixed(1));
      showHudMessage(`Volumen: ${Math.round(next * 100)}%`, Volume1);
      return next;
    });
    triggerOSD();
  }, [showHudMessage, triggerOSD]);

  const toggleResizeMode = useCallback(() => {
    setResizeMode((prev) => {
      const next = prev === 'contain' ? 'cover' : 'contain';
      showHudMessage(next === 'cover' ? 'Ajuste: Llenar Pantalla' : 'Ajuste: Contener Original (16:9)', Maximize2);
      return next;
    });
    triggerOSD();
  }, [showHudMessage, triggerOSD]);

  const handleToggleFav = useCallback(() => {
    if (!activeChannel) return;
    toggleFavorite(activeChannel);
    const willBeFav = !favSet.has(String(activeChannel.id));
    showHudMessage(willBeFav ? 'Guardado en Favoritos' : 'Eliminado de Favoritos', Star);
    triggerOSD();
  }, [activeChannel, favSet, toggleFavorite, showHudMessage, triggerOSD]);

  // Zapping: Canal Siguiente
  const nextChannel = useCallback(() => {
    if (channels.length === 0 || !activeChannel) return;
    const idx = channels.findIndex((c) => c.id === activeChannel.id);
    const nextIdx = (idx + 1) % channels.length;
    const target = channels[nextIdx];
    setActiveChannel(target);
    showHudMessage(`Siguiente: ${target.name}`, SkipForward);
  }, [channels, activeChannel, setActiveChannel, showHudMessage]);

  // Zapping: Canal Anterior
  const prevChannel = useCallback(() => {
    if (channels.length === 0 || !activeChannel) return;
    const idx = channels.findIndex((c) => c.id === activeChannel.id);
    const prevIdx = (idx - 1 + channels.length) % channels.length;
    const target = channels[prevIdx];
    setActiveChannel(target);
    showHudMessage(`Anterior: ${target.name}`, SkipBack);
  }, [channels, activeChannel, setActiveChannel, showHudMessage]);

  // Abrir / Cerrar Guía de dos ventanas enfocando directamente el canal actual en reproducción
  const openGuide = useCallback(() => {
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    setShowOSD(false);
    setGuideSearch('');
    const currentCat = categoriesRef.current.find((c) => c.key === selectedCategoryKeyRef.current);
    const hasActiveInCat =
      activeChannel && currentCat ? currentCat.filter(activeChannel) : false;
    const targetCatKey = hasActiveInCat ? selectedCategoryKeyRef.current : 'all';
    selectedCategoryKeyRef.current = targetCatKey;
    setSelectedCategoryKey(targetCatKey);
    focusedCategoryKeyRef.current = targetCatKey;
    guidePaneRef.current = 'channels';
    setGuidePane('channels');
    setShowGuide(true);
  }, [activeChannel]);

  const closeGuide = useCallback(() => {
    setShowGuide(false);
  }, []);

  // Al desplazarse por la Ventana 1 no cambia los canales de la derecha;
  // solo actualiza la lista derecha cuando el usuario presiona OK o Derecha.
  const handleCategoryFocus = useCallback((key: string) => {
    focusedCategoryKeyRef.current = key;
    guidePaneRef.current = 'categories';
    setGuidePane('categories');
  }, []);

  const handleCategoryPress = useCallback((key: string) => {
    focusedCategoryKeyRef.current = key;
    setSelectedCategoryKey(key);
    setGuideSearch('');
    const catObj = categoriesRef.current.find((c) => c.key === key);
    const hasChannels = Boolean(catObj && channelsRef.current.some(catObj.filter));
    const nextPane = hasChannels ? 'channels' : 'categories';
    guidePaneRef.current = nextPane;
    setGuidePane(nextPane);
  }, []);

  // ── Motor Inteligente de Clasificaciones para Ventana 1 ───────────────────
  const categories: GuideCategory[] = useMemo(() => {
    const list: GuideCategory[] = [];

    // 1. Favoritos
    const favCount = channels.filter((c) => favSet.has(c.id)).length;
    list.push({
      key: 'fav',
      label: 'Favoritos',
      icon: Star,
      color: '#ffb703',
      filter: (c) => favSet.has(c.id),
    });

    // 2. Todos los canales
    list.push({
      key: 'all',
      label: 'Todos los canales',
      icon: Tv,
      color: '#ffffff',
      filter: () => true,
    });

    // 3. Géneros Temáticos Inteligentes
    const themes = [
      {
        key: 'theme_sports',
        label: 'Deportes en Vivo',
        icon: Trophy,
        color: '#00f59b',
        kws: ['sport', 'deport', 'futbol', 'fútbol', 'soccer', 'espn', 'tyc', 'fox', 'dazn', 'nba', 'racing', 'tnt sports', 'dsports', 'gol', 'laliga'],
      },
      {
        key: 'theme_movies',
        label: 'Cine & Películas',
        icon: Film,
        color: '#ffbe0b',
        kws: ['movie', 'cine', 'pelicul', 'film', 'hbo', 'star', 'cinema', 'max', 'action', 'paramount', 'amc', 'space', 'tnt', 'golden', 'studio'],
      },
      {
        key: 'theme_series',
        label: 'Series & Ficción',
        icon: Clapperboard,
        color: '#8338ec',
        kws: ['series', 'serie', 'ficcion', 'ficción', 'drama', 'warner', 'sony', 'universal', 'axn', 'fx', 'comedy', 'a&e'],
      },
      {
        key: 'theme_news',
        label: 'Noticias & Directos',
        icon: Globe,
        color: '#00f0ff',
        kws: ['news', 'noticia', 'actualidad', 'cnn', 'tn', 'c5n', 'bbc', 'al jazeera', 'ln+', 'cronica', 'a24', 'canal 26', 'telefe', 'eltrece', 'tv publica', 'america', 'rt'],
      },
      {
        key: 'theme_kids',
        label: 'Infantil & Animación',
        icon: Smile,
        color: '#ff007f',
        kws: ['kid', 'infantil', 'family', 'familiar', 'cartoon', 'disney', 'nick', 'junior', 'animacion', 'anime', 'toon', 'boomerang', 'discovery kids', 'cartoonito'],
      },
      {
        key: 'theme_entertainment',
        label: 'Entretenimiento & Shows',
        icon: Sparkles,
        color: '#ff5400',
        kws: ['entertain', 'entretenimiento', 'comedia', 'humor', 'variety', 'e!', 'tbs', 'tlc', 'glitz', 'telenovela'],
      },
      {
        key: 'theme_docs',
        label: 'Cultura & Documentales',
        icon: Compass,
        color: '#06d6a0',
        kws: ['docu', 'cultur', 'educat', 'ciencia', 'discovery', 'natgeo', 'national geographic', 'history', 'animal', 'investigation'],
      },
      {
        key: 'theme_music',
        label: 'Música & Recitales',
        icon: Music,
        color: '#e040fb',
        kws: ['music', 'musica', 'música', 'mtv', 'vh1', 'radio', 'hit', 'pop', 'rock', 'urbano', 'htv', 'cm', 'quiero'],
      },
    ];

    for (const t of themes) {
      const fn = (ch: Channel) => {
        const target = `${ch.name} ${ch.category?.name || ''} ${ch.groupTitle || ''}`.toLowerCase();
        return t.kws.some((kw) => target.includes(kw));
      };
      if (channels.some(fn)) {
        list.push({
          key: t.key,
          label: t.label,
          icon: t.icon,
          color: t.color,
          filter: fn,
        });
      }
    }

    // 4. Agrupación Dinámica por Países
    const countryMap = new Map<string, number>();
    for (const ch of channels) {
      const c = (ch.country || '').trim();
      if (c && c.toLowerCase() !== 'internacional' && c.toLowerCase() !== 'mundo') {
        const norm = c.charAt(0).toUpperCase() + c.slice(1);
        countryMap.set(norm, (countryMap.get(norm) || 0) + 1);
      }
    }
    const sortedCountries = Array.from(countryMap.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);

    for (const [countryName] of sortedCountries.slice(0, 8)) {
      list.push({
        key: `country_${countryName.toLowerCase()}`,
        label: countryName,
        icon: MapPin,
        color: '#38bdf8',
        filter: (ch: Channel) => (ch.country || '').toLowerCase() === countryName.toLowerCase(),
      });
    }

    // 5. Agrupación por Idiomas
    const langMap = new Map<string, number>();
    for (const ch of channels) {
      const l = (ch.language || '').trim();
      if (l) {
        const norm = l.charAt(0).toUpperCase() + l.slice(1);
        langMap.set(norm, (langMap.get(norm) || 0) + 1);
      }
    }
    for (const [langName, count] of langMap.entries()) {
      if (count >= 5) {
        list.push({
          key: `lang_${langName.toLowerCase()}`,
          label: `Idioma: ${langName}`,
          icon: Languages,
          color: '#a78bfa',
          filter: (ch: Channel) => (ch.language || '').toLowerCase() === langName.toLowerCase(),
        });
      }
    }

    return list;
  }, [channels, favSet]);

  // Actualizar handles de nodos en categorías
  useEffect(() => {
    if (Platform.OS === 'web' || !showGuide) return;
    const syncCatHandles = () => {
      const handles: Record<string, number> = {};
      for (const cat of categories) {
        const node = catRefs.current[cat.key];
        if (node) {
          const h = safeFindNodeHandle(node);
          if (typeof h === 'number' && h > 0) handles[cat.key] = h;
        }
      }
      setCatHandles(handles);
    };
    syncCatHandles();
    const t = setTimeout(syncCatHandles, 40);
    return () => clearTimeout(t);
  }, [categories, showGuide]);

  // Canales filtrados por la categoría activa en Ventana 1
  const categoryChannels = useMemo(() => {
    const cat = categories.find((c) => c.key === selectedCategoryKey) || categories[1] || categories[0];
    return channels.filter(cat.filter);
  }, [categories, selectedCategoryKey, channels]);

  // Canales de Ventana 2 filtrados además por el buscador interno
  const displayedChannels = useMemo(() => {
    if (!guideSearch.trim()) return categoryChannels;
    const q = guideSearch.toLowerCase().trim();
    return categoryChannels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.country || '').toLowerCase().includes(q) ||
        (c.category?.name || '').toLowerCase().includes(q),
    );
  }, [categoryChannels, guideSearch]);

  // Índice del canal actual dentro de la lista filtrada para posicionar scroll y foco automáticamente
  const activeChannelIdx = useMemo(() => {
    if (!activeChannel?.id) return -1;
    return displayedChannels.findIndex((c) => c.id === activeChannel.id);
  }, [displayedChannels, activeChannel?.id]);

  const preferredChannelIdx = activeChannelIdx >= 0 ? activeChannelIdx : 0;
  const initialScrollIdx = Math.max(0, preferredChannelIdx - 2);

  const getPlayerChannelItemLayout = useCallback(
    (_: any, index: number) => ({
      length: PLAYER_CH_STRIDE,
      offset: PLAYER_CH_STRIDE * index,
      index,
    }),
    [],
  );

  // Al abrir la guía o cambiar de categoría, desplazar al canal actual y activar el foco sobre él
  useEffect(() => {
    if (!showGuide) {
      setGuideFocusReady(false);
      return;
    }
    setGuideFocusReady(false);
    const targetOffset = Math.max(0, (preferredChannelIdx - 2) * PLAYER_CH_STRIDE);
    const scrollTimer = setTimeout(() => {
      channelsListRef.current?.scrollToOffset?.({ offset: targetOffset, animated: false });
    }, 10);
    const focusTimer = setTimeout(() => {
      channelsListRef.current?.scrollToOffset?.({ offset: targetOffset, animated: false });
      setGuideFocusReady(true);
    }, 55);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(focusTimer);
    };
  }, [showGuide, selectedCategoryKey, preferredChannelIdx]);

  const activeCategoryObj = useMemo(() => {
    return categories.find((c) => c.key === selectedCategoryKey) || categories[0];
  }, [categories, selectedCategoryKey]);

  categoriesRef.current = categories;
  const isError = Platform.OS === 'web' ? Boolean(webError) : isNativeError;

  // ── Eventos de Control Remoto / Teclado TV (vía MainActivity -> onTVRemoteKey) ──
  useTVRemoteKey((evt) => {
    if (!evt || !evt.eventType) return;
    const t = evt.eventType;
    const isFreshPress = (evt.repeatCount ?? 0) === 0;

    // Si la guía dual está abierta:
    if (showGuide) {
      if (t === 'playPause' && isFreshPress) {
        togglePlayPause();
      } else if (
        t === 'right' &&
        isFreshPress &&
        guidePaneRef.current === 'categories'
      ) {
        handleCategoryPress(focusedCategoryKeyRef.current);
      }
      return;
    }

    // Si el OSD está abierto:
    if (showOSD) {
      triggerOSD();
      const canTriggerEdge =
        isFreshPress || Date.now() - dockEdgeEnteredAtRef.current >= 220;
      if (t === 'playPause' && isFreshPress) {
        togglePlayPause();
      } else if ((t === 'up' || t === 'down') && !isError) {
        const now = Date.now();
        const minZapInterval = isFreshPress ? 80 : 350;
        if (now - lastZapTimeRef.current >= minZapInterval) {
          lastZapTimeRef.current = now;
          if (t === 'up') {
            nextChannel();
          } else {
            prevChannel();
          }
        }
      } else if (
        t === 'left' &&
        isDockFocusedRef.current &&
        focusedDockIdxRef.current === 0 &&
        canTriggerEdge
      ) {
        // En el extremo izquierdo del dock de botones: presionar izquierda abre la guía de canales
        openGuide();
      } else if (
        t === 'right' &&
        isDockFocusedRef.current &&
        focusedDockIdxRef.current === 8 &&
        canTriggerEdge
      ) {
        // En el extremo derecho del dock de botones: presionar derecha abre la guía de canales
        openGuide();
      }
      return;
    }

    // Cuando el menú no está visible (sin OSD ni Guía):
    // - Derecha o Izquierda: abre directamente la barra de filtros de canales
    // - Arriba o Abajo: cambia de canal de forma directa (sin abrir el menú OSD)
    // - OK / Select o Menú: muestra el menú de control OSD
    if (t === 'left' || t === 'right') {
      openGuide();
    } else if (t === 'up' || t === 'down') {
      const now = Date.now();
      const minZapInterval = isFreshPress ? 80 : 350;
      if (now - lastZapTimeRef.current >= minZapInterval) {
        lastZapTimeRef.current = now;
        if (t === 'up') {
          nextChannel();
        } else {
          prevChannel();
        }
      }
    } else if (t === 'select' || t === 'menu') {
      triggerOSD();
    } else if (t === 'playPause' && isFreshPress) {
      togglePlayPause();
    }
  });

  // Botón Atrás del control remoto: cierra la guía de UNA sola vez
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const backAction = () => {
      if (showGuide) {
        closeGuide();
        return true;
      }
      if (showOSD) {
        setShowOSD(false);
        return true;
      }
      router.back();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => sub.remove();
  }, [showGuide, showOSD, router, closeGuide]);

  // Tecla Atrás (Escape / Backspace) en Navegador Web (el resto se maneja vía useTVRemoteKey)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea';

      if (e.key === 'Escape' || (!isInput && e.key === 'Backspace')) {
        e.preventDefault();
        if (showGuide) {
          closeGuide();
          return;
        }
        if (showOSD) {
          setShowOSD(false);
          return;
        }
        router.back();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showGuide, showOSD, closeGuide, router]);

  if (!activeChannel) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadingText}>Conectando con la señal en vivo...</Text>
      </View>
    );
  }

  const proxyUrl =
    Platform.OS === 'web'
      ? `${API_URL}/proxy?url=${encodeURIComponent(activeChannel.url)}`
      : activeChannel.url;
  const isBuffering = Platform.OS === 'web' ? false : isNativeBuffering;

  const currentCategoryHandle = catHandles[selectedCategoryKey] || catHandles[categories[0]?.key];

  return (
    <View style={s.root}>
      {/* ── 1. CAPA DE VIDEO (REPRODUCCIÓN CONTINUA A PANTALLA COMPLETA) ── */}
      {Platform.OS === 'web' ? (
        <WebPlayer
          key={`${activeChannel.id}-${reloadKey}`}
          uri={proxyUrl}
          fallbackUri={activeChannel.url}
          paused={isPaused}
          muted={isMuted}
          volume={isMuted ? 0 : volume}
          resizeMode={resizeMode}
          onError={(msg: string) => setWebError(msg)}
        />
      ) : (
        <Video
          key={`${activeChannel.id}-${reloadKey}`}
          ref={videoRef}
          style={s.videoAbsolute}
          source={{ uri: proxyUrl }}
          controls={false}
          resizeMode={resizeMode}
          paused={isPaused}
          muted={isMuted}
          volume={isMuted ? 0 : volume}
          onLoad={() => {
            setIsNativeBuffering(false);
            setIsNativeError(false);
          }}
          onBuffer={({ isBuffering: b }: { isBuffering: boolean }) => {
            setIsNativeBuffering(b);
          }}
          onError={(err: any) => {
            console.warn('[ChannelPlayer] Error de reproducción:', err);
            setIsNativeError(true);
            setIsNativeBuffering(false);
          }}
        />
      )}

      {/* Indicadores de Carga y Error de Señal */}
      {!isError && isBuffering && (
        <View style={s.bufferOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={s.bufferText}>Sintonizando transmisión en directo…</Text>
        </View>
      )}

      {isError && (
        <View style={s.errorOverlay} pointerEvents="box-none">
          <View style={s.errorCard}>
            <Tv size={scale(36)} color="#f87171" />
            <Text style={s.errorTitle}>Señal momentáneamente no disponible</Text>
            <Text style={s.errorSub}>
              {webError || 'No se pudo recibir la transmisión en vivo. Puedes intentar sincronizar o cambiar de canal.'}
            </Text>
            <View style={s.errorActions}>
              <Focusable
                hasTVPreferredFocus
                onFocus={() => {
                  isDockFocusedRef.current = false;
                }}
                onPress={syncLive}
                animateScale={false}
                showFocusRing={false}
                style={s.errorBtn}
                focusedStyle={s.errorBtnFocused}
              >
                {() => (
                  <>
                    <RotateCcw size={scale(16)} color="#000" />
                    <Text style={s.errorBtnTxt}>Reintentar conexión</Text>
                  </>
                )}
              </Focusable>
              <Focusable
                onFocus={() => {
                  isDockFocusedRef.current = false;
                }}
                onPress={nextChannel}
                animateScale={false}
                showFocusRing={false}
                style={s.errorBtnSecondary}
                focusedStyle={s.errorBtnSecondaryFocused}
              >
                {({ focused }) => (
                  <>
                    <SkipForward size={scale(16)} color={focused ? '#000' : '#fff'} />
                    <Text style={[s.errorBtnSecondaryTxt, focused && { color: '#000' }]}>
                      Canal siguiente
                    </Text>
                  </>
                )}
              </Focusable>
            </View>
          </View>
        </View>
      )}

      {/* ── Capa táctil a pantalla completa para mostrar el OSD con toque/clic sin robar teclas TV ── */}
      {!showGuide && !showOSD && (
        <Pressable
          focusable={false}
          accessible={false}
          onPress={triggerOSD}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* ── 2. HUD DE NOTIFICACIÓN RÁPIDA (VOLUMEN, VIVO, ZAPPING) ── */}
      {hud && (
        <View style={s.hudToast} pointerEvents="none">
          {hud.icon && <hud.icon size={scale(18)} color={C.accent} />}
          <Text style={s.hudToastText}>{hud.text}</Text>
        </View>
      )}

      {/* ── 3. GUÍA DUAL: DOS VENTANAS UNIDAS SEMI-TRANSPARENTES ── */}
      {showGuide && (
        <View style={s.guideBackdrop} pointerEvents="box-none">
          {/* Backdrop clickeable: click afuera ("en otro lado") cierra la guía inmediatamente */}
          <Pressable
            focusable={false}
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={closeGuide}
          />

          {/* Sombra de viñeta suave lateral para no oscurecer el video que sigue de fondo */}
          <LinearGradient
            colors={['rgba(5, 5, 8, 0.94)', 'rgba(5, 5, 8, 0.65)', 'transparent']}
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
                  <Compass size={scale(18)} color={C.accent} />
                  <Text style={s.guideHeadTitle}>EXPLORAR GUÍA</Text>
                </View>
                <Text style={s.guideHeadSub}>Categorías y Géneros</Text>
              </View>

              <ScrollView
                style={s.catScroll}
                contentContainerStyle={s.catScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {categories.map((cat, idx) => {
                  const isSelected = cat.key === selectedCategoryKey;
                  const Icon = cat.icon;
                  const chCount = channels.filter(cat.filter).length;

                  return (
                    <Focusable
                      key={cat.key}
                      ref={(node: any) => {
                        catRefs.current[cat.key] = node;
                      }}
                      hasTVPreferredFocus={guideFocusReady && isSelected && guidePane === 'categories'}
                      onFocus={() => handleCategoryFocus(cat.key)}
                      onPress={() => handleCategoryPress(cat.key)}
                      trapFocusRight={true}
                      trapFocusLeft={true}
                      trapFocusUp={idx === 0}
                      trapFocusDown={idx === categories.length - 1}
                      throttleMs={0}
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
                              { backgroundColor: isSelected ? 'rgba(255, 183, 3, 0.2)' : 'rgba(255,255,255,0.06)' },
                              focused && { backgroundColor: '#000000' },
                            ]}
                          >
                            <Icon
                              size={scale(15)}
                              color={focused ? '#000000' : isSelected ? C.accent : cat.color}
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
                              {chCount}
                            </Text>
                          </View>
                        </>
                      )}
                    </Focusable>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── VENTANA 2: CANALES EN VIVO DE LA SELECCIÓN ACTIVA ── */}
            <View style={s.windowChannels}>
              <View style={s.chHeader}>
                <View style={s.chHeaderTop}>
                  <View style={s.chHeaderTitleWrap}>
                    <activeCategoryObj.icon size={scale(18)} color={activeCategoryObj.color} />
                    <Text style={s.chHeaderTitle} numberOfLines={1}>
                      {activeCategoryObj.label.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={s.chHeaderCount}>
                    {displayedChannels.length} {displayedChannels.length === 1 ? 'canal' : 'canales'}
                  </Text>
                </View>

                {/* Buscador Rápido integrado en Ventana 2 */}
                <View style={s.searchWrap}>
                  <Search size={scale(14)} color="rgba(255,255,255,0.5)" />
                  <TextInput
                    value={guideSearch}
                    onChangeText={setGuideSearch}
                    onFocus={() => {
                      guidePaneRef.current = 'channels';
                      setGuidePane('channels');
                    }}
                    placeholder="Filtrar canal por nombre o país…"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={s.searchInput}
                  />
                  {guideSearch.length > 0 && (
                    <Pressable onPress={() => setGuideSearch('')} style={s.searchClear}>
                      <X size={scale(13)} color="#fff" />
                    </Pressable>
                  )}
                </View>
              </View>

              <FlatList
                ref={channelsListRef}
                data={displayedChannels}
                keyExtractor={(item) => item.id}
                extraData={`${guideFocusReady}-${guidePane}-${activeChannel.id}-${preferredChannelIdx}-${currentCategoryHandle}`}
                style={s.chList}
                contentContainerStyle={s.chListContent}
                initialNumToRender={14}
                maxToRenderPerBatch={10}
                windowSize={7}
                getItemLayout={getPlayerChannelItemLayout}
                initialScrollIndex={
                  displayedChannels.length > initialScrollIdx ? initialScrollIdx : 0
                }
                onScrollToIndexFailed={() => {}}
                removeClippedSubviews={false}
                renderItem={({ item, index }) => {
                  const isCurrent = item.id === activeChannel.id;
                  const isFav = favSet.has(item.id);

                  return (
                    <Focusable
                      hasTVPreferredFocus={
                        guideFocusReady &&
                        index === preferredChannelIdx &&
                        guidePane === 'channels'
                      }
                      onFocus={() => {
                        guidePaneRef.current = 'channels';
                        setGuidePane('channels');
                      }}
                      onPress={() => {
                        setActiveChannel(item);
                        showHudMessage(`Sintonizando: ${item.name}`, Tv);
                      }}
                      nextFocusLeft={currentCategoryHandle}
                      trapFocusRight={true}
                      trapFocusDown={index === displayedChannels.length - 1}
                      throttleMs={80}
                      animateScale={false}
                      showFocusRing={false}
                      style={[s.chItem, isCurrent && s.chItemCurrent]}
                      focusedStyle={s.chItemFocused}
                    >
                      {({ focused }) => (
                        <>
                          {/* Logo del Canal */}
                          <View style={[s.chLogoBox, focused && s.chLogoBoxFocused]}>
                            {item.logo ? (
                              <RemoteImage
                                uri={item.logo}
                                style={s.chLogoImg as any}
                                contentFit="contain"
                                transition={150}
                              />
                            ) : (
                              <Tv
                                size={scale(18)}
                                color={focused ? '#000000' : 'rgba(255,255,255,0.7)'}
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
                                  {item.country ? ' • ' : ''}
                                  {item.language}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          {/* Indicadores de En Pantalla o Favorito */}
                          <View style={s.chBadgesWrap}>
                            {isCurrent && (
                              <View style={[s.badgeLiveOn, focused && s.badgeLiveOnFocused]}>
                                <View style={s.liveOnDot} />
                                <Text
                                  style={[s.liveOnTxt, focused && s.liveOnTxtFocused]}
                                >
                                  EN PANTALLA
                                </Text>
                              </View>
                            )}

                            {isFav && (
                              <Heart
                                size={scale(14)}
                                color={focused ? '#ff0055' : '#ff4d80'}
                                fill={focused ? '#ff0055' : '#ff4d80'}
                              />
                            )}
                          </View>
                        </>
                      )}
                    </Focusable>
                  );
                }}
                ListEmptyComponent={
                  <View style={s.emptyWrap}>
                    <Tv size={scale(28)} color="rgba(255,255,255,0.3)" />
                    <Text style={s.emptyTitle}>No hay canales en esta sección</Text>
                    <Text style={s.emptySub}>Prueba seleccionando otra categoría o limpiando la búsqueda.</Text>
                  </View>
                }
              />
            </View>
          </TVFocusGuide>
        </View>
      )}

      {/* ── 4. OSD PROFESIONAL (CONTROLES COMPLETOS + INFORMACIÓN EN CABECERA) ── */}
      {showOSD && !showGuide && (
        <View style={s.osdRoot} pointerEvents="box-none">
          {/* Click en cualquier parte libre del reproductor oculta el OSD */}
          <Pressable
            focusable={false}
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={() => setShowOSD(false)}
          />

          {/* Degradado Cinematográfico Superior */}
          <LinearGradient
            colors={['rgba(5, 5, 8, 0.92)', 'rgba(5, 5, 8, 0.45)', 'transparent']}
            style={s.osdTopGrad}
            pointerEvents="none"
          />

          {/* Degradado Cinematográfico Inferior */}
          <LinearGradient
            colors={['transparent', 'rgba(5, 5, 8, 0.65)', 'rgba(4, 4, 7, 0.98)']}
            locations={[0, 0.35, 1]}
            style={s.osdBottomGrad}
            pointerEvents="none"
          />

          {/* ── Cabecera Superior con Metadatos del Canal en Reproducción ── */}
          <View style={s.osdTopBar} pointerEvents="box-none">
            <View style={s.osdChannelLockup} pointerEvents="none">
              {activeChannel.logo ? (
                <View style={s.osdLogoBox}>
                  <RemoteImage
                    uri={activeChannel.logo}
                    style={s.osdLogoImg as any}
                    contentFit="contain"
                  />
                </View>
              ) : null}

              <View style={s.osdChannelDetails}>
                {activeChannel.category?.name || activeChannel.country ? (
                  <View style={s.osdBadgeRow}>
                    {activeChannel.category?.name ? (
                      <View style={s.osdTagBadge}>
                        <Text style={s.osdTagBadgeTxt}>
                          {activeChannel.category.name.toUpperCase()}
                        </Text>
                      </View>
                    ) : null}

                    {activeChannel.country ? (
                      <View style={s.osdCountryBadge}>
                        <MapPin size={scale(10)} color="#fff" />
                        <Text style={s.osdCountryBadgeTxt}>
                          {activeChannel.country.toUpperCase()}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <Text style={s.osdChannelName} numberOfLines={1}>
                  {activeChannel.name}
                </Text>
              </View>
            </View>

            {/* Reloj en la Esquina Superior Derecha */}
            <View style={s.osdTopRight} pointerEvents="none">
              {isMuted ? (
                <View style={s.mutedBadge}>
                  <VolumeX size={scale(13)} color="#f87171" />
                  <Text style={s.mutedBadgeTxt}>MUTED</Text>
                </View>
              ) : null}

              <View style={s.clockWrap}>
                <Clock size={scale(13)} color="rgba(255,255,255,0.7)" />
                <Text style={s.clockTxt}>{currentTime}</Text>
              </View>
            </View>
          </View>

          {/* ── Barra de Control Profesional Cinematográfica (Inferior) ── */}
          <View style={s.osdBottomBar} pointerEvents="box-none">
            {/* Tooltip flotante dinámico con el nombre de la acción enfocada */}
            <View style={s.osdTooltipWrap} pointerEvents="none">
              <View style={s.osdTooltipPill}>
                <View style={s.osdTooltipDot} />
                <Text style={s.osdTooltipText}>{focusedAction}</Text>
              </View>
            </View>

            {/* Dock de Control Compacto, Centrado y de Alta Fidelidad */}
            <View style={s.osdDock}>
              {/* 1. Canal Anterior */}
              <OSDActionButton
                icon={SkipBack}
                trapFocusLeft
                trapFocusUp={!isError}
                onPress={prevChannel}
                onFocus={() => {
                  triggerOSD();
                  updateDockIdx(0);
                  setFocusedAction('Canal Anterior');
                }}
              />

              {/* 2. Pausar / Reanudar (Botón Central Hero) */}
              <OSDActionButton
                hasPreferredFocus={osdFocusReady && !isError}
                isHero
                trapFocusUp={!isError}
                icon={isPaused ? Play : Pause}
                onPress={togglePlayPause}
                onFocus={() => {
                  triggerOSD();
                  updateDockIdx(1);
                  setFocusedAction(isPaused ? 'Reanudar Transmisión' : 'Pausar Transmisión');
                }}
                active={isPaused}
                accentColor="#f59e0b"
              />

              {/* 3. Canal Siguiente */}
              <OSDActionButton
                icon={SkipForward}
                trapFocusUp={!isError}
                onPress={nextChannel}
                onFocus={() => {
                  triggerOSD();
                  updateDockIdx(2);
                  setFocusedAction('Siguiente Canal');
                }}
              />

              {/* Separador sutil */}
              <View style={s.osdDockDivider} />

              {/* 4. Sincronizar Vivo */}
              <OSDActionButton
                icon={RotateCcw}
                trapFocusUp={!isError}
                onPress={syncLive}
                onFocus={() => {
                  triggerOSD();
                  updateDockIdx(3);
                  setFocusedAction('Sincronizar en Vivo');
                }}
              />

              {/* 5. Guía de Canales (Abre las dos ventanas unidas) */}
              <OSDActionButton
                icon={List}
                trapFocusUp={!isError}
                onPress={openGuide}
                onFocus={() => {
                  triggerOSD();
                  updateDockIdx(4);
                  setFocusedAction('Guía de Canales');
                }}
                accentColor={C.accent}
              />

              {/* 6. Silenciar / Reactivar Audio */}
              <OSDActionButton
                icon={isMuted ? VolumeX : Volume2}
                trapFocusUp={!isError}
                onPress={toggleMute}
                onFocus={() => {
                  triggerOSD();
                  updateDockIdx(5);
                  setFocusedAction(isMuted ? 'Reactivar Sonido' : 'Silenciar Audio');
                }}
                active={isMuted}
                accentColor="#ef4444"
              />

              {/* 7. Favorito */}
              <OSDActionButton
                icon={Heart}
                trapFocusUp={!isError}
                onPress={handleToggleFav}
                onFocus={() => {
                  triggerOSD();
                  updateDockIdx(6);
                  setFocusedAction(isCurrentFav ? 'Quitar de Favoritos' : 'Guardar en Favoritos');
                }}
                active={isCurrentFav}
                accentColor="#ff0055"
              />

              {/* 8. Ajuste de Pantalla */}
              <OSDActionButton
                icon={Maximize2}
                trapFocusUp={!isError}
                onPress={toggleResizeMode}
                onFocus={() => {
                  triggerOSD();
                  updateDockIdx(7);
                  setFocusedAction(resizeMode === 'cover' ? 'Ajuste: Llenar Pantalla' : 'Ajuste: Proporción Original');
                }}
              />

              {/* 9. Salir a la lista de canales */}
              <OSDActionButton
                icon={ArrowLeft}
                trapFocusRight
                trapFocusUp={!isError}
                onPress={() => router.back()}
                onFocus={() => {
                  triggerOSD();
                  updateDockIdx(8);
                  setFocusedAction('Salir del Reproductor');
                }}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Estilos Cinematográficos y Optimizados para TV ────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    ...(Platform.OS === 'web'
      ? ({ width: '100vw' as any, height: '100vh' as any, position: 'fixed' as any, top: 0, left: 0 } as any)
      : {}),
  },
  videoAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  center: {
    flex: 1,
    backgroundColor: '#07070a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(14),
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: scale(14),
    fontWeight: '600',
  },

  // ── Overlays de Carga y Error ──
  bufferOverlay: {
    position: 'absolute',
    top: scale(40),
    right: scale(40),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: 'rgba(6, 6, 10, 0.82)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(999),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bufferText: {
    color: '#ffffff',
    fontSize: scale(12.5),
    fontWeight: '700',
  },
  errorOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  errorCard: {
    width: scale(480),
    backgroundColor: '#12121a',
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: scale(28),
    alignItems: 'center',
    gap: scale(12),
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: scale(18),
    fontWeight: '800',
    textAlign: 'center',
  },
  errorSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: scale(13),
    textAlign: 'center',
    lineHeight: scale(18),
  },
  errorActions: {
    flexDirection: 'row',
    gap: scale(12),
    marginTop: scale(8),
  },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: C.accent,
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    borderRadius: scale(10),
  },
  errorBtnFocused: {
    backgroundColor: '#ffffff',
  },
  errorBtnTxt: {
    color: '#000000',
    fontSize: scale(13),
    fontWeight: '800',
  },
  errorBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    borderRadius: scale(10),
  },
  errorBtnSecondaryFocused: {
    backgroundColor: C.accent,
  },
  errorBtnSecondaryTxt: {
    color: '#ffffff',
    fontSize: scale(13),
    fontWeight: '700',
  },

  // ── HUD Toast Flotante ──
  hudToast: {
    position: 'absolute',
    top: scale(36),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: 'rgba(9, 9, 14, 0.94)',
    paddingHorizontal: scale(22),
    paddingVertical: scale(11),
    borderRadius: scale(999),
    borderWidth: 1.5,
    borderColor: 'rgba(255, 183, 3, 0.45)',
    zIndex: 90,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
  },
  hudToastText: {
    color: '#ffffff',
    fontSize: scale(14),
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ── GUÍA DUAL: DOS VENTANAS UNIDAS SEMI-TRANSPARENTES ──
  guideBackdrop: {
    ...(StyleSheet.absoluteFill as any),
    zIndex: 70,
  },
  guideBackdropGrad: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '75%',
  },
  dualContainer: {
    flexDirection: 'row',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: scale(650),
    backgroundColor: 'transparent',
  },

  // ── Ventana 1: Categorías ──
  windowCategories: {
    width: scale(250),
    height: '100%',
    backgroundColor: 'rgba(7, 7, 11, 0.88)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    paddingTop: scale(24),
  },
  guideHead: {
    paddingHorizontal: scale(20),
    paddingBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  guideHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  guideHeadTitle: {
    color: '#ffffff',
    fontSize: scale(15),
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  guideHeadSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: scale(11),
    fontWeight: '600',
    marginTop: scale(2),
  },
  catScroll: {
    flex: 1,
  },
  catScrollContent: {
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    gap: scale(6),
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    borderRadius: scale(11),
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  catPillActive: {
    backgroundColor: 'rgba(255, 183, 3, 0.12)',
    borderColor: 'rgba(255, 183, 3, 0.28)',
  },
  catPillFocused: {
    backgroundColor: C.accent,
    borderColor: '#ffffff',
  },
  catIconWrap: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.82)',
    fontSize: scale(13),
    fontWeight: '700',
  },
  catLabelActive: {
    color: C.accentLight,
    fontWeight: '900',
  },
  catLabelFocused: {
    color: '#000000',
    fontWeight: '900',
  },
  catCountBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  catCountBadgeActive: {
    backgroundColor: 'rgba(255, 183, 3, 0.25)',
  },
  catCountBadgeFocused: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  catCountTxt: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: scale(10.5),
    fontWeight: '800',
  },
  catCountTxtActive: {
    color: C.accent,
  },
  catCountTxtFocused: {
    color: '#000000',
  },

  // ── Ventana 2: Canales en Vivo ──
  windowChannels: {
    width: scale(400),
    height: '100%',
    backgroundColor: 'rgba(12, 12, 18, 0.92)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    paddingTop: scale(24),
  },
  chHeader: {
    paddingHorizontal: scale(20),
    paddingBottom: scale(14),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: scale(10),
  },
  chHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    flex: 1,
  },
  chHeaderTitle: {
    color: '#ffffff',
    fontSize: scale(15),
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  chHeaderCount: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: scale(11.5),
    fontWeight: '700',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: scale(12),
    height: scale(36),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: scale(12.5),
    fontWeight: '600',
    paddingVertical: 0,
  },
  searchClear: {
    padding: scale(4),
  },
  chList: {
    flex: 1,
  },
  chListContent: {
    paddingVertical: scale(12),
    paddingHorizontal: scale(14),
    gap: PLAYER_CH_ITEM_GAP,
  },
  chItem: {
    height: PLAYER_CH_ITEM_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingHorizontal: scale(10),
    borderRadius: scale(12),
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chItemCurrent: {
    backgroundColor: 'rgba(255, 183, 3, 0.1)',
    borderColor: 'rgba(255, 183, 3, 0.3)',
  },
  chItemFocused: {
    backgroundColor: C.accent,
    borderColor: '#ffffff',
  },
  chLogoBox: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(10),
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chLogoBoxFocused: {
    backgroundColor: '#ffffff',
  },
  chLogoImg: {
    width: '80%',
    height: '80%',
  },
  chInfoBox: {
    flex: 1,
  },
  chName: {
    color: '#ffffff',
    fontSize: scale(14),
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chNameCurrent: {
    color: C.accentLight,
  },
  chNameFocused: {
    color: '#000000',
  },
  chMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(2),
  },
  chMetaTxt: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: scale(11),
    fontWeight: '600',
  },
  chMetaTxtFocused: {
    color: 'rgba(0,0,0,0.7)',
  },
  chBadgesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  badgeLiveOn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: 'rgba(255, 0, 85, 0.2)',
    paddingHorizontal: scale(7),
    paddingVertical: scale(3),
    borderRadius: scale(6),
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 85, 0.45)',
  },
  badgeLiveOnFocused: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderColor: '#000000',
  },
  liveOnDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#ff0055',
  },
  liveOnTxt: {
    color: '#ff80a6',
    fontSize: scale(9.5),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  liveOnTxtFocused: {
    color: '#000000',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(40),
    paddingHorizontal: scale(20),
    gap: scale(8),
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: scale(14),
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: scale(11.5),
    textAlign: 'center',
  },

  // ── OSD PROFESIONAL (CONTROLES Y CABECERA) ──
  osdRoot: {
    ...(StyleSheet.absoluteFill as any),
    justifyContent: 'space-between',
    zIndex: 50,
  },
  osdTopGrad: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: scale(180),
  },
  osdBottomGrad: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(260),
  },

  // ── Cabecera Superior del OSD ──
  osdTopBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: scale(36),
    paddingHorizontal: scale(48),
  },
  osdChannelLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
  },
  osdLogoBox: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(14),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  osdLogoImg: {
    width: '85%',
    height: '85%',
  },
  osdChannelDetails: {
    gap: scale(4),
  },
  osdBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: '#ff0055',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(4),
  },
  badgeLiveDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#ffffff',
  },
  badgeLiveText: {
    color: '#ffffff',
    fontSize: scale(10.5),
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  osdTagBadge: {
    backgroundColor: 'rgba(255, 183, 3, 0.18)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(4),
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 3, 0.4)',
  },
  osdTagBadgeTxt: {
    color: C.accent,
    fontSize: scale(10.5),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  osdCountryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(4),
  },
  osdCountryBadgeTxt: {
    color: '#ffffff',
    fontSize: scale(10.5),
    fontWeight: '700',
  },
  badgeResolution: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: scale(7),
    paddingVertical: scale(3),
    borderRadius: scale(4),
  },
  badgeResolutionTxt: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: scale(10),
    fontWeight: '800',
  },
  osdChannelName: {
    color: '#ffffff',
    fontSize: scale(28),
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  osdTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
  },
  volumeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(255, 183, 3, 0.12)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 3, 0.3)',
  },
  volumeBadgeTxt: {
    color: C.accent,
    fontSize: scale(12),
    fontWeight: '800',
  },
  mutedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  mutedBadgeTxt: {
    color: '#f87171',
    fontSize: scale(12),
    fontWeight: '800',
  },
  clockWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: scale(14),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  clockTxt: {
    color: '#ffffff',
    fontSize: scale(13),
    fontWeight: '800',
  },

  // ── Barra de Botones Inferior del OSD Profesional ──
  osdBottomBar: {
    paddingBottom: scale(28),
    paddingHorizontal: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  osdTooltipWrap: {
    alignItems: 'center',
    marginBottom: scale(10),
  },
  osdTooltipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(12, 12, 18, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: scale(14),
    paddingVertical: scale(5),
    borderRadius: scale(999),
  },
  osdTooltipDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: C.accent,
  },
  osdTooltipText: {
    color: '#ffffff',
    fontSize: scale(12),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  osdDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: 'rgba(12, 12, 18, 0.85)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(999),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: scale(12),
    elevation: 10,
  },
  osdDockDivider: {
    width: 1,
    height: scale(24),
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginHorizontal: scale(4),
  },
  osdActionBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  osdActionBtnHero: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: 'rgba(255, 183, 3, 0.18)',
    borderColor: 'rgba(255, 183, 3, 0.45)',
  },
  osdActionBtnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.08 }],
    shadowColor: '#ffffff',
    shadowOpacity: 0.4,
    shadowRadius: scale(8),
    elevation: 8,
  },
  osdActionBtnHeroFocused: {
    backgroundColor: C.accent,
    borderColor: '#ffffff',
    transform: [{ scale: 1.1 }],
    shadowColor: C.accent,
    shadowOpacity: 0.65,
    shadowRadius: scale(12),
    elevation: 12,
  },
});
