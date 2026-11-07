import axios from "axios";
import { getItemAsync, setItemAsync } from "../utils/storage";

export const NEXOPLAY_API_BASE = "https://nexoplay-api.unixxtech.online";

const storageGet = async (key: string): Promise<string | null> => {
  return await getItemAsync(key);
};
const storageSet = async (key: string, val: string) => {
  await setItemAsync(key, val);
};

export interface NexoContentItem {
  id: string;
  slug: string;
  title: string;
  originalTitle?: string;
  description?: string;
  tagline?: string | null;
  type: "MOVIE" | "SERIES" | "DOCUMENTARY" | "ANIME" | string;
  releaseYear?: number;
  duration?: number;
  rating?: number;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  genres?: { id: string; name: string; slug: string }[];
  seasons?: any[];
  videoFiles?: any[];
  thumbnails?: { id: string; type: string; url: string }[];
  contentRating?: string;
  language?: string;
}

export interface NexoHomepageData {
  heroItems: NexoContentItem[];
  heroMode?: string;
  featured: NexoContentItem[];
  trending: NexoContentItem[];
  recent: NexoContentItem[];
}

let cachedToken: string | null = null;

export async function getNexoToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  try {
    const saved = await storageGet("nexo_token_tv");
    if (saved) {
      cachedToken = saved;
      return saved;
    }
  } catch {}
  try {
    const username = `tv_guest_${Date.now()}`;
    const res = await axios.post(`${NEXOPLAY_API_BASE}/api/auth/register`, {
      username,
      password: "NexoGuest2026!",
      asGuest: true,
    });
    const token = res.data?.data?.accessToken;
    if (token) {
      cachedToken = token;
      await storageSet("nexo_token_tv", token);
      return token;
    }
  } catch (e) {
    console.warn("Nexo token error:", e);
  }
  return "";
}

export async function getHomepage(): Promise<NexoHomepageData> {
  try {
    const res = await axios.get(
      `${NEXOPLAY_API_BASE}/api/content/homepage?lang=es`,
      { timeout: 10000 },
    );
    if (res.data?.success && res.data?.data) return res.data.data;
  } catch (e) {
    console.warn("Nexo homepage error:", e);
  }
  return { heroItems: [], featured: [], trending: [], recent: [] };
}

export async function getContentList(params: {
  type?: string;
  search?: string;
  sort?: string;
  genre?: string;
  genreId?: string;
  limit?: number;
  page?: number;
}): Promise<NexoContentItem[]> {
  try {
    const query = new URLSearchParams();
    if (params.type) query.append("type", params.type);
    if (params.search) query.append("search", params.search);
    if (params.sort) query.append("sort", params.sort);
    if (params.genre) query.append("genre", params.genre);
    if (params.genreId) query.append("genreId", params.genreId);
    if (params.limit) query.append("limit", String(params.limit));
    if (params.page) query.append("page", String(params.page));
    const res = await axios.get(
      `${NEXOPLAY_API_BASE}/api/content?${query.toString()}`,
      { timeout: 10000 },
    );
    if (res.data?.success && Array.isArray(res.data?.data))
      return res.data.data;
  } catch (e) {
    console.warn("Nexo content list error:", e);
  }
  return [];
}

export async function getContentDetail(
  slug: string,
): Promise<NexoContentItem | null> {
  try {
    const res = await axios.get(`${NEXOPLAY_API_BASE}/api/content/${slug}`, {
      timeout: 10000,
    });
    if (res.data?.success && res.data?.data) return res.data.data;
  } catch (e) {
    console.warn("Nexo detail error:", e);
  }
  return null;
}

export async function getWatchStream(slug: string, episodeId?: string) {
  try {
    const token = await getNexoToken();
    const url = `${NEXOPLAY_API_BASE}/api/content/${slug}/watch${episodeId ? `?episodeId=${episodeId}` : ""}`;
    const res = await axios.get(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 12000,
    });
    if (res.data?.success && res.data?.data) return res.data.data;
  } catch (e) {
    console.warn("Nexo watch stream error:", e);
  }
  return null;
}

export async function searchContent(query: string): Promise<NexoContentItem[]> {
  try {
    const res = await axios.get(
      `${NEXOPLAY_API_BASE}/api/content?search=${encodeURIComponent(query)}&limit=30`,
      { timeout: 10000 },
    );
    if (res.data?.success && Array.isArray(res.data?.data))
      return res.data.data;
  } catch (e) {
    console.warn("Nexo search error:", e);
  }
  return [];
}
