import { Loader2 } from "lucide-react";

/**
 * Page loading fallback for lazy-loaded routes
 * Optimized for minimal bundle size and fast render
 */
const PageLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

export default PageLoading;
