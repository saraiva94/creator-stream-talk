type ViteMetaEnv = {
  VITE_SITE_URL?: string;
};

export function getSiteUrl(): string {
  const env = (import.meta as unknown as { env?: ViteMetaEnv }).env;
  const explicit = env?.VITE_SITE_URL;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = (explicit || origin || "").trim();
  return base.replace(/\/$/, "");
}

export const siteUrl = getSiteUrl();
