import Video from "react-native-video";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, usePathname } from "expo-router";
import { Heart, List, Maximize2, Search, Tv2, X } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
      FlatList, StyleSheet, Text, TextInput, View,
} from "react-native";
import Focusable from "../../components/tv/Focusable";
import RemoteImage from "../../components/tv/RemoteImage";
import { Channel, useGlobal } from "../../contexts/GlobalContext";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import { AppSettings, contentIsRestricted, loadAppSettings } from "../../utils/appSettings";

const MINI_W = scale(268);
const MINI_H = Math.round(MINI_W * 9 / 16);

type ChannelSettings = Pick<AppSettings, "parentalLock" | "hideRestricted">;
type SidebarItem = { id: string; label: string };

const PALETTE: [string, string][] = [
  ["#e11d63", "#8a1c5e"], ["#2fb344", "#c2410c"],
  ["#2563eb", "#ea7a12"], ["#0e9aa7", "#4338ca"], ["#d97706", "#9a1b1b"],
];
const colorsFor = (name?: string): [string, string] => {
  const h = (name || "General").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[h % PALETTE.length];
};
const keyById = (c: Channel) => c.id;

// ── Mini player ──────────────────────────────────────────────────────────────
const MiniPlayer = memo(function MiniPlayer({
  channel, onExpand, isActive = true,
}: { channel: Channel | null; onExpand: () => void; isActive?: boolean }) {
  const [a, b] = colorsFor(channel?.category?.name);
  const [error, setError] = useState(false);

  useEffect(() => { setError(false); }, [channel?.url]);

  return (
    <Focusable
      onPress={onExpand}
      style={s.mini}
      focusedStyle={s.miniFocused}
      borderRadius={scale(14)}
      scaleValue={1.03}
    >
      {/* Background gradient */}
      <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Video feed */}
      {channel && !error && isActive && (
        <Video
          source={{ uri: channel.url }}
          style={StyleSheet.absoluteFill as any}
          resizeMode="cover"
          paused={!isActive}
          muted
          repeat
          onError={() => setError(true)}
        />
      )}

      {/* Dark overlay + info bar */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.82)"]}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.miniBar}>
        {channel?.logo ? (
          <RemoteImage uri={channel.logo} style={s.miniLogo as any} contentFit="contain" />
        ) : (
          <Tv2 size={scale(18)} color="#fff" />
        )}
        <View style={s.miniText}>
          <Text style={s.miniName} numberOfLines={1}>{channel?.name ?? "Sin canal"}</Text>
          {channel && (
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>EN VIVO</Text>
            </View>
          )}
        </View>
        <Maximize2 size={scale(13)} color="rgba(255,255,255,0.65)" />
      </View>

      <View style={s.miniHintWrap}>
        <Text style={s.miniHintTxt}>Pantalla completa</Text>
      </View>
    </Focusable>
  );
});

// ── Fila de canal ────────────────────────────────────────────────────────────
const ChannelRow = memo(function ChannelRow({
  item, index, isActive, isFav, onOpen, onFocus, onToggleFav, nextFocusLeft, preferFocus,
}: {
  item: Channel; index: number; isActive: boolean; isFav: boolean;
  onOpen: (ch: Channel) => void; onFocus: (ch: Channel) => void;
  onToggleFav: (id: string) => void; nextFocusLeft?: number; preferFocus?: boolean;
}) {
  return (
    <Focusable
      hasTVPreferredFocus={preferFocus}
      nextFocusLeft={nextFocusLeft}
      onFocus={() => onFocus(item)}
      onPress={() => onOpen(item)}
      borderRadius={scale(8)}
      scaleValue={1.02}
      style={[s.chRow, isActive && s.chRowActive]}
      focusedStyle={s.chRowFocused}
    >
      <Text style={[s.chNum, isActive && { color: C.accent }]}>{index + 1}</Text>
      <View style={[s.chLogoWrap, isActive && s.chLogoWrapActive]}>
        {item.logo ? (
          <RemoteImage uri={item.logo} style={s.chLogo as any} contentFit="contain" transition={120} />
        ) : (
          <Tv2 size={scale(18)} color={isActive ? C.accent : "rgba(255,255,255,0.4)"} />
        )}
      </View>
      <View style={s.chInfo}>
        <Text style={[s.chName, isActive && { color: C.accent }]} numberOfLines={1}>{item.name}</Text>
        <Text style={s.chMeta} numberOfLines={1}>{item.category?.name ?? "Sin categoría"}</Text>
      </View>
      {isActive && (
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveTxt}>EN VIVO</Text>
        </View>
      )}
      <Focusable onPress={() => onToggleFav(item.id)} style={s.favBtn} focusedStyle={s.favBtnFocused} hitSlop={8} scaleValue={1.12}>
        <Heart size={scale(14)} color={isFav ? "#e879f9" : "rgba(255,255,255,0.28)"} fill={isFav ? "#e879f9" : "none"} />
      </Focusable>
    </Focusable>
  );
});

// ── Sidebar item ─────────────────────────────────────────────────────────────
const SideItem = memo(function SideItem({
  item, isActive, onSelect,
}: { item: SidebarItem; isActive: boolean; onSelect: (id: string) => void }) {
  return (
    <Focusable
      onPress={() => onSelect(item.id)}
      onFocus={() => onSelect(item.id)}
      borderRadius={scale(6)}
      scaleValue={1.02}
      style={[s.sideItem, isActive && s.sideItemActive]}
      focusedStyle={s.sideItemFocused}
    >
      {item.id === "favorites" ? (
        <Heart size={scale(12)} color={isActive ? C.accent : "rgba(255,255,255,0.4)"} />
      ) : item.id === "all" ? (
        <List size={scale(12)} color={isActive ? C.accent : "rgba(255,255,255,0.4)"} />
      ) : (
        <View style={[s.sideDot, { backgroundColor: isActive ? C.accent : "rgba(255,255,255,0.22)" }]} />
      )}
      <Text style={[s.sideLabel, isActive && s.sideLabelActive]} numberOfLines={2}>{item.label}</Text>
    </Focusable>
  );
});

export default function ChannelsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const sidebarHandle = useSidebarHandle();
  const { channels, activeChannel, setActiveChannel, favorites, toggleFavorite } = useGlobal();

  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [playlistSel, setPlaylistSel] = useState("__default__");
  const [activeSideId, setActiveSideId] = useState("all");
  const [settings, setSettings] = useState<ChannelSettings>({ parentalLock: false, hideRestricted: true });
  const searchRef = useRef<TextInput>(null);

  // Timer para debouncear el streaming de video al navegar rápido con control remoto
  const channelFocusTimer = useRef<any>(null);

  useEffect(() => {
    loadAppSettings().then((saved) =>
      setSettings({ parentalLock: saved.parentalLock, hideRestricted: saved.hideRestricted })
    );
  }, []);

  useEffect(() => {
    return () => {
      if (channelFocusTimer.current) {
        clearTimeout(channelFocusTimer.current);
        channelFocusTimer.current = null;
      }
    };
  }, []);

  const playlistOptions = useMemo(() => {
    const map = new Map<string, boolean>();
    channels.forEach((c) => {
      const name = c.playlist?.name;
      if (name) map.set(name, (map.get(name) ?? false) || !!c.playlist?.isDefault);
    });
    return Array.from(map.entries()).map(([name, isDefault]) => ({ name, isDefault }));
  }, [channels]);
  const hasDefault = playlistOptions.some((p) => p.isDefault);

  const byPlaylist = useMemo(() => {
    if (playlistSel === "__all__") return channels;
    if (playlistSel === "__default__")
      return hasDefault ? channels.filter((c) => c.playlist?.isDefault) : channels;
    return channels.filter((c) => c.playlist?.name === playlistSel);
  }, [channels, playlistSel, hasDefault]);

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const cats = Array.from(new Set(byPlaylist.map((c) => c.category?.name).filter(Boolean))).sort() as string[];
    return [{ id: "favorites", label: "Favoritos" }, { id: "all", label: "Todos" },
      ...cats.map((cat) => ({ id: `cat:${cat}`, label: cat }))];
  }, [byPlaylist]);

  const filtered = useMemo(() => {
    let list = byPlaylist;
    if (activeSideId === "favorites") {
      const favSet = new Set(favorites);
      list = list.filter((c) => favSet.has(c.id));
    } else if (activeSideId.startsWith("cat:")) {
      list = list.filter((c) => c.category?.name === activeSideId.slice(4));
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    if (settings.parentalLock || settings.hideRestricted)
      list = list.filter((c) => !contentIsRestricted((c as any).contentRating));
    return list;
  }, [byPlaylist, activeSideId, favorites, search, settings]);

  const selectPlaylist = useCallback((key: string) => {
    setPlaylistSel(key); setActiveSideId("all");
  }, []);

  const openFullscreen = useCallback((ch: Channel) => {
    if (channelFocusTimer.current) clearTimeout(channelFocusTimer.current);
    setActiveChannel(ch);
    router.push({ pathname: "/player", params: { channelId: ch.id, channelUrl: ch.url } } as any);
  }, [router, setActiveChannel]);

  // Debounce suave al navegar: la card se enfoca al instante, pero el video en el mini-player
  // solo arranca si el usuario se detiene 220ms sobre el canal.
  const handleFocus = useCallback((ch: Channel) => {
    if (channelFocusTimer.current) clearTimeout(channelFocusTimer.current);
    channelFocusTimer.current = setTimeout(() => {
      setActiveChannel(ch);
    }, 220);
  }, [setActiveChannel]);

  const toggleSearch = useCallback(() => {
    const next = !showSearch;
    setShowSearch(next);
    if (next) setTimeout(() => searchRef.current?.focus(), 150);
    else setSearch("");
  }, [showSearch]);

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const sectionTitle = activeSideId === "all" ? "Todos" : activeSideId === "favorites" ? "Favoritos" : activeSideId.slice(4);

  return (
    <View style={s.root}>
      {/* ── LEFT: mini player + playlist chips + category sidebar ── */}
      <View style={s.leftCol}>
        <MiniPlayer channel={activeChannel} isActive={pathname.includes("channels")} onExpand={() => activeChannel && openFullscreen(activeChannel)} />

        {/* Playlist chips */}
        {playlistOptions.length > 0 && (
          <FlatList
            horizontal showsHorizontalScrollIndicator={false}
            data={[{ key: "__default__", label: hasDefault ? "Por defecto" : "Todas" },
              { key: "__all__", label: "Todas las listas" },
              ...playlistOptions.map((p) => ({ key: p.name, label: p.name }))]}
            keyExtractor={(o) => o.key}
            style={s.plStrip}
            contentContainerStyle={s.plContent}
            renderItem={({ item: o }) => {
              const on = playlistSel === o.key;
              return (
                <Focusable onPress={() => selectPlaylist(o.key)}
                  style={[s.plChip, on && s.plChipOn]} focusedStyle={s.plChipFocused}>
                  <Text style={[s.plChipTxt, on && s.plChipTxtOn]} numberOfLines={1}>{o.label}</Text>
                </Focusable>
              );
            }}
          />
        )}

        {/* Category sidebar */}
        <FlatList
          data={sidebarItems} keyExtractor={(i) => i.id}
          showsVerticalScrollIndicator={false} style={s.sidebar}
          contentContainerStyle={s.sidebarContent}
          renderItem={({ item }) => (
            <SideItem item={item} isActive={activeSideId === item.id} onSelect={setActiveSideId} />
          )}
        />
      </View>

      {/* ── RIGHT: header + channel list ── */}
      <View style={s.rightCol}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>{sectionTitle}</Text>
            <Text style={s.headerCount}>{filtered.length} canales</Text>
          </View>
          {showSearch && (
            <View style={s.searchWrap}>
              <Search size={scale(14)} color="rgba(255,255,255,0.5)" />
              <TextInput ref={searchRef} style={s.searchInput}
                placeholder="Buscar canal..." placeholderTextColor="rgba(255,255,255,0.3)"
                value={search} onChangeText={setSearch} autoCorrect={false} />
              {search.length > 0 && (
                <Focusable onPress={() => setSearch("")} hitSlop={8}>
                  <X size={scale(13)} color="rgba(255,255,255,0.5)" />
                </Focusable>
              )}
            </View>
          )}
          <Focusable onPress={toggleSearch} style={s.iconBtn} focusedStyle={s.iconBtnFocused}>
            {showSearch ? <X size={scale(17)} color="#fff" /> : <Search size={scale(17)} color="#fff" />}
          </Focusable>
        </View>

        <FlatList
          data={filtered} keyExtractor={keyById} style={s.list}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={16} maxToRenderPerBatch={12} windowSize={7}
          renderItem={({ item, index }) => (
            <ChannelRow item={item} index={index}
              isActive={activeChannel?.id === item.id} isFav={favSet.has(item.id)}
              onOpen={openFullscreen} onFocus={handleFocus} onToggleFav={toggleFavorite}
              nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
              preferFocus={index === 0}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTxt}>{activeSideId === "favorites" ? "Sin favoritos" : "Sin canales"}</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0e0e10", flexDirection: "row", paddingLeft: scale(72) },

  // Left column
  leftCol: {
    width: MINI_W + scale(24),
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.07)",
    paddingTop: scale(14),
    paddingHorizontal: scale(10),
  },

  // Mini player
  mini: {
    width: "100%", height: MINI_H,
    borderRadius: scale(14), overflow: "hidden",
    backgroundColor: "#1a1a1c",
    marginBottom: scale(10),
  },
  miniFocused: { backgroundColor: "rgba(255,255,255,0.15)" },
  miniBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: scale(10), paddingBottom: scale(8), gap: scale(8),
  },
  miniLogo: { width: scale(30), height: scale(22) },
  miniText: { flex: 1 },
  miniName: { color: "#fff", fontSize: scale(12), fontWeight: "700" },
  miniHintWrap: {
    position: "absolute", top: scale(7), right: scale(8),
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: scale(7), paddingVertical: scale(3),
    borderRadius: scale(6),
  },
  miniHintTxt: { color: "rgba(255,255,255,0.65)", fontSize: scale(9), fontWeight: "600" },

  // Shared live indicator
  livePill: { flexDirection: "row", alignItems: "center", gap: scale(4), marginTop: scale(2) },
  liveDot: { width: scale(5), height: scale(5), borderRadius: 99, backgroundColor: C.live },
  liveTxt: { color: C.live, fontSize: scale(9), fontWeight: "800", letterSpacing: 0.5 },

  // Playlist chips
  plStrip: { flexGrow: 0, height: scale(42), marginBottom: scale(6) },
  plContent: { alignItems: "center", gap: scale(6), height: scale(42) },
  plChip: {
    height: scale(28), paddingHorizontal: scale(11), borderRadius: 99,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  plChipOn: { backgroundColor: C.accent },
  plChipFocused: { backgroundColor: "rgba(255,255,255,0.22)" },
  plChipTxt: { color: "rgba(255,255,255,0.6)", fontSize: scale(11), fontWeight: "700", maxWidth: scale(130) },
  plChipTxtOn: { color: "#000" },

  // Sidebar categories
  sidebar: { flex: 1 },
  sidebarContent: { paddingBottom: scale(20) },
  sideItem: {
    flexDirection: "row", alignItems: "center", gap: scale(8),
    paddingHorizontal: scale(10), paddingVertical: scale(10),
    borderRadius: scale(6), marginBottom: scale(2),
    borderLeftWidth: 6, borderLeftColor: "transparent",
  },
  sideItemActive: { backgroundColor: "rgba(255,255,255,0.07)" },
  sideItemFocused: { borderLeftColor: C.accent, backgroundColor: "rgba(255,255,255,0.08)" },
  sideDot: { width: scale(5), height: scale(5), borderRadius: 99, marginHorizontal: scale(3) },
  sideLabel: { flex: 1, fontSize: scale(12), fontWeight: "600", color: "rgba(255,255,255,0.45)" },
  sideLabelActive: { color: C.accent },

  // Right column
  rightCol: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: scale(10),
    paddingHorizontal: scale(16), paddingVertical: scale(12),
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: scale(18), fontWeight: "800", color: "#fff" },
  headerCount: { fontSize: scale(11), color: "rgba(255,255,255,0.38)", fontWeight: "600", marginTop: scale(2) },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: scale(8),
    width: scale(230), height: scale(36), paddingHorizontal: scale(12),
    borderRadius: scale(10), backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  searchInput: { flex: 1, color: "#fff", fontSize: scale(13), paddingVertical: 0 },
  iconBtn: {
    width: scale(36), height: scale(36), borderRadius: scale(10),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  iconBtnFocused: { backgroundColor: "rgba(255,255,255,0.2)" },

  // Channel list
  list: { flex: 1 },
  listContent: { paddingBottom: scale(30), paddingVertical: scale(4) },
  chRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: scale(14), paddingVertical: scale(10),
    gap: scale(10), marginHorizontal: scale(6), marginBottom: scale(2),
    borderRadius: scale(8),
    borderLeftWidth: 3, borderLeftColor: "transparent",
  },
  chRowActive: { backgroundColor: "rgba(255,183,3,0.06)" },
  chRowFocused: { borderLeftColor: C.accent, backgroundColor: "rgba(255,255,255,0.06)" },
  chNum: { width: scale(26), textAlign: "center", fontSize: scale(13), fontWeight: "800", color: "rgba(255,255,255,0.28)" },
  chLogoWrap: {
    width: scale(48), height: scale(48), borderRadius: scale(10),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden",
  },
  chLogoWrapActive: { backgroundColor: "rgba(255,183,3,0.08)" },
  chLogo: { width: "85%", height: "85%" },
  chInfo: { flex: 1 },
  chName: { fontSize: scale(13), fontWeight: "700", color: "#fff" },
  chMeta: { fontSize: scale(11), color: "rgba(255,255,255,0.38)", marginTop: scale(2) },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: scale(4),
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: scale(7), height: scale(22), borderRadius: 99,
  },
  favBtn: {
    width: scale(32), height: scale(32), alignItems: "center", justifyContent: "center",
    borderRadius: scale(8),
  },
  favBtnFocused: { backgroundColor: "rgba(232,121,249,0.12)" },
  empty: { flex: 1, alignItems: "center", paddingTop: scale(60) },
  emptyTxt: { color: "rgba(255,255,255,0.28)", fontSize: scale(14), fontWeight: "600" },
});
