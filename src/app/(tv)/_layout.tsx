import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Home, Compass, Heart, LogOut, User as UserIcon } from 'lucide-react-native';
import { useGlobal } from '../../contexts/GlobalContext';

const NAV_ITEMS = [
  { name: 'index', label: 'Inicio', icon: Home, path: '/(tv)' },
  { name: 'explore', label: 'Explorar', icon: Compass, path: '/(tv)/explore' },
  { name: 'favorites', label: 'Favoritos', icon: Heart, path: '/(tv)/favorites' },
  { name: 'profile', label: 'Perfil', icon: UserIcon, path: '/(tv)/profile' },
];

export default function TvLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useGlobal();
  const [isSidebarFocused, setIsSidebarFocused] = useState(false);

  return (
    <View className="flex-1 bg-[#02050a] flex-row">
      {/* Sidebar Navigation */}
      <View 
        className={`h-full bg-black/60 border-r border-white/5 py-10 transition-all ${isSidebarFocused ? 'w-64 px-6' : 'w-24 px-0 items-center'} `}
      >
        <View className="mb-12 items-center">
          <Text className="text-2xl font-black text-white">
            {isSidebarFocused ? (
              <>Nuba<Text className="text-cyan-500">TV</Text></>
            ) : (
              <Text className="text-cyan-500">N</Text>
            )}
          </Text>
        </View>

        <View className="flex-1 space-y-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            
            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => router.replace(item.path as any)}
                onFocus={() => setIsSidebarFocused(true)}
                onBlur={() => setIsSidebarFocused(false)}
                className={`py-4 rounded-2xl flex-row items-center justify-center focus:bg-cyan-500/20 focus:border-cyan-500 focus:border-2 ${isActive ? 'bg-white/10' : ''}`}
                style={isSidebarFocused ? { paddingHorizontal: 16, justifyContent: 'flex-start' } : {}}
              >
                <Icon color={isActive ? '#22d3ee' : 'rgba(255,255,255,0.4)'} size={28} />
                {isSidebarFocused && (
                  <Text className={`ml-4 font-bold text-lg ${isActive ? 'text-white' : 'text-white/40'}`}>
                    {item.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={logout}
          onFocus={() => setIsSidebarFocused(true)}
          onBlur={() => setIsSidebarFocused(false)}
          className="py-4 rounded-2xl flex-row items-center justify-center focus:bg-red-500/20 focus:border-red-500 focus:border-2"
          style={isSidebarFocused ? { paddingHorizontal: 16, justifyContent: 'flex-start' } : {}}
        >
          <LogOut color="rgba(255,255,255,0.4)" size={28} />
          {isSidebarFocused && (
            <Text className="ml-4 font-bold text-lg text-white/40">Salir</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View className="flex-1 overflow-hidden relative">
        {/* Subtle Background Glow */}
        <View className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <Slot />
      </View>
    </View>
  );
}
