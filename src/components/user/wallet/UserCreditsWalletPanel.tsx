import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RefreshCcw } from "lucide-react";
import { fetchCreditsBalance } from "@/lib/supabaseApi";
import { useLanguage } from "@/hooks/useLanguage";
import { logger } from "@/lib/logger";
import { openMercadoPagoCheckout } from "@/lib/mercadoPago";

const formatMinutes = (credits: number) => {
  // 180 credits = 30 minutes
  const minutes = Math.floor((credits / 180) * 30);
  return `${minutes} min`;
};

export const UserCreditsWalletPanel = () => {
  const { t } = useLanguage();
  const [balanceCredits, setBalanceCredits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPackage, setCheckoutPackage] = useState<number | null>(null);

  const buyCredits = async (credits: number) => {
    setCheckoutPackage(credits);
    setError(null);
    try {
      await openMercadoPagoCheckout("create-payment", { credits });
    } catch (error) {
      setError((error as Error).message);
      setCheckoutPackage(null);
    }
  };

  const fetchBalance = async () => {
    logger.credits.info('UserCreditsWalletPanel: Carregando saldo');
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        logger.credits.warn('Sem sessão ativa, não é possível carregar saldo');
        setBalanceCredits(0);
        return;
      }

      logger.credits.debug('Sessão encontrada', { userId: session.user.id });
      
      const data = await fetchCreditsBalance();
      const balance = data.balance_credits ?? data.creditBalance ?? 0;
      
      logger.credits.info('Saldo carregado na UI', { balance });
      setBalanceCredits(balance);
    } catch (err) {
      logger.credits.error('Erro ao carregar saldo na UI', {}, err as Error);
      const friendly = err instanceof Error ? err.message : "Error loading balance";
      setError(friendly);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    logger.credits.debug('UserCreditsWalletPanel montado');
    fetchBalance();
  }, []);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
        <div>
          <CardTitle className="text-lg sm:text-xl font-semibold">{t.credits.title}</CardTitle>
          <p className="text-xs sm:text-sm text-muted-foreground">{t.credits.balance}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchBalance} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t.common.error}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase text-muted-foreground">{t.credits.credits}</p>
            <p className="text-xl sm:text-2xl font-semibold">
              {isLoading || balanceCredits === null ? "..." : `${balanceCredits}`}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase text-muted-foreground">≈</p>
            <p className="text-xl sm:text-2xl font-semibold">
              {isLoading || balanceCredits === null ? "..." : formatMinutes(balanceCredits)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => buyCredits(180)} disabled={checkoutPackage !== null}>
            {t.credits.buy} 180 {t.credits.credits.toLowerCase()} · R$ 5,00
          </Button>
          <Button variant="outline" onClick={() => buyCredits(360)} disabled={checkoutPackage !== null}>
            {t.credits.buy} 360 {t.credits.credits.toLowerCase()} · R$ 9,00
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserCreditsWalletPanel;
