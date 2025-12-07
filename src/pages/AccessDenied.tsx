import { Link } from "react-router-dom";
import { ShieldX, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

const AccessDenied = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-destructive/10">
            <ShieldX className="h-16 w-16 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">403</h1>
          <h2 className="text-xl font-semibold text-foreground">
            {t.errors?.accessDenied || "Acesso Negado"}
          </h2>
          <p className="text-muted-foreground">
            {t.errors?.accessDeniedDescription || "Você não tem permissão para acessar esta página. Esta área é restrita a administradores."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <Link to="/" className="gap-2">
              <Home className="h-4 w-4" />
              {t.nav?.home || "Início"}
            </Link>
          </Button>
          <Button asChild>
            <Link to="/profile" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t.nav?.profile || "Meu Perfil"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
