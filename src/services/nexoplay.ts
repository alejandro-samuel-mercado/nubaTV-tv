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

// Caché en memoria de alta velocidad + deduplicación de peticiones en vuelo
// para que cambiar entre páginas del menú lateral y entrar a detalles sea instantáneo (0ms)
const CACHE_TTL_MS = 15 * 60 * 1000;
const memoryCache = new Map<string, { ts: number; data: any }>();
const pageStateCache = new Map<string, { ts: number; data: any }>();
const inflightRequests = new Map<string, Promise<any>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached(key: string, data: any) {
  if (memoryCache.size > 250) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { ts: Date.now(), data });
}

export function getPageCache<T>(pageKey: string): T | null {
  const entry = pageStateCache.get(pageKey);
  if (!entry) return null;
  return entry.data as T;
}

export function setPageCache<T>(pageKey: string, data: T): void {
  pageStateCache.set(pageKey, { ts: Date.now(), data });
}

export function getHomepageSync(): NexoHomepageData | null {
  return getCached<NexoHomepageData>("homepage:es");
}

export async function getNexoToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken) return cachedToken;
  if (!forceRefresh) {
    try {
      const saved = await storageGet("nexo_token_tv");
      if (saved) {
        cachedToken = saved;
        return saved;
      }
    } catch {}
  } else {
    cachedToken = null;
  }
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
  const cacheKey = "homepage:es";
  const hit = getCached<NexoHomepageData>(cacheKey);
  if (hit) return hit;

  const existing = inflightRequests.get(cacheKey);
  if (existing) return existing;

  const req = (async () => {
    try {
      const res = await axios.get(
        `${NEXOPLAY_API_BASE}/api/content/homepage?lang=es`,
        { timeout: 10000 },
      );
      if (res.data?.success && res.data?.data) {
        setCached(cacheKey, res.data.data);
        return res.data.data;
      }
    } catch (e) {
      console.warn("Nexo homepage error:", e);
    } finally {
      inflightRequests.delete(cacheKey);
    }
    return { heroItems: [], featured: [], trending: [], recent: [] };
  })();

  inflightRequests.set(cacheKey, req);
  return req;
}

// Mapa oficial de nombres/slugs de género a sus IDs reales en NexoPlay API
const GENRE_NAME_TO_ID: Record<string, string> = {
  "acción": "cmoywh11k0008xcl6zo6gmt9t",
  "accion": "cmoywh11k0008xcl6zo6gmt9t",
  "animación": "cmoywh4rc000excl6ffu8fp29",
  "animacion": "cmoywh4rc000excl6ffu8fp29",
  "aventura": "cmoywu81r006geptr132ep87q",
  "ciencia ficción": "cmoywh3gn000cxcl621by2juo",
  "ciencia ficcion": "cmoywh3gn000cxcl621by2juo",
  "ciencia-ficción": "cmoywh3gn000cxcl621by2juo",
  "comedia": "cmoywh22d0009xcl6fxgc4vqn",
  "crimen": "cmoywr9j70007eptr8xrn0ei8",
  "documental": "cmoyx15nv00tieptr2iki8128",
  "drama": "cmoywh2rh000axcl683pj6eu0",
  "familia": "cmoywr6i70003eptrk5wk7ek2",
  "fantasía": "cmoyx53dc018aeptrc2kx49kj",
  "fantasia": "cmoyx53dc018aeptrc2kx49kj",
  "historia": "cmoywr7sz0005eptrwkm74yl5",
  "kids": "cmp5ch9ju02y28jz6fy4q0yhg",
  "infantil": "cmp5ch9ju02y28jz6fy4q0yhg",
  "misterio": "cmoywr7t40006eptr4pzd1vte",
  "música": "cmp2p4nuj021smsyvicmg92il",
  "musica": "cmp2p4nuj021smsyvicmg92il",
  "película de tv": "cmoywvjly0095eptr1nydcr5j",
  "pelicula de tv": "cmoywvjly0095eptr1nydcr5j",
  "romance": "cmoywh40c000dxcl652stwp3g",
  "suspense": "cmoywtaxc0032eptrir5wbuxb",
  "terror": "cmoywh332000bxcl6ex38pblc",
  "bélica": "cmoywx5i300cqeptrdz05hv9n",
  "belica": "cmoywx5i300cqeptrdz05hv9n",
  "western": "cmp2p63pb024emsyvkgjzakqd",
};

export interface ContentListParams {
  type?: string;
  search?: string;
  sort?: string;
  genre?: string;
  genreId?: string;
  limit?: number;
  page?: number;
}

function buildListQuery(params: ContentListParams): string {
  const query = new URLSearchParams();
  if (params.type) query.append("type", params.type);
  if (params.search) query.append("search", params.search);

  // En la API de NexoPlay, "releaseYear" ordena por año de estreno descendente (ej. 2026 primero),
  // mientras que "recent" ordena por fecha de inserción en base de datos.
  const resolvedSort =
    params.sort === "recent" ? "releaseYear" : params.sort;
  if (resolvedSort) query.append("sort", resolvedSort);

  const resolvedGenreId =
    params.genreId ||
    (params.genre
      ? params.genre.startsWith("cm")
        ? params.genre
        : GENRE_NAME_TO_ID[params.genre.trim().toLowerCase()]
      : undefined);

  if (resolvedGenreId) {
    query.append("genreId", resolvedGenreId);
  } else if (params.genre) {
    query.append("genre", params.genre);
  }

  if (params.limit) query.append("limit", String(Math.min(params.limit, 100)));
  if (params.page) query.append("page", String(params.page));

  return query.toString();
}

export function getContentListSync(params: ContentListParams): NexoContentItem[] | null {
  const qs = buildListQuery(params);
  return getCached<NexoContentItem[]>(`list:${qs}`);
}

export async function getContentList(params: ContentListParams): Promise<NexoContentItem[]> {
  try {
    const qs = buildListQuery(params);
    const cacheKey = `list:${qs}`;
    const hit = getCached<NexoContentItem[]>(cacheKey);
    if (hit) return hit;

    const existing = inflightRequests.get(cacheKey);
    if (existing) return existing;

    const req = (async () => {
      try {
        const res = await axios.get(
          `${NEXOPLAY_API_BASE}/api/content?${qs}`,
          { timeout: 10000 },
        );
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setCached(cacheKey, res.data.data);
          return res.data.data;
        }
      } catch (e) {
        console.warn("Nexo content list error:", e);
      } finally {
        inflightRequests.delete(cacheKey);
      }
      return [];
    })();

    inflightRequests.set(cacheKey, req);
    return req;
  } catch (e) {
    console.warn("Nexo content list error:", e);
  }
  return [];
}

// Precarga inteligente por sección para que todas las páginas del menú lateral
// respondan de inmediato (0ms) al entrar o cambiar de sección.
const preloadedRoutes = new Set<string>();

export function preloadRouteData(routeKey: string): void {
  if (preloadedRoutes.has(routeKey)) return;
  preloadedRoutes.add(routeKey);

  switch (routeKey) {
    case "home":
      getHomepage().catch(() => {});
      getContentList({ type: "MOVIE", limit: 45, sort: "recent" }).catch(() => {});
      getContentList({ type: "SERIES", limit: 45, sort: "recent" }).catch(() => {});
      getContentList({ type: "ANIME", limit: 45, sort: "recent" }).catch(() => {});
      break;
    case "movies":
      getContentList({ type: "MOVIE", sort: "popular", limit: 45 }).catch(() => {});
      getContentList({ type: "MOVIE", sort: "recent", limit: 45 }).catch(() => {});
      getContentList({ type: "MOVIE", sort: "rating", limit: 35 }).catch(() => {});
      getContentList({ type: "MOVIE", genreId: "cmoywh11k0008xcl6zo6gmt9t", limit: 35 }).catch(() => {});
      getContentList({ type: "MOVIE", genreId: "cmoywh22d0009xcl6fxgc4vqn", limit: 35 }).catch(() => {});
      getContentList({ type: "MOVIE", genreId: "cmoywh3gn000cxcl621by2juo", limit: 35 }).catch(() => {});
      break;
    case "series":
      getContentList({ type: "SERIES", sort: "popular", limit: 45 }).catch(() => {});
      getContentList({ type: "SERIES", sort: "recent", limit: 45 }).catch(() => {});
      getContentList({ type: "SERIES", sort: "rating", limit: 35 }).catch(() => {});
      getContentList({ type: "SERIES", genreId: "cmoywh2rh000axcl683pj6eu0", limit: 35 }).catch(() => {});
      getContentList({ type: "SERIES", genreId: "cmoywh22d0009xcl6fxgc4vqn", limit: 35 }).catch(() => {});
      getContentList({ type: "SERIES", page: 2, limit: 35 }).catch(() => {});
      break;
    case "anime":
      getContentList({ type: "ANIME", sort: "popular", limit: 45 }).catch(() => {});
      getContentList({ type: "ANIME", sort: "recent", limit: 45 }).catch(() => {});
      getContentList({ type: "ANIME", sort: "rating", limit: 35 }).catch(() => {});
      getContentList({ type: "MOVIE", genreId: "cmoywh4rc000excl6ffu8fp29", sort: "popular", limit: 45 }).catch(() => {});
      getContentList({ type: "MOVIE", genreId: "cmoywh4rc000excl6ffu8fp29", sort: "recent", limit: 45 }).catch(() => {});
      getContentList({ type: "ANIME", page: 2, limit: 35 }).catch(() => {});
      break;
    case "kids":
      getContentList({ type: "MOVIE", genreId: "cmoywh4rc000excl6ffu8fp29", sort: "recent", limit: 45 }).catch(() => {});
      getContentList({ type: "MOVIE", genreId: "cmoywh4rc000excl6ffu8fp29", sort: "popular", limit: 45 }).catch(() => {});
      getContentList({ type: "SERIES", genreId: "cmoywh4rc000excl6ffu8fp29", sort: "recent", limit: 45 }).catch(() => {});
      getContentList({ type: "SERIES", genreId: "cmp5ch9ju02y28jz6fy4q0yhg", sort: "recent", limit: 40 }).catch(() => {});
      getContentList({ genreId: "cmoywr6i70003eptrk5wk7ek2", sort: "recent", limit: 45 }).catch(() => {});
      getContentList({ genreId: "cmoywh4rc000excl6ffu8fp29", sort: "rating", limit: 45 }).catch(() => {});
      break;
    case "premieres":
      getContentList({ type: "MOVIE", sort: "recent", limit: 45 }).catch(() => {});
      getContentList({ type: "SERIES", sort: "recent", limit: 45 }).catch(() => {});
      getContentList({ type: "ANIME", sort: "recent", limit: 45 }).catch(() => {});
      getContentList({ type: "MOVIE", sort: "popular", limit: 45 }).catch(() => {});
      getContentList({ type: "SERIES", sort: "popular", limit: 45 }).catch(() => {});
      getContentList({ type: "ANIME", sort: "popular", limit: 45 }).catch(() => {});
      break;
    case "channels":
      getHomepage().catch(() => {});
      getContentList({ type: "MOVIE", sort: "popular", limit: 18 }).catch(() => {});
      break;
  }
}

let bgPreloadStarted = false;
export function startBackgroundPreload(): void {
  if (bgPreloadStarted) return;
  bgPreloadStarted = true;
  const order = ["home", "movies", "series", "premieres", "anime", "kids", "channels"];
  order.forEach((key, idx) => {
    setTimeout(() => {
      preloadRouteData(key);
    }, 350 + idx * 350);
  });
}

export async function getContentDetail(
  slug: string,
): Promise<NexoContentItem | null> {
  const cacheKey = `detail:${slug}`;
  const hit = getCached<NexoContentItem>(cacheKey);
  if (hit) return hit;

  const existing = inflightRequests.get(cacheKey);
  if (existing) return existing;

  const req = (async () => {
    try {
      const res = await axios.get(`${NEXOPLAY_API_BASE}/api/content/${slug}`, {
        timeout: 10000,
      });
      if (res.data?.success && res.data?.data) {
        setCached(cacheKey, res.data.data);
        return res.data.data;
      }
    } catch (e) {
      console.warn("Nexo detail error:", e);
    } finally {
      inflightRequests.delete(cacheKey);
    }
    return null;
  })();

  inflightRequests.set(cacheKey, req);
  return req;
}

export async function getWatchStream(slug: string, episodeId?: string) {
  const url = `${NEXOPLAY_API_BASE}/api/content/${slug}/watch${episodeId ? `?episodeId=${episodeId}` : ""}`;
  try {
    const token = await getNexoToken(false);
    const res = await axios.get(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 12000,
    });
    if (res.data?.success && res.data?.data) return res.data.data;
  } catch (e: any) {
    if (e?.response?.status === 401 || e?.response?.status === 403) {
      try {
        const freshToken = await getNexoToken(true);
        const retryRes = await axios.get(url, {
          headers: freshToken ? { Authorization: `Bearer ${freshToken}` } : {},
          timeout: 12000,
        });
        if (retryRes.data?.success && retryRes.data?.data) return retryRes.data.data;
      } catch (retryErr) {
        console.warn("Nexo watch stream retry error:", retryErr);
      }
    } else {
      console.warn("Nexo watch stream error:", e);
    }
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
