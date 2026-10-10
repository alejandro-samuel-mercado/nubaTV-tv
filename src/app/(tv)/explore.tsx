import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useGlobal, Channel } from '../../contexts/GlobalContext';
import { useRouter } from 'expo-router';
import { scale } from '../../lib/scale';
import { C } from '../../lib/tvColors';
import ChannelCard from '../../components/tv/ChannelCard';
import ScreenBackground from '../../components/tv/ScreenBackground';
import { Search, Flame, Globe, MessageCircle, PlaySquare, ChevronRight } from 'lucide-react-native';

type ExplorerType = 'search' | 'category' | 'country' | 'language' | 'playlist';

const MENU_ITEMS = [
  { id: 'search', label: 'Búsqueda Global', icon: Search },
  { id: 'category', label: 'Categorías', icon: Flame },
  { id: 'country', label: 'Países', icon: Globe },
  { id: 'language', label: 'Idiomas', icon: MessageCircle },
  { id: 'playlist', label: 'Listas', icon: PlaySquare },
];

export default function ExploreTvScreen() {
  const { channels, activeChannel, setActiveChannel, playlists } = useGlobal();
  const router = useRouter();

  const [explorerType, setExplorerType] = useState<ExplorerType>('search');
  const [explorerValue, setExplorerValue] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // ── 1. Column 2 Data (Values) ─────────────────────────────────────────────
  const col2Values = useMemo(() => {
    let items: string[] = [];
    if (explorerType === 'category') {
      items = Array.from(new Set(channels.map(c => c.category?.name || 'General'))).sort();
    } else if (explorerType === 'country') {
      items = Array.from(new Set(channels.map(c => c.country).filter(Boolean))).sort() as string[];
    } else if (explorerType === 'language') {
      items = Array.from(new Set(channels.map(c => c.language).filter(Boolean))).sort() as string[];
    } else if (explorerType === 'playlist') {
      items = playlists;
    }
    return items;
  }, [channels, playlists, explorerType]);

  // Handle first load or when switching type
  React.useEffect(() => {
    if (explorerType !== 'search' && col2Values.length > 0 && !explorerValue) {
      setExplorerValue(col2Values[0]);
    }
  }, [explorerType, col2Values]);

  // ── 2. Column 3 Data (Channels) ───────────────────────────────────────────
  const col3Channels = useMemo(() => {
    if (explorerType === 'search') {
      if (!searchQuery.trim()) return [];
      const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const q = normalize(searchQuery.trim());
      return channels.filter(c => {
        const name = normalize(c.name);
        const cat = normalize(c.category?.name || '');
        const group = normalize(c.groupTitle || '');
        return name.includes(q) || cat.includes(q) || group.includes(q);
      }).slice(0, 100);
    } else {
      if (!explorerValue) return [];
      return channels.filter(c => {
        if (explorerType === 'category') return (c.category?.name || 'General') === explorerValue;
        if (explorerType === 'country') return c.country === explorerValue;
        if (explorerType === 'language') return c.language === explorerValue;
        if (explorerType === 'playlist') return c.playlist?.name === explorerValue;
        return false;
      });
    }
  }, [channels, explorerType, explorerValue, searchQuery]);

  const handlePlay = (ch: Channel) => {
    setActiveChannel(ch);
    router.push('/player');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenBackground />
      {/* ── COL 1: Menu ── */}
      <View style={s.col1}>
        <Text style={s.colTitle}>Explorar</Text>
        {MENU_ITEMS.map(item => {
          if (item.id === 'playlist' && playlists.length === 0) return null;
          const isActive = explorerType === item.id;
          const Icon = item.icon;
          return (
            <Pressable
              key={item.id}
              focusable
              onFocus={() => {
                setExplorerType(item.id as ExplorerType);
                if (item.id === 'search') setExplorerValue(null);
                else setExplorerValue(col2Values[0]); // Reset value to first item of new type
              }}
              style={({ focused }: any) => [
                s.menuBtn,
                isActive && s.menuBtnActive,
                focused && s.menuBtnFocused
              ]}
            >
              {({ focused }: any) => (
                <>
                  <View style={s.menuBtnLeft}>
                    <Icon size={scale(20)} color={isActive ? C.accentLight : C.textSecondary} />
                    <Text style={[s.menuBtnText, isActive && s.menuBtnTextActive, focused && s.menuBtnTextFocused]}>
                      {item.label}
                    </Text>
                  </View>
                  {isActive && <ChevronRight size={scale(16)} color={C.accentLight} />}
                </>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── COL 2: Values (Hidden if search) ── */}
      {explorerType !== 'search' && (
        <View style={s.col2}>
          <Text style={s.colTitleSub}>Opciones</Text>
          <FlatList
            data={col2Values}
            keyExtractor={item => item}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.listContent}
            renderItem={({ item }) => {
              const isActive = explorerValue === item;
              return (
                <Pressable
                  focusable
                  onFocus={() => setExplorerValue(item)}
                  style={({ focused }: any) => [
                    s.valBtn,
                    isActive && s.valBtnActive,
                    focused && s.valBtnFocused
                  ]}
                >
                  {({ focused }: any) => (
                    <Text style={[s.valBtnText, isActive && s.valBtnTextActive, focused && s.valBtnTextFocused]}>
                      {item}
                    </Text>
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* ── COL 3: Channels Grid & Search Input ── */}
      <View style={s.col3}>
        {explorerType === 'search' ? (
          <View style={s.searchWrap}>
            <View style={[s.searchInputWrap, searchFocused && s.searchInputWrapFocused]}>
              <Search size={scale(24)} color={C.accentLight} style={{ marginRight: scale(16) }} />
              <TextInput
                style={s.searchInput}
                placeholder="Busca por nombre, género..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                autoFocus
              />
            </View>
            <Text style={s.resultsText}>
              {searchQuery.trim() ? `${col3Channels.length} resultados para "${searchQuery}"` : 'Empieza a escribir para buscar...'}
            </Text>
          </View>
        ) : (
          <View style={s.col3Header}>
            <Text style={s.col3Title}>{explorerValue}</Text>
            <Text style={s.resultsText}>{col3Channels.length} canales</Text>
          </View>
        )}

        {col3Channels.length > 0 ? (
          <FlatList
            data={col3Channels}
            keyExtractor={c => c.id}
            numColumns={explorerType === 'search' ? 5 : 4} // adjust columns based on available width
            key={explorerType === 'search' ? 'grid5' : 'grid4'} // force re-render when columns change
            columnWrapperStyle={s.gridRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.gridContent}
            renderItem={({ item }) => (
              <View style={s.cardWrapper}>
                <ChannelCard
                  channel={item}
                  isActive={activeChannel?.id === item.id}
                  onPress={() => handlePlay(item)}
                />
              </View>
            )}
          />
        ) : (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>
              {explorerType === 'search' && !searchQuery.trim() 
                ? 'El buscador está unificado. Escribe algo arriba.'
                : 'No se encontraron canales.'}
            </Text>
          </View>
        )}
      </View>

    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#080808',
    paddingTop: scale(20),
  },
  
  // ── Col 1 ──
  col1: {
    width: scale(260),
    paddingHorizontal: scale(32),
    borderRightWidth: 1,
    borderRightColor: C.borderSubtle,
  },
  colTitle: {
    fontSize: scale(28),
    fontWeight: '900',
    color: '#fff',
    marginBottom: scale(24),
    letterSpacing: -0.5,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderRadius: scale(12),
    marginBottom: scale(8),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  menuBtnActive: {
    backgroundColor: 'rgba(255,145,0,0.1)',
  },
  menuBtnFocused: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  menuBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  menuBtnText: {
    fontSize: scale(15),
    fontWeight: '700',
    color: C.textSecondary,
  },
  menuBtnTextActive: {
    color: C.accentLight,
  },
  menuBtnTextFocused: {
    color: '#fff',
  },

  // ── Col 2 ──
  col2: {
    width: scale(280),
    paddingHorizontal: scale(20),
    borderRightWidth: 1,
    borderRightColor: C.borderSubtle,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  colTitleSub: {
    fontSize: scale(12),
    fontWeight: '800',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: scale(24),
    marginTop: scale(12),
    paddingHorizontal: scale(12),
  },
  listContent: {
    paddingBottom: scale(100),
  },
  valBtn: {
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderRadius: scale(12),
    marginBottom: scale(4),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  valBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  valBtnFocused: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.2)',
    transform: [{ scale: 1.02 }],
  },
  valBtnText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: C.textSecondary,
  },
  valBtnTextActive: {
    color: C.accentLight,
    fontWeight: '800',
  },
  valBtnTextFocused: {
    color: '#fff',
  },

  // ── Col 3 ──
  col3: {
    flex: 1,
    paddingHorizontal: scale(32),
    paddingTop: scale(10),
  },
  searchWrap: {
    marginBottom: scale(24),
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: scale(20),
    paddingHorizontal: scale(20),
    height: scale(60),
    marginBottom: scale(12),
  },
  searchInputWrapFocused: {
    borderColor: C.accent,
    backgroundColor: 'rgba(255,255,255,0.15)',
    transform: [{ scale: 1.02 }],
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: scale(18),
    fontWeight: '600',
    height: '100%',
    outlineStyle: 'none',
  } as any,
  col3Header: {
    marginBottom: scale(24),
  },
  col3Title: {
    fontSize: scale(24),
    fontWeight: '900',
    color: '#fff',
    marginBottom: scale(4),
  },
  resultsText: {
    fontSize: scale(13),
    color: C.textSecondary,
    fontWeight: '600',
  },
  gridContent: {
    paddingBottom: scale(100),
  },
  gridRow: {
    gap: scale(16),
    marginBottom: scale(16),
  },
  cardWrapper: {
    width: scale(160),
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: scale(100),
  },
  emptyText: {
    color: C.textMuted,
    fontSize: scale(16),
    fontWeight: '600',
  }
});
