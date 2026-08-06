import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useGlobal } from '../../contexts/GlobalContext';
import { LogOut, User as UserIcon, Calendar, Smartphone } from 'lucide-react-native';

export default function ProfileTvScreen() {
  const { user, logout } = useGlobal();

  const isExpired = user?.expiresAt && new Date(user.expiresAt) < new Date();

  return (
    <View className="flex-1 bg-transparent p-12">
      <View className="flex-row items-center mb-12 gap-4">
        <UserIcon color="#22d3ee" size={48} />
        <Text className="text-5xl font-black text-white">Mi Perfil</Text>
      </View>

      <View className="flex-1 max-w-[800px]">
        <View className="bg-white/5 p-10 rounded-3xl border border-white/10 flex-row items-center mb-8">
          <View className="w-32 h-32 bg-cyan-500/20 rounded-full items-center justify-center border border-cyan-500/50 mr-8">
            <UserIcon color="#22d3ee" size={64} />
          </View>
          <View>
            <Text className="text-white text-4xl font-black mb-2">{user?.username}</Text>
            <View className="bg-cyan-500/20 px-4 py-2 rounded-full self-start">
              <Text className="text-cyan-300 font-bold text-sm uppercase tracking-widest">{user?.role === 'admin' ? 'Administrador' : 'Usuario Pro'}</Text>
            </View>
          </View>
        </View>

        <View className="space-y-6 mb-12">
          <View className="flex-row items-center gap-6 bg-black/40 p-6 rounded-2xl border border-white/5">
            <Calendar color="rgba(255,255,255,0.4)" size={32} />
            <View>
              <Text className="text-white/40 text-sm font-bold uppercase mb-1">Vencimiento del Plan</Text>
              <Text className={`font-bold text-2xl ${isExpired ? 'text-red-400' : 'text-white'}`}>
                {user?.expiresAt ? new Date(user.expiresAt).toLocaleDateString() : 'Nunca'}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-6 bg-black/40 p-6 rounded-2xl border border-white/5">
            <Smartphone color="rgba(255,255,255,0.4)" size={32} />
            <View>
              <Text className="text-white/40 text-sm font-bold uppercase mb-1">Dispositivos Permitidos</Text>
              <Text className="text-white font-bold text-2xl">
                {user?.maxDevices || 1} pantallas simultáneas
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          onPress={logout}
          className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl flex-row items-center justify-center gap-4 focus:bg-red-500/30 focus:border-red-400 focus:border-4"
        >
          <LogOut color="#f87171" size={32} />
          <Text className="text-red-400 font-black text-2xl uppercase tracking-widest">Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
