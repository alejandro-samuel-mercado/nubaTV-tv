import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Clapperboard,
  Clock,
  Film,
  Flame,
  Layers,
  Search,
  Sparkles,
  Star,
  X
} from "lucide-react-native";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Focusable from "../../components/tv/Focusable";
import RemoteImage from "../../components/tv/RemoteImage";
import ExploreCollageBackground from "../../components/tv/ExploreCollageBackground";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  getContentList,
  NexoContentItem,
} from "../../services/nexoplay";

const { width: SW } = Dimensions.get("window");

// ── Dimensiones del layout TV ────────────────────────────────────────────────
const GLOBAL_NAV_OFFSET = scale(64);
const SIDEBAR_W = scale(340); // Barra lateral amplia y aprovechada
const GRID_PADDING = scale(20);
const CARD_GAP = scale(14);

const POSTER_W = scale(128);
const POSTER_H = scale(186);

const USABLE_W_OPEN = SW - GLOBAL_NAV_OFFSET - SIDEBAR_W - (GRID_PADDING * 2);
const USABLE_W_CLOSED = SW - GLOBAL_NAV_OFFSET - (GRID_PADDING * 2);

const COLS_OPEN = Math.max(3, Math.floor((USABLE_W_OPEN + CARD_GAP) / (POSTER_W + CARD_GAP)));
const COLS_CLOSED = Math.max(4, Math.floor((USABLE_W_CLOSED + CARD_GAP) / (POSTER_W + CARD_GAP)));

type ContentType = "" | "MOVIE" | "SERIES" | "ANIME" | "DOCUMENTARY";
type SortType = "recent" | "popular" | "rating";

// ── Tipo de contenido: cuadrícula equilibrada 3 columnas x 2 filas ───────────
const TYPE_ITEMS = [
  { value: "" as ContentType, label: "Todo", icon: Layers },
  { value: "MOVIE" as ContentType, label: "Películas", icon: Film },
  { value: "SERIES" as ContentType, label: "Series", icon: Clapperboard },
  { value: "ANIME" as ContentType, label: "Anime", icon: Sparkles },
  { value: "DOCUMENTARY" as ContentType, label: "Docu", icon: Film },
];

// ── Ordenar por: 3 columnas simétricas ───────────────────────────────────────
const SORT_OPTS: { value: SortType; label: string; icon: any }[] = [
  { value: "recent", label: "Recientes", icon: Clock },
  { value: "popular", label: "Populares", icon: Flame },
  { value: "rating", label: "Valoradas", icon: Star },
];

// ── 14 Géneros simétricos en 2 columnas x 7 filas (texto amplio y legible) ──
const GENRES: { label: string; value: string }[] = [
  { label: "Todos los géneros", value: "" },
  { label: "Acción", value: "Acción" },
  { label: "Animación", value: "Animación" },
  { label: "Aventura", value: "Aventura" },
  { label: "Ciencia ficción", value: "Ciencia ficción" },
  { label: "Comedia", value: "Comedia" },
  { label: "Crimen", value: "Crimen" },
  { label: "Drama", value: "Drama" },
  { label: "Fantasía", value: "Fantasía" },
  { label: "Misterio", value: "Misterio" },
  { label: "Romance", value: "Romance" },
  { label: "Suspense", value: "Suspense" },
  { label: "Terror", value: "Terror" },
  { label: "Bélica", value: "Bélica" },
];

const TYPE_LABEL_MAP: Record<string, string> = {
  MOVIE: "Película",
  SERIES: "Serie",
  ANIME: "Anime",
  DOCUMENTARY: "Documental",
};

// ── Poster card ──────────────────────────────────────────────────────────────
const VodCard = memo(function VodCard({
  item,
  onPress,
  trapFocusRight,
}: {
  item: NexoContentItem;
  onPress: (item: NexoContentItem) => void;
  trapFocusRight?: boolean;
}) {
  return (
    <Focusable
      onPress={() => onPress(item)}
      trapFocusRight={trapFocusRight}
      style={s.vodCard}
      focusedStyle={s.vodCardFocused}
      scaleFocused={1.05}
    >
      <RemoteImage
        uri={item.posterUrl || item.backdropUrl}
        style={StyleSheet.absoluteFill as any}
        contentFit="cover"
        transition={150}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.92)"]}
        style={s.vodGrad}
      />
      {item.rating ? (
        <View style={s.ratingBadge}>
          <Star size={scale(10)} color="#000" fill="#000" />
          <Text style={s.ratingBadgeTxt}>{item.rating.toFixed(1)}</Text>
        </View>
      ) : null}
      <View style={s.vodInfo}>
        <Text style={s.vodTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={s.vodMetaRow}>
          <Text style={s.vodType}>
            {TYPE_LABEL_MAP[item.type] || item.type}
          </Text>
          {item.releaseYear ? (
            <Text style={s.vodYear}> • {item.releaseYear}</Text>
          ) : null}
        </View>
      </View>
    </Focusable>
  );
});

export default function ExploreTvScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();

  // Control de apertura/cierre de la barra lateral de filtros
  const [filtersOpen, setFiltersOpen] = useState(true);

  // ── State de Ruta ──────────────────────────────────────────────────────────
  const routeParams = useLocalSearchParams<{
    type?: string;
    sort?: string;
    genreId?: string;
    genre?: string;
    search?: string;
  }>();

  const initialType = (routeParams.type ? routeParams.type.toUpperCase() : "") as ContentType;
  const initialSort = (routeParams.sort as SortType) || "recent";
  const initialGenre = routeParams.genre || routeParams.genreId || "";
  const initialQuery = routeParams.search || "";

  const [query, setQuery] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<TextInput>(null);

  // Filtros
  const [contentType, setContentType] = useState<ContentType>(initialType);
  const [sort, setSort] = useState<SortType>(initialSort);
  const [genre, setGenre] = useState(initialGenre);

  // Resultados
  const [items, setItems] = useState<NexoContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const busyRef = useRef(false);

  // Sincronizar parámetros de ruta cuando cambia la navegación externa
  useEffect(() => {
    if (routeParams.type !== undefined) {
      const t = (routeParams.type || "").toUpperCase() as ContentType;
      if (
        t !== contentType &&
        (t === "" || t === "MOVIE" || t === "SERIES" || t === "ANIME" || t === "DOCUMENTARY")
      ) {
        setContentType(t);
      }
    }
    if (routeParams.sort !== undefined) {
      const s = routeParams.sort as SortType;
      if (s !== sort && (s === "recent" || s === "popular" || s === "rating")) {
        setSort(s);
      }
    }
    if (routeParams.genre !== undefined && routeParams.genre !== genre) {
      setGenre(routeParams.genre);
    } else if (routeParams.genreId !== undefined && routeParams.genreId !== genre) {
      setGenre(routeParams.genreId);
    }
    if (routeParams.search !== undefined && routeParams.search !== appliedQuery) {
      setQuery(routeParams.search);
      setAppliedQuery(routeParams.search);
    }
  }, [
    routeParams.type,
    routeParams.sort,
    routeParams.genre,
    routeParams.genreId,
    routeParams.search,
  ]);

  // ── Cargar VOD ─────────────────────────────────────────────────────────────
  const loadVod = useCallback(
    (pg: number, reset: boolean) => {
      if (pg === 1) setLoading(true);
      const params: any = { sort, limit: 32, page: pg };
      if (contentType) params.type = contentType;
      if (genre) params.genre = genre;
      if (appliedQuery) params.search = appliedQuery;

      getContentList(params)
        .then((data) => {
          setItems((prev) => (reset ? data : [...prev, ...data]));
          setPage(pg);
          setHasMore(data.length === 32);
        })
        .catch(() => { })
        .finally(() => {
          setLoading(false);
          busyRef.current = false;
        });
    },
    [sort, contentType, genre, appliedQuery],
  );

  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(false);
    loadVod(1, true);
  }, [loadVod]);

  const loadMore = useCallback(() => {
    if (!hasMore || busyRef.current || loading) return;
    busyRef.current = true;
    loadVod(page + 1, false);
  }, [hasMore, loading, page, loadVod]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleVodPress = useCallback(
    (item: NexoContentItem) => {
      router.push({ pathname: "/detail", params: { slug: item.slug } } as any);
    },
    [router],
  );

  const submitSearch = useCallback(() => {
    setAppliedQuery(query.trim());
  }, [query]);

  const clearAllFilters = useCallback(() => {
    setContentType("");
    setSort("recent");
    setGenre("");
    setQuery("");
    setAppliedQuery("");
  }, []);

  const activeFilterCount =
    (appliedQuery ? 1 : 0) +
    (contentType ? 1 : 0) +
    (genre ? 1 : 0) +
    (sort !== "recent" ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  // Título dinámico para el encabezado de resultados
  const resultTitle = useMemo(() => {
    const typeLabel =
      TYPE_ITEMS.find((t) => t.value === contentType)?.label || "Catálogo";
    if (appliedQuery) return `Búsqueda: "${appliedQuery}"`;
    if (genre) return `${typeLabel} · ${genre}`;
    return typeLabel;
  }, [contentType, appliedQuery, genre]);

  const cols = filtersOpen ? COLS_OPEN : COLS_CLOSED;

  return (
    <View style={s.root}>
      {/* ── FONDO COLLAGE DINÁMICO DE PORTADAS Y BANNERS (OPACIDAD ELEGANTE + CAMBIO SUAVE) ── */}
      <ExploreCollageBackground items={items} />

      {/* ── 1. BARRA LATERAL AMPLIA, ORDENADA Y CON TIPOGRAFÍA GRANDE (SIN SCROLL) ── */}
      {filtersOpen && (
        <View style={s.sideFilterBar}>
          {/* Cabecera del panel: Título + Botón de Ocultar */}


          {/* Buscador grande y legible */}
          <Focusable
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={[s.sideSearchBox, searchFocused && s.sideSearchBoxFocused]}
            nextFocusLeft={sidebarHandle ?? undefined}
          >
            <Search
              size={scale(15)}
              color={searchFocused ? "#000" : "rgba(255,255,255,0.6)"}
            />
            <TextInput
              ref={searchRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submitSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Buscar películas, series..."
              placeholderTextColor={
                searchFocused ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.4)"
              }
              style={[s.searchInput, searchFocused && { color: "#000" }]}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Focusable
                onPress={() => {
                  setQuery("");
                  setAppliedQuery("");
                }}
                hitSlop={8}
                style={s.searchClearBtn}
              >
                <X
                  size={scale(13)}
                  color={searchFocused ? "#000" : "rgba(255,255,255,0.7)"}
                />
              </Focusable>
            )}
          </Focusable>

          {/* Botón de limpiar filtros activos */}
          {hasActiveFilters && (
            <Focusable
              onPress={clearAllFilters}
              style={s.clearBtn}
              focusedStyle={s.clearBtnFocused}
              nextFocusLeft={sidebarHandle ?? undefined}
            >
              <X size={scale(13)} color={C.accent} />
              <Text style={s.clearBtnTxt}>Limpiar todos los filtros</Text>
            </Focusable>
          )}

          {/* Sección 1: Tipo de contenido (Cuadrícula simétrica y ordenada) */}
          <View style={s.sectionHeaderRow}>
            <View style={s.sectionHeaderDot} />
            <Text style={s.sideSectionTitle}>TIPO DE CONTENIDO</Text>
          </View>
          <View style={s.typeGrid}>
            {TYPE_ITEMS.map((t) => {
              const isSelected = contentType === t.value;
              const Icon = t.icon;
              return (
                <Focusable
                  key={t.label}
                  onPress={() => setContentType(t.value)}
                  style={[s.typeChip, isSelected && s.typeChipActive]}
                  focusedStyle={s.typeChipFocused}
                  nextFocusLeft={sidebarHandle ?? undefined}
                >
                  <Icon
                    size={scale(14)}
                    color={isSelected ? C.accent : "rgba(255,255,255,0.75)"}
                  />
                  <Text
                    style={[
                      s.typeChipTxt,
                      isSelected && s.typeChipTxtActive,
                    ]}
                    numberOfLines={1}
                  >
                    {t.label}
                  </Text>
                </Focusable>
              );
            })}
          </View>

          <View style={s.sideDivider} />

          {/* Sección 2: Ordenar por (3 columnas simétricas con iconos) */}
          <View style={s.sectionHeaderRow}>
            <View style={s.sectionHeaderDot} />
            <Text style={s.sideSectionTitle}>ORDENAR POR</Text>
          </View>
          <View style={s.sortRow}>
            {SORT_OPTS.map((opt) => {
              const isSelected = sort === opt.value;
              const Icon = opt.icon;
              return (
                <Focusable
                  key={opt.value}
                  onPress={() => setSort(opt.value)}
                  style={[s.sortChip, isSelected && s.sortChipActive]}
                  focusedStyle={s.sortChipFocused}
                  nextFocusLeft={sidebarHandle ?? undefined}
                >
                  <Icon
                    size={scale(13)}
                    color={isSelected ? C.accent : "rgba(255,255,255,0.7)"}
                  />
                  <Text
                    style={[
                      s.sortChipTxt,
                      isSelected && s.sortChipTxtActive,
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                </Focusable>
              );
            })}
          </View>

          <View style={s.sideDivider} />

          {/* Sección 3: Géneros en 2 columnas amplias con texto grande */}
          <View style={s.sectionHeaderRow}>
            <View style={s.sectionHeaderDot} />
            <Text style={s.sideSectionTitle}>GÉNERO</Text>
          </View>
          <View style={s.genreGrid2Cols}>
            {GENRES.map((g) => {
              const isSelected =
                g.value === "" ? genre === "" : genre === g.value;
              return (
                <Focusable
                  key={g.label}
                  onPress={() => setGenre(g.value)}
                  style={[
                    s.genreChip2,
                    isSelected && s.genreChip2Active,
                  ]}
                  focusedStyle={s.genreChip2Focused}
                  nextFocusLeft={sidebarHandle ?? undefined}
                >
                  <Text
                    style={[
                      s.genreChip2Txt,
                      isSelected && s.genreChip2TxtActive,
                    ]}
                    numberOfLines={1}
                  >
                    {g.label}
                  </Text>
                </Focusable>
              );
            })}
          </View>
        </View>
      )}

      {/* ── 2. ÁREA PRINCIPAL DE CONTENIDO (GRID DE RESULTADOS) ── */}
      <View style={s.mainArea}>
        {/* Barra superior con botón toggle de filtros, título y metadata */}
        <View style={s.topBarRow}>
          <View style={s.topBarLeft}>


            {/* Título de la vista actual */}
            <View style={s.mainHeadTitleGroup}>
              <View style={s.mainHeadAccent} />
              <Text style={s.mainHeadTitle}>{resultTitle}</Text>
            </View>
          </View>


        </View>

        {/* Grid de películas, series, anime */}
        {loading && items.length === 0 ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={s.loadingTxt}>Cargando catálogo...</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            numColumns={cols}
            key={`vod-grid-${filtersOpen ? "open" : "closed"}-${cols}`}
            contentContainerStyle={s.gridContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={cols * 3}
            maxToRenderPerBatch={cols * 2}
            windowSize={6}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            renderItem={({ item, index }) => (
              <View style={s.cardWrapper}>
                <VodCard
                  item={item}
                  onPress={handleVodPress}
                  trapFocusRight={index % cols === cols - 1 || index === items.length - 1}
                />
              </View>
            )}
            ListFooterComponent={
              hasMore && loading ? (
                <View style={s.footer}>
                  <ActivityIndicator color={C.accent} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              !loading ? (
                <View style={s.center}>
                  <Text style={s.emptyTitle}>Sin resultados</Text>
                  <Text style={s.emptySub}>
                    No encontramos contenido que coincida con estos filtros.
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </View>
  );
}

// ── ESTILOS ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080808",
    paddingLeft: GLOBAL_NAV_OFFSET,
    flexDirection: "row",
  },

  // ── Barra Lateral Amplia, Ordenada y Elegante (Sin Scroll) ──
  sideFilterBar: {
    width: SIDEBAR_W,
    height: "100%",
    backgroundColor: "rgba(13, 19, 32, 0.95)", // Tono azul noche profundo y sofisticado
    borderRightWidth: 1.5,
    borderRightColor: "rgba(255, 183, 3, 0.35)", // Borde derecho con resplandor dorado
    paddingHorizontal: scale(16),
    paddingTop: scale(40),
    paddingBottom: scale(14),
    justifyContent: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: scale(10),
    elevation: 8,
    zIndex: 2,
  },

  sideHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(10),
    paddingBottom: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.07)",
  },
  sideHeaderTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  sideHeaderTitle: {
    fontSize: scale(14),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 1.2,
  },
  sideHideBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    paddingHorizontal: scale(10),
    height: scale(28),
    borderRadius: scale(6),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  sideHideBtnFocused: {
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOpacity: 0.5,
    shadowRadius: scale(6),
    elevation: 6,
  },
  sideHideBtnTxt: {
    fontSize: scale(11.5),
    fontWeight: "700",
    color: "#ffffff",
  },

  sideSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    height: scale(38),
    paddingHorizontal: scale(12),
    borderRadius: scale(8),
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: scale(10),
  },
  sideSearchBoxFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: scale(13),
    paddingVertical: 0,
    fontWeight: "600",
  },
  searchClearBtn: {
    padding: scale(4),
  },

  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    height: scale(30),
    borderRadius: scale(7),
    backgroundColor: "rgba(255, 183, 3, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.4)",
    marginBottom: scale(10),
  },
  clearBtnFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  clearBtnTxt: {
    color: C.accent,
    fontSize: scale(12),
    fontWeight: "800",
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    marginBottom: scale(6),
  },
  sectionHeaderDot: {
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: C.accent,
  },
  sideSectionTitle: {
    fontSize: scale(11.5),
    fontWeight: "900",
    color: "rgba(255, 255, 255, 0.5)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  sideDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    marginVertical: scale(8),
  },

  // ── Tipo de contenido (Cuadrícula simétrica 3 columnas) ──
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(6),
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(6),
    width: "31.5%",
    height: scale(32),
    borderRadius: scale(7),
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  typeChipActive: {
    backgroundColor: "rgba(255, 183, 3, 0.18)",
    borderColor: "rgba(255, 183, 3, 0.6)",
  },
  typeChipFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOpacity: 0.6,
    shadowRadius: scale(6),
    elevation: 6,
  },
  typeChipTxt: {
    fontSize: scale(12.5),
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.8)",
  },
  typeChipTxtActive: {
    color: C.accent,
    fontWeight: "800",
  },

  // ── Ordenar por (3 columnas horizontales) ──
  sortRow: {
    flexDirection: "row",
    gap: scale(6),
  },
  sortChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(5),
    height: scale(32),
    borderRadius: scale(7),
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sortChipActive: {
    backgroundColor: "rgba(255, 183, 3, 0.18)",
    borderColor: "rgba(255, 183, 3, 0.6)",
  },
  sortChipFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  sortChipTxt: {
    fontSize: scale(12),
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.75)",
  },
  sortChipTxtActive: {
    color: C.accent,
    fontWeight: "800",
  },

  // ── Rejilla de Géneros en 2 Columnas amplias con letra grande ──
  genreGrid2Cols: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: scale(5),
  },
  genreChip2: {
    width: "48.5%",
    height: scale(31),
    borderRadius: scale(7),
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(8),
  },
  genreChip2Active: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  genreChip2Focused: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOpacity: 0.6,
    shadowRadius: scale(6),
    elevation: 6,
  },
  genreChip2Txt: {
    fontSize: scale(12.5),
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.8)",
  },
  genreChip2TxtActive: {
    color: "#000000",
    fontWeight: "900",
  },

  // ── 2. Área Principal de Contenido ──
  mainArea: {
    flex: 1,
    paddingHorizontal: GRID_PADDING,
    paddingTop: scale(20),
    zIndex: 1,
  },

  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(12),
    paddingBottom: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(16),
  },

  // Botón Abrir / Cerrar Filtros
  filterToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    height: scale(36),
    paddingHorizontal: scale(14),
    borderRadius: scale(8),
    backgroundColor: "rgba(255, 183, 3, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 183, 3, 0.4)",
  },
  filterToggleBtnActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  filterToggleBtnFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  filterToggleTxt: {
    fontSize: scale(13),
    fontWeight: "800",
    color: C.accent,
    letterSpacing: 0.3,
  },
  filterToggleTxtActive: {
    color: "#000000",
  },
  filterCountBadge: {
    backgroundColor: C.accent,
    borderRadius: scale(10),
    paddingHorizontal: scale(6),
    paddingVertical: scale(1.5),
    marginLeft: scale(2),
  },
  filterCountBadgeTxt: {
    fontSize: scale(10),
    fontWeight: "900",
    color: "#000000",
  },

  mainHeadTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),

  },
  mainHeadAccent: {
    width: scale(4),
    height: scale(18),
    borderRadius: scale(2),
    backgroundColor: C.accent,
  },
  mainHeadTitle: {
    fontSize: scale(18),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.4,
  },
  mainHeadMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  mainHeadCount: {
    fontSize: scale(13),
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.5)",
  },

  gridContent: {
    paddingBottom: scale(40),
  },

  // ── Tarjetas VOD ──
  cardWrapper: {
    marginRight: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  vodCard: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: scale(10),
    overflow: "hidden",
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: "transparent",
  },
  vodCardFocused: {
    borderColor: C.accent,
    zIndex: 10,
  },
  vodGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
  },
  ratingBadge: {
    position: "absolute",
    top: scale(6),
    right: scale(6),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3.5),
    backgroundColor: C.accent,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2.5),
    borderRadius: scale(4),
  },
  ratingBadgeTxt: {
    fontSize: scale(10),
    fontWeight: "900",
    color: "#000000",
  },
  vodInfo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: scale(8),
  },
  vodTitle: {
    fontSize: scale(12.5),
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: scale(15),
  },
  vodMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: scale(3),
  },
  vodType: {
    fontSize: scale(10.5),
    fontWeight: "700",
    color: C.accent,
  },
  vodYear: {
    fontSize: scale(10.5),
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
  },

  // ── Estados de Carga y Vacío ──
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: scale(80),
    gap: scale(10),
  },
  loadingTxt: {
    color: "rgba(255,255,255,0.6)",
    fontSize: scale(14),
  },
  emptyTitle: {
    fontSize: scale(18),
    fontWeight: "800",
    color: "#ffffff",
  },
  emptySub: {
    fontSize: scale(13),
    color: "rgba(255,255,255,0.5)",
    maxWidth: scale(340),
    textAlign: "center",
  },
  footer: {
    paddingVertical: scale(20),
    alignItems: "center",
  },
});
