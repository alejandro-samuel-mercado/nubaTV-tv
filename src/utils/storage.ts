import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Almacenamiento en memoria como fallback si SecureStore falla en Android TV
const memoryStorage = new Map<string, string>();

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Local storage is unavailable:", e);
      memoryStorage.set(key, value);
    }
    return;
  }

  try {
    if (typeof (SecureStore as any).setItemAsync === "function") {
      await (SecureStore as any).setItemAsync(key, value);
      return;
    }

    if (typeof (SecureStore as any).setValueWithKeyAsync === "function") {
      await (SecureStore as any).setValueWithKeyAsync(key, value);
      return;
    }
  } catch (error) {
    console.warn("[storage] SecureStore setItem failed, falling back to memory:", error);
  }

  memoryStorage.set(key, value);
};

export const getItemAsync = async (key: string): Promise<string | null> => {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Local storage is unavailable:", e);
      return memoryStorage.get(key) ?? null;
    }
  }

  try {
    if (typeof (SecureStore as any).getItemAsync === "function") {
      return await (SecureStore as any).getItemAsync(key);
    }

    if (typeof (SecureStore as any).getValueForKeyAsync === "function") {
      return await (SecureStore as any).getValueForKeyAsync(key);
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
    if (typeof (SecureStore as any).deleteItemAsync === "function") {
      await (SecureStore as any).deleteItemAsync(key);
      return;
    }

    if (typeof (SecureStore as any).deleteValueWithKeyAsync === "function") {
      await (SecureStore as any).deleteValueWithKeyAsync(key);
      return;
    }
  } catch (error) {
    console.warn("[storage] SecureStore deleteItem failed:", error);
  }
};
