import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Heart, Maximize2, Search, Tv2, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Channel, useGlobal } from "../../contexts/GlobalContext";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";

const SIDEBAR_PAD = scale(88);

export default function ChannelsScreen() {
  const router = useRouter();
  const {
    channels,
    activeChannel,
    setActiveChannel,
    favorites,
    toggleFavorite,
  } = useGlobal();

  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [playlistSel, setPlaylistSel] = useState("__default__");
  const [categoryId, setCategoryId] = useState("all");

  const playlistOptions = useMemo(() => {
    const map = new Map<string, boolean>();
    channels.forEach((c) => {
      const name = c.playlist?.name;
      if (name)
        map.set(name, (map.get(name) ?? false) || !!c.playlist?.isDefault);
    });
    return Array.from(map.entries()).map(([name, isDefault]) => ({
      name,
      isDefault,
    }));
  }, [channels]);

  const hasDefault = playlistOptions.some((p) => p.isDefault);

  const byPlaylist = useMemo(() => {
    if (playlistSel === "__all__") return channels;
    if (playlistSel === "__default__") {
      return hasDefault
        ? channels.filter((c) => c.playlist?.isDefault)
        : channels;
    }
    return channels.filter((c) => c.playlist?.name === playlistSel);
  }, [channels, playlistSel, hasDefault]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(byPlaylist.map((c) => c.category?.name).filter(Boolean)),
      ).sort() as string[],
    [byPlaylist],
  );

  const filtered = useMemo(() => {
    let list = byPlaylist;
    if (categoryId === "favorites")
      list = list.filter((c) => favorites.includes(c.id));
    else if (categoryId !== "all")
      list = list.filter((c) => c.category?.name === categoryId);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    return list;
  }, [byPlaylist, categoryId, favorites, search]);

  useEffect(() => {
    if (!filtered.length) return;
    const isVisible =
      !!activeChannel && filtered.some((c) => c.id === activeChannel.id);
    if (!isVisible) {
      const next = filtered[Math.floor(Math.random() * filtered.length)];
      setActiveChannel(next);
    }
  }, [filtered, activeChannel, setActiveChannel]);

  const openFullscreen = (ch: Channel) => {
    setActiveChannel(ch);
    router.push({
      pathname: "/player",
      params: { channelId: ch.id, channelUrl: ch.url },
    } as any);
  };

  const filters = [
    { id: "all", label: "Todos" },
    { id: "favorites", label: "Favoritos" },
    ...categories.map((name) => ({ id: name, label: name })),
  ];

  const heroImage = activeChannel?.logo || channels[0]?.logo || "";

  return (
    <View style={s.root}>
      <View style={s.backgroundLayer} pointerEvents="none">
        {heroImage ? (
          <Image
            source={{ uri: heroImage }}
            style={s.backgroundImage}
            resizeMode="cover"
            blurRadius={8}
          />
        ) : null}

        <LinearGradient
          colors={[
            "rgba(21, 24, 29, 0.82)",
            "rgba(15, 18, 22, 0.62)",
            "rgba(10, 11, 14, 0.68)",
            "rgba(7, 8, 10, 0.9)",
          ]}
          locations={[0, 0.28, 0.7, 1]}
          style={s.backgroundOverlay}
        />

        <LinearGradient
          colors={[
            "rgba(255, 183, 3, 0.07)",
            "rgba(34, 32, 30, 0.89)",
            "rgba(7, 8, 10, 0.51)",
          ]}
          locations={[0, 0.22, 1]}
          style={s.backgroundGlow}
        />
      </View>

      <View style={s.content}>
        {/* 1. Reproductor primero, grande, a todo el ancho útil */}
        <Pressable
          focusable
          disabled={!activeChannel}
          onPress={() => activeChannel && openFullscreen(activeChannel)}
          style={({ focused }: any) => [s.player, focused && s.playerFocus]}
        >
          {activeChannel?.logo ? (
            <Image
              source={{ uri: activeChannel.logo }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              blurRadius={18}
            />
          ) : null}
          <View style={s.playerDim} />

          {activeChannel?.logo ? (
            <Image
              source={{ uri: activeChannel.logo }}
              style={s.playerLogo}
              resizeMode="contain"
            />
          ) : (
            <Tv2 size={scale(48)} color="rgba(255,255,255,0.7)" />
          )}

          <View style={s.playerTop}>
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>EN VIVO</Text>
            </View>

            {showSearch ? (
              <View style={s.searchWrap}>
                <Search size={scale(15)} color="#fff" />
                <TextInput
                  autoFocus
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar canal"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  style={s.searchInput}
                />
                <Pressable
                  focusable
                  hitSlop={8}
                  onPress={() => {
                    setSearch("");
                    setShowSearch(false);
                  }}
                >
                  <X size={scale(15)} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                focusable
                onPress={() => setShowSearch(true)}
                style={({ focused }: any) => [
                  s.roundBtn,
                  focused && s.roundBtnOn,
                ]}
              >
                <Search size={scale(16)} color="#fff" />
              </Pressable>
            )}

            <Pressable
              focusable
              onPress={() => activeChannel && openFullscreen(activeChannel)}
              style={({ focused }: any) => [
                s.roundBtn,
                focused && s.roundBtnOn,
              ]}
            >
              <Maximize2 size={scale(16)} color="#fff" />
            </Pressable>
          </View>

          {activeChannel ? (
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.55)"]}
              style={s.playerFoot}
            >
              <Text style={s.playerName} numberOfLines={1}>
                {activeChannel.name}
              </Text>
              <Text style={s.playerCat} numberOfLines={1}>
                {activeChannel.category?.name || "Sin categoría"}
              </Text>
            </LinearGradient>
          ) : null}
        </Pressable>

        {/* 2. Una sola fila de filtros, pegada al player */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filters}
          contentContainerStyle={s.filtersContent}
        >
          {playlistOptions.length > 0 &&
            [
              {
                key: "__default__",
                label: hasDefault ? "Por defecto" : "Principal",
              },
              { key: "__all__", label: "Todas" },
              ...playlistOptions.map((p) => ({ key: p.name, label: p.name })),
            ].map((p) => {
              const on = playlistSel === p.key;
              return (
                <Pressable
                  key={p.key}
                  focusable
                  onPress={() => {
                    setPlaylistSel(p.key);
                    setCategoryId("all");
                  }}
                  style={({ focused }: any) => [
                    s.pill,
                    on && s.pillOn,
                    focused && s.pillFocus,
                  ]}
                >
                  <Text
                    style={[s.pillTxt, on && s.pillTxtOn]}
                    numberOfLines={1}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}

          <View style={s.sep} />

          {filters.map((f) => {
            const on = categoryId === f.id;
            return (
              <Pressable
                key={f.id}
                focusable
                onPress={() => setCategoryId(f.id)}
                style={({ focused }: any) => [
                  s.pill,
                  on && s.pillSolid,
                  focused && s.pillFocus,
                ]}
              >
                {f.id === "favorites" ? (
                  <Heart
                    size={scale(12)}
                    color={on ? "#000" : "#fff"}
                    fill={on ? "#000" : "none"}
                  />
                ) : null}
                <Text
                  style={[s.pillTxt, on && s.pillTxtDark]}
                  numberOfLines={1}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 3. Canales en una tira horizontal, sin caja negra */}
        <FlatList
          horizontal
          data={filtered}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          style={s.rail}
          contentContainerStyle={s.railContent}
          ListEmptyComponent={<Text style={s.empty}>Sin canales</Text>}
          renderItem={({ item }) => {
            const on = activeChannel?.id === item.id;
            const fav = favorites.includes(item.id);
            return (
              <Pressable
                focusable
                onFocus={() => setActiveChannel(item)}
                onPress={() => openFullscreen(item)}
                style={({ focused }: any) => [
                  s.card,
                  on && s.cardOn,
                  focused && s.cardFocus,
                ]}
              >
                <View style={s.cardLogo}>
                  {item.logo ? (
                    <Image
                      source={{ uri: item.logo }}
                      style={s.cardImg}
                      resizeMode="contain"
                    />
                  ) : (
                    <Tv2 size={scale(22)} color="rgba(255,255,255,0.7)" />
                  )}
                </View>
                <Text style={s.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={s.cardMeta} numberOfLines={1}>
                  {item.category?.name || "TV"}
                </Text>
                <Pressable
                  focusable
                  onPress={() => toggleFavorite(item.id)}
                  hitSlop={8}
                  style={s.heart}
                >
                  <Heart
                    size={scale(13)}
                    color={fav ? "#E50914" : "rgba(255,255,255,0.55)"}
                    fill={fav ? "#E50914" : "none"}
                  />
                </Pressable>
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07080b",
    paddingLeft: SIDEBAR_PAD,
    paddingRight: scale(18),
    paddingTop: scale(14),
    paddingBottom: scale(12),
  },

  player: {
    flex: 1,
    minHeight: scale(340),
    borderRadius: scale(20),
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a22",
  },
  playerFocus: {
    borderWidth: 2,
    borderColor: C.accent,
  },
  playerDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(10,10,16,0.35)",
  },
  playerLogo: {
    width: scale(180),
    height: scale(180),
  },
  playerTop: {
    position: "absolute",
    top: scale(14),
    left: scale(14),
    right: scale(14),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: scale(10),
    height: scale(32),
    borderRadius: 99,
  },
  liveDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: 99,
    backgroundColor: "#ff3b30",
  },
  liveTxt: {
    color: "#fff",
    fontSize: scale(11),
    fontWeight: "900",
    letterSpacing: 1,
  },
  roundBtn: {
    marginLeft: "auto",
    width: scale(36),
    height: scale(36),
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  roundBtnOn: { backgroundColor: C.accent },
  searchWrap: {
    marginLeft: "auto",
    flex: 1,
    maxWidth: scale(320),
    height: scale(36),
    borderRadius: 99,
    paddingHorizontal: scale(12),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: scale(13),
    paddingVertical: 0,
  },
  playerFoot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scale(18),
    paddingTop: scale(28),
    paddingBottom: scale(14),
  },
  playerName: {
    color: "#fff",
    fontSize: scale(26),
    fontWeight: "900",
  },
  playerCat: {
    color: "rgba(255,255,255,0.8)",
    fontSize: scale(13),
    fontWeight: "600",
    marginTop: scale(2),
  },

  filters: { flexGrow: 0, marginTop: scale(12), maxHeight: scale(44) },
  filtersContent: {
    alignItems: "center",
    gap: scale(8),
    paddingRight: scale(8),
  },
  sep: {
    width: 1,
    height: scale(18),
    backgroundColor: "rgba(255,255,255,0.18)",
    marginHorizontal: scale(4),
  },
  pill: {
    height: scale(34),
    paddingHorizontal: scale(14),
    borderRadius: 99,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pillOn: { backgroundColor: "rgba(255,183,3,0.22)" },
  pillSolid: { backgroundColor: C.accent },
  pillFocus: { borderWidth: 1.5, borderColor: "#fff" },
  pillTxt: {
    color: "#fff",
    fontSize: scale(13),
    fontWeight: "700",
    maxWidth: scale(160),
  },
  pillTxtOn: { color: C.accent },
  pillTxtDark: { color: "#000" },

  rail: { flexGrow: 0, marginTop: scale(12), maxHeight: scale(168) },
  railContent: {
    gap: scale(10),
    alignItems: "flex-start",
    paddingBottom: scale(4),
  },
  card: {
    width: scale(148),
    borderRadius: scale(14),
    padding: scale(10),
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cardOn: { backgroundColor: "rgba(255,183,3,0.16)" },
  cardFocus: { borderWidth: 2, borderColor: C.accent },
  cardLogo: {
    height: scale(72),
    borderRadius: scale(10),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: scale(8),
  },
  cardImg: { width: "78%", height: "78%" },
  cardName: { color: "#fff", fontSize: scale(13), fontWeight: "800" },
  cardMeta: {
    color: "rgba(255,255,255,0.55)",
    fontSize: scale(11),
    marginTop: scale(2),
    fontWeight: "600",
  },
  heart: { position: "absolute", top: scale(8), right: scale(8) },
  empty: { color: "rgba(255,255,255,0.6)", marginTop: scale(24) },

  backgroundLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
    overflow: "hidden",
    backgroundColor: "#07080b",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    height: "100%",
    width: "100%",
    opacity: 0.7,
  },
  backgroundOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.8,
  },
  content: {
    flex: 1,
    zIndex: 1,
    paddingTop: scale(14),
    paddingBottom: scale(12),
    paddingLeft: SIDEBAR_PAD,
    paddingRight: scale(18),
  },
});
