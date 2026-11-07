import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import {
  Compass,
  Film,
  Globe,
  Heart,
  List,
  Maximize2,
  Music,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Smile,
  Sparkles,
  Trophy,
  Tv,
  Tv2,
  X,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Video from "react-native-video";
import Focusable from "../../components/tv/Focusable";
import RemoteImage from "../../components/tv/RemoteImage";
import { Channel, useGlobal } from "../../contexts/GlobalContext";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  AppSettings,
  contentIsRestricted,
  loadAppSettings,
} from "../../utils/appSettings";

const { height: SH, width: SW } = Dimensions.get("window");

// ── Altura fija para cada fila de canal (Garantiza scroll 100% fluido en TV) ──
const ITEM_HEIGHT = scale(62);

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  Entertainment: "Entretenimiento",
  News: "Noticias",
  Sports: "Deportes",
  Kids: "Infantil",
  Family: "Familiar",
  Culture: "Cultura",
  Education: "Educación",
  Series: "Series",
  Comedy: "Comedia",
  Movies: "Películas",
  Music: "Música",
  Lifestyle: "Estilo de Vida",
  Documentary: "Documentales",
  Undefined: "General",
  General: "General",
  "News;Public": "Noticias",
  "Kids;Family": "Infantil",
  Anime: "Anime",
};

const catOf = (c: Channel) => {
  const raw = c.category?.name || c.groupTitle || "General";
  return CATEGORY_TRANSLATIONS[raw] || raw;
};

const getCategoryIcon = (id: string, label: string) => {
  if (id === "favorites") return Heart;
  if (id === "all") return List;
  switch (label) {
    case "Deportes":
      return Trophy;
    case "Noticias":
      return Globe;
    case "Películas":
      return Film;
    case "Series":
      return Tv;
    case "Entretenimiento":
    case "Comedia":
      return Sparkles;
    case "Infantil":
    case "Familiar":
      return Smile;
    case "Música":
      return Music;
    case "Documentales":
    case "Cultura":
    case "Educación":
      return Compass;
    default:
      return Tv2;
  }
};

type ChannelSettings = Pick<AppSettings, "parentalLock" | "hideRestricted">;

// ── Píldora de Categoría Horizontal ──────────────────────────────────────────
const CategoryPill = memo(function CategoryPill({
  id,
  label,
  count,
  isActive,
  icon: Icon,
  onSelect,
}: {
  id: string;
  label: string;
  count?: number;
  isActive: boolean;
  icon: any;
  onSelect: (id: string) => void;
}) {
  return (
    <Focusable
      onPress={() => onSelect(id)}
      style={[s.catPill, isActive && s.catPillActive]}
      focusedStyle={s.catPillFocused}
      scaleFocused={1.05}
    >
      <Icon
        size={scale(13)}
        color={isActive ? "#000000" : "rgba(255,255,255,0.75)"}
      />
      <Text style={[s.catPillTxt, isActive && s.catPillTxtActive]} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined && count > 0 ? (
        <View style={[s.catCountBadge, isActive && s.catCountBadgeActive]}>
          <Text style={[s.catCountTxt, isActive && s.catCountTxtActive]}>
            {count}
          </Text>
        </View>
      ) : null}
    </Focusable>
  );
});

// ── Fila de Canal en la Guía (Sin Focusable anidado = Cero bugs de control) ───
const ChannelRow = memo(function ChannelRow({
  item,
  index,
  isActive,
  isFav,
  onSelect,
  onOpenFullscreen,
  nextFocusLeft,
  preferFocus,
}: {
  item: Channel;
  index: number;
  isActive: boolean;
  isFav: boolean;
  onSelect: (ch: Channel) => void;
  onOpenFullscreen: (ch: Channel) => void;
  nextFocusLeft?: number;
  preferFocus?: boolean;
}) {
  const numStr = index + 1 < 10 ? `0${index + 1}` : `${index + 1}`;

  return (
    <Focusable
      hasTVPreferredFocus={preferFocus}
      nextFocusLeft={nextFocusLeft}
      onPress={() => {
        if (isActive) {
          onOpenFullscreen(item);
        } else {
          onSelect(item);
        }
      }}
      style={[s.chRow, isActive && s.chRowActive]}
      focusedStyle={s.chRowFocused}
      scaleFocused={1.02}
    >
      {/* Número de Canal */}
      <Text style={[s.chNum, isActive && s.chNumActive]}>{numStr}</Text>

      {/* Logo del Canal en Cápsula Curvada */}
      <View style={[s.chLogoWrap, isActive && s.chLogoWrapActive]}>
        {item.logo ? (
          <RemoteImage
            uri={item.logo}
            style={s.chLogo as any}
            contentFit="contain"
            transition={100}
          />
        ) : (
          <Tv2
            size={scale(18)}
            color={isActive ? C.accent : "rgba(255,255,255,0.4)"}
          />
        )}
      </View>

      {/* Nombre y Metadatos */}
      <View style={s.chInfo}>
        <Text style={[s.chName, isActive && s.chNameActive]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={s.chMeta} numberOfLines={1}>
          {catOf(item)}
          {item.country ? ` • ${item.country}` : ""}
        </Text>
      </View>

      {/* Badge EN VIVO si es el canal activo */}
      {isActive && (
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveTxt}>EN VIVO</Text>
        </View>
      )}

      {/* Indicador de Favorito (Puro Icono Visual, Sin interferir en el foco) */}
      {isFav && (
        <View style={s.favIndicator}>
          <Heart size={scale(13)} color="#ff4d80" fill="#ff4d80" />
        </View>
      )}
    </Focusable>
  );
});

export default function ChannelsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const sidebarHandle = useSidebarHandle();

  const {
    channels,
    activeChannel,
    setActiveChannel,
    favorites,
    toggleFavorite,
  } = useGlobal();

  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeCatId, setActiveCatId] = useState("all");
  const [videoError, setVideoError] = useState(false);
  const [settings, setSettings] = useState<ChannelSettings>({
    parentalLock: false,
    hideRestricted: true,
  });

  const searchInputRef = useRef<TextInput>(null);
  const channelFocusTimer = useRef<any>(null);

  // Cargar ajustes parentales
  useEffect(() => {
    loadAppSettings().then((saved) =>
      setSettings({
        parentalLock: saved.parentalLock,
        hideRestricted: saved.hideRestricted,
      }),
    );
  }, []);

  // Seleccionar primer canal si no hay activo
  useEffect(() => {
    if (!activeChannel && channels.length > 0) {
      setActiveChannel(channels[0]);
    }
  }, [activeChannel, channels, setActiveChannel]);

  // Limpiar timer de debounce al desmontar
  useEffect(() => {
    return () => {
      if (channelFocusTimer.current) {
        clearTimeout(channelFocusTimer.current);
      }
    };
  }, []);

  // Reset video error on channel change
  useEffect(() => {
    setVideoError(false);
  }, [activeChannel?.url]);

  // Lista de categorías traducidas y únicas
  const categoriesList = useMemo(() => {
    const catsSet = new Set<string>();
    channels.forEach((c) => {
      catsSet.add(catOf(c));
    });
    const sorted = Array.from(catsSet).sort();
    return [
      { id: "all", label: "Todos", icon: List },
      { id: "favorites", label: "Favoritos", icon: Heart },
      ...sorted.map((cat) => ({
        id: `cat:${cat}`,
        label: cat,
        icon: getCategoryIcon(`cat:${cat}`, cat),
      })),
    ];
  }, [channels]);

  // Canales filtrados por categoría, búsqueda y control parental
  const filteredChannels = useMemo(() => {
    let list = channels;
    if (activeCatId === "favorites") {
      const favSet = new Set(favorites);
      list = list.filter((c) => favSet.has(c.id));
    } else if (activeCatId.startsWith("cat:")) {
      const targetCat = activeCatId.slice(4);
      list = list.filter((c) => catOf(c) === targetCat);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          catOf(c).toLowerCase().includes(q),
      );
    }
    if (settings.parentalLock || settings.hideRestricted) {
      list = list.filter(
        (c) => !contentIsRestricted((c as any).contentRating),
      );
    }
    return list;
  }, [channels, activeCatId, favorites, search, settings]);

  const currentIndex = useMemo(
    () => filteredChannels.findIndex((c) => c.id === activeChannel?.id),
    [filteredChannels, activeChannel],
  );

  // Navegación rápida entre canales (Zapping en directo)
  const handlePrevChannel = useCallback(() => {
    if (filteredChannels.length === 0) return;
    const prevIdx =
      (currentIndex - 1 + filteredChannels.length) % filteredChannels.length;
    setActiveChannel(filteredChannels[prevIdx]);
  }, [currentIndex, filteredChannels, setActiveChannel]);

  const handleNextChannel = useCallback(() => {
    if (filteredChannels.length === 0) return;
    const nextIdx = (currentIndex + 1) % filteredChannels.length;
    setActiveChannel(filteredChannels[nextIdx]);
  }, [currentIndex, filteredChannels, setActiveChannel]);

  // Abrir reproductor en pantalla completa
  const openFullscreen = useCallback(
    (ch?: Channel) => {
      const target = ch || activeChannel;
      if (!target) return;
      if (channelFocusTimer.current) clearTimeout(channelFocusTimer.current);
      setActiveChannel(target);
      router.push({
        pathname: "/player",
        params: { channelId: target.id, channelUrl: target.url },
      } as any);
    },
    [router, activeChannel, setActiveChannel],
  );

  // Debounce suave al navegar: la card se enfoca al instante, pero el video
  // del reproductor arranca si el usuario se detiene 220ms
  const handleSelectChannel = useCallback(
    (ch: Channel) => {
      if (channelFocusTimer.current) clearTimeout(channelFocusTimer.current);
      channelFocusTimer.current = setTimeout(() => {
        setActiveChannel(ch);
      }, 150);
    },
    [setActiveChannel],
  );

  const toggleSearch = useCallback(() => {
    const next = !showSearch;
    setShowSearch(next);
    if (next) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    } else {
      setSearch("");
    }
  }, [showSearch]);

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const isCurrentFav = activeChannel ? favSet.has(activeChannel.id) : false;
  const isPageActive = pathname.includes("channels");

  // FlatList getItemLayout para scroll matemático exacto y sin saltos
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <View style={s.root}>
      {/* ── COLUMNA IZQUIERDA: EL GRAN ESCENARIO EN VIVO (LIVE CINEMA STAGE) ── */}
      <View style={s.leftCol}>
        {/* Gran Reproductor 16:9 con Halo y Bordes Curvados */}
        <Focusable
          onPress={() => activeChannel && openFullscreen(activeChannel)}
          style={s.stagePlayerWrap}
          focusedStyle={s.stagePlayerWrapFocused}
          scaleFocused={1.02}
          nextFocusLeft={sidebarHandle ?? undefined}
        >
          {/* Halo de luz ambiental */}
          <View style={s.playerGlowAura} pointerEvents="none" />

          <View style={s.playerFrame}>
            {/* Video en tiempo real */}
            {activeChannel && !videoError && isPageActive ? (
              <Video
                source={{ uri: activeChannel.url }}
                style={StyleSheet.absoluteFill as any}
                resizeMode="cover"
                paused={!isPageActive}
                muted
                repeat
                onError={() => setVideoError(true)}
              />
            ) : (
              <LinearGradient
                colors={["#1c172e", "#0a0814"]}
                style={StyleSheet.absoluteFill}
              />
            )}

            {/* Degradado y Viñeta Cinematográfica */}
            <LinearGradient
              colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.85)"]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Barra Superior del Video: EN VIVO + Categoría */}
            <View style={s.playerTopBar}>
              <View style={s.liveChip}>
                <View style={s.liveDot} />
                <Text style={s.liveChipTxt}>EN VIVO</Text>
              </View>
              {activeChannel && (
                <View style={s.catBadge}>
                  <Text style={s.catBadgeTxt}>{catOf(activeChannel)}</Text>
                </View>
              )}
            </View>

            {/* Aviso de Pantalla Completa al enfocar */}
            <View style={s.playerHint}>
              <Maximize2 size={scale(14)} color="#ffffff" />
              <Text style={s.playerHintTxt}>PANTALLA COMPLETA [ OK ]</Text>
            </View>
          </View>
        </Focusable>

        {/* ── CONSOLA DE IDENTIDAD Y CONTROLES DEL CANAL EN VIVO ── */}
        <View style={s.liveDeck}>
          {/* Identidad del canal */}
          <View style={s.deckIdentity}>
            <View style={s.deckLogoWrap}>
              {activeChannel?.logo ? (
                <RemoteImage
                  uri={activeChannel.logo}
                  style={s.deckLogo as any}
                  contentFit="contain"
                  transition={120}
                />
              ) : (
                <Tv2 size={scale(24)} color={C.accent} />
              )}
            </View>
            <View style={s.deckInfo}>
              <Text style={s.deckTitle} numberOfLines={1}>
                {activeChannel?.name || "Selecciona un canal"}
              </Text>
              <Text style={s.deckMeta} numberOfLines={1}>
                {activeChannel
                  ? [
                      catOf(activeChannel),
                      activeChannel.country || "Internacional",
                      activeChannel.language || "Español",
                      "1080p Full HD",
                    ]
                      .filter(Boolean)
                      .join(" • ")
                  : "Explora la grilla de canales en vivo"}
              </Text>
            </View>
          </View>

          {/* Botones de Control del Reproductor */}
          <View style={s.deckButtons}>
            {/* Botón Principal Pantalla Completa */}
            <Focusable
              onPress={() => activeChannel && openFullscreen(activeChannel)}
              style={s.btnPrimaryFullscreen}
              focusedStyle={s.btnPrimaryFullscreenFocused}
              scaleFocused={1.05}
              nextFocusLeft={sidebarHandle ?? undefined}
            >
              <Maximize2 size={scale(15)} color="#000000" />
              <Text style={s.btnPrimaryFullscreenTxt}>Pantalla Completa</Text>
            </Focusable>

            {/* Canal Anterior */}
            <Focusable
              onPress={handlePrevChannel}
              style={s.btnControl}
              focusedStyle={s.btnControlFocused}
              scaleFocused={1.06}
            >
              <SkipBack size={scale(16)} color="#ffffff" />
            </Focusable>

            {/* Canal Siguiente */}
            <Focusable
              onPress={handleNextChannel}
              style={s.btnControl}
              focusedStyle={s.btnControlFocused}
              scaleFocused={1.06}
            >
              <SkipForward size={scale(16)} color="#ffffff" />
            </Focusable>

            {/* Favorito */}
            <Focusable
              onPress={() => activeChannel && toggleFavorite(activeChannel.id)}
              style={[s.btnControl, isCurrentFav && s.btnControlFavActive]}
              focusedStyle={s.btnControlFocused}
              scaleFocused={1.06}
            >
              <Heart
                size={scale(16)}
                color={isCurrentFav ? "#ff4d80" : "#ffffff"}
                fill={isCurrentFav ? "#ff4d80" : "none"}
              />
            </Focusable>
          </View>

          {/* Atajos de Control Remoto de TV */}
          <View style={s.consoleHints}>
            <Text style={s.consoleHintItem}>
              <Text style={s.consoleHintKey}>[ OK ]</Text> Ver canal
            </Text>
            <Text style={s.consoleHintSep}>•</Text>
            <Text style={s.consoleHintItem}>
              <Text style={s.consoleHintKey}>[ ◄ ► ]</Text> Cambiar de panel
            </Text>
            <Text style={s.consoleHintSep}>•</Text>
            <Text style={s.consoleHintItem}>
              <Text style={s.consoleHintKey}>[ ▲ ▼ ]</Text> Navegar
            </Text>
          </View>
        </View>
      </View>

      {/* ── COLUMNA DERECHA: LA GUÍA INTERACTIVA DE CANALES (CHANNEL GUIDE) ── */}
      <View style={s.rightCol}>
        {/* Cabecera de la Guía */}
        <View style={s.guideHeader}>
          <View style={s.guideTitleGroup}>
            <Text style={s.guideTitle}>Guía de Canales</Text>
            <View style={s.guideCountBadge}>
              <Text style={s.guideCountTxt}>{filteredChannels.length}</Text>
            </View>
          </View>

          {/* Buscador Integrado */}
          <View style={s.searchBarContainer}>
            {showSearch ? (
              <View style={s.searchInputWrap}>
                <Search size={scale(13)} color="rgba(255,255,255,0.5)" />
                <TextInput
                  ref={searchInputRef}
                  style={s.searchInput}
                  placeholder="Buscar canal..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <Focusable onPress={() => setSearch("")} style={s.searchClear}>
                    <X size={scale(12)} color="rgba(255,255,255,0.7)" />
                  </Focusable>
                )}
              </View>
            ) : null}

            <Focusable
              onPress={toggleSearch}
              style={s.btnSearchToggle}
              focusedStyle={s.btnSearchToggleFocused}
              scaleFocused={1.06}
            >
              {showSearch ? (
                <X size={scale(15)} color="#ffffff" />
              ) : (
                <Search size={scale(15)} color="#ffffff" />
              )}
            </Focusable>
          </View>
        </View>

        {/* Cinta Horizontal de Categorías con Iconos */}
        <View style={s.categoriesBar}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categoriesList}
            keyExtractor={(c) => c.id}
            contentContainerStyle={s.categoriesTrack}
            renderItem={({ item }) => (
              <CategoryPill
                id={item.id}
                label={item.label}
                count={
                  item.id === "all"
                    ? channels.length
                    : item.id === "favorites"
                    ? favorites.length
                    : undefined
                }
                isActive={activeCatId === item.id}
                icon={item.icon}
                onSelect={setActiveCatId}
              />
            )}
          />
        </View>

        {/* Lista de Canales (Scroll Optimizado con Altura Fija) */}
        <FlatList
          data={filteredChannels}
          keyExtractor={(c) => c.id}
          style={s.channelList}
          contentContainerStyle={s.channelListContent}
          showsVerticalScrollIndicator={false}
          getItemLayout={getItemLayout}
          initialNumToRender={14}
          maxToRenderPerBatch={10}
          windowSize={7}
          renderItem={({ item, index }) => (
            <ChannelRow
              item={item}
              index={index}
              isActive={activeChannel?.id === item.id}
              isFav={favSet.has(item.id)}
              onSelect={handleSelectChannel}
              onOpenFullscreen={openFullscreen}
              nextFocusLeft={sidebarHandle ?? undefined}
              preferFocus={index === 0}
            />
          )}
          ListEmptyComponent={
            <View style={s.emptyGuide}>
              <Tv2 size={scale(36)} color="rgba(255,255,255,0.2)" />
              <Text style={s.emptyGuideTxt}>
                {activeCatId === "favorites"
                  ? "No tienes canales en favoritos"
                  : "No se encontraron canales"}
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07070a",
    flexDirection: "row",
    paddingLeft: scale(68),
    paddingRight: scale(36),
    paddingTop: scale(24),
    paddingBottom: scale(20),
    gap: scale(32),
  },

  // ── COLUMNA IZQUIERDA: EL GRAN ESCENARIO EN VIVO ───────────────────────────
  leftCol: {
    flex: 1.15,
    justifyContent: "space-between",
  },
  stagePlayerWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: scale(22),
  },
  stagePlayerWrapFocused: {
    transform: [{ scale: 1.02 }],
  },
  playerGlowAura: {
    position: "absolute",
    top: scale(-8),
    left: scale(-8),
    right: scale(-8),
    bottom: scale(-8),
    borderRadius: scale(28),
    backgroundColor: C.accent,
    opacity: 0.22,
    shadowColor: C.accent,
    shadowRadius: scale(32),
    shadowOpacity: 0.85,
  },
  playerFrame: {
    width: "100%",
    height: "100%",
    borderRadius: scale(22),
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "#0b0914",
    elevation: 14,
  },
  playerTopBar: {
    position: "absolute",
    top: scale(14),
    left: scale(14),
    right: scale(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 128, 0.4)",
    paddingHorizontal: scale(9),
    paddingVertical: scale(4),
    borderRadius: scale(20),
  },
  liveDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: "#ff4d80",
  },
  liveChipTxt: {
    color: "#ff4d80",
    fontSize: scale(10),
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  catBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.4)",
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(20),
  },
  catBadgeTxt: {
    color: C.accent,
    fontSize: scale(10.5),
    fontWeight: "800",
  },
  playerHint: {
    position: "absolute",
    bottom: scale(14),
    right: scale(14),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: scale(10),
    paddingVertical: scale(5),
    borderRadius: scale(8),
  },
  playerHintTxt: {
    color: "#ffffff",
    fontSize: scale(10),
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // ── LIVE DECK: CONSOLA DE IDENTIDAD Y CONTROLES ───────────────────────────
  liveDeck: {
    marginTop: scale(16),
    backgroundColor: "rgba(14, 12, 22, 0.65)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: scale(22),
    padding: scale(18),
  },
  deckIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(14),
    marginBottom: scale(16),
  },
  deckLogoWrap: {
    width: scale(58),
    height: scale(58),
    borderRadius: scale(16),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.14)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  deckLogo: {
    width: "80%",
    height: "80%",
  },
  deckInfo: {
    flex: 1,
  },
  deckTitle: {
    color: "#ffffff",
    fontSize: scale(21),
    fontWeight: "900",
    letterSpacing: -0.3,
    marginBottom: scale(2),
  },
  deckMeta: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: scale(12),
    fontWeight: "600",
  },
  deckButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    marginBottom: scale(14),
  },
  btnPrimaryFullscreen: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    backgroundColor: C.accent,
    height: scale(44),
    borderRadius: scale(22),
  },
  btnPrimaryFullscreenFocused: {
    backgroundColor: "#ffffff",
    transform: [{ scale: 1.04 }],
    shadowColor: "#ffffff",
    shadowRadius: scale(12),
    shadowOpacity: 0.6,
  },
  btnPrimaryFullscreenTxt: {
    color: "#000000",
    fontSize: scale(13.5),
    fontWeight: "900",
  },
  btnControl: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.16)",
    justifyContent: "center",
    alignItems: "center",
  },
  btnControlFavActive: {
    backgroundColor: "rgba(255, 77, 128, 0.15)",
    borderColor: "#ff4d80",
  },
  btnControlFocused: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderColor: "#ffffff",
  },
  consoleHints: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    paddingTop: scale(10),
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  consoleHintItem: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: scale(10.5),
    fontWeight: "600",
  },
  consoleHintKey: {
    color: C.accent,
    fontWeight: "800",
  },
  consoleHintSep: {
    color: "rgba(255, 255, 255, 0.2)",
    fontSize: scale(10),
  },

  // ── COLUMNA DERECHA: LA GUÍA INTERACTIVA DE CANALES ────────────────────────
  rightCol: {
    flex: 1,
  },
  guideHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(12),
  },
  guideTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  guideTitle: {
    color: "#ffffff",
    fontSize: scale(20),
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  guideCountBadge: {
    backgroundColor: "rgba(255, 183, 3, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.35)",
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(10),
  },
  guideCountTxt: {
    color: C.accent,
    fontSize: scale(11),
    fontWeight: "900",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    width: scale(190),
    height: scale(36),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: scale(18),
    paddingHorizontal: scale(10),
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: scale(12),
    paddingVertical: 0,
  },
  searchClear: {
    padding: scale(4),
  },
  btnSearchToggle: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  btnSearchToggleFocused: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },

  // ── BARRA HORIZONTAL DE CATEGORÍAS ─────────────────────────────────────────
  categoriesBar: {
    marginBottom: scale(12),
  },
  categoriesTrack: {
    gap: scale(8),
    paddingRight: scale(20),
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(18),
  },
  catPillActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  catPillFocused: {
    borderColor: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  catPillTxt: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: scale(11.5),
    fontWeight: "700",
  },
  catPillTxtActive: {
    color: "#000000",
    fontWeight: "900",
  },
  catCountBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: scale(6),
    paddingVertical: scale(1.5),
    borderRadius: scale(8),
  },
  catCountBadgeActive: {
    backgroundColor: "#000000",
  },
  catCountTxt: {
    color: "#ffffff",
    fontSize: scale(9.5),
    fontWeight: "800",
  },
  catCountTxtActive: {
    color: C.accent,
    fontWeight: "900",
  },

  // ── LISTA DE CANALES CON ALTURA FIJA ────────────────────────────────────────
  channelList: {
    flex: 1,
  },
  channelListContent: {
    paddingBottom: scale(24),
    gap: scale(6),
  },
  chRow: {
    height: ITEM_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(12),
    gap: scale(10),
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: scale(14),
  },
  chRowActive: {
    backgroundColor: "rgba(255, 183, 3, 0.1)",
    borderColor: "rgba(255, 183, 3, 0.4)",
  },
  chRowFocused: {
    borderColor: C.accent,
    backgroundColor: "rgba(255, 183, 3, 0.22)",
    shadowColor: C.accent,
    shadowRadius: scale(10),
    shadowOpacity: 0.6,
  },
  chNum: {
    width: scale(26),
    textAlign: "center",
    fontSize: scale(12),
    fontWeight: "800",
    color: "rgba(255, 255, 255, 0.35)",
    fontVariant: ["tabular-nums"],
  },
  chNumActive: {
    color: C.accent,
    fontWeight: "900",
  },
  chLogoWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(10),
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  chLogoWrapActive: {
    backgroundColor: "rgba(255, 183, 3, 0.12)",
    borderColor: C.accent,
  },
  chLogo: {
    width: "85%",
    height: "85%",
  },
  chInfo: {
    flex: 1,
  },
  chName: {
    color: "#ffffff",
    fontSize: scale(13.5),
    fontWeight: "700",
    marginBottom: scale(2),
  },
  chNameActive: {
    color: C.accent,
    fontWeight: "900",
  },
  chMeta: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: scale(11),
    fontWeight: "500",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: "rgba(255, 77, 128, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 128, 0.35)",
    paddingHorizontal: scale(7),
    paddingVertical: scale(2.5),
    borderRadius: scale(12),
  },
  liveTxt: {
    color: "#ff4d80",
    fontSize: scale(9.5),
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  favIndicator: {
    paddingHorizontal: scale(4),
  },
  emptyGuide: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: scale(60),
    gap: scale(10),
  },
  emptyGuideTxt: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: scale(13.5),
    fontWeight: "600",
  },
});
