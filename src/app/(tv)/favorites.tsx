import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useGlobal, Channel } from '../../contexts/GlobalContext';
import { useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { scale } from '../../lib/scale';
import { C } from '../../lib/tvColors';
import ChannelCard from '../../components/tv/ChannelCard';
import ScreenBackground from '../../components/tv/ScreenBackground';
import { useSidebarHandle } from '../../hooks/useNavThrottle';

export default function FavoritesTvScreen() {
  const { channels, favorites, toggleFavorite, activeChannel, setActiveChannel } = useGlobal();
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();

  const favChannels = channels.filter(c => favorites.includes(c.id));

  const handlePlay = (ch: Channel) => {
    setActiveChannel(ch);
    router.push('/player');
  };

  return (
    <View style={s.root}>
      <ScreenBackground />
      {/* Header */}
      <View style={s.header}>
        <View style={s.titleRow}>
          <Heart size={scale(32)} color={C.live} fill={C.live} style={s.icon} />
          <Text style={s.title}>Mis Favoritos</Text>
        </View>
        <Text style={s.subtitle}>{favChannels.length} contenidos guardados</Text>
      </View>

      {/* Grid */}
      <FlatList
        data={favChannels}
        keyExtractor={c => c.id}
        numColumns={6}
        renderItem={({ item, index }) => (
          <View style={s.cardWrapper}>
            <ChannelCard
              channel={item}
              isActive={activeChannel?.id === item.id}
              isFav={true}
              hasTVPreferredFocus={index === 0}
              nextFocusLeft={index % 6 === 0 ? sidebarHandle ?? undefined : undefined}
              trapFocusRight={index % 6 === 5 || index === favChannels.length - 1}
              onPress={() => handlePlay(item)}
              onToggleFav={() => toggleFavorite(item.id)}
            />
          </View>
        )}
        contentContainerStyle={s.grid}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Heart size={scale(64)} color={C.borderMedium} strokeWidth={1} style={{ marginBottom: scale(20) }} />
            <Text style={s.emptyText}>No tienes contenido favorito aún.</Text>
            
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080808',
    paddingLeft: scale(110),
    paddingRight: scale(48),
    paddingTop: scale(40),
  },
  header: {
    marginBottom: scale(36),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  icon: {
    marginRight: scale(16),
  },
  title: {
    fontSize: scale(38),
    fontWeight: '900',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: scale(15),
    color: C.textSecondary,
    fontWeight: '600',
  },
  grid: {
    paddingBottom: scale(60),
    gap: scale(20),
  },
  cardWrapper: {
    width: scale(160),
    marginRight: scale(16),
    marginBottom: scale(16),
  },
  empty: {
    paddingTop: scale(100),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: scale(20),
    color: C.textSecondary,
    fontWeight: '600',
    marginBottom: scale(8),
  },
  emptySub: {
    fontSize: scale(14),
    color: C.textMuted,
  }
});
