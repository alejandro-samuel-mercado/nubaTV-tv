import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import { useGlobal, Channel } from '../../contexts/GlobalContext';
import { useRouter } from 'expo-router';
import { Search, Compass } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';

export default function ExploreTvScreen() {
  const { channels, setActiveChannel } = useGlobal();
  const router = useRouter();
  
  const [search, setSearch] = useState('');
  
  const filteredChannels = useMemo(() => {
    return channels.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [channels, search]);

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
      <View className="flex-row items-center mb-8 gap-4">
        <Compass color="#22d3ee" size={48} />
        <Text className="text-5xl font-black text-white">Explorar</Text>
      </View>
      
      {/* Search Bar - Larger for TV */}
      <View className="relative mb-12 w-2/3">
        <View className="absolute left-6 top-6 z-10">
          <Search color="rgba(255,255,255,0.4)" size={32} />
        </View>
        <TextInput
          className="w-full bg-black/40 border border-white/10 rounded-3xl py-6 pl-20 pr-6 text-white text-2xl font-bold focus:border-cyan-500 focus:bg-white/10"
          placeholder="Buscar canales por nombre..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View className="flex-1">
        {filteredChannels.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-white/40 text-2xl font-bold">No se encontraron canales.</Text>
          </View>
        ) : (
          <FlashList
            data={filteredChannels}
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
