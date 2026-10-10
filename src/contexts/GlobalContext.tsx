import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const safeSetItem = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

const safeGetItem = async (key: string) => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
};

const safeRemoveItem = async (key: string) => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};


// Set to your API URL
export const API_URL = 'https://nubatv-api.unixxtech.online/api';

export interface Channel {
  id: string;
  name: string;
  logo: string | null;
  url: string;
  country: string;
  language: string;
  categoryId: string;
  playlistId: string | null;
  isActive: boolean;
  category?: { name: string };
  playlist?: { name: string; isDefault?: boolean };
  groupTitle?: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  expiresAt: string | null;
  isActive: boolean;
  maxDevices: number;
}

interface GlobalContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
  
  channels: Channel[];
  setChannels: (channels: Channel[]) => void;
  activeChannel: Channel | null;
  setActiveChannel: (channel: Channel | null) => void;
  
  playlists: string[];
  selectedPlaylist: string | null;
  setSelectedPlaylist: (playlist: string | null) => void;
  
  favorites: string[];
  toggleFavorite: (id: string) => void;
  
  loading: boolean;
  
  refreshAuth: () => Promise<void>;
  fetchChannels: () => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [playlists, setPlaylists] = useState<string[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize Auth & Interceptors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await logout();
        }
        return Promise.reject(error);
      }
    );

    refreshAuth();

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const refreshAuth = async () => {
    try {
      const storedToken = await safeGetItem('token');
      if (storedToken) {
        setToken(storedToken);
        const res = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        setUser(res.data);
      } else {
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.log('Error verifying session:', error);
      await safeRemoveItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/channels?limit=20000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const activeChannels = (res.data?.data || []).filter((c: Channel) => c.isActive);
      
      const uniquePlaylists = Array.from(new Set(activeChannels.map((c: Channel) => c.playlist?.name).filter(Boolean))) as string[];
      setPlaylists(uniquePlaylists);
      
      setChannels(activeChannels);
      if (activeChannels.length > 0 && !activeChannel) {
        setActiveChannel(activeChannels[0]);
      }
    } catch (error) {
      console.log('Error fetching channels:', error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchChannels();
    }
  }, [token]);

  // Load favorites
  useEffect(() => {
    safeGetItem('favorites').then(res => {
      if (res) setFavorites(JSON.parse(res));
    });
  }, []);

  const toggleFavorite = (id: string) => {
    const updated = favorites.includes(id) 
      ? favorites.filter(fId => fId !== id) 
      : [...favorites, id];
    setFavorites(updated);
    safeSetItem('favorites', JSON.stringify(updated));
  };

  const logout = async () => {
    await safeRemoveItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <GlobalContext.Provider value={{
      user, setUser, token, setToken, logout, refreshAuth,
      channels, setChannels, activeChannel, setActiveChannel,
      playlists, selectedPlaylist, setSelectedPlaylist,
      favorites, toggleFavorite,
      loading, fetchChannels
    }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobal() {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    throw new Error('useGlobal must be used within a GlobalProvider');
  }
  return context;
}
