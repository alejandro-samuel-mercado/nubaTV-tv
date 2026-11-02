import { getItemAsync, setItemAsync } from "./storage";

export const SETTINGS_STORAGE_KEY = "nubatv_tv_settings";

export type QualityMode = "Auto" | "HD" | "4K";
export type LayoutMode = "Lista" | "Cuadrícula";

export type AppSettings = {
  parentalLock: boolean;
  hideRestricted: boolean;
  compactMode: boolean;
  showMetaDetails: boolean;
  layoutMode: LayoutMode;
  autoPlayNext: boolean;
  subtitlesEnabled: boolean;
  defaultQuality: QualityMode;
  externalPlayer: boolean;
  integrations: {
    realDebrid: boolean;
    trakt: boolean;
    plex: boolean;
  };
};

export const defaultSettings: AppSettings = {
  parentalLock: false,
  hideRestricted: true,
  compactMode: false,
  showMetaDetails: true,
  layoutMode: "Cuadrícula",
  autoPlayNext: true,
  subtitlesEnabled: true,
  defaultQuality: "HD",
  externalPlayer: false,
  integrations: {
    realDebrid: false,
    trakt: false,
    plex: false,
  },
};

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const saved = await getItemAsync(SETTINGS_STORAGE_KEY);
    if (!saved) return defaultSettings;

    const parsed = JSON.parse(saved) as Partial<AppSettings>;
    return {
      ...defaultSettings,
      ...parsed,
      integrations: {
        ...defaultSettings.integrations,
        ...(parsed.integrations ?? {}),
      },
    };
  } catch (error) {
    console.log("Error parsing app settings:", error);
    return defaultSettings;
  }
}

export async function saveAppSettings(settings: AppSettings) {
  await setItemAsync(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function contentIsRestricted(contentRating?: string | null): boolean {
  if (!contentRating) return false;

  const normalized = contentRating.toUpperCase().replace(/\s+/g, "");
  if (["18+", "R18", "NC-17", "XXX", "X"].includes(normalized)) return true;
  if (/^1[89]$/.test(normalized)) return true;
  if (/^18\+$/.test(normalized)) return true;
  if (/^R|^AO$/.test(normalized)) return true;
  return false;
}
