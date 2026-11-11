"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getStore, type AuthUser, type Store } from "@/lib/store";
import { effectiveFee, pickCurrent, priceFor, totalRate, type EffectiveFee } from "@/lib/fees";
import { APPS, type AppId, type FeeVersion, type MenuItem, type Profile } from "@/lib/types";

interface Ctx {
  store: Store;
  ready: boolean;
  user: AuthUser | null;
  profile: Profile | null;
  published: FeeVersion[];
  current: Record<AppId, FeeVersion | null>;
  items: MenuItem[];
  /** apps cuja versão em vigor ainda não foi vista/confirmada pelo cliente */
  pending: AppId[];
  lastSync: Date | null;
  toast: string | null;
  fee(app: AppId, planKey?: string): EffectiveFee;
  ifoodRate(): number;
  refreshFees(opts?: { silent?: boolean }): Promise<AppId[]>;
  /** Botão "Buscar atualização": consulta a tabela central e devolve os apps com versão ainda não confirmada. */
  checkUpdates(): Promise<AppId[]>;
  ack(apps?: AppId[]): Promise<void>;
  updateProfile(patch: Parameters<Store["updateProfile"]>[0]): Promise<void>;
  reloadItems(): Promise<void>;
  recalcMenu(): Promise<number>;
  showToast(msg: string): void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fora do AppProvider");
  return c;
};

const AUTO_REFRESH_MS = 5 * 60 * 1000;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const store = useMemo(() => getStore(), []);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [published, setPublished] = useState<FeeVersion[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const publishedRef = useRef<FeeVersion[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const current = useMemo(() => {
    const out = {} as Record<AppId, FeeVersion | null>;
    for (const a of APPS) out[a.id] = pickCurrent(published, a.id);
    return out;
  }, [published]);

  const pending = useMemo(
    () => (profile ? APPS.map((a) => a.id).filter((id) => current[id] && profile.ack_versions?.[id] !== current[id]!.id) : []),
    [profile, current]
  );

  const fee = useCallback((app: AppId, planKey?: string) => effectiveFee(current[app], profile, app, planKey), [current, profile]);
  const ifoodRate = useCallback(() => { const f = fee("ifood"); return totalRate(f.commission, f.online); }, [fee]);

  /** Busca a tabela central. Retorna os apps que tiveram versão nova desde a última busca. */
  const refreshFees = useCallback(async (opts?: { silent?: boolean }) => {
    const list = await store.listPublishedFees();
    const before = publishedRef.current;
    const changed = APPS.map((a) => a.id).filter((id) => {
      const n = pickCurrent(list, id);
      const o = pickCurrent(before, id);
      return before.length > 0 && n && n.id !== o?.id;
    });
    publishedRef.current = list;
    setPublished(list);
    setLastSync(new Date());
    if (changed.length && !opts?.silent) {
      const names = changed.map((id) => APPS.find((a) => a.id === id)!.name).join(", ");
      showToast(`Taxas atualizadas: ${names}. Confira e recalcule o cardápio.`);
    }
    return changed;
  }, [store, showToast]);

  const checkUpdates = useCallback(async () => {
    await refreshFees({ silent: true });
    const list = publishedRef.current;
    return APPS.map((a) => a.id).filter((id) => {
      const c = pickCurrent(list, id);
      return c && profile?.ack_versions?.[id] !== c.id;
    });
  }, [refreshFees, profile]);

  const reloadItems = useCallback(async () => setItems(await store.listItems()), [store]);

  const updateProfile = useCallback(async (patch: Parameters<Store["updateProfile"]>[0]) => {
    setProfile(await store.updateProfile(patch));
  }, [store]);

  const ack = useCallback(async (apps?: AppId[]) => {
    if (!profile) return;
    const next = { ...profile.ack_versions };
    for (const id of apps ?? APPS.map((a) => a.id)) if (current[id]) next[id] = current[id]!.id;
    await updateProfile({ ack_versions: next });
  }, [profile, current, updateProfile]);

  /** Refaz o preço ideal de todos os itens com as taxas em vigor e confirma a versão do iFood. */
  const recalcMenu = useCallback(async () => {
    const rate = ifoodRate();
    const updated = items.map((i) => ({ ...i, ideal_price: priceFor(i.target_net, rate), ideal_rate: rate }));
    await store.saveItems(updated);
    setItems(updated);
    await ack(["ifood"]);
    return updated.length;
  }, [items, ifoodRate, store, ack]);

  // sessão
  useEffect(() => {
    let alive = true;
    store.getUser().then((u) => { if (alive) { setUser(u); if (!u) setReady(true); } });
    const off = store.onAuthChange((u) => setUser(u));
    return () => { alive = false; off(); };
  }, [store]);

  // carga inicial ao entrar
  useEffect(() => {
    if (!user) { setProfile(null); setItems([]); return; }
    let alive = true;
    setReady(false); // segura as telas até o perfil e as taxas chegarem
    (async () => {
      try {
        const [p, list, its] = await Promise.all([store.getProfile(), store.listPublishedFees(), store.listItems()]);
        if (!alive) return;
        publishedRef.current = list;
        setPublished(list);
        setItems(its);
        setLastSync(new Date());
        // primeiro acesso: considera a tabela atual como já vista
        const missing = APPS.map((a) => a.id).filter((id) => !p.ack_versions?.[id]);
        if (missing.length) {
          const ackv = { ...p.ack_versions };
          for (const id of missing) { const c = pickCurrent(list, id); if (c) ackv[id] = c.id; }
          setProfile(await store.updateProfile({ ack_versions: ackv }).catch(() => ({ ...p, ack_versions: ackv })));
        } else setProfile(p);
      } catch (e) {
        showToast((e as Error).message);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [user, store, showToast]);

  // atualização automática: tempo real + ao voltar para o app + a cada 5 min
  useEffect(() => {
    if (!user) return;
    const off = store.subscribeFees(() => { refreshFees().catch(() => {}); });
    const onFocus = () => { if (document.visibilityState === "visible") refreshFees().catch(() => {}); };
    document.addEventListener("visibilitychange", onFocus);
    const t = setInterval(() => refreshFees().catch(() => {}), AUTO_REFRESH_MS);
    return () => { off(); document.removeEventListener("visibilitychange", onFocus); clearInterval(t); };
  }, [user, store, refreshFees]);

  const value: Ctx = { store, ready, user, profile, published, current, items, pending, lastSync, toast,
    fee, ifoodRate, refreshFees, checkUpdates, ack, updateProfile, reloadItems, recalcMenu, showToast };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
