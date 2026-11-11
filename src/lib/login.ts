/** Usuário sem "@" (ex.: "Admin") vira um e-mail interno, porque o Supabase exige e-mail. */
export const LOGIN_DOMAIN = "dommafood.local";
export const toEmail = (v: string) => {
  const t = v.trim();
  return t.includes("@") ? t.toLowerCase() : `${t.toLowerCase()}@${LOGIN_DOMAIN}`;
};
export const displayLogin = (email: string) => (email.endsWith(`@${LOGIN_DOMAIN}`) ? email.split("@")[0] : email);
