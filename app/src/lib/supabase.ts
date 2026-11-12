// The one Supabase connection for the app. It only ever holds the public key; every permission
// is enforced by the database and the server functions, never by this app.
import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// On the iPad and phones the sign-in is kept in Apple's Keychain (SecureStore). A saved sign-in can be
// larger than one Keychain entry allows, so it is split into pieces.
const CHUNK = 1800;
const nativeStore = {
  async getItem(key: string) {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (!count) return null;
    let out = "";
    for (let i = 0; i < Number(count); i++) out += (await SecureStore.getItemAsync(`${key}.${i}`)) ?? "";
    return out;
  },
  async setItem(key: string, value: string) {
    await nativeStore.removeItem(key);
    const parts = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < parts; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${key}.n`, String(parts));
  },
  async removeItem(key: string) {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    for (let i = 0; i < Number(count ?? 0); i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

// On the website, "Remember me" keeps the sign-in in this browser; without it, closing the tab signs out.
const REMEMBER = "homework.remember";
function webArea(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REMEMBER) === "no" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}
const webStore = {
  getItem: (key: string) => webArea()?.getItem(key) ?? null,
  setItem: (key: string, value: string) => webArea()?.setItem(key, value),
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch { /* nothing saved */ }
  },
};

export function setRememberMe(remember: boolean) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBER, remember ? "yes" : "no");
  } catch { /* private window: nothing to remember */ }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === "web" ? webStore : nativeStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keep the sign-in fresh only while the app is open.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
