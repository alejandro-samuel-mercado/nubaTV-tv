import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const setItemAsync = async (key: string, value: string) => {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error("Local storage is unavailable:", e);
    }
    return;
  }

  if (typeof (SecureStore as any).setItemAsync === "function") {
    await (SecureStore as any).setItemAsync(key, value);
    return;
  }

  if (typeof (SecureStore as any).setValueWithKeyAsync === "function") {
    await (SecureStore as any).setValueWithKeyAsync(key, value);
    return;
  }

  throw new Error(
    "expo-secure-store does not expose a compatible storage API on this platform",
  );
};

export const getItemAsync = async (key: string) => {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error("Local storage is unavailable:", e);
      return null;
    }
  }

  if (typeof (SecureStore as any).getItemAsync === "function") {
    return await (SecureStore as any).getItemAsync(key);
  }

  if (typeof (SecureStore as any).getValueForKeyAsync === "function") {
    return await (SecureStore as any).getValueForKeyAsync(key);
  }

  return null;
};

export const deleteItemAsync = async (key: string) => {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Local storage is unavailable:", e);
    }
    return;
  }

  if (typeof (SecureStore as any).deleteItemAsync === "function") {
    await (SecureStore as any).deleteItemAsync(key);
    return;
  }

  if (typeof (SecureStore as any).deleteValueWithKeyAsync === "function") {
    await (SecureStore as any).deleteValueWithKeyAsync(key);
    return;
  }
};
