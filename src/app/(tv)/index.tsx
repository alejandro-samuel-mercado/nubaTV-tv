import React, { useMemo, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useGlobal, Channel } from '../../contexts/GlobalContext';
import { useRouter } from 'expo-router';
import { Play } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';

export default function HomeTvScreen() {
  const { channels, activeChannel, setActiveChannel } = useGlobal();
  const router = useRouter();

  const [focusedChannel, setFocusedChannel] = useState<Channel | null>(null);

  // Group channels by category for horizontal rows
  const categories = useMemo(() => {
    const grouped = channels.reduce((acc, channel) => {
      let categoryName = channel.category?.name || 'General';
      if (!acc[categoryName]) acc[categoryName] = [];
      acc[categoryName].push(channel);
      return acc;
    }, {} as Record<string, Channel[]>);

    return Object.entries(grouped)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, items]) => ({ name, items }));
  }, [channels]);

  const handlePlay = (channel: Channel) => {
    setActiveChannel(channel);
    router.push('/player');
  };

  const currentDisplayChannel = focusedChannel || activeChannel || channels[0];

  const renderChannelCard = ({ item }: { item: Channel }) => {
    return (
      <TouchableOpacity
        onPress={() => handlePlay(item)}
        onFocus={() => setFocusedChannel(item)}
        className="w-48 h-32 mr-6 rounded-2xl bg-white/5 border border-white/10 items-center justify-center focus:border-cyan-400 focus:border-4 focus:bg-white/20 transition-all"
        activeOpacity={0.8}
      >
        {item.logo ? (
          <Image source={{ uri: item.logo }} className="w-20 h-20 mb-2" resizeMode="contain" />
        ) : (
          <View className="w-16 h-16 mb-2 rounded-full bg-white/10 items-center justify-center">
            <Text className="text-white/30 font-black text-2xl">{item.name.charAt(0)}</Text>
          </View>
        )}
        <Text className="text-white text-xs font-bold text-center px-2" numberOfLines={1}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  const renderCategoryRow = ({ item }: { item: { name: string, items: Channel[] } }) => (
    <View className="mb-10 pl-10">
      <Text className="text-white font-bold text-2xl mb-6">{item.name}</Text>
      <View style={{ height: 140 }}>
        <FlashList
          data={item.items}
          renderItem={renderChannelCard}
          keyExtractor={c => c.id}
          horizontal
          // @ts-ignore
          estimatedItemSize={192}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 40 }}
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-transparent">
      
      {/* Hero Banner Area */}
      <View className="h-[55%] w-full relative mb-8">
        {currentDisplayChannel?.logo && (
          <Image 
            source={{ uri: currentDisplayChannel.logo }} 
            className="absolute top-0 right-0 w-[60%] h-full opacity-20 object-cover mask-image-gradient"
            resizeMode="cover" 
          />
        )}
        <View className="absolute inset-0 bg-gradient-to-r from-[#02050a] via-[#02050a]/90 to-transparent" />
        <View className="absolute inset-0 bg-gradient-to-t from-[#02050a] to-transparent" />

        <View className="absolute bottom-10 left-10 w-2/3">
          <View className="bg-cyan-500/20 self-start px-3 py-1 rounded-md mb-4 border border-cyan-500/30">
            <Text className="text-cyan-300 text-sm font-bold uppercase tracking-widest">
              {currentDisplayChannel?.category?.name || 'General'}
            </Text>
          </View>
          <Text className="text-white text-6xl font-black mb-4 leading-tight shadow-black shadow-2xl" numberOfLines={2}>
            {currentDisplayChannel?.name || 'Bienvenido a NubaTV'}
          </Text>
          <Text className="text-white/60 text-xl font-bold mb-8">
            {currentDisplayChannel?.country} • {currentDisplayChannel?.language}
          </Text>

          {currentDisplayChannel && (
            <TouchableOpacity 
              onPress={() => handlePlay(currentDisplayChannel)}
              className="bg-white px-8 py-4 rounded-full flex-row items-center self-start focus:bg-cyan-400 focus:border-white focus:border-4"
            >
              <Play size={24} color="black" fill="black" />
              <Text className="text-black font-black text-xl ml-3 uppercase tracking-widest">Reproducir</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Categories using FlashList */}
      <View className="flex-1">
        {categories.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-white/40 text-xl font-bold">Cargando canales...</Text>
          </View>
        ) : (
          <FlashList
            data={categories}
            renderItem={renderCategoryRow}
            keyExtractor={item => item.name}
            // @ts-ignore
            estimatedItemSize={220}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}
      </View>
    </View>
  );
}
