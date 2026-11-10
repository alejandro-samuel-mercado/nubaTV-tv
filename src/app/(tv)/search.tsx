import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import { useSidebarHandle } from '../../hooks/useNavThrottle';

const CARD_W = scale(120);
const CARD_H = scale(175);

const FILTERS = [
  { key: 'all', label: 'Todos', icon: Layers, color: C.accent },
  { key: 'premieres', label: 'Estrenos', icon: Sparkles, color: '#ffb703' },
  { key: 'movies', label: 'Películas', icon: Film, color: '#38bdf8' },
  { key: 'series', label: 'Series', icon: Clapperboard, color: '#a855f7' },
  { key: 'anime', label: 'Anime', icon: Flame, color: '#ec4899' },
];

export default function SearchScreen() {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [rawResults, setRawResults] = useState<NexoContentItem[]>([]);
  const [premieresList, setPremieresList] = useState<NexoContentItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Carga previa de estrenos para cuando se active el filtro "Estrenos" sin consulta
  useEffect(() => {
    let cancelled = false;
    getContentList({ sort: 'recent', limit: 35 })
      .then((items) => {
        if (!cancelled) setPremieresList(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Filtrado reactivo según el chip seleccionado
  const displayedItems = useMemo(() => {
    const source = query.trim() ? rawResults : (activeFilter === 'premieres' ? premieresList : []);

    if (activeFilter === 'all') return source;

    if (activeFilter === 'premieres') {
      if (!query.trim()) return premieresList;
      return source.filter((item) => (item.releaseYear || 0) >= 2024);
    }

    if (activeFilter === 'movies') {
      return source.filter((item) => item.type === 'MOVIE');
    }

    if (activeFilter === 'series') {
      return source.filter((item) => item.type === 'SERIES');
    }

    if (activeFilter === 'anime') {
      return source.filter((item) => item.type === 'ANIME');
    }

    return source;
  }, [rawResults, query, activeFilter, premieresList]);

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
          autoFocus
        />
      </View>

      {/* ── Filtros Rápidos (incluye Estrenos) ── */}
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

      {/* ── Resultados o Sugerencias ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={s.loadingTxt}>Buscando contenido...</Text>
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
      ) : activeFilter === 'premieres' ? (
        <View style={s.center}>
          <ActivityIndicator size="small" color="#ffb703" />
          <Text style={s.hint}>Cargando cartelera de estrenos...</Text>
        </View>
      ) : (
        <View style={s.center}>
          <Text style={s.hint}>Escribe para buscar o selecciona "Estrenos" para explorar novedades</Text>
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
