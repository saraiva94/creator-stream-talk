type ViteMetaEnv = {
  VITE_SITE_URL?: string;
};

const PRODUCTION_URL = import.meta.env.VITE_SITE_URL || "https://streamstar.vercel.app";

export function getSiteUrl(): string {
  const env = (import.meta as unknown as { env?: ViteMetaEnv }).env;
  const explicit = env?.VITE_SITE_URL;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isPreview = origin.includes("localhost");

  if (isPreview) {
    return PRODUCTION_URL;
  }

  const base = (explicit || origin || PRODUCTION_URL).trim();
  return base.replace(/\/$/, "");
}

export const siteUrl = getSiteUrl();
