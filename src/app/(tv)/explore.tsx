import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Check, Film, Layers, Search, SlidersHorizontal, Tv2, X,
} from "lucide-react-native";
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import {
  ActivityIndicator, Dimensions, FlatList, Modal,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import Focusable from "../../components/tv/Focusable";
import RemoteImage from "../../components/tv/RemoteImage";
import { Channel, useGlobal } from "../../contexts/GlobalContext";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  getContentList, NEXOPLAY_API_BASE, NexoContentItem, searchContent,
} from "../../services/nexoplay";

const { width: SW } = Dimensions.get("window");
const GAP = scale(14);
const CARD_W = scale(130);
const CARD_H = scale(185);
const COLS = Math.max(4, Math.floor((SW - scale(180) + GAP) / (CARD_W + GAP)));
const CH_CARD_W = scale(160);
const CH_CARD_H = scale(90);
const CH_COLS = Math.max(3, Math.floor((SW - scale(180) + GAP) / (CH_CARD_W + GAP)));

const PALETTE: [string, string][] = [
  ["#e11d63", "#7b1c5a"], ["#2fb344", "#c2410c"],
  ["#2563eb", "#ea7a12"], ["#0e9aa7", "#3b2f8f"], ["#d97706", "#9a1b1b"],
];
const chColor = (name?: string): [string, string] => {
  const h = (name || "TV").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[h % PALETTE.length];
};

type ContentType = "" | "MOVIE" | "SERIES" | "ANIME" | "DOCUMENTARY";
type SortType = "recent" | "popular" | "rating";
type TabType = "vod" | "channels";

const TYPE_OPTS: { value: ContentType; label: string }[] = [
  { value: "", label: "Todo" },
  { value: "MOVIE", label: "Películas" },
  { value: "SERIES", label: "Series" },
  { value: "ANIME", label: "Anime" },
  { value: "DOCUMENTARY", label: "Documentales" },
];
const SORT_OPTS: { value: SortType; label: string }[] = [
  { value: "recent", label: "Últimos agregados" },
  { value: "popular", label: "Populares" },
  { value: "rating", label: "Mejor valorados" },
];

// ── Poster card (VOD) ────────────────────────────────────────────────────────
const VodCard = memo(function VodCard({
  item, onPress,
}: { item: NexoContentItem; onPress: (item: NexoContentItem) => void }) {
  return (
    <Focusable onPress={() => onPress(item)} style={s.vodCard} focusedStyle={s.vodCardFocused}>
      <RemoteImage uri={item.posterUrl || item.backdropUrl} style={StyleSheet.absoluteFill as any} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={s.vodGrad} />
      <View style={s.vodInfo}>
        <Text style={s.vodTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={s.vodYear}>{item.releaseYear || ""}</Text>
      </View>
    </Focusable>
  );
});

// ── Channel tile ─────────────────────────────────────────────────────────────
const ChannelTile = memo(function ChannelTile({
  ch, onPress,
}: { ch: Channel; onPress: (ch: Channel) => void }) {
  const [a, b] = chColor(ch.category?.name);
  return (
    <Focusable onPress={() => onPress(ch)} style={s.chTile} focusedStyle={s.chTileFocused}>
      <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.18)" }]} />
      {ch.logo ? (
        <RemoteImage uri={ch.logo} style={s.chTileLogo as any} contentFit="contain" transition={120} />
      ) : (
        <Tv2 size={scale(28)} color="rgba(255,255,255,0.8)" />
      )}
      <View style={s.chTileBar}>
        <Text style={s.chTileName} numberOfLines={1}>{ch.name}</Text>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveTxt}>EN VIVO</Text>
        </View>
      </View>
    </Focusable>
  );
});

// ── Filter chip ──────────────────────────────────────────────────────────────
const FilterChip = memo(function FilterChip({
  label, selected, onPress,
}: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Focusable onPress={onPress} style={[s.chip, selected && s.chipOn]} focusedStyle={s.chipFocused}>
      {selected && <Check size={scale(12)} color="#000" style={{ marginRight: scale(4) }} />}
      <Text style={[s.chipTxt, selected && s.chipTxtOn]}>{label}</Text>
    </Focusable>
  );
});

export default function ExploreTvScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();
  const { channels, setActiveChannel } = useGlobal();

  // ── State ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabType>("vod");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<TextInput>(null);

  // VOD filters
  const [contentType, setContentType] = useState<ContentType>("");
  const [sort, setSort] = useState<SortType>("recent");
  const [genreId, setGenreId] = useState("");
  const [genres, setGenres] = useState<{ label: string; value: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // VOD results
  const [items, setItems] = useState<NexoContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const busyRef = useRef(false);

  // Channel filters
  const [chCatId, setChCatId] = useState("__all__");

  // ── Load genres ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${NEXOPLAY_API_BASE}/api/genres`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setGenres([{ label: "Todos los géneros", value: "" }, ...j.data.map((g: any) => ({ label: g.name, value: g.id }))]);
        }
      })
      .catch(() => {});
  }, []);

  // ── Load VOD ───────────────────────────────────────────────────────────────
  const loadVod = useCallback((pg: number, reset: boolean) => {
    if (pg === 1) setLoading(true);
    const params: any = { sort, limit: 32, page: pg };
    if (contentType) params.type = contentType;
    if (genreId) params.genreId = genreId;
    if (appliedQuery) params.search = appliedQuery;

    getContentList(params).then((data) => {
      setItems((prev) => reset ? data : [...prev, ...data]);
      setPage(pg);
      setHasMore(data.length === 32);
    }).catch(() => {}).finally(() => {
      setLoading(false);
      busyRef.current = false;
    });
  }, [sort, contentType, genreId, appliedQuery]);

  useEffect(() => {
    if (tab !== "vod") return;
    setItems([]); setPage(1); setHasMore(false);
    loadVod(1, true);
  }, [loadVod, tab]);

  const loadMore = useCallback(() => {
    if (!hasMore || busyRef.current || loading) return;
    busyRef.current = true;
    loadVod(page + 1, false);
  }, [hasMore, loading, page, loadVod]);

  // ── Channel filtering ──────────────────────────────────────────────────────
  const chCategories = useMemo(() => {
    const cats = Array.from(new Set(channels.map((c) => c.category?.name).filter(Boolean))).sort() as string[];
    return [{ id: "__all__", label: "Todos" }, ...cats.map((c) => ({ id: c, label: c }))];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    let list = channels;
    if (chCatId !== "__all__") list = list.filter((c) => c.category?.name === chCatId);
    const q = appliedQuery.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    return list;
  }, [channels, chCatId, appliedQuery]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleVodPress = useCallback((item: NexoContentItem) => {
    router.push({ pathname: "/detail", params: { slug: item.slug } } as any);
  }, [router]);

  const handleChPress = useCallback((ch: Channel) => {
    setActiveChannel(ch);
    router.push({ pathname: "/player", params: { channelId: ch.id, channelUrl: ch.url } } as any);
  }, [router, setActiveChannel]);

  const submitSearch = useCallback(() => {
    setAppliedQuery(query.trim());
  }, [query]);

  // ── Filter counts for modal badge ──────────────────────────────────────────
  const activeFilters = (contentType ? 1 : 0) + (genreId ? 1 : 0) + (sort !== "recent" ? 1 : 0);

  return (
    <View style={s.root}>
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <View style={s.topBar}>
        {/* Search */}
        <Focusable
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={[s.searchBox, searchFocused && s.searchBoxFocused]}
          nextFocusLeft={sidebarHandle ?? undefined}
        >
          <Search size={scale(16)} color={searchFocused ? "#000" : "rgba(255,255,255,0.6)"} />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar películas, series, canales…"
            placeholderTextColor={searchFocused ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.45)"}
            style={[s.searchInput, searchFocused && { color: "#000" }]}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Focusable onPress={() => { setQuery(""); setAppliedQuery(""); }} hitSlop={8}>
              <X size={scale(14)} color={searchFocused ? "#000" : "rgba(255,255,255,0.6)"} />
            </Focusable>
          )}
        </Focusable>

        {/* Tabs */}
        <View style={s.tabs}>
          <Focusable
            onPress={() => setTab("vod")}
            style={[s.tab, tab === "vod" && s.tabOn]}
            focusedStyle={s.tabFocused}
          >
            <Film size={scale(14)} color={tab === "vod" ? "#000" : "rgba(255,255,255,0.7)"} />
            <Text style={[s.tabTxt, tab === "vod" && s.tabTxtOn]}>Contenido</Text>
          </Focusable>
          <Focusable
            onPress={() => setTab("channels")}
            style={[s.tab, tab === "channels" && s.tabOn]}
            focusedStyle={s.tabFocused}
          >
            <Tv2 size={scale(14)} color={tab === "channels" ? "#000" : "rgba(255,255,255,0.7)"} />
            <Text style={[s.tabTxt, tab === "channels" && s.tabTxtOn]}>Canales</Text>
          </Focusable>
        </View>

        {/* Filters button (VOD only) */}
        {tab === "vod" && (
          <Focusable onPress={() => setShowFilters(true)} style={s.filterBtn} focusedStyle={s.filterBtnFocused}>
            <SlidersHorizontal size={scale(16)} color="#fff" />
            <Text style={s.filterBtnTxt}>Filtros</Text>
            {activeFilters > 0 && (
              <View style={s.filterBadge}>
                <Text style={s.filterBadgeTxt}>{activeFilters}</Text>
              </View>
            )}
          </Focusable>
        )}
      </View>

      {/* ── VOD TYPE CHIPS ──────────────────────────────────────────────── */}
      {tab === "vod" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={s.typeStrip} contentContainerStyle={s.typeContent}>
          {TYPE_OPTS.map((opt) => (
            <FilterChip key={opt.value} label={opt.label}
              selected={contentType === opt.value}
              onPress={() => setContentType(opt.value)} />
          ))}
        </ScrollView>
      )}

      {/* ── CHANNEL CATEGORY CHIPS ──────────────────────────────────────── */}
      {tab === "channels" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={s.typeStrip} contentContainerStyle={s.typeContent}>
          {chCategories.map((cat) => (
            <FilterChip key={cat.id} label={cat.label}
              selected={chCatId === cat.id}
              onPress={() => setChCatId(cat.id)} />
          ))}
        </ScrollView>
      )}

      {/* ── RESULTS ─────────────────────────────────────────────────────── */}
      <View style={s.resultsArea}>
        {/* Header */}
        <View style={s.resultsHead}>
          <Text style={s.resultsTitle}>
            {appliedQuery ? `Resultados para "${appliedQuery}"` : tab === "vod" ? "Explorar contenido" : "Canales en vivo"}
          </Text>
          <Text style={s.resultsCount}>
            {tab === "vod" ? `${items.length} ${hasMore ? "+" : ""} títulos` : `${filteredChannels.length} canales`}
          </Text>
        </View>

        {tab === "vod" ? (
          loading && items.length === 0 ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={C.accent} />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              numColumns={COLS}
              key={`vod-${COLS}`}
              contentContainerStyle={s.vodGrid}
              showsVerticalScrollIndicator={false}
              initialNumToRender={COLS * 3}
              maxToRenderPerBatch={COLS * 2}
              windowSize={6}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              renderItem={({ item }) => (
                <View style={s.vodCardWrap}>
                  <VodCard item={item} onPress={handleVodPress} />
                </View>
              )}
              ListFooterComponent={hasMore && loading ? (
                <View style={s.footer}>
                  <ActivityIndicator color={C.accent} />
                </View>
              ) : null}
              ListEmptyComponent={!loading ? (
                <View style={s.center}>
                  <Text style={s.emptyTxt}>Sin resultados</Text>
                </View>
              ) : null}
            />
          )
        ) : (
          <FlatList
            data={filteredChannels}
            keyExtractor={(c) => c.id}
            numColumns={CH_COLS}
            key={`ch-${CH_COLS}`}
            contentContainerStyle={s.chGrid}
            showsVerticalScrollIndicator={false}
            initialNumToRender={CH_COLS * 3}
            windowSize={6}
            renderItem={({ item: ch }) => (
              <View style={s.chTileWrap}>
                <ChannelTile ch={ch} onPress={handleChPress} />
              </View>
            )}
            ListEmptyComponent={
              <View style={s.center}>
                <Text style={s.emptyTxt}>Sin canales</Text>
              </View>
            }
          />
        )}
      </View>

      {/* ── FILTERS MODAL ───────────────────────────────────────────────── */}
      <Modal visible={showFilters} transparent animationType="fade" onRequestClose={() => setShowFilters(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalPanel}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Filtros</Text>
              <Focusable hasTVPreferredFocus onPress={() => setShowFilters(false)}
                style={s.modalClose} focusedStyle={s.modalCloseFocused}>
                <X size={scale(18)} color="#fff" />
              </Focusable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type */}
              <Text style={s.modalSectionTitle}>TIPO DE CONTENIDO</Text>
              <View style={s.chipGroup}>
                {TYPE_OPTS.map((opt) => (
                  <FilterChip key={opt.value} label={opt.label}
                    selected={contentType === opt.value}
                    onPress={() => setContentType(opt.value)} />
                ))}
              </View>

              {/* Sort */}
              <Text style={s.modalSectionTitle}>ORDENAR POR</Text>
              <View style={s.chipGroup}>
                {SORT_OPTS.map((opt) => (
                  <FilterChip key={opt.value} label={opt.label}
                    selected={sort === opt.value}
                    onPress={() => setSort(opt.value)} />
                ))}
              </View>

              {/* Genres */}
              {genres.length > 0 && (
                <>
                  <Text style={s.modalSectionTitle}>GÉNEROS</Text>
                  <View style={s.chipGroup}>
                    {genres.slice(0, 24).map((g) => (
                      <FilterChip key={g.value} label={g.label}
                        selected={genreId === g.value}
                        onPress={() => setGenreId(g.value)} />
                    ))}
                  </View>
                </>
              )}

              {/* Reset */}
              <Focusable
                onPress={() => { setContentType(""); setSort("recent"); setGenreId(""); }}
                style={s.resetBtn} focusedStyle={s.resetBtnFocused}
              >
                <Text style={s.resetBtnTxt}>Limpiar filtros</Text>
              </Focusable>

              <View style={{ height: scale(40) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0e0e10", paddingLeft: scale(72) },

  // Top bar
  topBar: {
    flexDirection: "row", alignItems: "center", gap: scale(12),
    paddingHorizontal: scale(20), paddingVertical: scale(12),
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: scale(10),
    height: scale(44), paddingHorizontal: scale(16),
    borderRadius: scale(12),
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  searchBoxFocused: {
    backgroundColor: "#fff",
  },
  searchInput: { flex: 1, color: "#fff", fontSize: scale(14), paddingVertical: 0 },

  tabs: { flexDirection: "row", gap: scale(6) },
  tab: {
    flexDirection: "row", alignItems: "center", gap: scale(6),
    height: scale(38), paddingHorizontal: scale(16), borderRadius: scale(10),
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  tabOn: { backgroundColor: C.accent },
  tabFocused: { backgroundColor: "rgba(255,255,255,0.2)" },
  tabTxt: { fontSize: scale(13), fontWeight: "700", color: "rgba(255,255,255,0.7)" },
  tabTxtOn: { color: "#000" },

  filterBtn: {
    flexDirection: "row", alignItems: "center", gap: scale(8),
    height: scale(38), paddingHorizontal: scale(16), borderRadius: scale(10),
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  filterBtnFocused: { backgroundColor: "rgba(255,255,255,0.2)" },
  filterBtnTxt: { color: "#fff", fontSize: scale(13), fontWeight: "700" },
  filterBadge: {
    backgroundColor: C.accent, borderRadius: 99,
    width: scale(18), height: scale(18), alignItems: "center", justifyContent: "center",
  },
  filterBadgeTxt: { color: "#000", fontSize: scale(10), fontWeight: "900" },

  // Type/category chips strip
  typeStrip: { flexGrow: 0, height: scale(48) },
  typeContent: {
    alignItems: "center", gap: scale(8), height: scale(48),
    paddingHorizontal: scale(20),
  },
  chip: {
    flexDirection: "row", alignItems: "center",
    height: scale(32), paddingHorizontal: scale(14), borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  chipOn: { backgroundColor: C.accent },
  chipFocused: { backgroundColor: "rgba(255,255,255,0.2)" },
  chipTxt: { fontSize: scale(12), fontWeight: "700", color: "rgba(255,255,255,0.65)" },
  chipTxtOn: { color: "#000" },

  // Results area
  resultsArea: { flex: 1 },
  resultsHead: {
    flexDirection: "row", alignItems: "center", gap: scale(12),
    paddingHorizontal: scale(20), paddingVertical: scale(10),
  },
  resultsTitle: { flex: 1, fontSize: scale(16), fontWeight: "800", color: "#fff" },
  resultsCount: { fontSize: scale(12), color: "rgba(255,255,255,0.4)", fontWeight: "600" },

  // VOD grid
  vodGrid: { paddingHorizontal: scale(16), paddingBottom: scale(40) },
  vodCardWrap: { flex: 1 / COLS, padding: scale(6) },
  vodCard: {
    width: "100%", aspectRatio: CARD_W / CARD_H,
    borderRadius: scale(12), overflow: "hidden",
    backgroundColor: "#1a1a1c",
  },
  vodCardFocused: { backgroundColor: "#252525" },
  vodGrad: { position: "absolute", bottom: 0, left: 0, right: 0, height: "50%" },
  vodInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: scale(8) },
  vodTitle: { color: "#fff", fontSize: scale(11), fontWeight: "700" },
  vodYear: { color: "rgba(255,255,255,0.5)", fontSize: scale(10), marginTop: scale(2) },

  // Channel grid
  chGrid: { paddingHorizontal: scale(16), paddingBottom: scale(40) },
  chTileWrap: { flex: 1 / CH_COLS, padding: scale(6) },
  chTile: {
    width: "100%", height: CH_CARD_H,
    borderRadius: scale(12), overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#222",
  },
  chTileFocused: { backgroundColor: "#333" },
  chTileLogo: { width: "55%", height: "55%" },
  chTileBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: scale(6), backgroundColor: "rgba(0,0,0,0.5)",
  },
  chTileName: { color: "#fff", fontSize: scale(11), fontWeight: "700" },

  // Live
  livePill: { flexDirection: "row", alignItems: "center", gap: scale(4), marginTop: scale(2) },
  liveDot: { width: scale(4), height: scale(4), borderRadius: 99, backgroundColor: C.live },
  liveTxt: { color: C.live, fontSize: scale(9), fontWeight: "800" },

  // Filter modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "flex-start", alignItems: "flex-end",
  },
  modalPanel: {
    width: scale(420), height: "100%",
    backgroundColor: "#16161b",
    padding: scale(28),
    borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.1)",
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: scale(24),
  },
  modalTitle: { fontSize: scale(22), fontWeight: "900", color: "#fff" },
  modalClose: {
    width: scale(40), height: scale(40), borderRadius: scale(20),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modalCloseFocused: { backgroundColor: "#fff" },
  modalSectionTitle: {
    fontSize: scale(11), fontWeight: "900", color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5, marginBottom: scale(12), marginTop: scale(22),
  },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: scale(8) },
  resetBtn: {
    marginTop: scale(28), height: scale(44), borderRadius: scale(12),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  resetBtnFocused: { backgroundColor: "rgba(255,255,255,0.2)" },
  resetBtnTxt: { color: "#fff", fontSize: scale(14), fontWeight: "800" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: scale(60) },
  emptyTxt: { color: "rgba(255,255,255,0.3)", fontSize: scale(16), fontWeight: "600" },
  footer: { paddingVertical: scale(20), alignItems: "center" },
});
