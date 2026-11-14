import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowUpDown,
  ChevronDown,
  Clapperboard,
  Clock,
  Film,
  Flame,
  Layers,
  Search,
  Sparkles,
  Star,
  Tag,
  X,
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
  BackHandler,
  Dimensions,
  findNodeHandle,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ExploreCollageBackground from "../../components/tv/ExploreCollageBackground";
import Focusable from "../../components/tv/Focusable";
import RemoteImage from "../../components/tv/RemoteImage";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  getContentList,
  NexoContentItem,
} from "../../services/nexoplay";

const { width: SW } = Dimensions.get("window");

// ── Dimensiones del layout TV a ancho completo ──────────────────────────────
const GLOBAL_NAV_OFFSET = scale(64);
const GRID_PADDING = scale(26);
const CARD_GAP = scale(14);

const POSTER_W = scale(134);
const POSTER_H = scale(194);


const USABLE_W = SW - GLOBAL_NAV_OFFSET - GRID_PADDING * 2 - scale(16);
const COLS = Math.max(4, Math.floor((USABLE_W + CARD_GAP) / (POSTER_W + CARD_GAP)));

type ContentType = "" | "MOVIE" | "SERIES" | "ANIME" | "DOCUMENTARY";
type SortType = "all" | "recent" | "popular" | "rating";

const TYPE_ITEMS: { value: ContentType; label: string; icon: any }[] = [
  { value: "", label: "Todos", icon: Layers },
  { value: "MOVIE", label: "Películas", icon: Film },
  { value: "SERIES", label: "Series", icon: Clapperboard },
  { value: "ANIME", label: "Anime", icon: Sparkles },
  { value: "DOCUMENTARY", label: "Docu", icon: Film },
];

const SORT_OPTS: { value: SortType; label: string; icon: any }[] = [
  { value: "all", label: "Todos", icon: Layers },
  { value: "recent", label: "Estrenos", icon: Sparkles },
  { value: "popular", label: "Populares", icon: Flame },
  { value: "rating", label: "Valoradas", icon: Star },
];

const GENRES: { label: string; value: string }[] = [
  { label: "Todos", value: "" },
  { label: "Acción", value: "Acción" },
  { label: "Animación", value: "Animación" },
  { label: "Aventura", value: "Aventura" },
  { label: "Ciencia ficción", value: "Ciencia ficción" },
  { label: "Comedia", value: "Comedia" },
  { label: "Crimen", value: "Crimen" },
  { label: "Drama", value: "Drama" },
  { label: "Familia", value: "Familia" },
  { label: "Fantasía", value: "Fantasía" },
  { label: "Misterio", value: "Misterio" },
  { label: "Romance", value: "Romance" },
  { label: "Suspense", value: "Suspense" },
  { label: "Terror", value: "Terror" },
  { label: "Bélica", value: "Bélica" },
];

const GENRE_ID_LABELS: Record<string, string> = {
  cmoywh11k0008xcl6zo6gmt9t: "Acción",
  cmoywh4rc000excl6ffu8fp29: "Animación",
  cmoywu81r006geptr132ep87q: "Aventura",
  cmoywh3gn000cxcl621by2juo: "Ciencia ficción",
  cmoywh22d0009xcl6fxgc4vqn: "Comedia",
  cmoywr9j70007eptr8xrn0ei8: "Crimen",
  cmoyx15nv00tieptr2iki8128: "Documental",
  cmoywh2rh000axcl683pj6eu0: "Drama",
  cmoywr6i70003eptrk5wk7ek2: "Familia",
  cmoyx53dc018aeptrc2kx49kj: "Fantasía",
  cmp5ch9ju02y28jz6fy4q0yhg: "Kids",
  cmoywr7t40006eptr4pzd1vte: "Misterio",
  cmoywh40c000dxcl652stwp3g: "Romance",
  cmoywtaxc0032eptrir5wbuxb: "Suspense",
  cmoywh332000bxcl6ex38pblc: "Terror",
  cmoywx5i300cqeptrdz05hv9n: "Bélica",
};

const TYPE_LABEL_MAP: Record<string, string> = {
  MOVIE: "Película",
  SERIES: "Serie",
  ANIME: "Anime",
  DOCUMENTARY: "Documental",
};

const TVFocusGuide: any =
  (require("react-native") as any).TVFocusGuideView ?? View;

// ── Poster card ──────────────────────────────────────────────────────────────
const VodCard = memo(function VodCard({
  item,
  onPress,
  focusRef,
  onLayout,
  hasPreferredFocus,
  nextFocusLeft,
  trapFocusRight,
  disabled,
}: {
  item: NexoContentItem;
  onPress: (item: NexoContentItem) => void;
  focusRef?: React.Ref<any>;
  onLayout?: () => void;
  hasPreferredFocus?: boolean;
  nextFocusLeft?: number;
  trapFocusRight?: boolean;
  disabled?: boolean;
}) {
  return (
    <Focusable
      ref={focusRef}
      disabled={disabled}
      hasTVPreferredFocus={hasPreferredFocus}
      onLayout={onLayout}
      onPress={() => onPress(item)}
      nextFocusLeft={nextFocusLeft}
      trapFocusRight={trapFocusRight}
      style={s.vodCard}
      focusedStyle={s.vodCardFocused}
      scaleFocused={1.02}
    >
      <View style={s.vodCardInner}>
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
      </View>
    </Focusable>
  );
});

export default function ExploreTvScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();

  // ── State de Ruta ──────────────────────────────────────────────────────────
  const routeParams = useLocalSearchParams<{
    type?: string;
    sort?: string;
    genreId?: string;
    genre?: string;
    search?: string;
  }>();

  const initialType = (routeParams.type ? routeParams.type.toUpperCase() : "") as ContentType;
  const initialSort = (routeParams.sort as SortType) || "all";
  const initialGenre = routeParams.genre || routeParams.genreId || "";
  const initialQuery = routeParams.search || "";

  const [query, setQuery] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [isEditingSearch, setIsEditingSearch] = useState(false);
  const [returnToSearchBtn, setReturnToSearchBtn] = useState(false);
  const searchRef = useRef<TextInput>(null);

  // Filtros
  const [contentType, setContentType] = useState<ContentType>(initialType);
  const [sort, setSort] = useState<SortType>(initialSort);
  const [genre, setGenre] = useState(initialGenre);

  // Selector desplegable compacto de géneros
  const [genreModalOpen, setGenreModalOpen] = useState(false);
  const [returnToGenreBtn, setReturnToGenreBtn] = useState(false);
  const preferredGenreChipRef = useRef<any>(null);

  // Foco inicial en la primera portada (o en Buscar si arranca vacío) una sola vez
  const [initialCardFocused, setInitialCardFocused] = useState(false);
  const [initialEmptySearchFocus, setInitialEmptySearchFocus] = useState(false);
  const hasAutoFocusedRef = useRef(false);

  // Handle del primer resultado para bajar desde cualquier filtro superior
  const firstCardRef = useRef<any>(null);
  const [firstCardHandle, setFirstCardHandle] = useState<number | undefined>(undefined);
  const cardHandleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const nextSort = routeParams.sort as SortType;
      if (
        nextSort !== sort &&
        (nextSort === "all" || nextSort === "recent" || nextSort === "popular" || nextSort === "rating")
      ) {
        setSort(nextSort);
      }
    } else if (routeParams.type !== undefined && sort !== "all") {
      setSort("all");
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

  const triggerReturnToGenreBtn = useCallback(() => {
    if (focusReturnTimer.current) clearTimeout(focusReturnTimer.current);
    setReturnToGenreBtn(false);
    focusReturnTimer.current = setTimeout(() => {
      setReturnToGenreBtn(true);
      focusReturnTimer.current = setTimeout(() => {
        setReturnToGenreBtn(false);
      }, 220);
    }, 45);
  }, []);

  const triggerReturnToSearchBtn = useCallback(() => {
    if (focusReturnTimer.current) clearTimeout(focusReturnTimer.current);
    setReturnToSearchBtn(false);
    focusReturnTimer.current = setTimeout(() => {
      setReturnToSearchBtn(true);
      focusReturnTimer.current = setTimeout(() => {
        setReturnToSearchBtn(false);
      }, 220);
    }, 45);
  }, []);

  const syncFirstCardHandle = useCallback(() => {
    if (Platform.OS === "web") return;
    if (firstCardRef.current) {
      try {
        const h = findNodeHandle(firstCardRef.current);
        if (typeof h === "number" && h > 0) {
          setFirstCardHandle((prev) => (prev !== h ? h : prev));
        }
      } catch {}
    } else {
      setFirstCardHandle(undefined);
    }
  }, []);

  const scheduleCardHandleSync = useCallback(() => {
    if (Platform.OS === "web") return;
    if (cardHandleTimer.current) clearTimeout(cardHandleTimer.current);
    cardHandleTimer.current = setTimeout(syncFirstCardHandle, 60);
  }, [syncFirstCardHandle]);

  useEffect(() => {
    return () => {
      if (cardHandleTimer.current) clearTimeout(cardHandleTimer.current);
      if (focusReturnTimer.current) clearTimeout(focusReturnTimer.current);
    };
  }, []);

  useEffect(() => {
    if (genreModalOpen) {
      setReturnToGenreBtn(false);
      const t = setTimeout(() => {
        try {
          preferredGenreChipRef.current?.requestTVFocus?.();
          preferredGenreChipRef.current?.focus?.();
        } catch {}
      }, 30);
      return () => clearTimeout(t);
    }
  }, [genreModalOpen]);

  // Botón Atrás (Android / Web Esc) cierra primero el selector de géneros si está abierto
  useEffect(() => {
    if (Platform.OS === "web") {
      if (!genreModalOpen) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setGenreModalOpen(false);
          triggerReturnToGenreBtn();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (genreModalOpen) {
        setGenreModalOpen(false);
        triggerReturnToGenreBtn();
        return true;
      }
      if (isEditingSearch) {
        searchRef.current?.blur();
        setIsEditingSearch(false);
        triggerReturnToSearchBtn();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [genreModalOpen, isEditingSearch, triggerReturnToGenreBtn, triggerReturnToSearchBtn]);

  // ── Cargar VOD ─────────────────────────────────────────────────────────────
  const loadVod = useCallback(
    (pg: number, reset: boolean) => {
      if (pg === 1) setLoading(true);
      const currentYear = new Date().getFullYear();
      const isCurrentYear = (x: NexoContentItem) =>
        Boolean(x && (x.releaseYear || 0) >= currentYear);

      const genreParams: any = {};
      if (genre) {
        if (genre.startsWith("cm")) {
          genreParams.genreId = genre;
        } else {
          genreParams.genre = genre;
        }
      }

      const apiSort: "recent" | "popular" | "rating" =
        sort === "all" ? "recent" : sort;

      // Cuando es "Todos" o "Estrenos" y el tipo es "Todos" sin búsqueda de texto,
      // combinamos e intercalamos Películas, Series y Anime
      if ((sort === "all" || sort === "recent") && !contentType && !appliedQuery) {
        Promise.all([
          getContentList({ type: "MOVIE", sort: "recent", limit: 20, page: pg, ...genreParams }),
          getContentList({ type: "SERIES", sort: "recent", limit: 20, page: pg, ...genreParams }),
          getContentList({ type: "ANIME", sort: "recent", limit: 16, page: pg, ...genreParams }),
        ])
          .then(([mvRaw, srRaw, anRaw]) => {
            let mv = mvRaw;
            let sr = srRaw;
            let an = anRaw;

            if (sort === "recent") {
              const mvCur = mvRaw.filter(isCurrentYear);
              const srCur = srRaw.filter(isCurrentYear);
              const anCur = anRaw.filter(isCurrentYear);
              const useFallback = Boolean(
                genre && mvCur.length + srCur.length + anCur.length < 6,
              );
              mv = useFallback ? mvRaw : mvCur;
              sr = useFallback ? srRaw : srCur;
              an = useFallback ? anRaw : anCur;
            }

            const maxLen = Math.max(mv.length, sr.length, an.length);
            const interleaved: NexoContentItem[] = [];
            for (let i = 0; i < maxLen; i++) {
              if (mv[i]) interleaved.push(mv[i]);
              if (sr[i]) interleaved.push(sr[i]);
              if (an[i]) interleaved.push(an[i]);
            }
            setItems((prev) => {
              const base = reset ? [] : prev;
              const seen = new Set(base.map((x) => x.id));
              const next = [...base];
              for (const it of interleaved) {
                if (it?.id && !seen.has(it.id)) {
                  seen.add(it.id);
                  next.push(it);
                }
              }
              return next;
            });
            setPage(pg);
            setHasMore(
              (mvRaw.length === 20 && mv.length === 20) ||
                (srRaw.length === 20 && sr.length === 20),
            );
          })
          .catch(() => {})
          .finally(() => {
            setLoading(false);
            busyRef.current = false;
          });
        return;
      }

      const params: any = { sort: apiSort, limit: 32, page: pg, ...genreParams };
      if (contentType) params.type = contentType;
      if (appliedQuery) params.search = appliedQuery;

      getContentList(params)
        .then((data) => {
          const curYearList = data.filter(isCurrentYear);
          const filtered =
            sort === "recent" && !appliedQuery
              ? curYearList.length < 6
                ? data
                : curYearList
              : data;
          setItems((prev) => {
            if (reset) return filtered;
            const seen = new Set(prev.map((x) => x.id));
            const next = [...prev];
            for (const it of filtered) {
              if (it?.id && !seen.has(it.id)) {
                seen.add(it.id);
                next.push(it);
              }
            }
            return next;
          });
          setPage(pg);
          setHasMore(
            sort === "recent" && !appliedQuery
              ? data.length === 32 && filtered.length === data.length
              : data.length === 32,
          );
        })
        .catch(() => {})
        .finally(() => {
          setLoading(false);
          busyRef.current = false;
        });
    },
    [sort, contentType, genre, appliedQuery],
  );

  useEffect(() => {
    setItems([]);
    setFirstCardHandle(undefined);
    setPage(1);
    setHasMore(false);
    loadVod(1, true);
  }, [loadVod]);

  useEffect(() => {
    scheduleCardHandleSync();
  }, [items.length, scheduleCardHandleSync]);

  useEffect(() => {
    if (!hasAutoFocusedRef.current && !loading && !genreModalOpen) {
      hasAutoFocusedRef.current = true;
      if (items.length > 0) {
        const t = setTimeout(() => setInitialCardFocused(true), 60);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setInitialEmptySearchFocus(true), 60);
      return () => clearTimeout(t);
    }
  }, [loading, items.length, genreModalOpen]);

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
    setIsEditingSearch(false);
    triggerReturnToSearchBtn();
  }, [query, triggerReturnToSearchBtn]);

  const startSearchEditing = useCallback(() => {
    hasAutoFocusedRef.current = true;
    setIsEditingSearch(true);
    setTimeout(() => {
      searchRef.current?.focus();
    }, 45);
  }, []);

  const cycleContentType = useCallback(() => {
    const idx = TYPE_ITEMS.findIndex((t) => t.value === contentType);
    const next = TYPE_ITEMS[(idx + 1) % TYPE_ITEMS.length];
    setContentType(next.value);
  }, [contentType]);

  const cycleSort = useCallback(() => {
    const idx = SORT_OPTS.findIndex((o) => o.value === sort);
    const next = SORT_OPTS[(idx + 1) % SORT_OPTS.length];
    setSort(next.value);
  }, [sort]);

  const clearAllFilters = useCallback(() => {
    setContentType("");
    setSort("all");
    setGenre("");
    setQuery("");
    setAppliedQuery("");
    triggerReturnToGenreBtn();
  }, [triggerReturnToGenreBtn]);

  const closeGenreModal = useCallback(() => {
    setGenreModalOpen(false);
    triggerReturnToGenreBtn();
  }, [triggerReturnToGenreBtn]);

  const currentTypeObj =
    TYPE_ITEMS.find((t) => t.value === contentType) || TYPE_ITEMS[0];
  const currentSortObj =
    SORT_OPTS.find((o) => o.value === sort) || SORT_OPTS[0];
  const TypeIcon = currentTypeObj.icon;
  const SortIcon = currentSortObj.icon;

  const activeGenreLabel = useMemo(() => {
    if (!genre) return "Todos";
    if (genre.startsWith("cm")) return GENRE_ID_LABELS[genre] || "Selección";
    return GENRES.find((g) => g.value === genre)?.label || genre;
  }, [genre]);

  const hasActiveFilters = Boolean(
    appliedQuery || contentType || genre || sort !== "all",
  );

  const resultTitle = useMemo(() => {
    if (appliedQuery) return `Resultados: "${appliedQuery}"`;
    if (genre) return `${currentTypeObj.label} · ${activeGenreLabel}`;
    return currentTypeObj.label === "Todos" ? "Explorar Catálogo" : currentTypeObj.label;
  }, [currentTypeObj.label, appliedQuery, genre, activeGenreLabel]);

  return (
    <View style={s.root}>
      {/* Fondo collage dinámico */}
      <ExploreCollageBackground items={items} />

      {/* ── ÁREA COMPLETA DE CATÁLOGO + BARRA SUPERIOR ULTRA-COMPACTA ── */}
      <View
        style={s.mainArea}
        importantForAccessibility={genreModalOpen ? "no-hide-descendants" : "auto"}
        pointerEvents={genreModalOpen ? "none" : "auto"}
      >
        {/* Barra superior de 1 línea: Título + Buscador grande/visible + Filtros compactos */}
        <View style={s.topBarRow}>
          <View style={s.mainHeadTitleGroup}>
            <View style={s.mainHeadAccent} />
            <Text style={s.mainHeadTitle} numberOfLines={1}>
              {resultTitle}
            </Text>
          </View>

          <View style={s.compactControlsRow}>
            {/* Buscador grande, destacado y de navegación TV sin trabas */}
            <Focusable
              disabled={genreModalOpen}
              hasTVPreferredFocus={returnToSearchBtn || initialEmptySearchFocus}
              onFocus={() => {
                hasAutoFocusedRef.current = true;
                if (initialEmptySearchFocus) setInitialEmptySearchFocus(false);
                if (returnToSearchBtn) setReturnToSearchBtn(false);
              }}
              onPress={startSearchEditing}
              nextFocusLeft={sidebarHandle ?? undefined}
              nextFocusDown={items.length > 0 ? firstCardHandle : undefined}
              trapFocusUp={true}
              trapFocusDown={items.length === 0}
              scaleFocused={1.02}
              style={[
                s.compactSearchBox,
                isEditingSearch && s.compactSearchBoxFocused,
              ]}
              focusedStyle={s.compactSearchBoxFocused}
            >
              {({ focused }) => {
                const activeVisual = focused || isEditingSearch;
                return (
                  <>
                    <Search
                      size={scale(17)}
                      color={activeVisual ? "#000000" : C.accent}
                      strokeWidth={2.5}
                    />
                    <TextInput
                      ref={searchRef}
                      value={query}
                      onChangeText={setQuery}
                      onSubmitEditing={submitSearch}
                      onFocus={() => {
                        hasAutoFocusedRef.current = true;
                        setIsEditingSearch(true);
                      }}
                      onBlur={() => setIsEditingSearch(false)}
                      focusable={!genreModalOpen && (Platform.OS === "web" || isEditingSearch)}
                      accessible={!genreModalOpen && (Platform.OS === "web" || isEditingSearch)}
                      editable={!genreModalOpen}
                      pointerEvents={Platform.OS === "web" || isEditingSearch ? "auto" : "none"}
                      placeholder="Buscar películas, series..."
                      placeholderTextColor={
                        activeVisual ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)"
                      }
                      style={[s.searchInput, activeVisual && { color: "#000000" }]}
                      returnKeyType="search"
                    />
                    {query.length > 0 && (
                      <Pressable
                        focusable={false}
                        accessible={false}
                        onPress={() => {
                          setQuery("");
                          setAppliedQuery("");
                        }}
                        hitSlop={8}
                        style={s.searchClearBtn}
                      >
                        <X
                          size={scale(14)}
                          color={activeVisual ? "#000000" : "rgba(255,255,255,0.8)"}
                        />
                      </Pressable>
                    )}
                  </>
                );
              }}
            </Focusable>

            {/* Tipo compacto en 1 solo botón (cicla al presionar) */}
            <Focusable
              disabled={genreModalOpen}
              onFocus={() => {
                hasAutoFocusedRef.current = true;
              }}
              onPress={cycleContentType}
              trapFocusUp={true}
              nextFocusDown={items.length > 0 ? firstCardHandle : undefined}
              trapFocusDown={items.length === 0}
              style={[s.filterPill, contentType !== "" && s.filterPillActive]}
              focusedStyle={s.filterPillFocused}
            >
              {({ focused }) => (
                <>
                  <TypeIcon
                    size={scale(13)}
                    color={focused ? "#000000" : contentType !== "" ? C.accent : "rgba(255,255,255,0.8)"}
                  />
                  <Text
                    style={[
                      s.filterPillTxt,
                      contentType !== "" && s.filterPillTxtActive,
                      focused && { color: "#000000", fontWeight: "900" },
                    ]}
                    numberOfLines={1}
                  >
                    {currentTypeObj.label}
                  </Text>
                </>
              )}
            </Focusable>

            {/* Orden compacto en 1 solo botón (cicla al presionar) */}
            <Focusable
              disabled={genreModalOpen}
              onFocus={() => {
                hasAutoFocusedRef.current = true;
              }}
              onPress={cycleSort}
              trapFocusUp={true}
              nextFocusDown={items.length > 0 ? firstCardHandle : undefined}
              trapFocusDown={items.length === 0}
              style={[s.filterPill, sort !== "all" && s.filterPillActive]}
              focusedStyle={s.filterPillFocused}
            >
              {({ focused }) => (
                <>
                  <SortIcon
                    size={scale(13)}
                    color={focused ? "#000000" : sort !== "all" ? C.accent : "rgba(255,255,255,0.8)"}
                  />
                  <Text
                    style={[
                      s.filterPillTxt,
                      sort !== "all" && s.filterPillTxtActive,
                      focused && { color: "#000000", fontWeight: "900" },
                    ]}
                    numberOfLines={1}
                  >
                    {currentSortObj.label}
                  </Text>
                  <ArrowUpDown
                    size={scale(11)}
                    color={focused ? "#000000" : "rgba(255,255,255,0.5)"}
                  />
                </>
              )}
            </Focusable>

            {/* Selector desplegable de Género */}
            <Focusable
              disabled={genreModalOpen}
              hasTVPreferredFocus={!genreModalOpen && returnToGenreBtn}
              onFocus={() => {
                hasAutoFocusedRef.current = true;
                if (returnToGenreBtn) setReturnToGenreBtn(false);
              }}
              onPress={() => setGenreModalOpen(true)}
              trapFocusUp={true}
              nextFocusDown={items.length > 0 ? firstCardHandle : undefined}
              trapFocusDown={items.length === 0}
              trapFocusRight={!hasActiveFilters}
              style={[s.filterPill, genre !== "" && s.filterPillActive]}
              focusedStyle={s.filterPillFocused}
            >
              {({ focused }) => (
                <>
                  <Tag
                    size={scale(13)}
                    color={focused ? "#000000" : genre !== "" ? C.accent : "rgba(255,255,255,0.8)"}
                  />
                  <Text
                    style={[
                      s.filterPillTxt,
                      genre !== "" && s.filterPillTxtActive,
                      focused && { color: "#000000", fontWeight: "900" },
                    ]}
                    numberOfLines={1}
                  >
                    {activeGenreLabel}
                  </Text>
                  <ChevronDown
                    size={scale(12)}
                    color={focused ? "#000000" : "rgba(255,255,255,0.6)"}
                  />
                </>
              )}
            </Focusable>

            {/* Limpiar filtros (solo visible si hay filtro activo) */}
            {hasActiveFilters && (
              <Focusable
                disabled={genreModalOpen}
                onPress={clearAllFilters}
                trapFocusUp={true}
                nextFocusDown={items.length > 0 ? firstCardHandle : undefined}
                trapFocusDown={items.length === 0}
                trapFocusRight={true}
                style={s.clearBtn}
                focusedStyle={s.clearBtnFocused}
              >
                {({ focused }) => (
                  <X
                    size={scale(15)}
                    color={focused ? "#000000" : C.accent}
                  />
                )}
              </Focusable>
            )}
          </View>
        </View>

        {/* Grid a ancho completo */}
        {loading && items.length === 0 ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={s.loadingTxt}>Cargando catálogo...</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            numColumns={COLS}
            key={`vod-grid-full-${COLS}`}
            style={{ overflow: "visible" }}
            contentContainerStyle={s.gridContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={COLS * 3}
            maxToRenderPerBatch={COLS * 2}
            windowSize={6}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            renderItem={({ item, index }) => {
              const isCol0 = index % COLS === 0;
              return (
                <View style={s.cardWrapper}>
                  <VodCard
                    item={item}
                    disabled={genreModalOpen}
                    focusRef={index === 0 ? firstCardRef : undefined}
                    onLayout={index === 0 ? scheduleCardHandleSync : undefined}
                    hasPreferredFocus={!genreModalOpen && index === 0 && initialCardFocused}
                    onPress={handleVodPress}
                    nextFocusLeft={isCol0 ? (sidebarHandle ?? undefined) : undefined}
                    trapFocusRight={index % COLS === COLS - 1 || index === items.length - 1}
                  />
                </View>
              );
            }}
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

      {/* ── MODAL COMPACTO DE GÉNEROS (SOLO SE MUESTRA AL ABRIRLO) ── */}
      {genreModalOpen && (
        <View style={s.modalOverlay}>
          <Pressable
            focusable={false}
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={closeGenreModal}
          />
          <TVFocusGuide
            autoFocus
            trapFocusUp
            trapFocusDown
            trapFocusLeft
            trapFocusRight
            destinations={[]}
            style={s.genreModalBox}
          >
            <View style={s.genreModalHeader}>
              <Text style={s.genreModalTitle}>Seleccionar género</Text>
              <Focusable
                onPress={closeGenreModal}
                trapFocusUp
                trapFocusRight
                scaleFocused={1.06}
                style={s.modalCloseBtn}
                focusedStyle={s.modalCloseBtnFocused}
              >
                {({ focused }) => (
                  <X size={scale(15)} color={focused ? "#000000" : "#ffffff"} />
                )}
              </Focusable>
            </View>

            <View style={s.genreModalGrid}>
              {GENRES.map((g, idx) => {
                const isSelected =
                  g.value === ""
                    ? genre === ""
                    : genre === g.value ||
                      (genre.startsWith("cm") &&
                        GENRE_ID_LABELS[genre]?.toLowerCase() === g.value.toLowerCase());
                const isPreferred =
                  isSelected ||
                  (genre.startsWith("cm") &&
                    !GENRE_ID_LABELS[genre] &&
                    idx === 0);
                return (
                  <Focusable
                    key={g.label}
                    ref={isPreferred ? preferredGenreChipRef : undefined}
                    hasTVPreferredFocus={isPreferred}
                    onPress={() => {
                      setGenre(g.value);
                      closeGenreModal();
                    }}
                    trapFocusUp={idx < 3}
                    trapFocusDown={idx + 3 >= GENRES.length}
                    trapFocusLeft={idx % 3 === 0}
                    trapFocusRight={idx % 3 === 2 || idx === GENRES.length - 1}
                    scaleFocused={1.03}
                    style={[s.genreModalChip, isSelected && s.genreModalChipActive]}
                    focusedStyle={s.genreModalChipFocused}
                  >
                    {({ focused }) => (
                      <Text
                        style={[
                          s.genreModalChipTxt,
                          isSelected && s.genreModalChipTxtActive,
                          focused && { color: "#000000", fontWeight: "900" },
                        ]}
                        numberOfLines={1}
                      >
                        {g.label}
                      </Text>
                    )}
                  </Focusable>
                );
              })}
            </View>
          </TVFocusGuide>
        </View>
      )}
    </View>
  );
}

// ── ESTILOS ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080808",
    paddingLeft: GLOBAL_NAV_OFFSET,
  },

  mainArea: {
    flex: 1,
    paddingHorizontal: GRID_PADDING,
    paddingTop: scale(18),
    zIndex: 1,
  },

  // ── Barra Superior Ultra-Compacta ──
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: scale(12),
    marginBottom: scale(14),
    paddingBottom: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },

  mainHeadTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    flexShrink: 1,
    maxWidth: scale(240),
  },
  mainHeadAccent: {
    width: scale(4),
    height: scale(18),
    borderRadius: scale(2),
    backgroundColor: C.accent,
  },
  mainHeadTitle: {
    fontSize: scale(17),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.3,
  },

  compactControlsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: scale(8),
  },

  compactSearchBox: {
    flex: 1,
    minWidth: scale(280),
    maxWidth: scale(390),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    height: scale(44),
    paddingHorizontal: scale(14),
    borderRadius: scale(10),
    backgroundColor: "rgba(18, 25, 42, 0.92)",
    borderWidth: 2,
    borderColor: "rgba(255, 183, 3, 0.55)",
    shadowColor: C.accent,
    shadowOpacity: 0.18,
    shadowRadius: scale(8),
    elevation: 4,
  },
  compactSearchBoxFocused: {
    backgroundColor: "#ffffff",
    borderColor: C.accent,
    shadowOpacity: 0.55,
    shadowRadius: scale(12),
    elevation: 10,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: scale(14),
    paddingVertical: 0,
    fontWeight: "700",
  },
  searchClearBtn: {
    padding: scale(3),
  },

  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    height: scale(40),
    paddingHorizontal: scale(13),
    borderRadius: scale(9),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  filterPillActive: {
    backgroundColor: "rgba(255, 183, 3, 0.16)",
    borderColor: "rgba(255, 183, 3, 0.6)",
  },
  filterPillFocused: {
    backgroundColor: C.accent,
    borderColor: "#ffffff",
    transform: [{ scale: 1.04 }],
    elevation: 6,
  },
  filterPillTxt: {
    fontSize: scale(12.5),
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.9)",
    maxWidth: scale(115),
  },
  filterPillTxtActive: {
    color: C.accent,
    fontWeight: "800",
  },

  clearBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(9),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 183, 3, 0.16)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 183, 3, 0.5)",
  },
  clearBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#ffffff",
    transform: [{ scale: 1.05 }],
  },

  gridContent: {
    paddingTop: scale(10),
    paddingHorizontal: scale(8),
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
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: "transparent",
  },
  vodCardFocused: {
    borderColor: C.accent,
    zIndex: 10,
  },
  vodCardInner: {
    flex: 1,
    borderRadius: scale(8),
    overflow: "hidden",
    backgroundColor: C.bgCard,
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

  // ── Modal Compacto de Géneros ──
  modalOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: "rgba(0, 0, 0, 0.82)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  genreModalBox: {
    width: scale(520),
    backgroundColor: "#0c0c10",
    borderRadius: scale(16),
    padding: scale(20),
    borderWidth: 1.5,
    borderColor: "rgba(255, 183, 3, 0.45)",
  },
  genreModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(14),
  },
  genreModalTitle: {
    fontSize: scale(16),
    fontWeight: "900",
    color: "#ffffff",
  },
  modalCloseBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  modalCloseBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#ffffff",
  },
  genreModalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: scale(8),
  },
  genreModalChip: {
    width: "31.8%",
    height: scale(36),
    borderRadius: scale(8),
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(8),
  },
  genreModalChipActive: {
    backgroundColor: "rgba(255, 183, 3, 0.16)",
    borderColor: C.accent,
  },
  genreModalChipFocused: {
    backgroundColor: C.accent,
    borderColor: "#ffffff",
  },
  genreModalChipTxt: {
    fontSize: scale(12.5),
    fontWeight: "700",
    color: "rgba(255,255,255,0.88)",
  },
  genreModalChipTxtActive: {
    color: C.accent,
    fontWeight: "900",
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
