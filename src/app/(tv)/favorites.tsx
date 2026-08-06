import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useGlobal, Channel } from '../../contexts/GlobalContext';
import { useRouter } from 'expo-router';
import { Heart, HeartCrack } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';

export default function FavoritesTvScreen() {
  const { channels, favorites, setActiveChannel } = useGlobal();
  const router = useRouter();
  
  const favoriteChannels = useMemo(() => {
    return channels.filter(c => favorites.includes(c.id));
  }, [channels, favorites]);

  const handlePlay = (channel: Channel) => {
    setActiveChannel(channel);
    router.push('/player');
  };

  const renderChannelCard = ({ item }: { item: Channel }) => {
    return (
      <TouchableOpacity
        onPress={() => handlePlay(item)}
        className="w-48 h-32 m-3 rounded-2xl bg-white/5 border border-white/10 items-center justify-center focus:border-cyan-400 focus:border-4 focus:bg-white/20 transition-all"
        activeOpacity={0.8}
      >
        {item.logo ? (
          <Image source={{ uri: item.logo }} className="w-16 h-16 mb-2" resizeMode="contain" />
        ) : (
          <View className="w-16 h-16 mb-2 rounded-full bg-white/10 items-center justify-center">
            <Text className="text-white/30 font-black text-2xl">{item.name.charAt(0)}</Text>
          </View>
        )}
        <Text className="text-white text-xs font-bold text-center px-2" numberOfLines={1}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-transparent p-12">
      <View className="flex-row items-center mb-12 gap-4">
        <Heart color="#22d3ee" size={48} />
        <Text className="text-5xl font-black text-white">Favoritos</Text>
      </View>
      
      <View className="flex-1">
        {favoriteChannels.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <HeartCrack color="rgba(255,255,255,0.2)" size={100} className="mb-6" />
            <Text className="text-white/40 text-2xl font-bold">Aún no tienes canales favoritos.</Text>
            <Text className="text-white/30 text-lg mt-2">Durante la reproducción, añádelos con el corazón.</Text>
          </View>
        ) : (
          <FlashList
            data={favoriteChannels}
            renderItem={renderChannelCard}
            keyExtractor={item => item.id}
            numColumns={4}
            // @ts-ignore
            estimatedItemSize={140}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}
