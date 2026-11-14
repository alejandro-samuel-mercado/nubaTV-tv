import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Almacenamiento en memoria rápido y fallback si SecureStore falla o excede límite en Android TV
const memoryStorage = new Map<string, string>();
const CHUNK_PREFIX = "__chunked__:";
const CHUNK_SIZE = 1600;

const sanitizeKey = (key: string) => key.replace(/[^a-zA-Z0-9._-]/g, "_");

const rawSetSecure = async (k: string, v: string): Promise<void> => {
  const safeKey = sanitizeKey(k);
  if (typeof (SecureStore as any).setItemAsync === "function") {
    await (SecureStore as any).setItemAsync(safeKey, v);
    return;
  }
  if (typeof (SecureStore as any).setValueWithKeyAsync === "function") {
    await (SecureStore as any).setValueWithKeyAsync(safeKey, v);
  }
};

const rawGetSecure = async (k: string): Promise<string | null> => {
  const safeKey = sanitizeKey(k);
  if (typeof (SecureStore as any).getItemAsync === "function") {
    return await (SecureStore as any).getItemAsync(safeKey);
  }
  if (typeof (SecureStore as any).getValueForKeyAsync === "function") {
    return await (SecureStore as any).getValueForKeyAsync(safeKey);
  }
  return null;
};

const rawDeleteSecure = async (k: string): Promise<void> => {
  const safeKey = sanitizeKey(k);
  if (typeof (SecureStore as any).deleteItemAsync === "function") {
    await (SecureStore as any).deleteItemAsync(safeKey);
    return;
  }
  if (typeof (SecureStore as any).deleteValueWithKeyAsync === "function") {
    await (SecureStore as any).deleteValueWithKeyAsync(safeKey);
  }
};

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  memoryStorage.set(key, value);

  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Local storage is unavailable:", e);
    }
    return;
  }

  try {
    if (value.length <= CHUNK_SIZE) {
      await rawSetSecure(key, value);
    } else {
      const count = Math.ceil(value.length / CHUNK_SIZE);
      for (let i = 0; i < count; i++) {
        const slice = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await rawSetSecure(`${key}__c_${i}`, slice);
      }
      await rawSetSecure(key, `${CHUNK_PREFIX}${count}`);
    }
  } catch (error) {
    console.warn("[storage] SecureStore setItem failed, using memory:", error);
  }
};

export const getItemAsync = async (key: string): Promise<string | null> => {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key) ?? memoryStorage.get(key) ?? null;
    } catch (e) {
      console.warn("Local storage is unavailable:", e);
      return memoryStorage.get(key) ?? null;
    }
  }

  try {
    const raw = await rawGetSecure(key);
    if (raw !== null && raw !== undefined) {
      if (raw.startsWith(CHUNK_PREFIX)) {
        const count = parseInt(raw.slice(CHUNK_PREFIX.length), 10) || 0;
        const parts: string[] = [];
        for (let i = 0; i < count; i++) {
          const part = await rawGetSecure(`${key}__c_${i}`);
          if (part === null) return memoryStorage.get(key) ?? null;
          parts.push(part);
        }
        const joined = parts.join("");
        memoryStorage.set(key, joined);
        return joined;
      }
      memoryStorage.set(key, raw);
      return raw;
    }
  } catch (error) {
    console.warn("[storage] SecureStore getItem failed, falling back to memory:", error);
  }

  return memoryStorage.get(key) ?? null;
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  memoryStorage.delete(key);

  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Local storage is unavailable:", e);
    }
    return;
  }

  try {
    await rawDeleteSecure(key);
  } catch (error) {
    console.warn("[storage] SecureStore deleteItem failed:", error);
  }
};
