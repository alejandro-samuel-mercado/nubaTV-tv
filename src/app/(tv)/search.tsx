import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { scale } from '../../lib/scale';
import { C } from '../../lib/tvColors';
import { searchContent, getContentList, NexoContentItem } from '../../services/nexoplay';
import PosterCard from '../../components/tv/PosterCard';
import Focusable from '../../components/tv/Focusable';
import {
  Search as SearchIcon,
  Sparkles,
  Layers,
  Film,
  Clapperboard,
  Flame,
  Smile,
} from 'lucide-react-native';
import { useSidebarHandle } from '../../hooks/useNavThrottle';

const CARD_W = scale(120);
const CARD_H = scale(175);

const FILTERS = [
  { key: 'all', label: 'Todos', icon: Layers, color: C.accent },
  { key: 'premieres', label: 'Estrenos', icon: Sparkles, color: '#ffb703' },
  { key: 'movies', label: 'Películas', icon: Film, color: '#38bdf8' },
  { key: 'series', label: 'Series', icon: Clapperboard, color: '#a855f7' },
  { key: 'kids', label: 'Kids', icon: Smile, color: '#06d6a0' },
  { key: 'anime', label: 'Anime', icon: Flame, color: '#ec4899' },
];

export default function SearchScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();
  const params = useLocalSearchParams<{ filter?: string; q?: string }>();

  const [query, setQuery] = useState(params.q || '');
  const [activeFilter, setActiveFilter] = useState(
    params.filter && FILTERS.some((f) => f.key === params.filter)
      ? params.filter
      : 'all'
  );
  const [rawResults, setRawResults] = useState<NexoContentItem[]>([]);
  const [catalogMap, setCatalogMap] = useState<Record<string, NexoContentItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Escuchar cambios en los parámetros de la URL
  useEffect(() => {
    if (params.filter && FILTERS.some((f) => f.key === params.filter)) {
      setActiveFilter(params.filter);
    }
    if (params.q && params.q !== query) {
      setQuery(params.q);
      doSearch(params.q);
    }
  }, [params.filter, params.q]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setRawResults([]);
      return;
    }
    setLoading(true);
    try {
      const r = await searchContent(q);
      setRawResults(r);
    } catch {
      setRawResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga reactiva de catálogo cuando no hay texto de búsqueda
  useEffect(() => {
    if (query.trim()) return;
    if (catalogMap[activeFilter] && catalogMap[activeFilter].length > 0) return;

    let cancelled = false;
    setLoadingCatalog(true);

    (async () => {
      try {
        let items: NexoContentItem[] = [];
        if (activeFilter === 'premieres') {
          items = await getContentList({ sort: 'recent', limit: 40 });
        } else if (activeFilter === 'movies') {
          items = await getContentList({ type: 'MOVIE', sort: 'popular', limit: 40 });
        } else if (activeFilter === 'series') {
          items = await getContentList({ type: 'SERIES', sort: 'popular', limit: 40 });
        } else if (activeFilter === 'anime') {
          items = await getContentList({ type: 'ANIME', limit: 40 });
        } else if (activeFilter === 'kids') {
          const all = await getContentList({ limit: 60, sort: 'popular' });
          const kidsKeywords = [
            'animación',
            'animacion',
            'familiar',
            'infantil',
            'niños',
            'aventura',
            'kids',
          ];
          items = all.filter(
            (item) =>
              item.genres?.some((g) =>
                kidsKeywords.some((k) => g.name.toLowerCase().includes(k))
              ) ||
              item.contentRating === 'G' ||
              item.contentRating === 'PG'
          );
        } else {
          items = await getContentList({ sort: 'popular', limit: 40 });
        }

        if (!cancelled) {
          setCatalogMap((prev) => ({ ...prev, [activeFilter]: items }));
        }
      } catch (err) {
        console.warn('Error cargando catálogo para filtro:', activeFilter, err);
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeFilter, query, catalogMap]);

  // Filtrado reactivo según el chip seleccionado y la búsqueda
  const displayedItems = useMemo(() => {
    if (query.trim()) {
      if (activeFilter === 'all') return rawResults;

      if (activeFilter === 'premieres') {
        return rawResults.filter((item) => (item.releaseYear || 0) >= 2024);
      }

      if (activeFilter === 'movies') {
        return rawResults.filter((item) => item.type === 'MOVIE');
      }

      if (activeFilter === 'series') {
        return rawResults.filter((item) => item.type === 'SERIES');
      }

      if (activeFilter === 'anime') {
        return rawResults.filter((item) => item.type === 'ANIME');
      }

      if (activeFilter === 'kids') {
        const kidsKeywords = [
          'animación',
          'animacion',
          'familiar',
          'infantil',
          'niños',
          'kids',
        ];
        return rawResults.filter((item) =>
          item.genres?.some((g) =>
            kidsKeywords.some((k) => g.name.toLowerCase().includes(k))
          )
        );
      }

      return rawResults;
    }

    return catalogMap[activeFilter] || [];
  }, [rawResults, query, activeFilter, catalogMap]);

  return (
    <View style={s.root}>
      {/* ── Barra de Búsqueda ── */}
      <View style={s.searchBar}>
        <SearchIcon size={scale(18)} color={C.textSecondary} />
        <TextInput
          style={s.input}
          placeholder="Buscar películas, series, estrenos, anime..."
          placeholderTextColor={C.textMuted}
          value={query}
          {...({ nextFocusLeft: sidebarHandle ?? undefined } as any)}
          onChangeText={(q) => {
            setQuery(q);
            doSearch(q);
          }}
          autoFocus={!params.filter}
        />
      </View>

      {/* ── Filtros Rápidos (incluye Estrenos, Películas, Series, Kids, Anime) ── */}
      <View style={s.filtersRow}>
        {FILTERS.map((f, idx) => {
          const isActive = activeFilter === f.key;
          const Icon = f.icon;
          return (
            <Focusable
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              nextFocusLeft={idx === 0 ? sidebarHandle ?? undefined : undefined}
              trapFocusRight={idx === FILTERS.length - 1}
              scaleFocused={1.03}
              style={[
                s.filterPill,
                isActive && {
                  backgroundColor: f.color,
                  borderColor: f.color,
                },
              ]}
              focusedStyle={{
                backgroundColor: f.color,
                borderColor: '#ffffff',
              }}
            >
              <Icon
                size={scale(12)}
                color={isActive ? '#000000' : f.color}
                style={{ marginRight: scale(5) }}
              />
              <Text
                style={[
                  s.filterPillTxt,
                  { color: isActive ? '#000000' : '#ffffff' },
                ]}
              >
                {f.label}
              </Text>
            </Focusable>
          );
        })}
      </View>

      {/* ── Resultados o Catálogo Filtrado ── */}
      {loading || (loadingCatalog && displayedItems.length === 0) ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={s.loadingTxt}>
            {query.trim() ? 'Buscando contenido...' : 'Cargando catálogo...'}
          </Text>
        </View>
      ) : displayedItems.length > 0 ? (
        <FlatList
          data={displayedItems}
          keyExtractor={(i) => String(i.id || i.slug)}
          numColumns={7}
          columnWrapperStyle={{ gap: scale(14) }}
          contentContainerStyle={s.grid}
          renderItem={({ item, index }) => (
            <PosterCard
              item={item}
              width={CARD_W}
              height={CARD_H}
              nextFocusLeft={index % 7 === 0 ? sidebarHandle ?? undefined : undefined}
              trapFocusRight={index % 7 === 6 || index === displayedItems.length - 1}
              onPressItem={(it) =>
                router.push({ pathname: '/detail', params: { slug: it.slug } } as any)
              }
            />
          )}
        />
      ) : query.length > 0 ? (
        <View style={s.center}>
          <Text style={s.empty}>Sin resultados para "{query}"</Text>
          <Text style={s.hint}>Prueba seleccionando otro filtro o término</Text>
        </View>
      ) : (
        <View style={s.center}>
          <Text style={s.hint}>No hay títulos disponibles en esta categoría</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080808',
    paddingLeft: scale(64),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginHorizontal: scale(32),
    marginTop: scale(28),
    marginBottom: scale(12),
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: scale(12),
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  input: {
    flex: 1,
    fontSize: scale(15),
    color: C.textPrimary,
    fontWeight: '600',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginHorizontal: scale(32),
    marginBottom: scale(18),
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  filterPillTxt: {
    fontSize: scale(11.5),
    fontWeight: '800',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
  },
  loadingTxt: {
    fontSize: scale(13),
    color: C.textSecondary,
    fontWeight: '700',
  },
  empty: {
    fontSize: scale(15),
    color: C.textSecondary,
    fontWeight: '700',
  },
  hint: {
    fontSize: scale(13),
    color: C.textMuted,
  },
  grid: {
    paddingHorizontal: scale(32),
    paddingBottom: scale(40),
    gap: scale(14),
  },
});
