type ViteMetaEnv = {
  VITE_SITE_URL?: string;
};

// URL de produção para redirects de autenticação
// IMPORTANTE: Esta é a URL principal da aplicação publicada
const PRODUCTION_URL = "https://streamstar.lovable.app";

export function getSiteUrl(): string {
  const env = (import.meta as unknown as { env?: ViteMetaEnv }).env;
  const explicit = env?.VITE_SITE_URL;
  
  // Se estiver em ambiente de preview/dev, SEMPRE usar URL de produção para redirects de auth
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  
  // Detectar QUALQUER ambiente que não seja produção
  const isPreview = origin.includes("lovableproject.com") || 
                    origin.includes("localhost") || 
                    origin.includes("id-preview--") ||
                    origin.includes("-preview--") ||
                    (origin.includes("lovable.app") && origin !== PRODUCTION_URL);
  
  if (isPreview) {
    console.log("[SITE_URL] Preview detected, using production URL:", PRODUCTION_URL);
    return PRODUCTION_URL;
  }
  
  const base = (explicit || origin || PRODUCTION_URL).trim();
  return base.replace(/\/$/, "");
}

export const siteUrl = getSiteUrl();
