import { getItemAsync, setItemAsync } from "./storage";

export const RECENT_CHANNELS_KEY = "@nubatv_recent_channels";
export const MAX_RECENT_CHANNELS = 16;

type RecentListener = (channelIds: string[]) => void;
const recentListeners = new Set<RecentListener>();

export async function getRecentChannelIds(): Promise<string[]> {
  try {
    const raw = await getItemAsync(RECENT_CHANNELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id) => typeof id === "string" && id.trim().length > 0);
    }
  } catch (err) {
    console.warn("[recentChannels] Error reading recent channels:", err);
  }
  return [];
}

export async function recordRecentChannel(channelId: string): Promise<string[]> {
  if (!channelId || typeof channelId !== "string") return [];
  try {
    const current = await getRecentChannelIds();
    const updated = [channelId, ...current.filter((id) => id !== channelId)].slice(
      0,
      MAX_RECENT_CHANNELS,
    );
    await setItemAsync(RECENT_CHANNELS_KEY, JSON.stringify(updated));
    recentListeners.forEach((fn) => {
      try {
        fn(updated);
      } catch {}
    });
    return updated;
  } catch (err) {
    console.warn("[recentChannels] Error saving recent channel:", err);
    return [];
  }
}

export function subscribeRecentChannels(cb: RecentListener): () => void {
  recentListeners.add(cb);
  return () => {
    recentListeners.delete(cb);
  };
}
