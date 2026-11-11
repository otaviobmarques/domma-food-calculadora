import type { AdminStats, AdminUser, FeeVersion, MenuItem, Profile, SourceCheck } from "../types";

export interface AuthUser { id: string; email: string }

export interface Store {
  mode: "demo" | "supabase";
  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (u: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(restaurant: string, email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  /** Link de acesso: define a senha e devolve o e-mail para entrar. */
  redeemAccessLink(token: string, password: string): Promise<string>;
  signOut(): Promise<void>;

  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Pick<Profile, "restaurant_name" | "plan_choice" | "custom_fees" | "ack_versions">>): Promise<Profile>;

  /** Todas as versões publicadas (histórico incluído). */
  listPublishedFees(): Promise<FeeVersion[]>;
  /** Avisa quando a tabela central muda (publicação nova). */
  subscribeFees(cb: () => void): () => void;

  listItems(): Promise<MenuItem[]>;
  saveItem(item: Partial<MenuItem> & Pick<MenuItem, "name" | "target_net">): Promise<MenuItem>;
  saveItems(items: MenuItem[]): Promise<void>;
  deleteItem(id: string): Promise<void>;

  admin: {
    listVersions(): Promise<FeeVersion[]>;
    saveVersion(v: Omit<FeeVersion, "id" | "created_at" | "published_at"> & { id?: string }): Promise<FeeVersion>;
    publishVersion(id: string): Promise<void>;
    deleteVersion(id: string): Promise<void>;
    stats(): Promise<AdminStats>;
    checkSources(): Promise<SourceCheck[]>;
    listUsers(): Promise<AdminUser[]>;
    createUser(email: string, restaurant: string, isAdmin: boolean): Promise<string>;
    setBlocked(id: string, blocked: boolean): Promise<void>;
    setAdmin(id: string, isAdmin: boolean): Promise<void>;
    deleteUser(id: string): Promise<void>;
    /** Gera um link de uso único (token) para o usuário criar a senha e entrar. */
    createAccessLink(id: string, hours?: number): Promise<string>;
  };
}
