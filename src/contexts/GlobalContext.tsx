import axios from "axios";
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Platform } from "react-native";
import { getContentDetail, NexoContentItem } from "../services/nexoplay";
import { deleteItemAsync, getItemAsync, setItemAsync } from "../utils/storage";

const safeSetItem = async (key: string, value: string) => {
  await setItemAsync(key, value);
};

const safeGetItem = async (key: string) => {
  return await getItemAsync(key);
};

const safeRemoveItem = async (key: string) => {
  await deleteItemAsync(key);
};

// Set to your API URL
export const API_URL = "https://nubatv-api.unixxtech.online/api";

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
  role: "admin" | "user";
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
  favoriteChannelItems: Channel[];
  toggleFavorite: (idOrChannel: string | Channel) => void;

  vodFavorites: NexoContentItem[];
  isVodFavorite: (slugOrId?: string) => boolean;
  toggleVodFavorite: (item: NexoContentItem) => void;

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
  const [savedChannelSnapshots, setSavedChannelSnapshots] = useState<Channel[]>([]);
  const [vodFavorites, setVodFavorites] = useState<NexoContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const channelsRef = useRef<Channel[]>([]);
  channelsRef.current = channels;
  const activeChannelRef = useRef<Channel | null>(null);
  activeChannelRef.current = activeChannel;

  // Initialize Auth & Interceptors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const reqUrl = String(error?.config?.url || "");
        if (
          error.response?.status === 401 &&
          reqUrl.startsWith(API_URL) &&
          !reqUrl.includes("/auth/login")
        ) {
          await logout();
        }
        return Promise.reject(error);
      },
    );

    refreshAuth();

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const refreshAuth = async () => {
    try {
      const storedToken = await safeGetItem("token");
      if (storedToken) {
        setToken(storedToken);
        const res = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        setUser(res.data);
      } else {
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.log("Error verifying session:", error);
      await safeRemoveItem("token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;

    const registerTvDevice = async () => {
      try {
        await axios.post(
          `${API_URL}/tv/register`,
          {
            name: "NUBA-TV",
            platform: Platform.OS,
            ip: "local-network",
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (error) {
        console.log("TV registration failed:", error);
      }
    };

    registerTvDevice();
  }, [token]);

  const fetchChannels = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/channels?limit=20000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const activeChannels = (res.data?.data || [])
        .filter((c: Channel) => c.isActive)
        .map((c: Channel) => ({ ...c, id: String(c.id) }));

      const uniquePlaylists = Array.from(
        new Set(
          activeChannels.map((c: Channel) => c.playlist?.name).filter(Boolean),
        ),
      ) as string[];
      setPlaylists(uniquePlaylists);

      setChannels(activeChannels);
      if (activeChannels.length > 0 && !activeChannel) {
        setActiveChannel(activeChannels[0]);
      }
    } catch (error) {
      console.log("Error fetching channels:", error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchChannels();
    }
  }, [token]);

  // Load Channel & VOD favorites on mount
  useEffect(() => {
    (async () => {
      try {
        const [favsRaw, favChSnapshotsRaw, vodFavsRaw, legacyLocalFavsRaw] = await Promise.all([
          safeGetItem("favorites"),
          safeGetItem("favorite_channels_data"),
          safeGetItem("vod_favorites_data"),
          safeGetItem("local_favorites"),
        ]);

        if (favsRaw) {
          const parsedIds: string[] = JSON.parse(favsRaw);
          if (Array.isArray(parsedIds)) {
            setFavorites(parsedIds.map((id) => String(id)));
          }
        }

        if (favChSnapshotsRaw) {
          const parsedChs: Channel[] = JSON.parse(favChSnapshotsRaw);
          if (Array.isArray(parsedChs)) {
            setSavedChannelSnapshots(parsedChs.map((c) => ({ ...c, id: String(c.id) })));
          }
        }

        let loadedVodItems: NexoContentItem[] = [];
        if (vodFavsRaw) {
          const parsedVod: NexoContentItem[] = JSON.parse(vodFavsRaw);
          if (Array.isArray(parsedVod)) {
            loadedVodItems = parsedVod;
            setVodFavorites(parsedVod);
          }
        }

        // Migrar cualquier slug previamente guardado en "local_favorites"
        if (legacyLocalFavsRaw) {
          const legacySlugs: string[] = JSON.parse(legacyLocalFavsRaw);
          if (Array.isArray(legacySlugs) && legacySlugs.length > 0) {
            const existingSlugs = new Set(loadedVodItems.map((it) => it.slug));
            const missingSlugs = legacySlugs.filter((s) => s && !existingSlugs.has(s));
            if (missingSlugs.length > 0) {
              const fetched = await Promise.all(
                missingSlugs.map((slug) => getContentDetail(slug).catch(() => null)),
              );
              const validFetched = fetched.filter(Boolean) as NexoContentItem[];
              if (validFetched.length > 0) {
                const merged = [...loadedVodItems, ...validFetched];
                setVodFavorites(merged);
                safeSetItem("vod_favorites_data", JSON.stringify(merged));
              }
            }
          }
        }
      } catch (e) {
        console.warn("Error loading favorites:", e);
      }
    })();
  }, []);

  const toggleFavorite = useCallback((idOrChannel: string | Channel) => {
    const channelObj = typeof idOrChannel === "object" ? idOrChannel : null;
    const rawId = channelObj ? channelObj.id : idOrChannel;
    if (!rawId) return;
    const id = String(rawId);

    setFavorites((prev) => {
      const exists = prev.some((fId) => String(fId) === id);
      const updated = exists
        ? prev.filter((fId) => String(fId) !== id)
        : [...prev, id];
      safeSetItem("favorites", JSON.stringify(updated));

      setSavedChannelSnapshots((prevSnaps) => {
        if (exists) {
          const nextSnaps = prevSnaps.filter((c) => String(c.id) !== id);
          safeSetItem("favorite_channels_data", JSON.stringify(nextSnaps));
          return nextSnaps;
        }
        const resolved =
          channelObj ||
          (activeChannelRef.current && String(activeChannelRef.current.id) === id
            ? activeChannelRef.current
            : null) ||
          channelsRef.current.find((c) => String(c.id) === id) ||
          null;
        if (!resolved) return prevSnaps;
        const snapshot: Channel = {
          id: String(resolved.id),
          name: resolved.name,
          logo: resolved.logo,
          url: resolved.url,
          country: resolved.country || "",
          language: resolved.language || "",
          categoryId: resolved.categoryId || "",
          playlistId: resolved.playlistId || null,
          isActive: true,
          category: resolved.category,
          groupTitle: resolved.groupTitle,
        };
        const nextSnaps = [
          ...prevSnaps.filter((c) => String(c.id) !== id),
          snapshot,
        ];
        safeSetItem("favorite_channels_data", JSON.stringify(nextSnaps));
        return nextSnaps;
      });

      return updated;
    });
  }, []);

  const favoriteChannelItems = useMemo(() => {
    const favSet = new Set(favorites.map((id) => String(id)));
    const result: Channel[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const chId = String(ch.id);
      if (favSet.has(chId) && !seen.has(chId)) {
        seen.add(chId);
        result.push(ch);
      }
    }

    for (let i = 0; i < savedChannelSnapshots.length; i++) {
      const snap = savedChannelSnapshots[i];
      const snapId = String(snap.id);
      if (favSet.has(snapId) && !seen.has(snapId)) {
        seen.add(snapId);
        result.push(snap);
      }
    }

    return result;
  }, [channels, favorites, savedChannelSnapshots]);

  const vodFavKeySet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < vodFavorites.length; i++) {
      const it = vodFavorites[i];
      if (it.slug) set.add(String(it.slug));
      if (it.id) set.add(String(it.id));
    }
    return set;
  }, [vodFavorites]);

  const isVodFavorite = useCallback(
    (slugOrId?: string) => {
      if (!slugOrId) return false;
      return vodFavKeySet.has(String(slugOrId));
    },
    [vodFavKeySet],
  );

  const toggleVodFavorite = useCallback((item: NexoContentItem) => {
    if (!item || (!item.slug && !item.id)) return;
    const itemSlug = item.slug ? String(item.slug) : "";
    const itemId = item.id ? String(item.id) : "";

    setVodFavorites((prev) => {
      const exists = prev.some(
        (x) =>
          (itemSlug && String(x.slug) === itemSlug) ||
          (itemId && String(x.id) === itemId),
      );
      let updated: NexoContentItem[];
      if (exists) {
        updated = prev.filter(
          (x) =>
            !(
              (itemSlug && String(x.slug) === itemSlug) ||
              (itemId && String(x.id) === itemId)
            ),
        );
      } else {
        // Guardar versión compacta para almacenamiento eficiente
        const compactItem: NexoContentItem = {
          id: item.id,
          slug: item.slug,
          title: item.title,
          type: item.type,
          posterUrl: item.posterUrl,
          backdropUrl: item.backdropUrl,
          releaseYear: item.releaseYear,
          duration: item.duration,
          rating: item.rating,
          contentRating: item.contentRating,
          language: item.language,
          genres: item.genres?.slice(0, 2),
        };
        updated = [compactItem, ...prev];
      }

      safeSetItem("vod_favorites_data", JSON.stringify(updated));
      safeSetItem(
        "local_favorites",
        JSON.stringify(updated.map((u) => u.slug).filter(Boolean)),
      );
      return updated;
    });
  }, []);

  const logout = async () => {
    await safeRemoveItem("token");
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      setUser,
      token,
      setToken,
      logout,
      refreshAuth,
      channels,
      setChannels,
      activeChannel,
      setActiveChannel,
      playlists,
      selectedPlaylist,
      setSelectedPlaylist,
      favorites,
      favoriteChannelItems,
      toggleFavorite,
      vodFavorites,
      isVodFavorite,
      toggleVodFavorite,
      loading,
      fetchChannels,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      user,
      token,
      channels,
      activeChannel,
      playlists,
      selectedPlaylist,
      favorites,
      favoriteChannelItems,
      toggleFavorite,
      vodFavorites,
      isVodFavorite,
      toggleVodFavorite,
      loading,
    ],
  );

  return (
    <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>
  );
}

export function useGlobal() {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    throw new Error("useGlobal must be used within a GlobalProvider");
  }
  return context;
}
