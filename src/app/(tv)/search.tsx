import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { scale } from '../../lib/scale';
import { C } from '../../lib/tvColors';
import { searchContent, NexoContentItem } from '../../services/nexoplay';
import { LinearGradient } from 'expo-linear-gradient';
import PosterCard from '../../components/tv/PosterCard';
import { Search as SearchIcon } from 'lucide-react-native';

const CARD_W = scale(130);
const CARD_H = scale(185);

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NexoContentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const r = await searchContent(q);
    setResults(r);
    setLoading(false);
  }, []);

  return (
    <View style={s.root}>
      <View style={s.searchBar}>
        <SearchIcon size={scale(20)} color={C.textSecondary} />
        <TextInput
          style={s.input}
          placeholder="Buscar peliculas, series, canales..."
          placeholderTextColor={C.textMuted}
          value={query}
          onChangeText={q => { setQuery(q); doSearch(q); }}
          autoFocus
        />
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.accent} /></View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          numColumns={7}
          columnWrapperStyle={{ gap: scale(14) }}
          contentContainerStyle={s.grid}
          renderItem={({ item }) => (
            <PosterCard
              item={item}
              width={CARD_W}
              height={CARD_H}
              onPressItem={(it) => router.push({ pathname: '/detail', params: { slug: it.slug } } as any)}
            />
          )}
        />
      ) : query.length > 0 ? (
        <View style={s.center}>
          <Text style={s.empty}>Sin resultados para "{query}"</Text>
        </View>
      ) : (
        <View style={s.center}>
          <Text style={s.hint}>Escribe para buscar contenido</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: scale(12),
    margin: scale(32), backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: scale(14), paddingHorizontal: scale(20), paddingVertical: scale(14),
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  input: { flex: 1, fontSize: scale(18), color: C.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: scale(16), color: C.textSecondary },
  hint: { fontSize: scale(16), color: C.textMuted },
  grid: { paddingHorizontal: scale(32), paddingBottom: scale(40), gap: scale(14) },
  card: {
    width: CARD_W, height: CARD_H, borderRadius: scale(10),
    overflow: 'visible', backgroundColor: C.bgCard,
  },
  cardFocused: {
    backgroundColor: "rgba(255,183,3,0.12)",
    shadowColor: C.accent, shadowRadius: scale(10), shadowOpacity: 0.5, elevation: 8,
  },
  img: { ...StyleSheet.absoluteFill },
  grad: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: scale(8) },
  name: { fontSize: scale(11), fontWeight: '700', color: '#fff' },
});
