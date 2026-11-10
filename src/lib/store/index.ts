"use client";
import { createDemoStore } from "./demo";
import { createSupabaseStore } from "./supabase";
import type { Store } from "./types";

let store: Store | null = null;
export function getStore(): Store {
  if (!store) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    store = url && key ? createSupabaseStore(url, key) : createDemoStore();
  }
  return store;
}
export type { Store, AuthUser } from "./types";
