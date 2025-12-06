type ViteMetaEnv = {
  VITE_SITE_URL?: string;
};

// URL de produção para redirects de autenticação
const PRODUCTION_URL = "https://streamstar.vercel.app";

export function getSiteUrl(): string {
  const env = (import.meta as unknown as { env?: ViteMetaEnv }).env;
  const explicit = env?.VITE_SITE_URL;
  
  // Se estiver em ambiente de preview/dev, usar URL de produção para redirects de auth
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isPreview = origin.includes("lovableproject.com") || origin.includes("localhost");
  
  if (isPreview) {
    return PRODUCTION_URL;
  }
  
  const base = (explicit || origin || PRODUCTION_URL).trim();
  return base.replace(/\/$/, "");
}

export const siteUrl = getSiteUrl();
